import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines, getDebtorClients, getCredentialStatus } from './database_ops';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';
import { OpenAI } from 'openai';

async function generateReportWithAI(prompt: string, systemInstruction?: string): Promise<string> {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // 1. Try OpenRouter (Gemini 2.5 Flash / 2.0 Flash)
    if (OPENROUTER_API_KEY) {
        try {
            console.log("📡 [Cron AI] Attempting OpenRouter...");
            const openai = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: OPENROUTER_API_KEY,
            });
            const response = await openai.chat.completions.create({
                model: 'google/gemini-2.5-flash',
                messages: [
                    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1500
            });
            if (response.choices?.[0]?.message?.content) {
                return response.choices[0].message.content;
            }
        } catch (e: any) {
            console.error("⚠️ [Cron AI] OpenRouter failed:", e.message);
        }
    }

    // 2. Try Groq (Llama 3.3 70b)
    if (GROQ_API_KEY) {
        try {
            console.log("📡 [Cron AI] Attempting Groq...");
            const openai = new OpenAI({
                baseURL: 'https://api.groq.com/openai/v1',
                apiKey: GROQ_API_KEY,
            });
            const response = await openai.chat.completions.create({
                model: 'llama-3.3-70b-specdec',
                messages: [
                    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1500
            });
            if (response.choices?.[0]?.message?.content) {
                return response.choices[0].message.content;
            }
        } catch (e: any) {
            try {
                const openai = new OpenAI({
                    baseURL: 'https://api.groq.com/openai/v1',
                    apiKey: GROQ_API_KEY,
                });
                const response = await openai.chat.completions.create({
                    model: 'mixtral-8x7b-32768',
                    messages: [
                        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 1500
                });
                if (response.choices?.[0]?.message?.content) {
                    return response.choices[0].message.content;
                }
            } catch (e2: any) {
                console.error("⚠️ [Cron AI] Groq failed:", e2.message);
            }
        }
    }

    // 3. Try Google Generative AI SDK (Gemini 2.0 Flash)
    if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('dummy')) {
        try {
            console.log("📡 [Cron AI] Attempting Google Generative AI SDK...");
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                ...(systemInstruction ? { systemInstruction } : {})
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (text) return text;
        } catch (e: any) {
            console.error("⚠️ [Cron AI] Google SDK failed:", e.message);
        }
    }

    throw new Error("No AI providers available or all of them failed");
}

export async function triggerProactiveReport(bot: Bot) {
    const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
    const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];

    try {
        const summary = await getDatabaseSummary();
        const deadlines = await getUpcomingDeadlines();

        // Fetch pending tasks from Supabase
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'Pendiente')
            .order('due_date', { ascending: true });

        let tasksList = "No hay tareas pendientes en la agenda hoy.";
        if (tasks && tasks.length > 0) {
            tasksList = tasks.map(t => `- [ ] ${t.title} (Vence: ${t.due_date || 'Sin fecha'})${t.description ? ` - ${t.description}` : ''}`).join('\n');
        }

        const systemPrompt = `Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es de madrugada (3:30 AM) y estás preparando el reporte operativo del día para el Comandante. Tu tarea es mandarle un resumen consolidado de la CARTERA ESTRATÉGICA y de su AGENDA DE TRABAJO usando estricto LENGUAJE TÉCNICO CONTABLE y TONO EJECUTIVO DE ALTA CONFIABILIDAD.`;
        const prompt = `
Contexto actual de la base de datos:
--- 
INFORMACIÓN CONSOLIDADA (RESUMEN ESTRATÉGICO):
${summary}

VENCIMIENTOS SRI (PRÓXIMOS 7 DÍAS):
${deadlines}

AGENDA DE TAREAS PENDIENTES:
${tasksList}
---

INSTRUCCIONES DE REDACCIÓN:
1. Comienza con un saludo breve y firme ("Comandante", "Santiago", "Reporte de operaciones listo").
2. Destaca el Health Score de la cartera y la Cartera por Cobrar inmediatamente.
3. Sé extremadamente específico sobre los tipos de obligaciones que vencen pronto.
4. Muestra un bloque con sus tareas pendientes para hoy, incitándolo de forma formal a resolverlas.
5. Identifica una oportunidad de gestión inmediata (ej: "Hoy podemos liquidar 3 declaraciones de IVA de la lista de prioridad").
6. Mantén un formato limpio, con uso de emojis profesionales y negritas estratégicas.
7. Termina con una pregunta de mando táctico (ej: "¿Damos luz verde a la gestión de cobros hoy?").

Genera el mensaje directamente para Telegram.
`;

        const aiResponse = await generateReportWithAI(prompt, systemPrompt);

        // BUG FIX: added parse_mode so *bold* and _italic_ markdown renders correctly in Telegram
        try {
            await bot.api.sendMessage(adminChatId, aiResponse, { parse_mode: 'Markdown' });
        } catch (markdownError) {
            console.warn("⚠️ Failed to send cron report with Markdown, falling back to plain text:", markdownError);
            await bot.api.sendMessage(adminChatId, aiResponse);
        }
        console.log("✅ Reporte proactivo enviado a Santiago.");
    } catch (error: any) {
        console.error("❌ Error en reporte proactivo:", error);
        try {
            await bot.api.sendMessage(adminChatId, `⚠️ Comandante, intenté generar tu reporte, pero hubo un error de conexión con la IA (${error.message}). Por favor, pídeme un 'resumen general' cuando puedas.`);
        } catch (e) {}
    }
}

export function startCronJobs(bot: Bot) {
    // Ejecutar todos los días a las 03:30 AM hora de Ecuador
    cron.schedule('30 3 * * *', async () => {
        console.log("⏰ Ejecutando reporte proactivo de madrugada (03:30 AM)...");
        await triggerProactiveReport(bot);
    }, {
        timezone: "America/Guayaquil"
    });

    console.log("✅ Baku Proactive CronJobs inicializado (Hora objetivo: 03:30 AM EC).");

    // Lunes Financiero: Reporte de deudores cada Lunes a las 08:00 AM hora de Ecuador
    cron.schedule('0 8 * * 1', async () => {
        console.log("⏰ Ejecutando reporte semanal de deudores (Lunes Financiero 08:00 AM)...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            const debtorReport = await getDebtorClients();
            
            const systemPrompt = `Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es lunes por la mañana (08:00 AM) y es momento de iniciar la cobranza semanal ("Lunes Financiero"). Tu misión es presentarle un resumen ejecutivo y motivador sobre la cartera vencida por cobrar, e instarlo a iniciar gestiones de recuperación de flujo.`;
            const prompt = `
Reporte actual de deudores de la base de datos:
---
${debtorReport}
---

Instrucciones de redacción:
1. Comienza de forma profesional y firme (ej: "Comandante, listos para recuperar flujo de caja esta semana" o "Lunes Financiero activado").
2. Explica de forma concisa quiénes son los principales deudores y cuánto suman los honorarios pendientes de cobrar. Incluye el nombre COMPLETO de cada deudor.
3. Sugiere enviar recordatorios a los clientes clave que tengan deudas mayores.
4. Recuérdale que puede pedirte: "Genera el mensaje de cobro para [nombre] por $[monto]" y tú generarás el WhatsApp listo para copiar.
5. Mantén un formato estructurado con emojis de finanzas y negritas estratégicas.
`;
            const aiResponse = await generateReportWithAI(prompt, systemPrompt);

            // BUG FIX: added parse_mode so *bold* and _italic_ markdown renders correctly in Telegram
            try {
                await bot.api.sendMessage(adminChatId, aiResponse, { parse_mode: 'Markdown' });
            } catch (markdownError) {
                console.warn("⚠️ Failed to send debtor report with Markdown, falling back to plain text:", markdownError);
                await bot.api.sendMessage(adminChatId, aiResponse);
            }
            console.log("✅ Reporte semanal de deudores enviado a Santiago.");
        } catch (error) {
            console.error("❌ Error en Lunes Financiero cron:", error);
        }
    }, {
        timezone: "America/Guayaquil"
    });

    // Copia de seguridad silenciosa a Google Sheets a la media noche
    cron.schedule('0 0 * * *', async () => {
        console.log("⏰ Ejecutando copia de seguridad automática a Google Sheets (00:00 AM)...");
        try {
            const { data: clients, error } = await supabase.from('clients').select('*').eq('is_deleted', false);
            if (error) throw error;
            if (clients && clients.length > 0) {
                await syncToSheets(clients);
                console.log(`✅ Backup completado en Google Sheets para ${clients.length} clientes.`);
            }
        } catch (e: any) {
            console.error("❌ Falló el backup nocturno en Google Sheets:", e.message);
        }
    }, {
        timezone: "America/Guayaquil"
    });

    // 🔐 Viernes Credencial: Alerta de claves SRI por caducar cada Viernes a las 09:00 AM
    cron.schedule('0 9 * * 5', async () => {
        console.log("⏰ Ejecutando revisión de credenciales SRI (Viernes 09:00 AM)...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            const credReport = await getCredentialStatus();
            // Only send if there are issues (report won't contain '✅ Credenciales SRI OK' if issues exist)
            if (!credReport.startsWith('✅ Credenciales SRI OK')) {
                const alertMsg = `🔐 *VIERNES CREDENCIAL — Alerta Automática*\n\n${credReport}\n\n_Santiago, revisa estas credenciales antes de que afecten las declaraciones. Baku._`;
                // BUG FIX: added parse_mode so *bold* and _italic_ markdown renders correctly in Telegram
                try {
                    await bot.api.sendMessage(adminChatId, alertMsg, { parse_mode: 'Markdown' });
                } catch (markdownError) {
                    console.warn("⚠️ Failed to send credentials alert with Markdown, falling back to plain text:", markdownError);
                    await bot.api.sendMessage(adminChatId, alertMsg);
                }
                console.log("✅ Alerta de credenciales enviada a Santiago.");
            } else {
                console.log("✅ Viernes Credencial: Sin alertas. Todas las claves OK.");
            }
        } catch (error) {
            console.error("❌ Error en Viernes Credencial cron:", error);
        }
    }, {
        timezone: "America/Guayaquil"
    });

    console.log("✅ Baku Elite CronJobs inicializados: 03:30 AM (Reporte), 08:00 AM Lunes (Financiero), 09:00 AM Viernes (Credenciales), 00:00 AM (Backup).");
}
