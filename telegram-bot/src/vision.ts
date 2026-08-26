import { GoogleGenerativeAI } from '@google/generative-ai';
import { findClients } from './database_ops';
import { OpenAI } from 'openai';

export interface OcrReceiptData {
    clientName: string | null;
    amount: number | null;
    date: string | null;
    bank: string | null;
    reference?: string | null;
}

export interface ProcessPaymentReceiptResult {
    success: boolean;
    message: string;
    client?: any;
    extracted?: OcrReceiptData;
    candidates?: any[];
}

/**
 * Extracts payment information from a receipt image (transfer receipt)
 * and matches it against clients in Supabase.
 */
export async function processPaymentReceipt(buffer: Buffer, mimeType: string): Promise<ProcessPaymentReceiptResult> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    const prompt = `
    Eres un asistente contable de élite analizando un comprobante de transferencia bancaria de Ecuador (Banco Pichincha, Guayaquil, Bolivariano, Pacífico, Produbanco, Cooperativa JEP, Deuna, etc.).
    Extrae la siguiente información en estricto formato JSON (sin bloques de código markdown, solo el objeto JSON plano):
    {
        "clientName": "Nombre completo de la persona u ordenante que realiza la transferencia",
        "amount": 15.50,
        "date": "Fecha del comprobante (ej: 25/08/2026)",
        "bank": "Nombre del banco de origen o destino",
        "reference": "Número de comprobante, referencia o autorización si está visible"
    }
    Si un campo no está claro, pon null. El campo "amount" debe ser un número float.
    `;

    let text = '';

    // 1. Try Google Generative AI SDK (Gemini 2.5 Flash / 2.0 Flash)
    if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('dummy')) {
        try {
            console.log("📡 [Vision OCR] Analizando comprobante con Google Generative AI...");
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const imagePart = {
                inlineData: {
                    data: buffer.toString("base64"),
                    mimeType: mimeType || "image/jpeg"
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            text = result.response.text();
        } catch (e: any) {
            console.warn("⚠️ [Vision OCR] Gemini SDK error, intentando fallback:", e.message);
        }
    }

    // 2. Fallback via OpenRouter
    if (!text && OPENROUTER_API_KEY) {
        try {
            console.log("📡 [Vision OCR] Analizando comprobante vía OpenRouter...");
            const openai = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: OPENROUTER_API_KEY,
            });

            const base64Data = buffer.toString('base64');
            const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

            const response = await openai.chat.completions.create({
                model: 'google/gemini-2.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: dataUrl } }
                        ] as any
                    }
                ]
            });

            text = response.choices?.[0]?.message?.content || '';
        } catch (e: any) {
            console.error("❌ [Vision OCR] OpenRouter fallback error:", e.message);
        }
    }

    if (!text) {
        return {
            success: false,
            message: "⚠️ OCR: No se pudo procesar la imagen del comprobante con los modelos de visión."
        };
    }

    let extracted: OcrReceiptData;
    try {
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        extracted = JSON.parse(jsonStr);
    } catch (e) {
        return {
            success: false,
            message: "⚠️ OCR: El modelo no devolvió un JSON legible. Respuesta: " + text.substring(0, 100)
        };
    }

    if (!extracted.clientName && !extracted.amount) {
        return {
            success: false,
            message: "⚠️ OCR: No logré extraer el nombre del cliente ni el monto de la transferencia."
        };
    }

    // 3. Search client in database
    const rawName = (extracted.clientName || '').trim();
    const searchTokens = rawName.split(' ').filter(p => p.length > 2).slice(0, 3).join(' ');
    const clients = searchTokens ? await findClients(searchTokens, '*') : [];

    const amountFormatted = extracted.amount ? `$${Number(extracted.amount).toFixed(2)}` : 'monto no especificado';
    const dateFormatted = extracted.date || 'fecha reciente';
    const bankFormatted = extracted.bank ? ` (${extracted.bank})` : '';

    if (clients.length === 0) {
        return {
            success: true,
            extracted,
            message: `🧾 <b>Comprobante Detectado</b>\n\n` +
                     `👤 <b>Pagador:</b> ${rawName || 'Desconocido'}\n` +
                     `💰 <b>Monto:</b> ${amountFormatted}\n` +
                     `📅 <b>Fecha:</b> ${dateFormatted}${bankFormatted}\n\n` +
                     `⚠️ <i>No encontré un cliente registrado con ese nombre en la base de datos. Puedes buscarlo manualmente con <code>/menu</code> o escribir su nombre.</i>`
        };
    }

    if (clients.length === 1) {
        const client = clients[0];
        return {
            success: true,
            client,
            extracted,
            message: `✅ <b>Comprobante Bancario Detectado</b>\n\n` +
                     `👤 <b>Cliente:</b> <b>${client.name}</b>\n` +
                     (client.trade_name ? `🏢 <b>Comercial:</b> ${client.trade_name}\n` : '') +
                     `🆔 <b>RUC:</b> <code>${client.ruc}</code>\n` +
                     `💰 <b>Monto Transferido:</b> <b>${amountFormatted}</b>\n` +
                     `📅 <b>Fecha:</b> ${dateFormatted}${bankFormatted}\n\n` +
                     `¿Deseas registrar este pago de honorarios ahora en Supabase?`
        };
    }

    return {
        success: true,
        candidates: clients,
        extracted,
        message: `🔍 <b>Comprobante Bancario Detectado</b>\n\n` +
                 `👤 <b>Nombre en Comprobante:</b> ${rawName}\n` +
                 `💰 <b>Monto:</b> <b>${amountFormatted}</b>\n` +
                 `📅 <b>Fecha:</b> ${dateFormatted}${bankFormatted}\n\n` +
                 `Encontré <b>${clients.length}</b> clientes coincidentes. Selecciona el correcto para registrar el pago:`
    };
}
