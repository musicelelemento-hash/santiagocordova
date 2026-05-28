import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines, getDebtorClients } from './database_ops';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';

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

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es de madrugada (3:30 AM) y estás preparando el reporte operativo del día para el Comandante.
Tu tarea es mandarle un resumen consolidado de la CARTERA ESTRATÉGICA y de su AGENDA DE TRABAJO usando estricto LENGUAJE TÉCNICO CONTABLE y TONO EJECUTIVO DE ALTA CONFIABILIDAD.

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

    // Lunes Financiero: Reporte de deudores cada Lunes a las 08:00 AM hora de Ecuador
    cron.schedule('0 8 * * 1', async () => {
        console.log("⏰ Ejecutando reporte semanal de deudores (Lunes Financiero 08:00 AM)...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            const debtorReport = await getDebtorClients();
            
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `
Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es lunes por la mañana (08:00 AM) y es momento de iniciar la cobranza semanal ("Lunes Financiero").
Tu misión es presentarle un resumen ejecutivo y motivador sobre la cartera vencida por cobrar, e instarlo a iniciar gestiones de recuperación de flujo.

Reporte actual de deudores de la base de datos:
---
${debtorReport}
---

Instrucciones de redacción:
1. Comienza de forma profesional y firme (ej: "Comandante, listos para recuperar flujo de caja esta semana" o "Lunes Financiero activado").
2. Explica de forma concisa quiénes son los principales deudores y cuánto suman los honorarios pendientes de cobrar.
3. Sugiere enviar recordatorios a los clientes clave que tengan deudas mayores.
4. Mantén un formato estructurado con emojis de finanzas y negritas estratégicas.
`;
            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();

            await bot.api.sendMessage(adminChatId, aiResponse);
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
}
