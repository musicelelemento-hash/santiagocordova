import { Bot, InlineKeyboard, InputFile } from 'grammy';
require('dotenv').config();
import { processChatWithAgentLoop, BOT_NAME, STATUS_ICON } from './agent';
import { clearChatHistory, saveMessage } from './database';
import { getAuthUrl, setTokenFromCode } from './gmail';
import express from 'express';
import { transcribeAudioUrl, textToSpeech, updateVoiceConfig, getVoiceStatus } from './voice';
import { validateSRIPDF, ValidatedPDF } from './pdf-validator';
import { uploadToDrive } from './google-sync';
import { updateClientData, getDebtorClients, getUpcomingDeadlines, getDatabaseSummary, getClientsStatusReport, getClientField, quickUpdateClient, markPaymentAsPaid, findClients, markPaymentsList, markDeclaration, get_sri_credential, saveDeclarationPdf, getClientDeclarationProofsList, convertMarkdownToTelegramHtml, FIELD_LABELS, FIELD_DB_MAPPING, getDeclarationYears, getDeclarationProofsByYear, saveClientSignatureP12, getRecentSriInvoices, downloadClientProofFile, processAndSaveDeclarationPdf } from './database_ops';
import axios from 'axios';
import { createRouteHandler } from "uploadthing/express";
import { ourFileRouter } from "./uploadthing";
import { startCronJobs, triggerProactiveReport } from './cron';
import { supabase } from './supabase';
import { processPaymentReceipt } from './vision';
import { emitInvoice, getEmisorConfig, wakeUpFacturadorApi } from './sri_api';
import { generateRidePdfBuffer } from './pdf_generator';

const pendingPdfs = new Map<string, { buffer: Buffer, data: ValidatedPDF }>();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set");

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Security: Whitelist authorized users
// Clean quotes and whitespace from environment variable
const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
  .replace(/['"]/g, '') // Remove any accidental quotes
  .split(',')
  .map(id => id.trim())
  .filter(id => id.length > 0);

// FAIL-SAFE: Always allow Santiago (ID from user report)
if (!ALLOWED_USERS.includes("1879067180")) {
  ALLOWED_USERS.push("1879067180");
}

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  const username = ctx.from?.username || "sin_usuario";
  
  console.log(`📥 UPDATE RECEIVED: [User: ${username}] [ID: ${userId}]`);

  if (userId && ALLOWED_USERS.includes(userId)) {
    console.log(`✅ User ${userId} authorized.`);
    return await next();
  }
  
  console.warn(`⛔ ACCESS DENIED: User ${userId} (@${username}) is not in ALLOWED_USERS:`, ALLOWED_USERS);
  await ctx.reply(`Lo siento, no tienes permiso para usar este bot o tu ID (${userId}) no está en la lista blanca. Por favor, avísale a Santiago.`);
});

// Error handling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ CRITICAL ERROR while handling update ${ctx.update.update_id}:`, err.error);
  // Optional: Notify the user if possible
  ctx.reply("Ups, ocurrió un error interno. Santiago ya fue notificado. Baku.").catch(e => console.error("Could not send error report to user:", e));
});

// Base commands & Tactical Center
bot.command(['start', 'menu', 'panel', 'ayuda', 'help'], async (ctx) => {
    const kb = new InlineKeyboard()
        .text('📊 Resumen Cartera', 'baku_cmd:quick_report')
        .text('⏰ Vencimientos SRI', 'baku_cmd:deadlines').row()
        .text('📋 Deudores & Mora', 'baku_cmd:debt_report')
        .text('💳 Registrar Pago', 'baku_cmd:reg_payment').row()
        .text('👤 Expediente 360°', 'baku_cmd:view_profile')
        .text('📄 Comprobantes PDF', 'baku_cmd:browse_proofs').row()
        .text('🔐 Bóveda Firma .p12', 'baku_cmd:upload_p12')
        .text('🧾 Emitir Factura', 'baku_cmd:create_invoice').row()
        .text('🔄 Refrescar Estado', 'baku_cmd:quick_report');

    const welcome = `⚡ <b>PANEL TÁCTICO CONTABLE — ${BOT_NAME.toUpperCase()}</b>\n\n` +
                    `Bienvenido Santiago. Selecciona una acción rápida o escribe lo que necesitas (clave, RUC, pagos, comprobantes, deudores o envía una nota de voz / foto de comprobante):`;

    await ctx.reply(welcome, {
        parse_mode: 'HTML',
        reply_markup: kb
    });
});

bot.command('cobranza', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const report = await getDebtorClients();
    await ctx.reply(convertMarkdownToTelegramHtml(report), { parse_mode: 'HTML' });
});

bot.command('vencimientos', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const report = await getUpcomingDeadlines();
    await ctx.reply(convertMarkdownToTelegramHtml(report), { parse_mode: 'HTML' });
});

bot.command('resumen', async (ctx) => {
    await ctx.replyWithChatAction('typing');
    const summary = await getDatabaseSummary();
    await ctx.reply(convertMarkdownToTelegramHtml(summary), { parse_mode: 'HTML' });
});

bot.command('clear', async (ctx) => {
  if (ctx.chat) {
    await clearChatHistory(ctx.chat.id.toString());
    await ctx.reply('La memoria de nuestra conversación ha sido borrada permanentemente.');
  }
});

bot.command('authgmail', async (ctx) => {
  const url = getAuthUrl();
  await ctx.reply(`Para permitir que el bot lea tus correos, por favor entra al siguiente enlace y autoriza a tu cuenta de Google:\n\n${url}\n\nDespués de autorizar, la página te redirigirá. ¡Copia el texto después de \`code=\` en la barra de direcciones y mándamelo usando el comando:\n/setgmailcode TU_CODIGO`);
});

bot.command('setgmailcode', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const code = ctx.match;
  if (!code) {
    return ctx.reply('Por favor dame el código. Ejemplo: /setgmailcode 4/0AeaYSHC...');
  }

  await ctx.replyWithChatAction('typing');
  try {
    await setTokenFromCode(chatId, code as string);
    await ctx.reply('¡Listo! Has autorizado tu cuenta de Google perfectamente. Ahora puedes pedirme "Lee mis correos sin leer".');
  } catch (err: any) {
    await ctx.reply('Error autorizando tu cuenta: ' + err.message);
  }
});

bot.command('setelevenlabs', async (ctx) => {
    const key = ctx.match;
    if (!key) return ctx.reply('Uso: /setelevenlabs TU_CLAVE_API');
    updateVoiceConfig(key as string);
    await ctx.reply('✅ Clave de ElevenLabs actualizada. Baku.');
});

bot.command('setvoice', async (ctx) => {
    const voiceId = ctx.match;
    if (!voiceId) return ctx.reply('Uso: /setvoice ID_DE_VOZ');
    updateVoiceConfig(undefined, voiceId as string);
    await ctx.reply(`✅ Voz de ElevenLabs cambiada a: ${voiceId}. Baku.`);
});

bot.command('status', async (ctx) => {
    const vStatus = await getVoiceStatus();
    let statusMsg = "📊 <b>ESTADO DEL SISTEMA:</b>\n\n";
    statusMsg += `🎙️ ElevenLabs: ${vStatus.elevenLabs ? '✅ Conectado' : '❌ Sin Clave'}\n`;
    statusMsg += `🆕 Voz Actual: <code>${vStatus.voiceId}</code>\n`;
    statusMsg += `☁️ Google TTS: ${vStatus.googleCloud ? '✅ Activo (Respaldo)' : '⚠️ No configurado'}\n`;
    statusMsg += `🧠 Groq: ✅ Activo\n`;
    statusMsg += "\nBaku.";
    await ctx.reply(statusMsg, { parse_mode: 'HTML' });
});

bot.command('testcron', async (ctx) => {
    await ctx.reply('⏳ Forzando la generación del reporte proactivo matutino. Por favor espera...');
    await triggerProactiveReport(bot, ctx.chat.id.toString());
});

bot.command('reporte', async (ctx) => {
    await ctx.reply('⏳ Comandante, estoy preparando y consolidando el reporte operativo en tiempo real. Un momento...');
    await triggerProactiveReport(bot, ctx.chat.id.toString());
});


// ─────────────────────────────────────────────────────────
// PRE-AI SHORTCUT ENGINE — Zero tokens, instant responses
// Now with inline keyboard disambiguation — no context loss!
// ─────────────────────────────────────────────────────────

/** Builds a Telegram inline keyboard for client selection */
function buildClientKeyboard(clients: any[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    clients.slice(0, 8).forEach(c => {
        const baseName = c.name.split(' ').slice(0, 3).join(' ');
        const label = c.trade_name
            ? `${baseName} · ${c.trade_name.split(' ')[0]}`
            : baseName;
        kb.text(`👤 ${label.substring(0, 30)}`, `baku_sel:${c.ruc}`).row();
    });
    kb.text('❌ Cancelar', 'baku_cancel');
    return kb;
}

/** Muestra la ficha del perfil del cliente con botones de edición */
async function showClientProfileCard(chatId: string, client: any, ctx: any) {
    const ruc = client.ruc || '';
    const regime = client.regime || 'Régimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
    const rawTaxProfile = client.tax_profile || {};
    const clientStartPeriod = client.clientStartPeriod || rawTaxProfile.clientStartPeriod || 'No configurado';

    let obligationsText = '';
    if (ivaFrequency === 'Mensual') obligationsText = 'IVA Mensual';
    else if (ivaFrequency === 'Semestral') obligationsText = 'IVA Semestral';
    else obligationsText = 'Exento / Ninguno';

    let cardText = `👤 <b>EXPEDIENTE 360°: ${client.name}</b>\n`;
    if (client.trade_name) cardText += `🏢 <b>Nombre Comercial:</b> ${client.trade_name}\n`;
    cardText += `🆔 <b>RUC:</b> <code>${ruc}</code>\n`;
    cardText += `⚖️ <b>Régimen:</b> ${regime}\n`;
    cardText += `🔄 <b>Frecuencia IVA:</b> ${obligationsText}\n`;
    cardText += `📅 <b>Inicio Obligaciones:</b> <code>${clientStartPeriod}</code>\n`;
    cardText += `📧 <b>Email:</b> ${client.email || '<i>(vacío)</i>'}\n`;
    cardText += `📞 <b>Telf:</b> ${client.phones ? client.phones.join(', ') : '<i>(vacío)</i>'}\n`;
    cardText += `🔑 <b>Clave SRI:</b> <code>${client.sri_password || '<i>(vacío)</i>'}</code>\n`;
    cardText += `🔑 <b>Clave Firma:</b> <code>${client.signature_password || '<i>(vacío)</i>'}</code>\n`;
    if (client.signature_expiration) cardText += `⏳ <b>Vence Firma:</b> ${client.signature_expiration}\n`;
    if (client.notes) cardText += `📝 <b>Notas:</b> ${client.notes}\n`;

    const kb = new InlineKeyboard()
        .text('💳 Honorarios / Pagar', `baku_hub_pay:${ruc}`)
        .text('📄 Comprobantes SRI', `baku_hub_proofs:${ruc}`).row()
        .text('🔐 Firma .p12 / Bóveda', `baku_hub_p12:${ruc}`)
        .text('📲 Link Portal Cliente', `baku_hub_portal:${ruc}`).row()
        .text('✏️ Editar Perfil', `baku_hub_edit:${ruc}`)
        .text('❌ Cerrar Perfil', 'baku_cancel');

    await ctx.reply(convertMarkdownToTelegramHtml(cardText), {
        parse_mode: 'HTML',
        reply_markup: kb
    });
}

/** Sets up a pending dialog and shows a client selection keyboard */
async function showClientSelection(
    chatId: string,
    clients: any[],
    dialogType: DialogState['type'],
    data: DialogState['data'],
    ctx: any,
    message: string = '🔍 Encontré varios clientes. Selecciona el correcto:'
) {
    pendingDialogs.set(chatId, {
        type: dialogType,
        chatId,
        step: 'select_client',
        candidates: clients,
        data
    });
    await ctx.reply(convertMarkdownToTelegramHtml(message), {
        parse_mode: 'HTML',
        reply_markup: buildClientKeyboard(clients)
    });
}

async function showOperationalMenu(ctx: any) {
    const kb = new InlineKeyboard()
        .text('👤 Expediente de Cliente', 'baku_cmd:view_profile').row()
        .text('💳 Registrar Pago', 'baku_cmd:reg_payment').row()
        .text('📄 Comprobantes SRI (Declaraciones)', 'baku_cmd:browse_proofs').row()
        .text('🔐 Firma .p12 / Bóveda', 'baku_cmd:upload_p12').row()
        .text('🧾 Facturas Emitidas (Historial)', 'baku_cmd:browse_invoices').row()
        .text('💸 Emitir Nueva Factura', 'baku_cmd:create_invoice').row()
        .text('🔑 Ver Claves SRI', 'baku_cmd:see_sri_key').row()
        .text('📊 Reporte Rápido General', 'baku_cmd:quick_report');

    await ctx.reply(
        `🎯 <b>CENTRO DE OPERACIONES TÁCTICAS — SANTIAGO</b>\n\n` +
        `Selecciona una acción directa para gestionar la cartera de clientes de forma inmediata:`,
        {
            parse_mode: 'HTML',
            reply_markup: kb
        }
    );
}

async function showProofTypeSelector(chatId: string, client: any, ctx: any) {
    const kb = new InlineKeyboard()
        .text('📊 IVA (Mensual / Semestral)', 'baku_proof_type:' + client.ruc + ':IVA').row()
        .text('💰 RENTA (Anual)', 'baku_proof_type:' + client.ruc + ':RENTA').row()
        .text('❌ Cancelar', 'baku_cancel');

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            '📄 <b>Comprobantes de Declaración SRI</b>\n\n' +
            '<b>Cliente:</b> ' + client.name + '\n' +
            '<b>RUC:</b> <code>' + client.ruc + '</code>\n\n' +
            'Selecciona el tipo de impuesto que deseas consultar:'
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function showInvoicesListForClient(chatId: string, rucFilter: string | undefined, ctx: any) {
    await ctx.replyWithChatAction('typing');
    const invoices = await getRecentSriInvoices(10, rucFilter);
    if (!invoices || invoices.length === 0) {
        await ctx.reply('🧾 No se encontraron facturas autorizadas registradas.');
        return;
    }

    let msg = '🧾 <b>FACTURAS EMITIDAS AUTORIZADAS:</b>\n\n';
    const kb = new InlineKeyboard();
    invoices.forEach((inv: any) => {
        const sec = inv.secuencial;
        const total = Number(inv.total || 0).toFixed(2);
        const name = (inv.nombre_receptor || 'Cliente').substring(0, 18);
        msg += '• <b>No. ' + sec + '</b> - ' + name + ' ($' + total + ') [' + inv.fecha_emision + ']\n';
        kb.text('📥 RIDE PDF #' + sec, 'baku_inv_pdf:' + inv.clave_acceso)
          .text('📄 XML', 'baku_inv_xml:' + inv.clave_acceso).row();
    });
    kb.text('❌ Cerrar', 'baku_cancel');

    await ctx.reply(convertMarkdownToTelegramHtml(msg), {
        parse_mode: 'HTML',
        reply_markup: kb
    });
}

/**
 * Pre-AI shortcut engine. Returns true if the message was handled.
 * Uses inline keyboard buttons when multiple clients match — no context loss.
 */
async function tryDirectCommand(text: string, chatId: string, ctx: any): Promise<boolean> {
    const t = text.toLowerCase().trim();

    // Trigger operational menu
    if (['pagos', 'menú', 'menu', 'santiago', 'opciones', 'inicio', 'comenzar', 'baku', 'cliente', 'clientes'].includes(t)) {
        await showOperationalMenu(ctx);
        return true;
    }

    // Trigger proactive report
    if (['reporte', 'reporte matutino', 'forzar reporte', 'reporte proactivo', 'enviar reporte'].includes(t)) {
        await ctx.reply('⏳ Comandante, estoy preparando y consolidando el reporte operativo en tiempo real. Un momento...');
        await triggerProactiveReport(bot, chatId);
        return true;
    }

    // Stop identifier capture at " y " to avoid compound query false positives
    // e.g. "RUC de aleida y su clave" ➔ identifier = "aleida"
    const extractId = (raw: string): string => raw.split(/\s+y\s+/)[0].trim();

    /** Handles a field read with inline disambiguation if needed */
    async function doFieldQuery(rawId: string, field: string): Promise<boolean> {
        const identifier = extractId(rawId);
        if (!identifier || identifier.length < 2) return false;
        const clients = await findClients(identifier, '*');
        if (clients.length === 0) {
            // Fallback: check SRI vault for 13-digit RUCs when field is 'sri_password'
            if (field === 'sri_password' && identifier.trim().length === 13 && /^\d+$/.test(identifier.trim())) {
                const backupCred = await get_sri_credential(identifier.trim());
                if (!backupCred.includes('\u274c No se encontr')) {
                    await ctx.reply(convertMarkdownToTelegramHtml(backupCred), { parse_mode: 'HTML' });
                    await saveMessage(chatId, 'user', text);
                    await saveMessage(chatId, 'assistant', backupCred);
                    return true;
                }
            }
            await ctx.reply(`\u274c No encontré ningún cliente con "${identifier}". Baku.`);
            return true;
        }
        if (clients.length === 1) {
            const client = clients[0];
            const result = await getClientField(client.ruc, field);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            
            // Save to chat history for subsequent context (e.g. "y la clave")
            await saveMessage(chatId, 'user', text);
            await saveMessage(chatId, 'assistant', result);
            
            // Si solicitó la clave de firma electrónica, enviamos también el archivo p12 adjunto
            if (field === 'electronicSignaturePassword') {
                try {
                    const { data: dbClient } = await supabase
                        .from('clients')
                        .select('signature_file')
                        .eq('id', client.id)
                        .single();

                    const sigFile = dbClient?.signature_file;
                    if (sigFile && sigFile.content && sigFile.name) {
                        const buffer = Buffer.from(sigFile.content, 'base64');
                        await ctx.replyWithDocument(new InputFile(buffer, sigFile.name), {
                            caption: `📂 Archivo de firma electrónica (.p12) de <b>${client.name}</b>`,
                            parse_mode: 'HTML'
                        });
                        console.log(`✅ Archivo de firma electrónica enviado para ${client.name}`);
                    }
                } catch (fileErr) {
                    console.error("Error al obtener o enviar el archivo de firma:", fileErr);
                }
            }
            return true;
        }
        // Multiple matches ➔ inline keyboard, preserves field context
        await showClientSelection(
            chatId, clients, 'field_query', { field },
            ctx, `🔍 Encontré <b>${clients.length}</b> clientes con "${identifier}". Selecciona el que necesitas:`
        );
        return true;
    }

    /** Handles a field write with inline disambiguation if needed */
    async function doFieldUpdate(rawId: string, field: string, value: string): Promise<boolean> {
        const identifier = extractId(rawId);
        if (!identifier || identifier.length < 2) return false;
        const clients = await findClients(identifier, 'id, name, ruc, trade_name');
        if (clients.length === 0) {
            await ctx.reply(`❌ No encontré "${identifier}". Baku.`);
            return true;
        }
        if (clients.length === 1) {
            const result = await quickUpdateClient(clients[0].ruc, field, value);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            
            await saveMessage(chatId, 'user', text);
            await saveMessage(chatId, 'assistant', result);
            return true;
        }
        await showClientSelection(
            chatId, clients, 'field_query', { field, value },
            ctx, `🔍 Encontré <b>${clients.length}</b> coincidencias. ¿Cuál deseas editar?`
        );
        return true;
    }

    // --- FIELD READ shortcuts ---
    const claveMatch = t.match(/(?:clave\s*(?:sri)?|sri)\s+de\s+(.+)/);
    if (claveMatch) return doFieldQuery(claveMatch[1], 'sri_password');

    const iessMatch = t.match(/clave\s+iess\s+de\s+(.+)/);
    if (iessMatch) return doFieldQuery(iessMatch[1], 'iessPassword');

    const firmaMatch = t.match(/(?:clave\s+)?firma(?:\s+electr[oó]nica)?\s+de\s+(.+)/);
    if (firmaMatch) return doFieldQuery(firmaMatch[1], 'electronicSignaturePassword');

    const emailMatch = t.match(/(?:email|correo)\s+de\s+(.+)/);
    if (emailMatch) return doFieldQuery(emailMatch[1], 'email');

    const telMatch = t.match(/(?:tel[eé]fono|tel|cel(?:ular)?)\s+de\s+(.+)/);
    if (telMatch) return doFieldQuery(telMatch[1], 'phones');

    const rucMatch = t.match(/ruc\s+de\s+(.+)/);
    if (rucMatch) return doFieldQuery(rucMatch[1], 'ruc');

    const regimenMatch = t.match(/(?:r[eé]gimen|tipo)\s+de\s+(.+)/);
    if (regimenMatch) return doFieldQuery(regimenMatch[1], 'regime');

    const facturadorMatch = t.match(/(?:facturador|sistema\s+de\s+facturaci[oó]n)\s+de\s+(.+)/);
    if (facturadorMatch) return doFieldQuery(facturadorMatch[1], 'billing_system');

    const usrFactMatch = t.match(/usuario\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+)/);
    if (usrFactMatch) return doFieldQuery(usrFactMatch[1], 'billing_user');

    const claveFactMatch = t.match(/clave\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+)/);
    if (claveFactMatch) return doFieldQuery(claveFactMatch[1], 'billing_password');

    const precioFactMatch = t.match(/precio\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+)/);
    if (precioFactMatch) return doFieldQuery(precioFactMatch[1], 'billing_price');

    const vigenciaFactMatch = t.match(/(?:vigencia|caducidad|vencimiento)\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+)/);
    if (vigenciaFactMatch) return doFieldQuery(vigenciaFactMatch[1], 'billing_expiration');

    // --- FIELD WRITE shortcuts ---
    const editClaveMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:la\s+)?clave\s+(?:sri\s+)?de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editClaveMatch) return doFieldUpdate(editClaveMatch[1], 'sri_password', editClaveMatch[2].trim());

    const editEmailMatch = t.match(/(?:edita|cambia|actualiza)\s+(?:el\s+)?(?:email|correo)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editEmailMatch) return doFieldUpdate(editEmailMatch[1], 'email', editEmailMatch[2].trim());

    const editTelMatch = t.match(/(?:edita|cambia|actualiza)\s+(?:el\s+)?(?:tel[eé]fono|tel|cel(?:ular)?)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editTelMatch) return doFieldUpdate(editTelMatch[1], 'phones', editTelMatch[2].trim());

    const editFacturadorMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:el\s+)?(?:facturador|sistema\s+de\s+facturaci[oó]n)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editFacturadorMatch) return doFieldUpdate(editFacturadorMatch[1], 'billing_system', editFacturadorMatch[2].trim());

    const editUsrFactMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:el\s+)?usuario\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editUsrFactMatch) return doFieldUpdate(editUsrFactMatch[1], 'billing_user', editUsrFactMatch[2].trim());

    const editClaveFactMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:la\s+)?clave\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editClaveFactMatch) return doFieldUpdate(editClaveFactMatch[1], 'billing_password', editClaveFactMatch[2].trim());

    const editPrecioFactMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:el\s+)?precio\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editPrecioFactMatch) return doFieldUpdate(editPrecioFactMatch[1], 'billing_price', editPrecioFactMatch[2].trim());

    const editVigenciaFactMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:la\s+)?(?:vigencia|caducidad|vencimiento)\s+(?:del\s+)?(?:facturador|sistema)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editVigenciaFactMatch) return doFieldUpdate(editVigenciaFactMatch[1], 'billing_expiration', editVigenciaFactMatch[2].trim());

    // --- PAYMENT shortcuts (interactive flow) ---
    const marcaPagoMatch = t.match(/(?:marca|registra|anota)\s+(?:como\s+)?(?:pagado|un\s+pago)\s+(?:de\s+|a\s+)?(.+)|(?:a\s+)?(.+?)\s+(?:ya\s+)?pag[oó]|cu[aá]nto\s+(?:me\s+)?debe\s+(.+)|qu[eé]\s+(?:meses\s+)?me\s+debe\s+(.+)/);
    const payClient = marcaPagoMatch ? (marcaPagoMatch[1] || marcaPagoMatch[2] || marcaPagoMatch[3] || marcaPagoMatch[4])?.trim() : null;
    if (payClient && payClient.length > 2) {
        const clients = await findClients(payClient, '*');
        await initiatePaymentFlow(chatId, clients, ctx);
        return true;
    }

    // --- PROOF shortcuts ---
    const comprobanteMatch = t.match(/(?:comprobante|ride|pdf)\s+(?:de\s+la\s+)?(?:declaraci[oó]n\s+)?de\s+(.+)/);
    if (comprobanteMatch) {
        const clients = await findClients(comprobanteMatch[1].trim(), 'id, name, ruc, trade_name');
        if (clients.length === 1) {
            const result = await getClientDeclarationProofsList(clients[0].ruc);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            return true;
        } else if (clients.length > 1) {
            await showClientSelection(
                chatId, clients, 'field_query', { field: 'sri_declaraciones' },
                ctx, `🔍 Encontré <b>${clients.length}</b> clientes. ¿De cuál deseas el comprobante?`
            );
            return true;
        } else {
             await ctx.reply(`❌ No encontré "${comprobanteMatch[1]}". Baku.`);
             return true;
        }
    }

    // --- INVOICE shortcuts ---
    const invoiceMatch = t.match(/(?:facturar|emitir\s+factura|factura|crear\s+factura)\s+(?:a|de|para)\s+(.+)/);
    if (invoiceMatch) {
        const clients = await findClients(invoiceMatch[1].trim(), '*');
        await initiateInvoiceFlow(chatId, clients, ctx);
        return true;
    }

    // --- REPORT shortcuts ---
    if (/(?:quien(?:es)?\s+(?:me\s+)?deb[e|en]|deudores|cartera\s+vencida|cobros\s+pendientes)/.test(t)) {
        const resultText = await getDebtorClients();
        await ctx.reply(convertMarkdownToTelegramHtml(resultText), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', text);
        await saveMessage(chatId, 'assistant', resultText);
        return true;
    }
    if (/(?:quien(?:es)?\s+falt[a|an]|falta\s+declarar|pendientes\s+(?:de\s+)?(?:sri|declarar)|quien\s+no\s+ha\s+declarado|no\s+han\s+declarado)/.test(t)) {
        const resultText = await getClientsStatusReport();
        await ctx.reply(convertMarkdownToTelegramHtml(resultText), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', text);
        await saveMessage(chatId, 'assistant', resultText);
        return true;
    }
    if (/(?:vencimiento|vence\s+(?:esta|la)\s+semana|pr[oó]ximos?\s+vencimientos?|cuando\s+vence)/.test(t)) {
        const resultText = await getUpcomingDeadlines();
        await ctx.reply(convertMarkdownToTelegramHtml(resultText), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', text);
        await saveMessage(chatId, 'assistant', resultText);
        return true;
    }
    if (/(?:^resumen$|estado\s+general|c[oó]mo\s+va\s+(?:todo|la\s+cartera)|panorama\s+general|cu[aá]ntos\s+clientes)/.test(t)) {
        const resultText = await getDatabaseSummary();
        await ctx.reply(convertMarkdownToTelegramHtml(resultText), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', text);
        await saveMessage(chatId, 'assistant', resultText);
        return true;
    }

    // --- PROFILE shortcuts ---
    const profileMatch = t.match(/(?:perfil|expediente|ficha)\s+(?:de\s+)?(.+)/);
    if (profileMatch) {
        const identifier = extractId(profileMatch[1]);
        if (identifier && identifier.length >= 2) {
            const clients = await findClients(identifier, '*');
            if (clients.length === 0) {
                await ctx.reply(`❌ No encontré ningún cliente con "${identifier}". Baku.`);
                return true;
            }
            if (clients.length === 1) {
                await showClientProfileCard(chatId, clients[0], ctx);
                return true;
            }
            await showClientSelection(
                chatId, clients, 'view_profile', {},
                ctx, `🔍 Encontré <b>${clients.length}</b> clientes con "${identifier}". Selecciona el que necesitas:`
            );
            return true;
        }
    }

    return false; // No shortcut matched — send to AI
}

export interface DialogState {
  type: 'mark_payment' | 'mark_declaration' | 'field_query' | 'view_profile' | 'edit_profile_field' | 'create_invoice' | 'browse_proofs' | 'upload_p12' | 'browse_invoices';
  chatId: string;
  step: 'select_client' | 'ask_payment_period' | 'ask_payment_future_period' | 'confirm_payment' | 'ask_declaration_type' | 'ask_declaration_period' | 'ask_declaration_realizada' | 'ask_declaration_method' | 'confirm_declaration' | 'ask_client_name' | 'ask_field_value' | 'ask_invoice_concept' | 'ask_invoice_custom_concept' | 'ask_invoice_custom_amount' | 'ask_invoice_payment_method' | 'ask_p12_password';
  client?: any;
  candidates?: any[];
  data: {
    periods?: string[];
    method?: 'pdf' | 'click';
    type?: 'IVA' | 'RENTA';
    isFuture?: boolean;
    field?: string;    // For field_query/edit_profile_field: which field to read/write
    value?: any;       // For field_query/edit_profile_field: value to write (if update)
    invoiceConcept?: string; // For create_invoice
    invoiceAmount?: number;  // For create_invoice
    p12Base64?: string;
    p12FileName?: string;
    selectedType?: 'IVA' | 'RENTA';
    selectedYear?: string;
  };
}

export const pendingDialogs = new Map<string, DialogState>();

function parsePeriods(input: string, isSemestral: boolean = false): string[] {
    const currentYear = new Date().getFullYear();
    const monthsMap: Record<string, string> = {
        enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
        julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
        noviembre: '11', diciembre: '12'
    };

    const semestresMap: Record<string, string> = {
        'primer': '1S', '1er': '1S', '1': '1S', 'segundo': '2S', '2do': '2S', '2': '2S'
    };

    const parts = input.toLowerCase()
        .replace(/\by\b/g, ',')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    const results: string[] = [];

    for (const part of parts) {
        const yyyyMmMatch = part.match(/^(\d{4})-(\d{2})$/);
        if (yyyyMmMatch) {
            results.push(part);
            continue;
        }

        const yyyySemMatch = part.match(/^(\d{4})-(1s|2s)$/i);
        if (yyyySemMatch) {
            results.push(part.toUpperCase());
            continue;
        }

        if (/^\d{4}$/.test(part)) {
            results.push(part);
            continue;
        }

        const yearMatch = part.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;

        const cleanPart = part.replace(/\b20\d{2}\b/g, '').trim();

        if (isSemestral) {
            let foundSem = false;
            for (const [key, val] of Object.entries(semestresMap)) {
                if (cleanPart.includes(key) || cleanPart === val.toLowerCase() || cleanPart.includes(val.toLowerCase() + ' semestre')) {
                    results.push(`${year}-${val}`);
                    foundSem = true;
                    break;
                }
            }
            if (foundSem) continue;
        }

        let foundMonth = false;
        for (const [monthName, monthNum] of Object.entries(monthsMap)) {
            if (cleanPart.includes(monthName)) {
                results.push(`${year}-${monthNum}`);
                foundMonth = true;
                break;
            }
        }
        if (foundMonth) continue;

        const numMatch = cleanPart.match(/\b(\d{1,2})\b/);
        if (numMatch) {
            const num = parseInt(numMatch[1]);
            if (num >= 1 && num <= 12) {
                const padMonth = String(num).padStart(2, '0');
                results.push(`${year}-${padMonth}`);
                continue;
            }
        }
    }

    return [...new Set(results)];
}

async function initiatePaymentFlow(chatId: string, matches: any[], ctx: any) {
    if (matches.length === 0) {
        await ctx.reply("❌ No encontré ningún cliente que coincida con esa búsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'mark_payment', {},
            ctx, `🔍 Encontré *${matches.length}* clientes. ¿Para cuál es el pago?`
        );
        return;
    }

    await startPaymentFlowForClient(chatId, matches[0], ctx);
}

export async function startPaymentFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'Régimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

    const history = client.sri_declaraciones || [];
    const unpaid = history.filter((d: any) => !d.is_paid && d.status !== 'Pendiente');
    
    let pendingMsg = "";
    if (unpaid.length > 0) {
        pendingMsg = `Tiene los siguientes periodos pendientes de pago registrados:\n` +
            unpaid.map((d: any) => `- **${d.type}** del periodo **${d.period}**`).join('\n') + `\n\n`;
    } else {
        pendingMsg = `No tiene periodos pendientes de pago registrados en su historial.\n\n`;
    }

    pendingDialogs.set(chatId, {
        type: 'mark_payment',
        chatId,
        step: 'ask_payment_period',
        client,
        data: {}
    });

    const kb = new InlineKeyboard();
    if (unpaid.length > 0) {
        unpaid.forEach((d: any) => {
            kb.text(`${d.type} ${d.period}`, `baku_pay:${client.ruc}:${d.type}:${d.period}`).row();
        });
        if (unpaid.length > 1) {
            // Se usa ALL_TYPES para simplificar en backend, pero se mandará como 'IVA' al LLM y él resolverá.
            // O mejor: mandar 'HONORARIOS' y procesará todos si 'todos' es periodo.
            kb.text(`💸 Pagar TODOS los ${unpaid.length} meses`, `baku_pay:${client.ruc}:HONORARIOS:todos`).row();
        }
    }
    kb.text(`❌ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `👤 **Cliente:** ${client.name}\n` +
            `📅 **Frecuencia IVA:** ${ivaFrequency}\n` +
            `💼 **Régimen:** ${regime}\n\n` +
            pendingMsg +
            `Elige el periodo que deseas marcar como pagado, o escríbelo en el chat:`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function initiateInvoiceFlow(chatId: string, matches: any[], ctx: any) {
    if (matches.length === 0) {
        await ctx.reply("❌ No encontré ningún cliente que coincida con esa búsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'create_invoice', {},
            ctx, `🔍 Encontré <b>${matches.length}</b> clientes. ¿A cuál vas a facturar?`
        );
        return;
    }

    await startInvoiceFlowForClient(chatId, matches[0], ctx);
}

export async function startInvoiceFlowForClient(chatId: string, client: any, ctx: any) {
    // 🔥 Wake-up en caso de entrada directa (botón desde perfil del cliente)
    wakeUpFacturadorApi().catch(() => {});

    const history = client.sri_declaraciones || [];
    const unpaid = history.filter((d: any) => !d.is_paid && d.status !== 'Pendiente');
    
    pendingDialogs.set(chatId, {
        type: 'create_invoice',
        chatId,
        step: 'ask_invoice_concept',
        client,
        data: {}
    });

    const kb = new InlineKeyboard();
    if (unpaid.length > 0) {
        unpaid.forEach((d: any) => {
            kb.text(`Honorarios ${d.period} - $${d.fee || 0}`, `baku_inv_concept:Honorarios ${d.period}:${d.fee || 0}`).row();
        });
    }
    kb.text(`✏️ Detalle Personalizado`, `baku_inv_custom`).row();
    kb.text(`❌ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `👤 **Cliente Seleccionado:** ${client.name}\n` +
            `🆕 **RUC:** ${client.ruc}\n\n` +
            `Elige el concepto a facturar de la lista de honorarios pendientes, o ingresa un detalle libre:`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function initiateDeclarationFlow(chatId: string, matches: any[], ctx: any) {
    if (matches.length === 0) {
        await ctx.reply("❌ No encontré ningún cliente que coincida con esa búsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'mark_declaration', {},
            ctx, `🔍 Encontré *${matches.length}* clientes. ¿Para cuál es la declaración?`
        );
        return;
    }

    await startDeclarationFlowForClient(chatId, matches[0], ctx);
}

export async function startDeclarationFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'Régimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

    const history = client.sri_declaraciones || [];
    const pendingDec = history.filter((d: any) => d.status === 'Pendiente');

    pendingDialogs.set(chatId, {
        type: 'mark_declaration',
        chatId,
        step: 'ask_declaration_type',
        client,
        data: {}
    });

    const kb = new InlineKeyboard();
    if (pendingDec.length > 0) {
        pendingDec.forEach((d: any) => {
            kb.text(`Declarar ${d.type} ${d.period}`, `baku_dec_type:${client.ruc}:${d.type}:${d.period}`).row();
        });
    }
    kb.text(`Declarar IVA (Otro)`, `baku_dec_type:${client.ruc}:IVA`).row();
    kb.text(`Declarar RENTA (Otro)`, `baku_dec_type:${client.ruc}:RENTA`).row();
    kb.text(`❌ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `👤 **Cliente:** ${client.name}\n` +
            `¿Qué declaración de impuestos deseas registrar? Elige una opción o escríbela en el chat.`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function handleDialogTriggers(chatId: string, text: string, ctx: any): Promise<boolean> {
    const t = text.toLowerCase().trim();

    if (t === 'cancelar' || t === 'salir') {
        if (pendingDialogs.has(chatId)) {
            pendingDialogs.delete(chatId);
            await ctx.reply("❌ Proceso interactivo cancelado. Baku.");
            return true;
        }
    }

    const isPaymentIntent = /(?:pag[oó]|cancel[oó]|liquid[oó]|pagar|cancelar|liquidar|registra pago|marca pago)/i.test(t) && 
        !/(?:quien|falta|debe|cuantos|reporte|resumen|vencimiento)/i.test(t);

    const isDeclarationIntent = /(?:declaraci[oó]n|declar[oó]|declarar|registra declaraci[oó]n|marca declaraci[oó]n)/i.test(t) &&
        !/(?:quien|falta|debe|cuantos|reporte|resumen|vencimiento)/i.test(t);

    if (isPaymentIntent) {
        let clientQuery = t
            .replace(/(?:me\s+)?(?:acaba\s+de\s+)?(?:cancel[oó]|pag[oó]|liquid[oó]|cancel[a]r?|pagar?)/g, '')
            .replace(/(?:marca|registra|anota)\s+(?:como\s+)?pagado\s+(?:a\s+)?/g, '')
            .replace(/(?:registra|marca|anota)\s+(?:el\s+)?pago\s+(?:de\s+)?/g, '')
            .replace(/(?:a\s+)/g, '')
            .trim();

        clientQuery = clientQuery.replace(/\s+/g, ' ');

        if (clientQuery.length > 2) {
            try {
                const matches = await findClients(clientQuery, '*');
                if (matches.length > 0) {
                    await initiatePaymentFlow(chatId, matches, ctx);
                    return true;
                }
            } catch (err) {
                console.error("Error finding clients for trigger:", err);
            }
        }
        
        pendingDialogs.set(chatId, {
            type: 'mark_payment',
            chatId,
            step: 'ask_client_name',
            data: {}
        });
        await ctx.reply("¿Para qué cliente deseas registrar el pago? (Escribe el nombre o RUC). Baku.");
        return true;
    }

    if (isDeclarationIntent) {
        let clientQuery = t
            .replace(/(?:declaraci[oó]n|declar[oó]|declarar)/g, '')
            .replace(/(?:marca|registra|anota)\s+declaraci[oó]n\s+(?:de\s+)?/g, '')
            .replace(/^de\s+/g, '')
            .trim();

        clientQuery = clientQuery.replace(/\s+/g, ' ');

        if (clientQuery.length > 2) {
            try {
                const matches = await findClients(clientQuery, '*');
                if (matches.length > 0) {
                    await initiateDeclarationFlow(chatId, matches, ctx);
                    return true;
                }
            } catch (err) {
                console.error("Error finding clients for trigger:", err);
            }
        }
        
        pendingDialogs.set(chatId, {
            type: 'mark_declaration',
            chatId,
            step: 'ask_client_name',
            data: {}
        });
        await ctx.reply("¿Para qué cliente deseas registrar la declaración? (Escribe el nombre o RUC). Baku.");
        return true;
    }

    return false;
}

async function handleDialogStep(chatId: string, text: string, ctx: any) {
    const dialog = pendingDialogs.get(chatId);
    if (!dialog) return;

    const t = text.toLowerCase().trim();

    if (t === 'cancelar' || t === 'salir') {
        pendingDialogs.delete(chatId);
        await ctx.reply("❌ Proceso interactivo cancelado. Baku.");
        return;
    }

    if (dialog.step === 'ask_client_name') {
        try {
            const matches = await findClients(text, '*');
            if (matches.length === 0) {
                await ctx.reply(`❌ No encontré ningún cliente con "${text}".\n\n💡 _Tip: Escribe SOLO el nombre (ej: "Juan") o RUC, sin otras palabras._\nEscribe **cancelar** para salir del modo registro. Baku.`);
                return;
            }
            if (dialog.type === 'mark_payment') {
                await initiatePaymentFlow(chatId, matches, ctx);
            } else if (dialog.type === 'mark_declaration') {
                await initiateDeclarationFlow(chatId, matches, ctx);
            } else if (dialog.type === 'create_invoice') {
                await initiateInvoiceFlow(chatId, matches, ctx);
            } else if (dialog.type === 'field_query') {
                const field = dialog.data.field!;
                if (matches.length > 1) {
                    await showClientSelection(
                        chatId, matches, 'field_query', dialog.data, ctx,
                        `🔍 Encontré <b>${matches.length}</b> clientes. Selecciona el correcto:`
                    );
                } else {
                    const client = matches[0];
                    if (dialog.data.value !== undefined) {
                        const result = await quickUpdateClient(client.ruc, field, dialog.data.value);
                        await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
                    } else {
                        const result = await getClientField(client.ruc, field);
                        await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
                    }
                    pendingDialogs.delete(chatId);
                }
            } else if (dialog.type === 'view_profile' as any) {
                if (matches.length > 1) {
                    await showClientSelection(
                        chatId, matches, 'view_profile', dialog.data, ctx,
                        `🔍 Encontré <b>${matches.length}</b> clientes. Selecciona el correcto:`
                    );
                } else {
                    const client = matches[0];
                    await showClientProfileCard(chatId, client, ctx);
                    pendingDialogs.delete(chatId);
                }
            } else if (dialog.type === 'upload_p12') {
                if (matches.length > 1) {
                    await showClientSelection(
                        chatId, matches, 'upload_p12', dialog.data, ctx,
                        `🔐 Encontré <b>${matches.length}</b> clientes. ¿A cuál asignamos la firma .p12?`
                    );
                } else {
                    const client = matches[0];
                    dialog.client = client;
                    dialog.step = 'ask_p12_password';
                    pendingDialogs.set(chatId, dialog);
                    await ctx.reply(`🔑 Ingresa la contraseña de la firma electrónica de **${client.name}**:`);
                }
            } else if (dialog.type === 'browse_proofs') {
                if (matches.length > 1) {
                    await showClientSelection(
                        chatId, matches, 'browse_proofs', dialog.data, ctx,
                        `📄 Encontré <b>${matches.length}</b> clientes. Selecciona el que deseas consultar:`
                    );
                } else {
                    const client = matches[0];
                    pendingDialogs.delete(chatId);
                    await showProofTypeSelector(chatId, client, ctx);
                }
            } else if (dialog.type === 'browse_invoices') {
                if (matches.length > 1) {
                    await showClientSelection(
                        chatId, matches, 'browse_invoices', dialog.data, ctx,
                        `🧾 Encontré <b>${matches.length}</b> clientes. Selecciona de cuál deseas las facturas:`
                    );
                } else {
                    const client = matches[0];
                    pendingDialogs.delete(chatId);
                    await showInvoicesListForClient(chatId, client.ruc, ctx);
                }
            }
        } catch (err: any) {
            await ctx.reply(`Error al buscar clientes: ${err.message}. Baku.`);
        }
        return;
    }

    if (dialog.type === 'upload_p12' && dialog.step === 'ask_p12_password') {
        const client = dialog.client;
        const password = text.trim();
        await ctx.replyWithChatAction('typing');
        const res = await saveClientSignatureP12(client.ruc, dialog.data.p12Base64!, dialog.data.p12FileName!, password);
        pendingDialogs.delete(chatId);
        await ctx.reply(convertMarkdownToTelegramHtml(res), { parse_mode: 'HTML' });
        return;
    }

    if (dialog.step === 'select_client') {
        const idx = parseInt(t) - 1;
        if (dialog.candidates && !isNaN(idx) && idx >= 0 && idx < dialog.candidates.length) {
            const selected = dialog.candidates[idx];
            if (dialog.type === 'mark_payment') {
                await startPaymentFlowForClient(chatId, selected, ctx);
            } else if (dialog.type === 'create_invoice') {
                await startInvoiceFlowForClient(chatId, selected, ctx);
            } else {
                await startDeclarationFlowForClient(chatId, selected, ctx);
            }
        } else {
            await ctx.reply("⚠️ Selección inválida. Por favor, responde con el número de la lista (ej: 1) o escribe **cancelar** para salir.");
        }
        return;
    }

    if (dialog.type === 'create_invoice') {
        const client = dialog.client;
        if (dialog.step === 'ask_invoice_custom_concept') {
            dialog.data.invoiceConcept = text;
            dialog.step = 'ask_invoice_custom_amount';
            pendingDialogs.set(chatId, dialog);
            await ctx.reply("✍️ Ingresa el monto a facturar en USD (subtotal sin impuestos, ej: 150.00):");
            return;
        }

        if (dialog.step === 'ask_invoice_custom_amount') {
            const amount = parseFloat(text.replace(',', '.'));
            if (isNaN(amount) || amount <= 0) {
                await ctx.reply("⚠️ Monto inválido. Por favor escribe un valor numérico mayor a cero (ej: 150.00 o 45.50). Baku.");
                return;
            }
            dialog.data.invoiceAmount = amount;
            dialog.step = 'ask_invoice_payment_method';
            pendingDialogs.set(chatId, dialog);

            const kb = new InlineKeyboard()
                .text('💵 Efectivo (Sin Sist. Fin)', 'baku_inv_pay:01').row()
                .text('🏦 Transferencia/Depósito', 'baku_inv_pay:20').row()
                .text('💳 Tarjeta de Crédito', 'baku_inv_pay:19').row()
                .text('❌ Cancelar', 'baku_cancel');
                
            await ctx.reply(
                `¿Cuál será la forma de pago para la factura de ${client.name} ($${amount.toFixed(2)})?`,
                { reply_markup: kb }
            );
            return;
        }
    }

    if (dialog.type === 'mark_payment') {
        const client = dialog.client;
        const regime = client.regime || 'Régimen General';
        const isPopular = regime === 'Rimpe Negocio Popular';
        const isEmprendedor = regime === 'Rimpe Emprendedor';
        const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
        const isSemestral = ivaFrequency === 'Semestral';

        if (dialog.step === 'ask_payment_period') {
            if (t === 'adelantado' || t === 'adelantados') {
                dialog.step = 'ask_payment_future_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply("¿Qué periodo(s) deseas registrar como pagos por adelantado? (ej: \`2026-06, 2026-07\` o \`junio\`). Baku.");
                return;
            }

            const parsed = parsePeriods(text, isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("⚠️ No pude identificar ningún periodo válido. Por favor, escribe un mes, año o formato válido (ej: \`2026-04\`, \`abril\`, \`primer semestre\`).");
                return;
            }

            dialog.data.periods = parsed;
            dialog.step = 'confirm_payment';
            pendingDialogs.set(chatId, dialog);

            await ctx.reply(
                `¿Confirmas el registro del pago de honorarios de **${client.name}** para el/los periodo(s): **${parsed.join(', ')}**?\n\n` +
                `Responde **SÍ** para guardar o **NO** para cancelar. Baku.`
            );
            return;
        }

        if (dialog.step === 'ask_payment_future_period') {
            const parsed = parsePeriods(text, isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("⚠️ No pude identificar ningún periodo válido por adelantado. Por favor, escribe un mes o periodo válido (ej: \`2026-06\`).");
                return;
            }

            dialog.data.periods = parsed;
            dialog.data.isFuture = true;
            dialog.step = 'confirm_payment';
            pendingDialogs.set(chatId, dialog);

            await ctx.reply(
                `¿Confirmas el registro de pago **adelantado** de **${client.name}** para el/los periodo(s): **${parsed.join(', ')}**?\n\n` +
                `Responde **SÍ** para guardar o **NO** para cancelar. Baku.`
            );
            return;
        }

        if (dialog.step === 'confirm_payment') {
            if (t === 'sí' || t === 'si') {
                await ctx.replyWithChatAction('typing');
                try {
                    const result = await markPaymentsList(client.ruc, 'IVA', dialog.data.periods || []);
                    pendingDialogs.delete(chatId);
                    await ctx.reply(result);
                } catch (err: any) {
                    await ctx.reply(`Error al registrar pagos: ${err.message}. Baku.`);
                }
            } else if (t === 'no') {
                pendingDialogs.delete(chatId);
                await ctx.reply("❌ Registro de pago cancelado. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÍ** o **NO** para confirmar o cancelar.");
            }
            return;
        }
    }

    if (dialog.type === 'mark_declaration') {
        const client = dialog.client;
        const regime = client.regime || 'Régimen General';
        const isPopular = regime === 'Rimpe Negocio Popular';
        const isEmprendedor = regime === 'Rimpe Emprendedor';
        const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
        const isSemestral = ivaFrequency === 'Semestral';

        if (dialog.step === 'ask_declaration_type') {
            if (t === 'iva') {
                dialog.data.type = 'IVA';
                dialog.step = 'ask_declaration_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(`¿Para qué periodo es la declaración de **IVA**? (ej: \`2026-04\` o \`abril\` para mensual, o \`primer semestre\` para semestral). Baku.`);
            } else if (t === 'renta') {
                dialog.data.type = 'RENTA';
                dialog.step = 'ask_declaration_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(`¿Para qué año/período es la declaración de **RENTA**? (ej: \`2025\` o \`2026\`). Baku.`);
            } else {
                await ctx.reply("⚠️ Tipo inválido. Por favor responde **IVA** o **RENTA**.");
            }
            return;
        }

        if (dialog.step === 'ask_declaration_period') {
            const parsed = parsePeriods(text, dialog.data.type === 'IVA' && isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("⚠️ No pude identificar un período válido. Por favor intenta de nuevo (ej: \`2026-04\`, \`abril\`, o \`2025\`).");
                return;
            }

            dialog.data.periods = [parsed[0]];
            dialog.step = 'ask_declaration_realizada';
            pendingDialogs.set(chatId, dialog);
            await ctx.reply(`¿Esta declaración del periodo **${parsed[0]}** ya fue realizada y enviada al SRI? (Responde **SÍ** o **NO**). Baku.`);
            return;
        }

        if (dialog.step === 'ask_declaration_realizada') {
            if (t === 'sí' || t === 'si') {
                dialog.step = 'ask_declaration_method';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(
                    `¿Cómo se realizó la declaración?\n` +
                    `1. **PDF**: Por comprobante PDF oficial\n` +
                    `2. **Clic**: Manualmente con un clic\n\n` +
                    `Responde **PDF** o **CLIC**.`
                );
            } else if (t === 'no') {
                pendingDialogs.delete(chatId);
                await ctx.reply("Entendido. No registraré la declaración todavía. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÍ** o **NO**.");
            }
            return;
        }

        if (dialog.step === 'ask_declaration_method') {
            if (t === 'pdf' || t === 'clic' || t === 'click') {
                dialog.data.method = (t === 'pdf') ? 'pdf' : 'click';
                dialog.step = 'confirm_declaration';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(
                    `¿Confirmas el registro de la declaración de **${dialog.data.type}** (${dialog.data.periods?.[0]}) de **${client.name}** como **Enviada** (vía ${dialog.data.method === 'pdf' ? 'PDF' : 'clic'})?\n\n` +
                    `Responde **SÍ** para guardar o **NO** para cancelar. Baku.`
                );
            } else {
                await ctx.reply("⚠️ Respuesta inválida. Por favor responde **PDF** o **CLIC**.");
            }
            return;
        }

        if (dialog.step === 'confirm_declaration') {
            if (t === 'sí' || t === 'si') {
                await ctx.replyWithChatAction('typing');
                try {
                    const period = dialog.data.periods?.[0] || '';
                    const result = await markDeclaration(client.ruc, dialog.data.type!, period, dialog.data.method!);
                    pendingDialogs.delete(chatId);
                    await ctx.reply(result);
                } catch (err: any) {
                    await ctx.reply(`Error al registrar declaración: ${err.message}. Baku.`);
                }
            } else if (t === 'no') {
                pendingDialogs.delete(chatId);
                await ctx.reply("❌ Registro de declaración cancelado. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÍ** o **NO** para confirmar o cancelar.");
            }
            return;
        }
    }

    if (dialog.type === 'edit_profile_field') {
        if (dialog.step === 'ask_field_value') {
            await ctx.replyWithChatAction('typing');
            const client = dialog.client;
            const field = dialog.data.field!;

            try {
                // Perform the update
                const result = await quickUpdateClient(client.ruc, field, text);
                pendingDialogs.delete(chatId);
                await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });

                // Show the updated profile card again!
                const updatedClients = await findClients(client.ruc, '*');
                if (updatedClients && updatedClients.length > 0) {
                    await showClientProfileCard(chatId, updatedClients[0], ctx);
                }
            } catch (err: any) {
                await ctx.reply(`❌ Error al actualizar el perfil: ${err.message}. Baku.`);
            }
            return;
        }
    }
}

// ─────────────────────────────────────────────────────────
// INLINE KEYBOARD CALLBACK HANDLER
// Handles button taps from client selection menus
// ─────────────────────────────────────────────────────────
bot.on('callback_query:data', async (ctx) => {
    const chatId = ctx.chat?.id.toString() || ctx.from.id.toString();
    const data = ctx.callbackQuery.data;

    // Always answer to dismiss the loading spinner on the button
    await ctx.answerCallbackQuery();

    if (data === 'baku_cancel') {
        pendingDialogs.delete(chatId);
        try { await ctx.editMessageText('❌ Operación cancelada. Baku.'); } catch(e) {}
        return;
    }

    if (data.startsWith('baku_prof_edit:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const field = parts[2];

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        // Fetch the client to have context
        const clients = await findClients(ruc, '*');
        if (!clients || clients.length === 0) {
            await ctx.reply("❌ Error: No se encontró al cliente. Baku.");
            return;
        }
        const client = clients[0];

        // If it's a select field, show specific options inline
        if (field === 'ivaFrequency') {
            pendingDialogs.set(chatId, {
                type: 'edit_profile_field',
                chatId,
                step: 'ask_field_value',
                client,
                data: { field }
            });
            const kb = new InlineKeyboard()
                .text('Mensual', 'baku_val_select:Mensual')
                .text('Semestral', 'baku_val_select:Semestral')
                .text('Ninguno', 'baku_val_select:Ninguno').row()
                .text('❌ Cancelar', 'baku_cancel');
            await ctx.reply(`🔄 Selecciona la nueva **Frecuencia de IVA** para **${client.name}**:`, {
                reply_markup: kb
            });
        } else if (field === 'regime') {
            pendingDialogs.set(chatId, {
                type: 'edit_profile_field',
                chatId,
                step: 'ask_field_value',
                client,
                data: { field }
            });
            const kb = new InlineKeyboard()
                .text('Régimen General', 'baku_val_select:Régimen General').row()
                .text('Rimpe Emprendedor', 'baku_val_select:Rimpe Emprendedor').row()
                .text('Rimpe Negocio Popular', 'baku_val_select:Rimpe Negocio Popular').row()
                .text('❌ Cancelar', 'baku_cancel');
            await ctx.reply(`⚖️ Selecciona el nuevo **Régimen Impositivo** para **${client.name}**:`, {
                reply_markup: kb
            });
        } else {
            pendingDialogs.set(chatId, {
                type: 'edit_profile_field',
                chatId,
                step: 'ask_field_value',
                client,
                data: { field }
            });
            const fieldLabel = FIELD_LABELS[field] || field;
            let promptText = `✍️ Escribe el nuevo valor para **${fieldLabel}** de **${client.name}**:`;
            if (field === 'clientStartPeriod') {
                promptText += `\n\n💡 _Formatos recomendados:_\n- **Mensual**: \`2026-05\` (Mayo 2026)\n- **Semestral**: \`2026-S1\` o \`2026-S2\``;
            }
            await ctx.reply(promptText);
        }
        return;
    }

    if (data.startsWith('baku_val_select:')) {
        const value = data.replace('baku_val_select:', '');
        const dialog = pendingDialogs.get(chatId);
        
        if (!dialog || dialog.type !== 'edit_profile_field' || dialog.step !== 'ask_field_value') {
            try { await ctx.editMessageText('⚠️ Este menú ya expiró. Baku.'); } catch(e) {}
            return;
        }

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const client = dialog.client;
        const field = dialog.data.field!;

        // Perform the update
        const result = await quickUpdateClient(client.ruc, field, value);
        pendingDialogs.delete(chatId);
        await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });

        // Show the updated profile card again!
        const updatedClients = await findClients(client.ruc, '*');
        if (updatedClients.length > 0) {
            await showClientProfileCard(chatId, updatedClients[0], ctx);
        }
        return;
    }

    if (data.startsWith('baku_pay:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const type = parts[2] as 'IVA' | 'RENTA' | 'HONORARIOS';
        const period = parts[3];

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        pendingDialogs.delete(chatId);
        const result = await markPaymentAsPaid(ruc, type, period);
        await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', `Marcar pago de ${type} (${period}) para cliente ${ruc}`);
        await saveMessage(chatId, 'assistant', result);
        return;
    }
    if (data.startsWith('baku_inv_concept:')) {
        const parts = data.split(':');
        const concept = parts[1];
        const amount = parseFloat(parts[2]) || 0;
        
        const dialog = pendingDialogs.get(chatId);
        if (!dialog || dialog.type !== 'create_invoice') return;
        
        dialog.data.invoiceConcept = concept;
        dialog.data.invoiceAmount = amount;
        dialog.step = 'ask_invoice_payment_method';
        
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        const kb = new InlineKeyboard()
            .text('💵 Efectivo (Sin Sist. Fin)', `baku_inv_pay:01`).row()
            .text('🏢 Transferencia/Depósito', `baku_inv_pay:20`).row()
            .text('💳 Tarjeta de Crédito', `baku_inv_pay:19`).row()
            .text('❌ Cancelar', `baku_cancel`);
            
        await ctx.reply(`¿Cuál será la forma de pago para la factura de ${dialog.client.name}?`, { reply_markup: kb });
        return;
    }

    if (data === 'baku_inv_custom') {
        const dialog = pendingDialogs.get(chatId);
        if (!dialog || dialog.type !== 'create_invoice') return;
        
        dialog.step = 'ask_invoice_custom_concept';
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        await ctx.reply(`✏️ Escribe el concepto o descripción que deseas facturar para ${dialog.client.name}:`);
        return;
    }

    if (data.startsWith('baku_inv_pay:')) {
        const parts = data.split(':');
        const paymentCode = parts[1];
        
        const dialog = pendingDialogs.get(chatId);
        if (!dialog || dialog.type !== 'create_invoice') return;
        
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        const client = dialog.client;
        const concept = dialog.data.invoiceConcept || '';
        const amount = dialog.data.invoiceAmount || 0;
        
        // Wake-up ping al servidor (puede estar dormido en Render free tier)
        const wakeMsg = await ctx.reply(
            `⏳ *Conectando con el servidor de facturación SRI...*\n_(Si estuvo inactivo puede tomar hasta 30 segundos)_`,
            { parse_mode: 'Markdown' }
        );
        await wakeUpFacturadorApi();

        try {
            await ctx.api.editMessageText(
                chatId, wakeMsg.message_id,
                `⚙️ Generando y autorizando la factura para *${client.name}*...`,
                { parse_mode: 'Markdown' }
            );
        } catch(e) {}
        
        try {
            const result = await emitInvoice(client, concept, amount, paymentCode);
            
            const isRimpePopular = result.emisor.emisorRegimen === '3';
            const ivaRate = isRimpePopular ? 0.00 : 0.15;
            const ivaValue = Number((amount * ivaRate).toFixed(2));
            const total = Number((amount + ivaValue).toFixed(2));
            
            const totals = {
                subtotal15: isRimpePopular ? 0.00 : amount,
                subtotal0: isRimpePopular ? amount : 0.00,
                iva15: ivaValue,
                total: total
            };

            const pdfBuffer = await generateRidePdfBuffer(
                result.comprobante,
                result.emisor,
                {
                    razonSocial: client.name || client.trade_name,
                    identificacion: client.ruc,
                    direccion: client.address || 'Ecuador'
                },
                result.payload.data.detalle,
                totals
            );
            
            try { await ctx.api.deleteMessage(chatId, wakeMsg.message_id); } catch(e) {}
            
            await ctx.replyWithDocument(new InputFile(pdfBuffer, `RIDE_factura_${result.emisor.emisorEstab}_${result.emisor.emisorPtoEmi}_${result.comprobante.secuencial}.pdf`), {
                caption: `✅ Factura generada y autorizada con éxito.\n\n**Concepto:** ${concept}\n**Total:** $${total.toFixed(2)}`,
                parse_mode: 'Markdown'
            });
        } catch (error: any) {
            console.error('Error emitiendo factura:', error);
            try { await ctx.api.deleteMessage(chatId, wakeMsg.message_id); } catch(e) {}
            
            const httpStatus = error?.response?.status;
            if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
                await ctx.reply(
                    `❌ *El servidor de facturación no respondió (Error ${httpStatus}).*\n\n` +
                    `Esto ocurre cuando el servidor tardó demasiado en despertar. Espera 30 segundos e inténtalo de nuevo — ya debería estar activo.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Error al emitir la factura:\n\`${error.message}\``, { parse_mode: 'Markdown' });
            }
        }
        
        pendingDialogs.delete(chatId);
        return;
    }

    if (data.startsWith('baku_dec_type:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const type = parts[2] as 'IVA' | 'RENTA';
        const period = parts[3];

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}

        const dialog = pendingDialogs.get(chatId);
        if (!dialog || dialog.step !== 'ask_declaration_type') {
            await ctx.reply('⚠️ Este menú ya expiró. Por favor repite tu consulta. Baku.');
            return;
        }

        dialog.data.type = type;

        if (period) {
            dialog.data.periods = [period];
            dialog.step = 'ask_declaration_realizada';
            pendingDialogs.set(chatId, dialog);
            await ctx.reply(convertMarkdownToTelegramHtml(`¿Esta declaración de **${type}** del periodo **${period}** ya fue realizada y enviada al SRI? (Responde **SÍ** o **NO**). Baku.`), { parse_mode: 'HTML' });
        } else {
            dialog.step = 'ask_declaration_period';
            pendingDialogs.set(chatId, dialog);
            const periodExample = type === 'IVA' ? '(ej: `2026-04` o `abril`)' : '(ej: `2025`)';
            await ctx.reply(convertMarkdownToTelegramHtml(`¿Para qué periodo es la declaración de **${type}**? ${periodExample}. Baku.`), { parse_mode: 'HTML' });
        }
        return;
    }

    if (data.startsWith('baku_proof_type:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const type = parts[2] as 'IVA' | 'RENTA';

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const years = await getDeclarationYears(ruc, type);
        if (years.length === 0) {
            await ctx.reply('📋 No se encontraron declaraciones registradas de ' + type + ' para este cliente.');
            return;
        }

        const kb = new InlineKeyboard();
        years.forEach(y => {
            kb.text('📅 Año ' + y, 'baku_proof_year:' + ruc + ':' + type + ':' + y).row();
        });
        kb.text('❌ Cancelar', 'baku_cancel');

        await ctx.reply(
            '📅 Selecciona el **año** de las declaraciones de **' + type + '**:',
            { reply_markup: kb }
        );
        return;
    }

    if (data.startsWith('baku_proof_year:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const type = parts[2] as 'IVA' | 'RENTA';
        const year = parts[3];

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const proofs = await getDeclarationProofsByYear(ruc, type, year);
        if (proofs.length === 0) {
            await ctx.reply('📋 No se encontraron comprobantes para ' + type + ' del año ' + year + '.');
            return;
        }

        const kb = new InlineKeyboard();
        proofs.forEach(p => {
            kb.text('📄 ' + p.type + ' ' + p.period, 'baku_proof_dl:' + ruc + ':' + p.period + ':' + p.type).row();
        });
        kb.text('❌ Cancelar', 'baku_cancel');

        await ctx.reply(
            '📄 Comprobantes disponibles de **' + type + '** (' + year + '):\nPresiona un botón para descargar el PDF:',
            { reply_markup: kb }
        );
        return;
    }

    if (data.startsWith('baku_proof_dl:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const period = parts[2];
        const type = parts[3] as 'IVA' | 'RENTA';

        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const fileResult = await downloadClientProofFile(ruc, period, type);
        if (!fileResult || fileResult.error || !fileResult.contentBase64) {
            await ctx.reply('❌ ' + (fileResult?.error || 'No se pudo descargar el comprobante.'));
            return;
        }

        const buffer = Buffer.from(fileResult.contentBase64, 'base64');
        await ctx.replyWithDocument(new InputFile(buffer, fileResult.fileName), {
            caption: '📄 Comprobante de declaración de **' + type + '** (Periodo: ' + period + ')',
            parse_mode: 'Markdown'
        });
        return;
    }

    if (data.startsWith('baku_inv_pdf:')) {
        const key = data.replace('baku_inv_pdf:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const { data: inv } = await supabase.from('sri_comprobantes').select('*').eq('clave_acceso', key).maybeSingle();
        if (!inv || !inv.xml) {
            await ctx.reply('❌ No se encontró el XML de la factura en el historial.');
            return;
        }

        const emisor = await getEmisorConfig();
        const pdfBuffer = await generateRidePdfBuffer(
            { secuencial: inv.secuencial, claveAcceso: inv.clave_acceso, fechaEmision: inv.fecha_emision, total: inv.total },
            emisor,
            { razonSocial: inv.nombre_receptor, identificacion: inv.ruc_receptor, direccion: 'Ecuador' },
            [{ codigoPrincipal: '001', descripcion: 'Facturación SRI', cantidad: '1.00', precioUnitario: Number(inv.total).toFixed(2), precioTotalSinImpuesto: Number(inv.total).toFixed(2), impuesto: { tarifa: '0', valor: '0.00' } }],
            { subtotal15: 0, subtotal0: Number(inv.total), iva15: 0, total: Number(inv.total) }
        );

        await ctx.replyWithDocument(new InputFile(pdfBuffer, 'RIDE_factura_' + inv.secuencial + '.pdf'), {
            caption: '🧾 Factura Autorizada No. ' + inv.secuencial + '\n**Receptor:** ' + inv.nombre_receptor + '\n**Total:** $' + inv.total,
            parse_mode: 'Markdown'
        });
        return;
    }

    if (data.startsWith('baku_inv_xml:')) {
        const key = data.replace('baku_inv_xml:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const { data: inv } = await supabase.from('sri_comprobantes').select('*').eq('clave_acceso', key).maybeSingle();
        if (!inv || !inv.xml) {
            await ctx.reply('❌ No se encontró el XML de la factura.');
            return;
        }

        const xmlBuffer = Buffer.from(inv.xml, 'utf8');
        await ctx.replyWithDocument(new InputFile(xmlBuffer, 'factura_' + inv.secuencial + '.xml'), {
            caption: '📄 XML firmado No. ' + inv.secuencial
        });
        return;
    }

    if (data.startsWith('baku_hub_pay:')) {
        const ruc = data.replace('baku_hub_pay:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const clients = await findClients(ruc, '*');
        if (clients && clients.length > 0) {
            await initiatePaymentFlow(chatId, clients, ctx);
        }
        return;
    }

    if (data.startsWith('baku_hub_proofs:')) {
        const ruc = data.replace('baku_hub_proofs:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const clients = await findClients(ruc, '*');
        if (clients && clients.length > 0) {
            await showProofTypeSelector(chatId, clients[0], ctx);
        }
        return;
    }

    if (data.startsWith('baku_hub_p12:')) {
        const ruc = data.replace('baku_hub_p12:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const clients = await findClients(ruc, '*');
        if (clients && clients.length > 0) {
            const c = clients[0];
            const hasP12 = c.signature_file && c.signature_file.content;
            let msg = `🔐 <b>Firma Electrónica .p12 — ${c.name}</b>\n\n`;
            msg += `🔑 <b>Contraseña:</b> <code>${c.signature_password || 'No asignada'}</code>\n`;
            msg += `⏳ <b>Vencimiento:</b> ${c.signature_expiration || 'No registrado'}\n`;
            msg += `📁 <b>Estado Archivo:</b> ${hasP12 ? '✅ Guardado en Bóveda (' + c.signature_file.name + ')' : '❌ No subido'}\n\n`;
            msg += `<i>Para actualizar la firma, simplemente adjunta el archivo .p12 o .pfx directamente en el chat.</i>`;
            await ctx.reply(convertMarkdownToTelegramHtml(msg), { parse_mode: 'HTML' });
        }
        return;
    }

    if (data.startsWith('baku_hub_portal:')) {
        const ruc = data.replace('baku_hub_portal:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const clients = await findClients(ruc, '*');
        if (clients && clients.length > 0) {
            const c = clients[0];
            const portalUrl = `https://santiagocordova.com/portal?ruc=${c.ruc}`;
            let msg = `📲 <b>PORTAL INTERACTIVO DEL CLIENTE</b>\n\n`;
            msg += `👤 <b>Cliente:</b> ${c.name}\n`;
            msg += `🔗 <b>Enlace Seguro:</b> ${portalUrl}\n\n`;
            msg += `<b>Mensaje listo para enviar por WhatsApp:</b>\n`;
            msg += `<code>Estimado(a) ${c.name}, le compartimos el enlace seguro a su Portal de Cliente para consultar su información tributaria y comprobantes: ${portalUrl}</code>`;
            await ctx.reply(convertMarkdownToTelegramHtml(msg), { parse_mode: 'HTML' });
        }
        return;
    }

    if (data.startsWith('baku_hub_edit:')) {
        const ruc = data.replace('baku_hub_edit:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const kb = new InlineKeyboard()
            .text('📅 Editar Inicio Oblig.', `baku_prof_edit:${ruc}:clientStartPeriod`).row()
            .text('🔄 Editar Frecuencia IVA', `baku_prof_edit:${ruc}:ivaFrequency`).row()
            .text('⚖️ Editar Régimen', `baku_prof_edit:${ruc}:regime`).row()
            .text('🔑 Editar Clave SRI', `baku_prof_edit:${ruc}:sri_password`).row()
            .text('📧 Editar Correo', `baku_prof_edit:${ruc}:email`).row()
            .text('📞 Editar Teléfono', `baku_prof_edit:${ruc}:phones`).row()
            .text('❌ Cancelar', 'baku_cancel');
        await ctx.reply('✏️ Selecciona el campo del perfil que deseas modificar:', { reply_markup: kb });
        return;
    }

    if (data.startsWith('baku_ocr_pay:')) {
        const parts = data.split(':');
        const ruc = parts[1];
        const amount = parseFloat(parts[2]) || 0;
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        await ctx.replyWithChatAction('typing');

        const clients = await findClients(ruc, '*');
        if (!clients || clients.length === 0) {
            await ctx.reply('❌ No se encontró el cliente para procesar el pago.');
            return;
        }

        const client = clients[0];
        await markPaymentAsPaid(ruc, 'HONORARIOS');
        const replyMsg = `✅ <b>¡Pago de Honorarios Registrado Exitosamente!</b>\n\n` +
                       `👤 <b>Cliente:</b> ${client.name}\n` +
                       `🆔 <b>RUC:</b> <code>${client.ruc}</code>\n` +
                       (amount > 0 ? `💰 <b>Monto Conciliado:</b> $${amount.toFixed(2)}\n` : '') +
                       `📅 <b>Fecha:</b> ${new Date().toLocaleDateString()}\n\n` +
                       `⚡ Base de datos sincronizada en Supabase.`;
        
        await ctx.reply(replyMsg, { parse_mode: 'HTML' });
        return;
    }

    if (data.startsWith('baku_hub_profile:')) {
        const ruc = data.replace('baku_hub_profile:', '');
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        const clients = await findClients(ruc, '*');
        if (clients && clients.length > 0) {
            await showClientProfileCard(chatId, clients[0], ctx);
        }
        return;
    }

    if (data.startsWith('baku_cmd:')) {
        const cmd = data.replace('baku_cmd:', '');
        
        // Remove keyboard from the menu message
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        if (cmd === 'debt_report') {
            await ctx.replyWithChatAction('typing');
            const report = await getDebtorClients();
            await ctx.reply(convertMarkdownToTelegramHtml(report), { parse_mode: 'HTML' });
            return;
        }

        if (cmd === 'deadlines') {
            await ctx.replyWithChatAction('typing');
            const report = await getUpcomingDeadlines();
            await ctx.reply(convertMarkdownToTelegramHtml(report), { parse_mode: 'HTML' });
            return;
        }

        if (cmd === 'browse_proofs') {
            pendingDialogs.set(chatId, {
                type: 'browse_proofs',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply('📄 ¿De qué cliente deseas consultar comprobantes de declaración? (Escribe el nombre o RUC):');
            return;
        }

        if (cmd === 'upload_p12') {
            await ctx.reply('🔐 **Subida de Firma Electrónica (.p12)**\n\nPor favor adjunta o reenvía el archivo **.p12** o **.pfx** directamente a este chat de Telegram.');
            return;
        }

        if (cmd === 'browse_invoices') {
            await showInvoicesListForClient(chatId, undefined, ctx);
            return;
        }

        if (cmd === 'view_profile') {
            pendingDialogs.set(chatId, {
                type: 'view_profile',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("👤 ¿De qué cliente deseas ver el perfil y editar sus datos? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'reg_payment') {
            pendingDialogs.set(chatId, {
                type: 'mark_payment',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("✍️ ¿Para qué cliente deseas registrar el pago? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'see_sri_key') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'sri_password' }
            });
            await ctx.reply("🔍 ¿De qué cliente deseas consultar la clave SRI? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'see_sig_key') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'electronicSignaturePassword' }
            });
            await ctx.reply("🔑 ¿De qué cliente deseas ver la clave de la firma electrónica? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'download_p12') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'electronicSignaturePassword' }
            });
            await ctx.reply("📂 ¿De qué cliente deseas descargar la firma electrónica (.p12)? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'check_expiry') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'signatureExpirationDate' }
            });
            await ctx.reply("📅 ¿De qué cliente deseas ver la fecha de caducidad de la firma? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'download_proof') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'sri_declaraciones' }
            });
            await ctx.reply("📄 ¿De qué cliente deseas ver/descargar comprobantes de declaraciones? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'create_invoice') {
            pendingDialogs.set(chatId, {
                type: 'create_invoice',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("🧾 ¿A qué cliente le deseas emitir la factura? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'quick_report') {
            await ctx.replyWithChatAction('typing');
            const summary = await getDatabaseSummary();
            await ctx.reply(convertMarkdownToTelegramHtml(summary), { parse_mode: 'HTML' });
        }
        return;
    }

    if (!data.startsWith('baku_sel:')) return;

    const ruc = data.replace('baku_sel:', '');
    const dialog = pendingDialogs.get(chatId);

    if (!dialog || dialog.step !== 'select_client') {
        try { await ctx.editMessageText('⚠️ Este menú ya expiró. Por favor repite tu consulta. Baku.'); } catch(e) {}
        return;
    }

    const client = dialog.candidates?.find(c => c.ruc === ruc);
    if (!client) {
        await ctx.reply('❌ Ocurrió un error al seleccionar el cliente. Baku.');
        return;
    }

    // Remove the inline keyboard from the original message to keep chat clean
    try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
    await ctx.reply(`✅ Seleccionado: <b>${client.name}</b>`, { parse_mode: 'HTML' });

    if (dialog.type === 'field_query') {
        const field = dialog.data.field!;
        if (field === 'sri_declaraciones') {
            const result = await getClientDeclarationProofsList(ruc);
            pendingDialogs.delete(chatId);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            await saveMessage(chatId, 'user', `Historial de declaraciones de ${client.name}`);
            await saveMessage(chatId, 'assistant', result);
        } else if (dialog.data.value !== undefined) {
            // Quick update flow
            const result = await quickUpdateClient(ruc, field, dialog.data.value);
            pendingDialogs.delete(chatId);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            await saveMessage(chatId, 'user', `Actualizar ${field} de ${client.name} a ${dialog.data.value}`);
            await saveMessage(chatId, 'assistant', result);
        } else {
            // Field read flow
            const result = await getClientField(ruc, field);
            pendingDialogs.delete(chatId);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            await saveMessage(chatId, 'user', `Ver ${field} de ${client.name}`);
            await saveMessage(chatId, 'assistant', result);
        }
    } else if (dialog.type === 'mark_payment') {
        await startPaymentFlowForClient(chatId, client, ctx);
    } else if (dialog.type === 'mark_declaration') {
        await startDeclarationFlowForClient(chatId, client, ctx);
    } else if (dialog.type === 'view_profile' as any) {
        pendingDialogs.delete(chatId);
        await showClientProfileCard(chatId, client, ctx);
    }
});

// Handle all incoming text messages
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();

  // 1. Try direct command (zero AI tokens — instant, with inline keyboard disambiguation)
  // This is placed FIRST so users can escape stuck dialogs by using a shortcut command.
  try {
    const beforeDialog = pendingDialogs.get(chatId);
    const directHandled = await tryDirectCommand(text, chatId, ctx);
    if (directHandled) {
        const afterDialog = pendingDialogs.get(chatId);
        if (beforeDialog && afterDialog === beforeDialog) {
            pendingDialogs.delete(chatId);
        }
        return;
    }
  } catch (err: any) {
    console.error(`❌ Error in direct command for chat ${chatId}:`, err);
  }

  // 2. Check if there is a pending dialog
  if (pendingDialogs.has(chatId)) {
      await handleDialogStep(chatId, text, ctx);
      return;
  }

  // 3. Check if a dialog is triggered by this message
  const triggered = await handleDialogTriggers(chatId, text, ctx);
  if (triggered) return;

  // Handle "SÍ GUARDAR" confirmation
  if (text.toUpperCase() === 'SÍ GUARDAR' || text.toUpperCase() === 'SI GUARDAR') {
    const pending = pendingPdfs.get(chatId);
    if (!pending) return ctx.reply("No tengo ningún documento pendiente por guardar.");

    await ctx.replyWithChatAction('typing');
    try {
      const { buffer, data } = pending;
      const folderName = `SantiagoBot/Clientes/${data.ruc}`;
      const fileName = `${data.type}_${data.period.replace(/\//g, '-')}.pdf`;
      
      // Upload to Drive
      const driveFile = await uploadToDrive(fileName, buffer, folderName);
      
      // Convert buffer to base64 for local database persistence
      const base64Content = buffer.toString('base64');
      const dbResult = await saveDeclarationPdf(
          data.ruc,
          data.type as 'IVA' | 'RENTA',
          data.period,
          fileName,
          buffer.length,
          base64Content,
          parseFloat(data.amount) || 0
      );
      
      const note = `Documento ${data.type} periodo ${data.period} cargado el ${new Date().toLocaleDateString()}. [Drive: ${driveFile.id}]`;
      await updateClientData(data.ruc, { notes: note, last_update: new Date().toISOString() });
      pendingPdfs.delete(chatId);
      await ctx.reply(`✅ ¡Todo listo, Santiago!\n\n1. Archivo guardado en Google Drive (${folderName}/${fileName})\n2. Supabase actualizado (${dbResult}).\n\n${STATUS_ICON}`);
    } catch (err: any) {
      await ctx.reply("Error guardando el documento: " + err.message);
    }
    return;
  }

  // 4. Full AI agent loop — show thinking indicator only here
  const thinkingMsg = await ctx.reply(`⚡ Procesando...`);
  try {
    const response = await processChatWithAgentLoop(chatId, text);
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await handleAgentResponse(ctx, response);
  } catch (err: any) {
    console.error(`❌ Error in agent loop for chat ${chatId}:`, err);
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await ctx.reply('⚠️ Santiago, he tenido un inconveniente técnico. Por favor, intenta de nuevo.');
  }
});

/**
 * Shared logic to send text/audio response
 */
async function handleAgentResponse(ctx: any, response: string) {
    const chatId = ctx.chat.id.toString();
    let isAudio = false;
    let textResponse = response;
    let audioResponse = response;
    
    // Check if the agent decided to reply with audio (be flexible with whitespace/case)
    if (response.toUpperCase().includes('[AUDIO]')) {
      isAudio = true;
      const parts = response.split(/\[AUDIO\]/i);
      textResponse = parts[0].trim();
      audioResponse = parts[1] ? parts[1].trim() : parts[0].trim();
    }

    const userText = (ctx.message?.text || ctx.message?.caption || "").toLowerCase();
    const isVoiceInput = !!(ctx.message && ctx.message.voice);

    console.log(`🎙️ handleAgentResponse | isVoiceInput: ${isVoiceInput} | LLM Response contains [AUDIO]: ${response.toUpperCase().includes('[AUDIO]')}`);

    if (userText.includes('audio') || userText.includes('nota de voz') || userText.includes('háblame') || userText.includes('hablame') || userText.includes('escuche') || userText.includes('escuchar')) {
      isAudio = true;
      console.log("🎙️ Forcing audio due to user keywords.");
    }
    
    // Force audio output if input was voice
    if (isVoiceInput) {
      isAudio = true;
      console.log("🎙️ Forcing audio due to voice input.");
    }

    console.log(`🎙️ Final isAudio decision: ${isAudio}`);

    // If audio is requested but there is no [AUDIO] tag, and the response is very long, we don't want to speak the whole thing
    if (isAudio && !response.toUpperCase().includes('[AUDIO]') && textResponse.length > 300) {
      audioResponse = "Santiago, te he dejado los detalles por escrito en Telegram para no dictarte una lista muy larga. Baku.";
    }

    // Send text response with icon
    await ctx.reply(`${textResponse}\n\n${STATUS_ICON}`);
    
    // Send audio if requested OR if input was voice (forced audio)
    if (isAudio) {
      console.log("🎙️ Attempting record_voice action...");
      await ctx.replyWithChatAction('record_voice');
      try {
        console.log(`🎙️ Generating TTS for: "${audioResponse.substring(0, 60)}..."`);
        const voiceInputFile = await textToSpeech(audioResponse);
        console.log("🎙️ Sending voice message...");
        await ctx.replyWithAudio(voiceInputFile, { caption: "Baku Voice" });
      } catch (ttsErr: any) {
        console.error("⚠️ TTS Error:", ttsErr.message);
        // Better error reporting for audio failures
        const errorNote = isVoiceInput 
          ? "🎙️ (Santiago, he transcrito tu audio arriba, pero no pude generar mi respuesta en voz por un error técnico. Baku.)"
          : "🎙️ (Nota: No pude generar el audio solicitado por un error técnico. Baku.)";
        
        await ctx.reply(errorNote);
      }
    }
}

// Handle incoming documents (PDFs)
bot.on('message:document', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const doc = ctx.message.document;
    if (!doc) return;

    const fileName = doc.file_name || 'documento';
    const isP12 = fileName.endsWith('.p12') || fileName.endsWith('.pfx');
    const isPdf = fileName.toLowerCase().endsWith('.pdf');

    await ctx.replyWithChatAction('typing');
    try {
        const fileObj = await ctx.api.getFile(doc.file_id);
        if (!fileObj.file_path) throw new Error('No se pudo obtener la ruta del archivo en Telegram');
        
        const fileUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_BOT_TOKEN + '/' + fileObj.file_path;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        if (isP12) {
            const base64Content = buffer.toString('base64');
            pendingDialogs.set(chatId, {
                type: 'upload_p12',
                chatId,
                step: 'ask_client_name',
                data: {
                    p12Base64: base64Content,
                    p12FileName: fileName
                }
            });
            await ctx.reply('🔐 Recibí la Firma Electrónica **' + fileName + '**.\n\n¿A qué cliente pertenece? (Escribe el nombre o RUC). Baku.');
        } else if (isPdf) {
            const resText = await processAndSaveDeclarationPdf(buffer, fileName);
            await ctx.reply(convertMarkdownToTelegramHtml(resText), { parse_mode: 'HTML' });
        } else {
            await ctx.reply('📁 Archivo **' + fileName + '** recibido.');
        }
    } catch (err: any) {
        console.error('Error al procesar documento enviado:', err);
        await ctx.reply('❌ Error al procesar el archivo: ' + err.message);
    }
});

// Handle incoming photos (Smart Vision OCR para comprobantes de pago)
bot.on('message:photo', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const photos = ctx.message.photo;
    if (!photos || photos.length === 0) return;

    // Pick highest resolution photo
    const photo = photos[photos.length - 1];

    await ctx.replyWithChatAction('typing');
    try {
        const fileObj = await ctx.api.getFile(photo.file_id);
        if (!fileObj.file_path) throw new Error('No se pudo obtener la ruta de la foto en Telegram');

        const fileUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_BOT_TOKEN + '/' + fileObj.file_path;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        const ocrResult = await processPaymentReceipt(buffer, 'image/jpeg');

        if (ocrResult.client) {
            const kb = new InlineKeyboard();
            const amount = ocrResult.extracted?.amount || 0;
            kb.text(`✅ Registrar Pago ($${amount > 0 ? amount.toFixed(2) : 'OK'})`, `baku_ocr_pay:${ocrResult.client.ruc}:${amount}`).row();
            kb.text(`👤 Ver Expediente 360°`, `baku_hub_profile:${ocrResult.client.ruc}`);
            kb.text(`❌ Descartar`, 'baku_cancel');

            await ctx.reply(convertMarkdownToTelegramHtml(ocrResult.message), {
                parse_mode: 'HTML',
                reply_markup: kb
            });
        } else if (ocrResult.candidates && ocrResult.candidates.length > 0) {
            const kb = buildClientKeyboard(ocrResult.candidates);
            await ctx.reply(convertMarkdownToTelegramHtml(ocrResult.message), {
                parse_mode: 'HTML',
                reply_markup: kb
            });
        } else {
            await ctx.reply(convertMarkdownToTelegramHtml(ocrResult.message), {
                parse_mode: 'HTML'
            });
        }
    } catch (err: any) {
        console.error('Error al procesar foto recibida:', err);
        await ctx.reply('⚠️ Error procesando la imagen con Smart Vision OCR: ' + err.message);
    }
});

// Handle incoming voice notes (Groq Whisper STT + TTS response)
bot.on('message:voice', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const voice = ctx.message.voice;
    if (!voice) return;

    await ctx.replyWithChatAction('typing');
    try {
        const fileObj = await ctx.api.getFile(voice.file_id);
        if (!fileObj.file_path) throw new Error('No se pudo obtener la ruta del audio en Telegram');

        const fileUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_BOT_TOKEN + '/' + fileObj.file_path;
        const transcribedText = await transcribeAudioUrl(fileUrl);

        if (!transcribedText || transcribedText.trim().length === 0) {
            await ctx.reply('🎙️ No pude reconocer lo que dijiste en el audio. ¿Podrías repetir o escribirlo?');
            return;
        }

        console.log(`🎙️ [Voice STT] Mensaje transcrito de ${chatId}: "${transcribedText}"`);
        await ctx.reply(`🎙️ <i>"${transcribedText}"</i>`, { parse_mode: 'HTML' });

        // 1. Try direct command
        const directHandled = await tryDirectCommand(transcribedText, chatId, ctx);
        if (directHandled) return;

        // 2. Try pending dialog
        if (pendingDialogs.has(chatId)) {
            await handleDialogStep(chatId, transcribedText, ctx);
            return;
        }

        // 3. Process via AI Agent
        const thinkingMsg = await ctx.reply(`⚡ Baku pensando...`);
        try {
            const response = await processChatWithAgentLoop(chatId, transcribedText);
            try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
            await handleAgentResponse(ctx, response);
        } catch (agentErr: any) {
            try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
            await ctx.reply('⚠️ Ocurrió un error al procesar tu solicitud por voz: ' + agentErr.message);
        }
    } catch (err: any) {
        console.error('Error al procesar nota de voz:', err);
        await ctx.reply('⚠️ Error procesando nota de voz: ' + err.message);
    }
});

// ==========================================
// 🚀 HTTP SERVER (Health Checks for Render) & BOT STARTUP
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint for Render
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Baku Telegram Bot',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start Express HTTP Server (prevents Render "No open ports detected" shutdown)
app.listen(PORT, () => {
    console.log(`🌐 Web server listening on port ${PORT} for Render health checks.`);
});

// Start Cron Jobs
try {
    startCronJobs(bot);
    console.log('⏰ Cron jobs initialized.');
} catch (cronErr) {
    console.error('⚠️ Error starting cron jobs:', cronErr);
}

// Start Telegram Bot Long Polling with Auto-Recovery
async function launchBot() {
    console.log('🚀 Iniciando Telegram Bot (Baku)...');
    try {
        // Elimina posibles webhooks previos que causan conflictos 409
        await bot.api.deleteWebhook({ drop_pending_updates: false });
        const me = await bot.api.getMe();
        console.log(`🤖 Bot @${me.username} (ID: ${me.id}) autenticado con éxito.`);
        
        await bot.start({
            onStart: (botInfo) => {
                console.log(`✅ ¡Bot @${botInfo.username} en línea y listo para recibir mensajes!`);
            }
        });
    } catch (err: any) {
        console.error('❌ Error crítico al iniciar Telegram bot:', err.message);
        if (err.message.includes('401')) {
            console.error('🔑 ERROR 401: El TELEGRAM_BOT_TOKEN es inválido o no está configurado.');
        } else if (err.message.includes('409')) {
            console.error('⚠️ ERROR 409: Hay otra instancia del bot ejecutándose simultáneamente o un webhook activo.');
        }
    }
}

launchBot();