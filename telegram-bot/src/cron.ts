import cron from 'node-cron';
import { Bot, InlineKeyboard } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines, getCredentialStatus, convertMarkdownToTelegramHtml, generateDailyOperationalReport } from './database_ops';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';
import { searchEmails } from './gmail';
import { generateAiText } from './ai';
import { proponerCobranzaSemanal } from './cobranza_semanal';
import { revisarObligacionesAnualesEmpresas } from './empresas_recordatorios';
import { registrarEjecucion } from './estado';
import { enviarParte } from './parte_diario';
import { revisarRecordatorios } from './pendientes';

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

        // Sin «briefing» de IA (22-nov-2026): sumaba texto y hasta 5 s de espera.
        const finalMessage = operationalReport;

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
        registrarEjecucion('buzon');
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

    // 23-nov-2026: el reporte de las 03:30 se dejó de mandar solo. Su contenido
    // (claves, fichas, estado) va dentro del parte de las 07:45: UN mensaje por la
    // mañana, no dos que decían casi lo mismo. A mano sigue con /reporte.

    // Lunes Financiero 08:00: Baku arma la lista de deudores y PREGUNTA. Los correos salen sólo con un botón.
    cron.schedule('0 8 * * 1', async () => {
        console.log("⏰ Lunes Financiero (08:00): proponiendo la cobranza semanal...");
        registrarEjecucion('lunes');
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
        registrarEjecucion('backup');
        try {
            // Sólo lo que escribe syncToSheets. Antes era select('*'): bajaba ~16 MB de archivos
            // y no traía sri_declaraciones, así que la columna RENTA salía siempre «Pendiente».
            const { data: clients, error } = await supabase
                .from('clients')
                .select('ruc, name, regime, notes, sri_declaraciones(type, period, status)')
                .eq('is_deleted', false);
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

    // 23-nov-2026: «Viernes credencial» retirado: las claves que no entran salen
    // cada mañana en el parte (bloque «Claves y fichas»).

    console.log("✅ Baku Elite CronJobs inicializados: 03:30 AM (Reporte), 08:00 AM Lunes (Financiero), 09:00 AM Viernes (Credenciales), 00:00 AM (Backup).");
    // 🏢 Obligaciones anuales de sociedades: todos los días 08:30
    cron.schedule('30 8 * * *', async () => {
    console.log('⏰ Revisando obligaciones anuales de sociedades (08:30)...');
    registrarEjecucion('sociedades');
    const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
    const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
    try {
    const mensaje = await revisarObligacionesAnualesEmpresas();
    if (!mensaje) return;
    // parse_mode HTML: sin él, Telegram mostraba las etiquetas <i> tal cual.
    await bot.api.sendMessage(adminChatId, convertMarkdownToTelegramHtml(mensaje), { parse_mode: 'HTML' });
    } catch (error) {
    console.error('❌ Error en recordatorios de sociedades:', error);
    }
    }, {
    timezone: "America/Guayaquil"
    });

    // ☀️ Parte del día (lun–vie 07:45) y recordatorio de la tarde (17:00, sólo si algo vence hoy).
    // Avisa sólo a Santiago; no escribe a los clientes (src/parte_diario.ts).
    const adminParte = () => (process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180").replace(/['"]/g, '').split(',').map(id => id.trim())[0];
    cron.schedule('45 7 * * 1-5', async () => {
        registrarEjecucion('parte');
        try {
            await enviarParte(bot.api, adminParte(), 'manana');
        } catch (error) {
            console.error('❌ Error en el parte del día:', error);
        }
    }, { timezone: "America/Guayaquil" });
    // 📝 Recordatorios de pendientes con hora (cada 2 min, todos los días). Sólo a Santiago.
    cron.schedule('*/2 * * * *', async () => {
        registrarEjecucion('recordatorios');
        try {
            await revisarRecordatorios(bot.api, adminParte());
        } catch (error) {
            console.error('❌ Error en recordatorios de pendientes:', error);
        }
    }, { timezone: "America/Guayaquil" });
    cron.schedule('0 17 * * 1-5', async () => {
        registrarEjecucion('parte_tarde');
        try {
            await enviarParte(bot.api, adminParte(), 'tarde');
        } catch (error) {
            console.error('❌ Error en el recordatorio de la tarde:', error);
        }
    }, { timezone: "America/Guayaquil" });
}