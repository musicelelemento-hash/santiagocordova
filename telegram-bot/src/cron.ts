import cron from 'node-cron';
import { Bot, InlineKeyboard } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines, getCredentialStatus, convertMarkdownToTelegramHtml, generateDailyOperationalReport } from './database_ops';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';
import { searchEmails } from './gmail';
import { generateAiText } from './ai';
import { proponerCobranzaSemanal } from './cobranza_semanal';

// Generación de texto con cascada unificada (ver src/ai.ts).

export function buildOperationalReportKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('🔑 Resolver Claves SRI', 'baku_mgmt:missing_keys')
        .text('💰 Deudores & Mora', 'baku_page_debt:1').row()
        .text('⏰ Ver Vencimientos', 'baku_nav:deadlines')
        .text('🧰 Gestión Interna', 'baku_hub:internal_mgmt').row()
        .text('🏠 Menú Principal', 'baku_nav:home');
}

export async function triggerProactiveReport(bot: Bot, chatId?: string) {
    const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
    const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
    const targetChatId = chatId || adminChatId;

    try {
        console.log(`⏰ Generando reporte proactivo operativo para chat ${targetChatId}...`);
        const operationalReport = await generateDailyOperationalReport();

        let finalMessage = operationalReport;

        // Opcional: intentar enriquecer con un briefing ejecutivo de IA si está disponible
        try {
            const systemPrompt = `Eres Baku, el asistente fiscal de élite de Santiago Cordova. Redacta un saludo militar/ejecutivo matutino de máximo 2 líneas destacando la acción prioritaria del día para el despacho contable.`;
            const prompt = `Reporte operativo consolidado:\n${operationalReport}\n\nGenera un saludo y recomendación ejecutiva concisa.`;
            
            // Timeout de 5s para que no bloquee ni cause demoras
            const aiIntro = await Promise.race([
                generateAiText({ prompt, systemInstruction: systemPrompt }),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), 5000))
            ]);

            if (aiIntro && aiIntro.trim().length > 10) {
                const formattedIntro = convertMarkdownToTelegramHtml(aiIntro.trim());
                finalMessage = `🫡 <b>BRIEFING EJECUTIVO:</b>\n${formattedIntro}\n\n${operationalReport}`;
            }
        } catch (aiError: any) {
            console.warn("ℹ️ IA en reposo o con timeout. Enviando reporte nativo de Supabase:", aiError.message);
            // Sin problemas: finalMessage ya tiene el reporte estructurado
        }

        const reportKb = buildOperationalReportKeyboard();

        try {
            await bot.api.sendMessage(targetChatId, finalMessage, { parse_mode: 'HTML', reply_markup: reportKb });
        } catch (htmlError) {
            console.warn("⚠️ Error enviando HTML en reporte proactivo, enviando sin tags:", htmlError);
            await bot.api.sendMessage(targetChatId, finalMessage.replace(/<[^>]+>/g, ''), { reply_markup: reportKb });
        }
        console.log(`✅ Reporte proactivo enviado a chat ${targetChatId}.`);
    } catch (error: any) {
        console.error("❌ Error en reporte proactivo:", error);
        try {
            await bot.api.sendMessage(targetChatId, `⚠️ <b>Error al consultar base de datos:</b> ${error.message}`, { parse_mode: 'HTML' });
        } catch (e) {}
    }
}

export function startCronJobs(bot: Bot) {
    // Monitoreo SRI Proactivo: 9 AM, 2 PM, 6 PM Lunes a Viernes
    cron.schedule('0 9,14,18 * * 1-5', async () => {
        console.log("⏰ Ejecutando monitoreo proactivo del Buzón SRI...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            const emails = await searchEmails(adminChatId, "from:sri.gob.ec is:unread", 5);
            if (!emails.includes("No se encontraron correos") && !emails.includes("no está autorizado") && !emails.includes("Error")) {
                const systemPrompt = "Eres Baku. Analiza estos correos del SRI y haz un resumen ejecutivo súper corto y directo para Santiago. Enumera de qué clientes son y si hay algo urgente (multas, glosas, claves).";
                const prompt = `Correos sin leer del SRI:\n${emails}\n\nResume lo más importante y dime si requiere acción inmediata.`;
                const aiResponse = await generateAiText({ prompt, systemInstruction: systemPrompt });
                
                const htmlResponse = convertMarkdownToTelegramHtml(`🚨 *ALERTA BUZÓN SRI*\n\n${aiResponse}`);
                try {
                    await bot.api.sendMessage(adminChatId, htmlResponse, { parse_mode: 'HTML' });
                } catch (e) {
                    await bot.api.sendMessage(adminChatId, `🚨 *ALERTA BUZÓN SRI*\n\n${aiResponse}`);
                }
            } else {
                console.log("✅ Monitoreo SRI: Sin novedades urgentes.");
            }
        } catch (error) {
            console.error("❌ Error en Monitoreo SRI cron:", error);
        }
    }, {
        timezone: "America/Guayaquil"
    });

    // Ejecutar todos los días a las 03:30 AM hora de Ecuador
    cron.schedule('30 3 * * *', async () => {
        console.log("⏰ Ejecutando reporte proactivo de madrugada (03:30 AM)...");
        await triggerProactiveReport(bot);
    }, {
        timezone: "America/Guayaquil"
    });

    console.log("✅ Baku Proactive CronJobs inicializado (Hora objetivo: 03:30 AM EC).");

    // Lunes Financiero 08:00: Baku arma la lista de deudores y PREGUNTA. Los correos salen sólo con un botón.
    cron.schedule('0 8 * * 1', async () => {
        console.log("⏰ Lunes Financiero (08:00): proponiendo la cobranza semanal...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            await proponerCobranzaSemanal(bot, adminChatId);
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
                const htmlAlertMsg = convertMarkdownToTelegramHtml(alertMsg);
                
                try {
                    await bot.api.sendMessage(adminChatId, htmlAlertMsg, { parse_mode: 'HTML' });
                } catch (htmlError) {
                    console.warn("⚠️ Failed to send credentials alert with HTML, falling back to plain text:", htmlError);
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
