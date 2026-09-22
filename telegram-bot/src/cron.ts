import cron from 'node-cron';
import { Bot } from 'grammy';
import { getDatabaseSummary, getUpcomingDeadlines, getDebtorClients, getDebtorClientsRaw, getCredentialStatus, convertMarkdownToTelegramHtml, generateDailyOperationalReport } from './database_ops';
import { syncToSheets } from './google-sync';
import { supabase } from './supabase';
import { searchEmails, sendEmail } from './gmail';
import { generateAiText } from './ai';

// Generación de texto con cascada unificada (ver src/ai.ts).

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

        try {
            await bot.api.sendMessage(targetChatId, finalMessage, { parse_mode: 'HTML' });
        } catch (htmlError) {
            console.warn("⚠️ Error enviando HTML en reporte proactivo, enviando sin tags:", htmlError);
            await bot.api.sendMessage(targetChatId, finalMessage.replace(/<[^>]+>/g, ''));
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

    // Lunes Financiero: Reporte de deudores cada Lunes a las 08:00 AM hora de Ecuador
    cron.schedule('0 8 * * 1', async () => {
        console.log("⏰ Ejecutando reporte semanal de deudores (Lunes Financiero 08:00 AM)...");
        const rawIds = process.env.TELEGRAM_ALLOWED_USER_IDS || "1879067180";
        const adminChatId = rawIds.replace(/['"]/g, '').split(',').map(id => id.trim())[0];
        try {
            const debtors = await getDebtorClientsRaw();
            
            // Envío de correos automáticos a clientes con email y deuda > 0
            let emailsSent = 0;
            for (const debtor of debtors) {
                if (debtor.email && debtor.clientDebt > 0) {
                    const subject = `Recordatorio de Honorarios Pendientes - Soluciones Contables Pro`;
                    const body = `Estimado/a ${debtor.name},\n\nEspero que se encuentre excelente.\n\nEl presente correo es un recordatorio cordial de que mantiene un saldo pendiente por servicios contables y declaraciones SRI por el valor de $${debtor.clientDebt}.\n\nPor favor, realizar el pago a la brevedad posible para mantener sus obligaciones fiscales al día y evitar recargos o multas del SRI.\n\nAtentamente,\nSoluciones Contables Pro`;
                    try {
                        await sendEmail(adminChatId, debtor.email, subject, body);
                        emailsSent++;
                    } catch (e) {
                        console.error(`Error enviando correo de cobro a ${debtor.email}:`, e);
                    }
                }
            }

            const debtorReport = await getDebtorClients();
            
            const systemPrompt = `Eres Baku, el asistente fiscal de élite de Santiago Cordova. Es lunes por la mañana (08:00 AM) y es momento de iniciar la cobranza semanal ("Lunes Financiero"). Tu misión es presentarle un resumen ejecutivo y motivador sobre la cartera vencida por cobrar, e instarlo a iniciar gestiones de recuperación de flujo. Además, menciona que el sistema Baku ha enviado ${emailsSent} correos de cobro automáticamente.`;
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
5. Mantén un formato limpio, estructurado con emojis de finanzas y negritas estratégicas.
6. El reporte de cobranza debe ser extremadamente conciso. La longitud del reporte NO DEBE superar los 3000 caracteres.
`;
            const aiResponse = await generateAiText({ prompt, systemInstruction: systemPrompt });
            const htmlResponse = convertMarkdownToTelegramHtml(aiResponse);

            try {
                await bot.api.sendMessage(adminChatId, htmlResponse, { parse_mode: 'HTML' });
            } catch (htmlError) {
                console.warn("⚠️ Failed to send debtor report with HTML, falling back to plain text:", htmlError);
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
