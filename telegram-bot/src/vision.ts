import { GoogleGenerativeAI } from '@google/generative-ai';
import { findClients, getDebtorClients, markPaymentAsPaid } from './database_ops';

/**
 * Extracts payment information from a receipt image and attempts to reconcile it.
 */
export async function processPaymentReceipt(buffer: Buffer, mimeType: string): Promise<{ success: boolean, message: string }> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set for OCR processing.");
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    Eres un asistente contable analizando un comprobante de transferencia bancaria.
    Extrae la siguiente información en estricto formato JSON (sin markdown, solo el JSON):
    {
        "clientName": "Nombre de la persona o empresa que realiza la transferencia",
        "amount": "Monto numérico exacto en USD (ej. 15.50)",
        "date": "Fecha del pago",
        "bank": "Banco de origen o destino"
    }
    Si no logras identificar algo, pon null.
    `;

    const imagePart = {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    
    let extracted: any;
    try {
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        extracted = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error("Fallo al interpretar los datos del recibo con Gemini: " + text);
    }

    if (!extracted.clientName) {
        return { success: false, message: "⚠️ OCR: No pude extraer el nombre del cliente en el comprobante." };
    }

    // 1. Find the client in our DB
    // We only use the first two words to improve matching (e.g. "William Cuenca" instead of full names)
    const searchName = extracted.clientName.split(' ').slice(0, 2).join(' ');
    const clients = await findClients(searchName, '*');
    
    if (clients.length === 0) {
        return { success: false, message: `⚠️ OCR: Extraje el nombre "${extracted.clientName}" ($${extracted.amount}), pero no encontré ningún cliente coincidente en la base de datos.` };
    }

    if (clients.length > 1) {
        return { success: false, message: `⚠️ OCR: Encontré el recibo de "${extracted.clientName}" por $${extracted.amount}, pero hay múltiples clientes que coinciden con ese nombre.` };
    }

    const client = clients[0];

    // Note: Since we don't know the exact period the user wants to pay for just from the receipt,
    // we could either ask them or mark a generic 'HONORARIOS' if we implement that.
    // Let's assume we want to mark the latest pending IVA declaration as paid.
    // Or we can return success and ask the user to confirm the period.
    
    // For now, let's create a pending dialog state logic, but since we are inside a pure function,
    // we'll just return the proposed action for the caller to handle.

    return { 
        success: true, 
        message: `✅ OCR Exitoso: Se detectó un pago de **$${extracted.amount}** de **${client.name}** el ${extracted.date} (${extracted.bank}).\n\n¿Deseas registrar este pago de honorarios ahora? Responde "registra pago de ${client.name}".`
    };
}
