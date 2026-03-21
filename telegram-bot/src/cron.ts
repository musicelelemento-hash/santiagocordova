import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines } from './database_ops';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';

export async function triggerProactiveReport(bot: Bot) {
    const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
    const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];

    try {
        const summary = await getDatabaseSummary();
        const deadlines = await getUpcomingDeadlines();

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es de madrugada (3:30 AM) y estás preparando el reporte operativo del día.
Tu tarea es mandarle un reporte inicial proactivo a Santiago usando estricto LENGUAJE TÉCNICO CONTABLE.

Toma la información de las obligaciones y conviértela en un mensaje ejecutivo directo.
REGLA CRÍTICA: Debes ser extremadamente específico sobre el TIPO de obligación. No digas "2 vencimientos", debes decir exactamente de qué son (ej: "2 vencimientos críticos de IVA Mensual" o "1 vencimiento de Impuesto a la Renta Régimen General"). 
Habla en términos de "cartera por cobrar", "obligaciones tributarias", "declaraciones", "honorarios contables".

Información de la base de datos hoy:
--- 
RESUMEN DE CARTERA Y OBLIGACIONES:
${summary}

VENCIMIENTOS SRI (PRÓXIMOS 7 DÍAS):
${deadlines}
---

Escribe el mensaje directamente como se lo enviarás a la app de Telegram de Santiago. Mantén un tono sumamente proactivo, contable y resolutivo. Termina preguntando qué frente de acción priorizamos hoy.
`;

        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();

        await bot.api.sendMessage(adminChatId, aiResponse);
        console.log("✅ Reporte proactivo enviado a Santiago.");
    } catch (error) {
        console.error("❌ Error en reporte proactivo:", error);
        try {
            await bot.api.sendMessage(adminChatId, "⚠️ Comandante, intenté generar tu reporte, pero hubo un error de conexión con la IA. Por favor, pídeme un 'resumen general' cuando puedas.");
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
}
