import { Bot, InlineKeyboard, InputFile } from 'grammy';
require('dotenv').config();
import { processChatWithAgentLoop, BOT_NAME, STATUS_ICON } from './agent';
import { clearChatHistory, saveMessage } from './database';
import { getAuthUrl, setTokenFromCode } from './gmail';
import express from 'express';
import { transcribeAudioUrl, textToSpeech, updateVoiceConfig, getVoiceStatus } from './voice';
import { validateSRIPDF, ValidatedPDF } from './pdf-validator';
import { uploadToDrive } from './google-sync';
import { updateClientData, getDebtorClients, getUpcomingDeadlines, getDatabaseSummary, getClientsStatusReport, getClientField, quickUpdateClient, markPaymentAsPaid, findClients, markPaymentsList, markDeclaration, get_sri_credential, saveDeclarationPdf, getClientDeclarationProofsList, convertMarkdownToTelegramHtml, FIELD_LABELS, FIELD_DB_MAPPING } from './database_ops';
import axios from 'axios';
import { createRouteHandler } from "uploadthing/express";
import { ourFileRouter } from "./uploadthing";
import { startCronJobs, triggerProactiveReport } from './cron';
import { supabase } from './supabase';
import { processPaymentReceipt } from './vision';
import { emitInvoice } from './sri_api';
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
  
  console.log(`Ã°Å¸â€œÂ¥ UPDATE RECEIVED: [User: ${username}] [ID: ${userId}]`);

  if (userId && ALLOWED_USERS.includes(userId)) {
    console.log(`Ã¢Å“â€¦ User ${userId} authorized.`);
    return await next();
  }
  
  console.warn(`Ã¢â€ºâ€ ACCESS DENIED: User ${userId} (@${username}) is not in ALLOWED_USERS:`, ALLOWED_USERS);
  await ctx.reply(`Lo siento, no tienes permiso para usar este bot o tu ID (${userId}) no estÃƒÂ¡ en la lista blanca. Por favor, avÃƒÂ­sale a Santiago.`);
});

// Error handling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ã¢ÂÅ’ CRITICAL ERROR while handling update ${ctx.update.update_id}:`, err.error);
  // Optional: Notify the user if possible
  ctx.reply("Ups, ocurriÃƒÂ³ un error interno. Santiago ya fue notificado. Baku.").catch(e => console.error("Could not send error report to user:", e));
});

// Base commands
bot.command('start', async (ctx) => {
  await ctx.reply(`Ã‚Â¡Hola! Soy ${BOT_NAME}. Tu agente privado enfocado en solucionar problemas, ejecutar herramientas y ayudarte con IA. Control total garantizado.\n\nEscrÃƒÂ­beme para empezar.`);
});

bot.command('clear', async (ctx) => {
  if (ctx.chat) {
    await clearChatHistory(ctx.chat.id.toString());
    await ctx.reply('La memoria de nuestra conversaciÃƒÂ³n ha sido borrada permanentemente.');
  }
});

bot.command('authgmail', async (ctx) => {
  const url = getAuthUrl();
  await ctx.reply(`Para permitir que el bot lea tus correos, por favor entra al siguiente enlace y autoriza a tu cuenta de Google:\n\n${url}\n\nDespuÃƒÂ©s de autorizar, la pÃƒÂ¡gina te redirigirÃƒÂ¡. Ã‚Â¡Copia el texto despuÃƒÂ©s de \`code=\` en la barra de direcciones y mÃƒÂ¡ndamelo usando el comando:\n/setgmailcode TU_CODIGO`);
});

bot.command('setgmailcode', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const code = ctx.match;
  if (!code) {
    return ctx.reply('Por favor dame el cÃƒÂ³digo. Ejemplo: /setgmailcode 4/0AeaYSHC...');
  }

  await ctx.replyWithChatAction('typing');
  try {
    await setTokenFromCode(chatId, code as string);
    await ctx.reply('Ã‚Â¡Listo! Has autorizado tu cuenta de Google perfectamente. Ahora puedes pedirme "Lee mis correos sin leer".');
  } catch (err: any) {
    await ctx.reply('Error autorizando tu cuenta: ' + err.message);
  }
});

bot.command('setelevenlabs', async (ctx) => {
    const key = ctx.match;
    if (!key) return ctx.reply('Uso: /setelevenlabs TU_CLAVE_API');
    updateVoiceConfig(key as string);
    await ctx.reply('Ã¢Å“â€¦ Clave de ElevenLabs actualizada. Baku.');
});

bot.command('setvoice', async (ctx) => {
    const voiceId = ctx.match;
    if (!voiceId) return ctx.reply('Uso: /setvoice ID_DE_VOZ');
    updateVoiceConfig(undefined, voiceId as string);
    await ctx.reply(`Ã¢Å“â€¦ Voz de ElevenLabs cambiada a: ${voiceId}. Baku.`);
});

bot.command('status', async (ctx) => {
    const vStatus = await getVoiceStatus();
    let statusMsg = "Ã°Å¸â€œÅ  <b>ESTADO DEL SISTEMA:</b>\n\n";
    statusMsg += `Ã°Å¸Å½â„¢Ã¯Â¸Â ElevenLabs: ${vStatus.elevenLabs ? 'Ã¢Å“â€¦ Conectado' : 'Ã¢ÂÅ’ Sin Clave'}\n`;
    statusMsg += `Ã°Å¸â€ â€ Voz Actual: <code>${vStatus.voiceId}</code>\n`;
    statusMsg += `Ã¢ËœÂÃ¯Â¸Â Google TTS: ${vStatus.googleCloud ? 'Ã¢Å“â€¦ Activo (Respaldo)' : 'Ã¢Å¡Â Ã¯Â¸Â No configurado'}\n`;
    statusMsg += `Ã°Å¸Â§Â  Groq: Ã¢Å“â€¦ Activo\n`;
    statusMsg += "\nBaku.";
    await ctx.reply(statusMsg, { parse_mode: 'HTML' });
});

bot.command('testcron', async (ctx) => {
    await ctx.reply('Ã¢ÂÂ³ Forzando la generaciÃƒÂ³n del reporte proactivo matutino. Por favor espera...');
    await triggerProactiveReport(bot, ctx.chat.id.toString());
});

bot.command('reporte', async (ctx) => {
    await ctx.reply('Ã¢ÂÂ³ Comandante, estoy preparando y consolidando el reporte operativo en tiempo real. Un momento...');
    await triggerProactiveReport(bot, ctx.chat.id.toString());
});


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// PRE-AI SHORTCUT ENGINE Ã¢â‚¬â€ Zero tokens, instant responses
// Now with inline keyboard disambiguation Ã¢â‚¬â€ no context loss!
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/** Builds a Telegram inline keyboard for client selection */
function buildClientKeyboard(clients: any[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    clients.slice(0, 8).forEach(c => {
        const baseName = c.name.split(' ').slice(0, 3).join(' ');
        const label = c.trade_name
            ? `${baseName} Ã‚Â· ${c.trade_name.split(' ')[0]}`
            : baseName;
        kb.text(`Ã°Å¸â€˜Â¤ ${label.substring(0, 30)}`, `baku_sel:${c.ruc}`).row();
    });
    kb.text('Ã¢ÂÅ’ Cancelar', 'baku_cancel');
    return kb;
}

/** Muestra la ficha del perfil del cliente con botones de ediciÃƒÂ³n */
async function showClientProfileCard(chatId: string, client: any, ctx: any) {
    const ruc = client.ruc || "";
    const regime = client.regime || 'RÃƒÂ©gimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
    
    // Normalizar inicio de obligaciones
    const rawTaxProfile = client.tax_profile || {};
    const clientStartPeriod = client.clientStartPeriod || rawTaxProfile.clientStartPeriod || 'No configurado';
    
    let obligationsText = "";
    if (ivaFrequency === 'Mensual') obligationsText = 'IVA Mensual';
    else if (ivaFrequency === 'Semestral') obligationsText = 'IVA Semestral';
    else obligationsText = 'Exento / Ninguno';

    let cardText = `Ã°Å¸â€˜Â¤ <b>EXPEDIENTE: ${client.name}</b>\n`;
    if (client.trade_name) cardText += `Ã°Å¸ÂÂ¢ <b>Nombre Comercial:</b> ${client.trade_name}\n`;
    cardText += `Ã°Å¸â€ â€ <b>RUC:</b> <code>${ruc}</code>\n`;
    cardText += `Ã¢Å¡â€“Ã¯Â¸Â <b>RÃƒÂ©gimen:</b> ${regime}\n`;
    cardText += `Ã°Å¸â€â€ž <b>Frecuencia IVA:</b> ${obligationsText}\n`;
    cardText += `Ã°Å¸â€œâ€¦ <b>Inicio Obligaciones:</b> <code>${clientStartPeriod}</code>\n`;
    cardText += `Ã°Å¸â€œÂ§ <b>Email:</b> ${client.email || '<i>(vacÃƒÂ­o)</i>'}\n`;
    cardText += `Ã°Å¸â€œÅ¾ <b>Telf:</b> ${client.phones ? client.phones.join(', ') : '<i>(vacÃƒÂ­o)</i>'}\n`;
    cardText += `Ã°Å¸â€â€˜ <b>Clave SRI:</b> <code>${client.sri_password || '<i>(vacÃƒÂ­o)</i>'}</code>\n`;
    cardText += `Ã°Å¸â€â€˜ <b>Clave Firma:</b> <code>${client.signature_password || '<i>(vacÃƒÂ­o)</i>'}</code>\n`;
    if (client.signature_expiration) cardText += `Ã¢ÂÂ³ <b>Vence Firma:</b> ${client.signature_expiration}\n`;
    if (client.notes) cardText += `Ã°Å¸â€œÂ <b>Notas:</b> ${client.notes}\n`;

    const kb = new InlineKeyboard()
        .text('Ã°Å¸â€œâ€¦ Editar Inicio Oblig.', `baku_prof_edit:${ruc}:clientStartPeriod`).row()
        .text('Ã°Å¸â€â€ž Editar Frecuencia IVA', `baku_prof_edit:${ruc}:ivaFrequency`).row()
        .text('Ã¢Å¡â€“Ã¯Â¸Â Editar RÃƒÂ©gimen', `baku_prof_edit:${ruc}:regime`).row()
        .text('Ã°Å¸â€â€˜ Editar Clave SRI', `baku_prof_edit:${ruc}:sri_password`).row()
        .text('Ã°Å¸â€œÂ§ Editar Correo', `baku_prof_edit:${ruc}:email`).row()
        .text('Ã°Å¸â€œÅ¾ Editar TelÃƒÂ©fono', `baku_prof_edit:${ruc}:phones`).row()
        .text('Ã¢ÂÅ’ Cerrar Perfil', 'baku_cancel');

    await ctx.reply(convertMarkdownToTelegramHtml(cardText), {
        parse_mode: 'HTML',
        reply_markup: kb
    });
}

/** Sets up a pending dialog and shows a client selection keyboard */
async function showClientSelection(
    chatId: string,
    clients: any[],
    dialogType: 'mark_payment' | 'mark_declaration' | 'field_query' | 'view_profile' | 'edit_profile_field' | 'create_invoice',
    data: DialogState['data'],
    ctx: any,
    message: string = 'Ã°Å¸â€Â EncontrÃƒÂ© varios clientes. Selecciona el correcto:'
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
        .text('Ã°Å¸â€˜Â¤ Ver Perfil de Cliente', 'baku_cmd:view_profile').row()
        .text('Ã°Å¸â€™Â° Registrar Pago', 'baku_cmd:reg_payment').row()
        .text('Ã°Å¸â€˜Â¤ Ver Claves SRI', 'baku_cmd:see_sri_key').row()
        .text('Ã°Å¸â€â€˜ Clave Firma ElectrÃƒÂ³nica', 'baku_cmd:see_sig_key').row()
        .text('Ã°Å¸â€œâ€š Descargar Firma (.p12)', 'baku_cmd:download_p12').row()
        .text('Ã°Å¸â€œâ€¦ CuÃƒÂ¡ndo Caduca Firma', 'baku_cmd:check_expiry').row()
        .text('Ã°Å¸â€œâ€ž Ver Comprobantes', 'baku_cmd:download_proof').row()
        .text('Ã°Å¸Â§Â¾ Emitir Factura', 'baku_cmd:create_invoice').row()
        .text('Ã°Å¸â€œÅ  Reporte RÃƒÂ¡pido General', 'baku_cmd:quick_report');

    await ctx.reply(
        `Ã°Å¸Å½Â¯ <b>CENTRO DE OPERACIONES TÃƒÂCTICAS Ã¢â‚¬â€ SANTIAGO</b>\n\n` +
        `Selecciona una acciÃƒÂ³n directa para gestionar la cartera de clientes de forma inmediata:`,
        {
            parse_mode: 'HTML',
            reply_markup: kb
        }
    );
}

/**
 * Pre-AI shortcut engine. Returns true if the message was handled.
 * Uses inline keyboard buttons when multiple clients match Ã¢â‚¬â€ no context loss.
 */
async function tryDirectCommand(text: string, chatId: string, ctx: any): Promise<boolean> {
    const t = text.toLowerCase().trim();

    // Trigger operational menu
    if (['pagos', 'menÃƒÂº', 'menu', 'santiago', 'opciones', 'inicio', 'comenzar', 'baku', 'cliente', 'clientes'].includes(t)) {
        await showOperationalMenu(ctx);
        return true;
    }

    // Trigger proactive report
    if (['reporte', 'reporte matutino', 'forzar reporte', 'reporte proactivo', 'enviar reporte'].includes(t)) {
        await ctx.reply('Ã¢ÂÂ³ Comandante, estoy preparando y consolidando el reporte operativo en tiempo real. Un momento...');
        await triggerProactiveReport(bot, chatId);
        return true;
    }

    // Stop identifier capture at " y " to avoid compound query false positives
    // e.g. "RUC de aleida y su clave" Ã¢â€ â€™ identifier = "aleida"
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
            await ctx.reply(`\u274c No encontrÃƒÂ© ningÃƒÂºn cliente con "${identifier}". Baku.`);
            return true;
        }
        if (clients.length === 1) {
            const client = clients[0];
            const result = await getClientField(client.ruc, field);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            
            // Save to chat history for subsequent context (e.g. "y la clave")
            await saveMessage(chatId, 'user', text);
            await saveMessage(chatId, 'assistant', result);
            
            // Si solicitÃƒÂ³ la clave de firma electrÃƒÂ³nica, enviamos tambiÃƒÂ©n el archivo p12 adjunto
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
                            caption: `Ã°Å¸â€œâ€š Archivo de firma electrÃƒÂ³nica (.p12) de <b>${client.name}</b>`,
                            parse_mode: 'HTML'
                        });
                        console.log(`Ã¢Å“â€¦ Archivo de firma electrÃƒÂ³nica enviado para ${client.name}`);
                    }
                } catch (fileErr) {
                    console.error("Error al obtener o enviar el archivo de firma:", fileErr);
                }
            }
            return true;
        }
        // Multiple matches Ã¢â€ â€™ inline keyboard, preserves field context
        await showClientSelection(
            chatId, clients, 'field_query', { field },
            ctx, `Ã°Å¸â€Â EncontrÃƒÂ© <b>${clients.length}</b> clientes con "${identifier}". Selecciona el que necesitas:`
        );
        return true;
    }

    /** Handles a field write with inline disambiguation if needed */
    async function doFieldUpdate(rawId: string, field: string, value: string): Promise<boolean> {
        const identifier = extractId(rawId);
        if (!identifier || identifier.length < 2) return false;
        const clients = await findClients(identifier, 'id, name, ruc, trade_name');
        if (clients.length === 0) {
            await ctx.reply(`Ã¢ÂÅ’ No encontrÃƒÂ© "${identifier}". Baku.`);
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
            ctx, `Ã°Å¸â€Â EncontrÃƒÂ© <b>${clients.length}</b> coincidencias. Ã‚Â¿CuÃƒÂ¡l deseas editar?`
        );
        return true;
    }

    // --- FIELD READ shortcuts ---
    const claveMatch = t.match(/(?:clave\s*(?:sri)?|sri)\s+de\s+(.+)/);
    if (claveMatch) return doFieldQuery(claveMatch[1], 'sri_password');

    const iessMatch = t.match(/clave\s+iess\s+de\s+(.+)/);
    if (iessMatch) return doFieldQuery(iessMatch[1], 'iessPassword');

    const firmaMatch = t.match(/(?:clave\s+)?firma(?:\s+electr[oÃƒÂ³]nica)?\s+de\s+(.+)/);
    if (firmaMatch) return doFieldQuery(firmaMatch[1], 'electronicSignaturePassword');

    const emailMatch = t.match(/(?:email|correo)\s+de\s+(.+)/);
    if (emailMatch) return doFieldQuery(emailMatch[1], 'email');

    const telMatch = t.match(/(?:tel[eÃƒÂ©]fono|tel|cel(?:ular)?)\s+de\s+(.+)/);
    if (telMatch) return doFieldQuery(telMatch[1], 'phones');

    const rucMatch = t.match(/ruc\s+de\s+(.+)/);
    if (rucMatch) return doFieldQuery(rucMatch[1], 'ruc');

    const regimenMatch = t.match(/(?:r[eÃƒÂ©]gimen|tipo)\s+de\s+(.+)/);
    if (regimenMatch) return doFieldQuery(regimenMatch[1], 'regime');

    const facturadorMatch = t.match(/(?:facturador|sistema\s+de\s+facturaci[oÃƒÂ³]n)\s+de\s+(.+)/);
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

    const editTelMatch = t.match(/(?:edita|cambia|actualiza)\s+(?:el\s+)?(?:tel[eÃƒÂ©]fono|tel|cel(?:ular)?)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editTelMatch) return doFieldUpdate(editTelMatch[1], 'phones', editTelMatch[2].trim());

    const editFacturadorMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:el\s+)?(?:facturador|sistema\s+de\s+facturaci[oÃƒÂ³]n)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
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
    const marcaPagoMatch = t.match(/(?:marca|registra|anota)\s+(?:como\s+)?(?:pagado|un\s+pago)\s+(?:de\s+|a\s+)?(.+)|(?:a\s+)?(.+?)\s+(?:ya\s+)?pag[oÃƒÂ³]|cu[aÃƒÂ¡]nto\s+(?:me\s+)?debe\s+(.+)|qu[eÃƒÂ©]\s+(?:meses\s+)?me\s+debe\s+(.+)/);
    const payClient = marcaPagoMatch ? (marcaPagoMatch[1] || marcaPagoMatch[2] || marcaPagoMatch[3] || marcaPagoMatch[4])?.trim() : null;
    if (payClient && payClient.length > 2) {
        const clients = await findClients(payClient, '*');
        await initiatePaymentFlow(chatId, clients, ctx);
        return true;
    }

    // --- PROOF shortcuts ---
    const comprobanteMatch = t.match(/(?:comprobante|ride|pdf)\s+(?:de\s+la\s+)?(?:declaraci[oÃƒÂ³]n\s+)?de\s+(.+)/);
    if (comprobanteMatch) {
        const clients = await findClients(comprobanteMatch[1].trim(), 'id, name, ruc, trade_name');
        if (clients.length === 1) {
            const result = await getClientDeclarationProofsList(clients[0].ruc);
            await ctx.reply(convertMarkdownToTelegramHtml(result), { parse_mode: 'HTML' });
            return true;
        } else if (clients.length > 1) {
            await showClientSelection(
                chatId, clients, 'field_query', { field: 'declaration_history' },
                ctx, `Ã°Å¸â€Â EncontrÃƒÂ© <b>${clients.length}</b> clientes. Ã‚Â¿De cuÃƒÂ¡l deseas el comprobante?`
            );
            return true;
        } else {
             await ctx.reply(`Ã¢ÂÅ’ No encontrÃƒÂ© "${comprobanteMatch[1]}". Baku.`);
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
    if (/(?:vencimiento|vence\s+(?:esta|la)\s+semana|pr[oÃƒÂ³]ximos?\s+vencimientos?|cuando\s+vence)/.test(t)) {
        const resultText = await getUpcomingDeadlines();
        await ctx.reply(convertMarkdownToTelegramHtml(resultText), { parse_mode: 'HTML' });
        await saveMessage(chatId, 'user', text);
        await saveMessage(chatId, 'assistant', resultText);
        return true;
    }
    if (/(?:^resumen$|estado\s+general|c[oÃƒÂ³]mo\s+va\s+(?:todo|la\s+cartera)|panorama\s+general|cu[aÃƒÂ¡]ntos\s+clientes)/.test(t)) {
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
                await ctx.reply(`Ã¢ÂÅ’ No encontrÃƒÂ© ningÃƒÂºn cliente con "${identifier}". Baku.`);
                return true;
            }
            if (clients.length === 1) {
                await showClientProfileCard(chatId, clients[0], ctx);
                return true;
            }
            await showClientSelection(
                chatId, clients, 'view_profile', {},
                ctx, `Ã°Å¸â€Â EncontrÃƒÂ© <b>${clients.length}</b> clientes con "${identifier}". Selecciona el que necesitas:`
            );
            return true;
        }
    }

    return false; // No shortcut matched Ã¢â‚¬â€ send to AI
}

export interface DialogState {
  type: 'mark_payment' | 'mark_declaration' | 'field_query' | 'view_profile' | 'edit_profile_field' | 'create_invoice';
  chatId: string;
  step: 'select_client' | 'ask_payment_period' | 'ask_payment_future_period' | 'confirm_payment' | 'ask_declaration_type' | 'ask_declaration_period' | 'ask_declaration_realizada' | 'ask_declaration_method' | 'confirm_declaration' | 'ask_client_name' | 'ask_field_value' | 'ask_invoice_concept' | 'ask_invoice_custom_concept' | 'ask_invoice_custom_amount' | 'ask_invoice_payment_method';
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
        await ctx.reply("Ã¢ÂÅ’ No encontrÃƒÂ© ningÃƒÂºn cliente que coincida con esa bÃƒÂºsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'mark_payment', {},
            ctx, `Ã°Å¸â€Â EncontrÃƒÂ© *${matches.length}* clientes. Ã‚Â¿Para cuÃƒÂ¡l es el pago?`
        );
        return;
    }

    await startPaymentFlowForClient(chatId, matches[0], ctx);
}

export async function startPaymentFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'RÃƒÂ©gimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

    const history = client.declaration_history || [];
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
            // Se usa ALL_TYPES para simplificar en backend, pero se mandarÃƒÂ¡ como 'IVA' al LLM y ÃƒÂ©l resolverÃƒÂ¡.
            // O mejor: mandar 'HONORARIOS' y procesarÃƒÂ¡ todos si 'todos' es periodo.
            kb.text(`Ã°Å¸â€™Â¸ Pagar TODOS los ${unpaid.length} meses`, `baku_pay:${client.ruc}:HONORARIOS:todos`).row();
        }
    }
    kb.text(`Ã¢ÂÅ’ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `Ã°Å¸â€˜Â¤ **Cliente:** ${client.name}\n` +
            `Ã°Å¸â€œâ€¦ **Frecuencia IVA:** ${ivaFrequency}\n` +
            `Ã°Å¸â€™Â¼ **RÃƒÂ©gimen:** ${regime}\n\n` +
            pendingMsg +
            `Elige el periodo que deseas marcar como pagado, o escrÃƒÂ­belo en el chat:`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function initiateInvoiceFlow(chatId: string, matches: any[], ctx: any) {
    if (matches.length === 0) {
        await ctx.reply("Ã¢ÂÅ’ No encontrÃƒÂ© ningÃƒÂºn cliente que coincida con esa bÃƒÂºsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'create_invoice', {},
            ctx, `Ã°Å¸â€Â EncontrÃƒÂ© <b>${matches.length}</b> clientes. Ã‚Â¿A cuÃƒÂ¡l vas a facturar?`
        );
        return;
    }

    await startInvoiceFlowForClient(chatId, matches[0], ctx);
}

export async function startInvoiceFlowForClient(chatId: string, client: any, ctx: any) {
    const history = client.declaration_history || [];
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
    kb.text(`Ã¢Å“ÂÃ¯Â¸Â Detalle Personalizado`, `baku_inv_custom`).row();
    kb.text(`Ã¢ÂÅ’ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `Ã°Å¸â€˜Â¤ **Cliente Seleccionado:** ${client.name}\n` +
            `Ã°Å¸â€ â€ **RUC:** ${client.ruc}\n\n` +
            `Elige el concepto a facturar de la lista de honorarios pendientes, o ingresa un detalle libre:`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function initiateDeclarationFlow(chatId: string, matches: any[], ctx: any) {
    if (matches.length === 0) {
        await ctx.reply("Ã¢ÂÅ’ No encontrÃƒÂ© ningÃƒÂºn cliente que coincida con esa bÃƒÂºsqueda. Baku.");
        return;
    }

    if (matches.length > 1) {
        await showClientSelection(
            chatId, matches, 'mark_declaration', {},
            ctx, `Ã°Å¸â€Â EncontrÃƒÂ© *${matches.length}* clientes. Ã‚Â¿Para cuÃƒÂ¡l es la declaraciÃƒÂ³n?`
        );
        return;
    }

    await startDeclarationFlowForClient(chatId, matches[0], ctx);
}

export async function startDeclarationFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'RÃƒÂ©gimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

    const history = client.declaration_history || [];
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
    kb.text(`Ã¢ÂÅ’ Cancelar`, `baku_cancel`);

    await ctx.reply(
        convertMarkdownToTelegramHtml(
            `Ã°Å¸â€˜Â¤ **Cliente:** ${client.name}\n` +
            `Ã‚Â¿QuÃƒÂ© declaraciÃƒÂ³n de impuestos deseas registrar? Elige una opciÃƒÂ³n o escrÃƒÂ­bela en el chat.`
        ),
        { parse_mode: 'HTML', reply_markup: kb }
    );
}

async function handleDialogTriggers(chatId: string, text: string, ctx: any): Promise<boolean> {
    const t = text.toLowerCase().trim();

    if (t === 'cancelar' || t === 'salir') {
        if (pendingDialogs.has(chatId)) {
            pendingDialogs.delete(chatId);
            await ctx.reply("Ã¢ÂÅ’ Proceso interactivo cancelado. Baku.");
            return true;
        }
    }

    const isPaymentIntent = /(?:pag[oÃƒÂ³]|cancel[oÃƒÂ³]|liquid[oÃƒÂ³]|pagar|cancelar|liquidar|registra pago|marca pago)/i.test(t) && 
        !/(?:quien|falta|debe|cuantos|reporte|resumen|vencimiento)/i.test(t);

    const isDeclarationIntent = /(?:declaraci[oÃƒÂ³]n|declar[oÃƒÂ³]|declarar|registra declaraci[oÃƒÂ³]n|marca declaraci[oÃƒÂ³]n)/i.test(t) &&
        !/(?:quien|falta|debe|cuantos|reporte|resumen|vencimiento)/i.test(t);

    if (isPaymentIntent) {
        let clientQuery = t
            .replace(/(?:me\s+)?(?:acaba\s+de\s+)?(?:cancel[oÃƒÂ³]|pag[oÃƒÂ³]|liquid[oÃƒÂ³]|cancel[a]r?|pagar?)/g, '')
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
        await ctx.reply("Ã‚Â¿Para quÃƒÂ© cliente deseas registrar el pago? (Escribe el nombre o RUC). Baku.");
        return true;
    }

    if (isDeclarationIntent) {
        let clientQuery = t
            .replace(/(?:declaraci[oÃƒÂ³]n|declar[oÃƒÂ³]|declarar)/g, '')
            .replace(/(?:marca|registra|anota)\s+declaraci[oÃƒÂ³]n\s+(?:de\s+)?/g, '')
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
        await ctx.reply("Ã‚Â¿Para quÃƒÂ© cliente deseas registrar la declaraciÃƒÂ³n? (Escribe el nombre o RUC). Baku.");
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
        await ctx.reply("Ã¢ÂÅ’ Proceso interactivo cancelado. Baku.");
        return;
    }

    if (dialog.step === 'ask_client_name') {
        try {
            const matches = await findClients(text, '*');
            if (matches.length === 0) {
                await ctx.reply(`Ã¢ÂÅ’ No encontrÃƒÂ© ningÃƒÂºn cliente con "${text}".\n\nÃ°Å¸â€™Â¡ _Tip: Escribe SOLO el nombre (ej: "Juan") o RUC, sin otras palabras._\nEscribe **cancelar** para salir del modo registro. Baku.`);
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
                        `Ã°Å¸â€Â EncontrÃƒÂ© <b>${matches.length}</b> clientes. Selecciona el correcto:`
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
                        `Ã°Å¸â€Â EncontrÃƒÂ© <b>${matches.length}</b> clientes. Selecciona el correcto:`
                    );
                } else {
                    const client = matches[0];
                    await showClientProfileCard(chatId, client, ctx);
                    pendingDialogs.delete(chatId);
                }
            }
        } catch (err: any) {
            await ctx.reply(`Error al buscar clientes: ${err.message}. Baku.`);
        }
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
            await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â SelecciÃƒÂ³n invÃƒÂ¡lida. Por favor, responde con el nÃƒÂºmero de la lista (ej: 1) o escribe **cancelar** para salir.");
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
        const regime = client.regime || 'RÃƒÂ©gimen General';
        const isPopular = regime === 'Rimpe Negocio Popular';
        const isEmprendedor = regime === 'Rimpe Emprendedor';
        const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
        const isSemestral = ivaFrequency === 'Semestral';

        if (dialog.step === 'ask_payment_period') {
            if (t === 'adelantado' || t === 'adelantados') {
                dialog.step = 'ask_payment_future_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply("Ã‚Â¿QuÃƒÂ© periodo(s) deseas registrar como pagos por adelantado? (ej: \`2026-06, 2026-07\` o \`junio\`). Baku.");
                return;
            }

            const parsed = parsePeriods(text, isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â No pude identificar ningÃƒÂºn periodo vÃƒÂ¡lido. Por favor, escribe un mes, aÃƒÂ±o o formato vÃƒÂ¡lido (ej: \`2026-04\`, \`abril\`, \`primer semestre\`).");
                return;
            }

            dialog.data.periods = parsed;
            dialog.step = 'confirm_payment';
            pendingDialogs.set(chatId, dialog);

            await ctx.reply(
                `Ã‚Â¿Confirmas el registro del pago de honorarios de **${client.name}** para el/los periodo(s): **${parsed.join(', ')}**?\n\n` +
                `Responde **SÃƒÂ** para guardar o **NO** para cancelar. Baku.`
            );
            return;
        }

        if (dialog.step === 'ask_payment_future_period') {
            const parsed = parsePeriods(text, isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â No pude identificar ningÃƒÂºn periodo vÃƒÂ¡lido por adelantado. Por favor, escribe un mes o periodo vÃƒÂ¡lido (ej: \`2026-06\`).");
                return;
            }

            dialog.data.periods = parsed;
            dialog.data.isFuture = true;
            dialog.step = 'confirm_payment';
            pendingDialogs.set(chatId, dialog);

            await ctx.reply(
                `Ã‚Â¿Confirmas el registro de pago **adelantado** de **${client.name}** para el/los periodo(s): **${parsed.join(', ')}**?\n\n` +
                `Responde **SÃƒÂ** para guardar o **NO** para cancelar. Baku.`
            );
            return;
        }

        if (dialog.step === 'confirm_payment') {
            if (t === 'sÃƒÂ­' || t === 'si') {
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
                await ctx.reply("Ã¢ÂÅ’ Registro de pago cancelado. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÃƒÂ** o **NO** para confirmar o cancelar.");
            }
            return;
        }
    }

    if (dialog.type === 'mark_declaration') {
        const client = dialog.client;
        const regime = client.regime || 'RÃƒÂ©gimen General';
        const isPopular = regime === 'Rimpe Negocio Popular';
        const isEmprendedor = regime === 'Rimpe Emprendedor';
        const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));
        const isSemestral = ivaFrequency === 'Semestral';

        if (dialog.step === 'ask_declaration_type') {
            if (t === 'iva') {
                dialog.data.type = 'IVA';
                dialog.step = 'ask_declaration_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(`Ã‚Â¿Para quÃƒÂ© periodo es la declaraciÃƒÂ³n de **IVA**? (ej: \`2026-04\` o \`abril\` para mensual, o \`primer semestre\` para semestral). Baku.`);
            } else if (t === 'renta') {
                dialog.data.type = 'RENTA';
                dialog.step = 'ask_declaration_period';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(`Ã‚Â¿Para quÃƒÂ© aÃƒÂ±o/perÃƒÂ­odo es la declaraciÃƒÂ³n de **RENTA**? (ej: \`2025\` o \`2026\`). Baku.`);
            } else {
                await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â Tipo invÃƒÂ¡lido. Por favor responde **IVA** o **RENTA**.");
            }
            return;
        }

        if (dialog.step === 'ask_declaration_period') {
            const parsed = parsePeriods(text, dialog.data.type === 'IVA' && isSemestral);
            if (parsed.length === 0) {
                await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â No pude identificar un perÃƒÂ­odo vÃƒÂ¡lido. Por favor intenta de nuevo (ej: \`2026-04\`, \`abril\`, o \`2025\`).");
                return;
            }

            dialog.data.periods = [parsed[0]];
            dialog.step = 'ask_declaration_realizada';
            pendingDialogs.set(chatId, dialog);
            await ctx.reply(`Ã‚Â¿Esta declaraciÃƒÂ³n del periodo **${parsed[0]}** ya fue realizada y enviada al SRI? (Responde **SÃƒÂ** o **NO**). Baku.`);
            return;
        }

        if (dialog.step === 'ask_declaration_realizada') {
            if (t === 'sÃƒÂ­' || t === 'si') {
                dialog.step = 'ask_declaration_method';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(
                    `Ã‚Â¿CÃƒÂ³mo se realizÃƒÂ³ la declaraciÃƒÂ³n?\n` +
                    `1. **PDF**: Por comprobante PDF oficial\n` +
                    `2. **Clic**: Manualmente con un clic\n\n` +
                    `Responde **PDF** o **CLIC**.`
                );
            } else if (t === 'no') {
                pendingDialogs.delete(chatId);
                await ctx.reply("Entendido. No registrarÃƒÂ© la declaraciÃƒÂ³n todavÃƒÂ­a. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÃƒÂ** o **NO**.");
            }
            return;
        }

        if (dialog.step === 'ask_declaration_method') {
            if (t === 'pdf' || t === 'clic' || t === 'click') {
                dialog.data.method = (t === 'pdf') ? 'pdf' : 'click';
                dialog.step = 'confirm_declaration';
                pendingDialogs.set(chatId, dialog);
                await ctx.reply(
                    `Ã‚Â¿Confirmas el registro de la declaraciÃƒÂ³n de **${dialog.data.type}** (${dialog.data.periods?.[0]}) de **${client.name}** como **Enviada** (vÃƒÂ­a ${dialog.data.method === 'pdf' ? 'PDF' : 'clic'})?\n\n` +
                    `Responde **SÃƒÂ** para guardar o **NO** para cancelar. Baku.`
                );
            } else {
                await ctx.reply("Ã¢Å¡Â Ã¯Â¸Â Respuesta invÃƒÂ¡lida. Por favor responde **PDF** o **CLIC**.");
            }
            return;
        }

        if (dialog.step === 'confirm_declaration') {
            if (t === 'sÃƒÂ­' || t === 'si') {
                await ctx.replyWithChatAction('typing');
                try {
                    const period = dialog.data.periods?.[0] || '';
                    const result = await markDeclaration(client.ruc, dialog.data.type!, period, dialog.data.method!);
                    pendingDialogs.delete(chatId);
                    await ctx.reply(result);
                } catch (err: any) {
                    await ctx.reply(`Error al registrar declaraciÃƒÂ³n: ${err.message}. Baku.`);
                }
            } else if (t === 'no') {
                pendingDialogs.delete(chatId);
                await ctx.reply("Ã¢ÂÅ’ Registro de declaraciÃƒÂ³n cancelado. Baku.");
            } else {
                await ctx.reply("Por favor responde **SÃƒÂ** o **NO** para confirmar o cancelar.");
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
                await ctx.reply(`Ã¢ÂÅ’ Error al actualizar el perfil: ${err.message}. Baku.`);
            }
            return;
        }
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// INLINE KEYBOARD CALLBACK HANDLER
// Handles button taps from client selection menus
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
bot.on('callback_query:data', async (ctx) => {
    const chatId = ctx.chat?.id.toString() || ctx.from.id.toString();
    const data = ctx.callbackQuery.data;

    // Always answer to dismiss the loading spinner on the button
    await ctx.answerCallbackQuery();

    if (data === 'baku_cancel') {
        pendingDialogs.delete(chatId);
        try { await ctx.editMessageText('Ã¢ÂÅ’ OperaciÃƒÂ³n cancelada. Baku.'); } catch(e) {}
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
            await ctx.reply("Ã¢ÂÅ’ Error: No se encontrÃƒÂ³ al cliente. Baku.");
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
                .text('Ã¢ÂÅ’ Cancelar', 'baku_cancel');
            await ctx.reply(`Ã°Å¸â€â€ž Selecciona la nueva **Frecuencia de IVA** para **${client.name}**:`, {
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
                .text('RÃƒÂ©gimen General', 'baku_val_select:RÃƒÂ©gimen General').row()
                .text('Rimpe Emprendedor', 'baku_val_select:Rimpe Emprendedor').row()
                .text('Rimpe Negocio Popular', 'baku_val_select:Rimpe Negocio Popular').row()
                .text('Ã¢ÂÅ’ Cancelar', 'baku_cancel');
            await ctx.reply(`Ã¢Å¡â€“Ã¯Â¸Â Selecciona el nuevo **RÃƒÂ©gimen Impositivo** para **${client.name}**:`, {
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
            let promptText = `Ã¢Å“ÂÃ¯Â¸Â Escribe el nuevo valor para **${fieldLabel}** de **${client.name}**:`;
            if (field === 'clientStartPeriod') {
                promptText += `\n\nÃ°Å¸â€™Â¡ _Formatos recomendados:_\n- **Mensual**: \`2026-05\` (Mayo 2026)\n- **Semestral**: \`2026-S1\` o \`2026-S2\``;
            }
            await ctx.reply(promptText);
        }
        return;
    }

    if (data.startsWith('baku_val_select:')) {
        const value = data.replace('baku_val_select:', '');
        const dialog = pendingDialogs.get(chatId);
        
        if (!dialog || dialog.type !== 'edit_profile_field' || dialog.step !== 'ask_field_value') {
            try { await ctx.editMessageText('Ã¢Å¡Â Ã¯Â¸Â Este menÃƒÂº ya expirÃƒÂ³. Baku.'); } catch(e) {}
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
            .text('Ã°Å¸â€™Âµ Efectivo (Sin Sist. Fin)', `baku_inv_pay:01`).row()
            .text('Ã°Å¸ÂÂ¦ Transferencia/DepÃƒÂ³sito', `baku_inv_pay:20`).row()
            .text('Ã°Å¸â€™Â³ Tarjeta de CrÃƒÂ©dito', `baku_inv_pay:19`).row()
            .text('Ã¢ÂÅ’ Cancelar', `baku_cancel`);
            
        await ctx.reply(`Ã‚Â¿CuÃƒÂ¡l serÃƒÂ¡ la forma de pago para la factura de ${dialog.client.name}?`, { reply_markup: kb });
        return;
    }

    if (data === 'baku_inv_custom') {
        const dialog = pendingDialogs.get(chatId);
        if (!dialog || dialog.type !== 'create_invoice') return;
        
        dialog.step = 'ask_invoice_custom_concept';
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        await ctx.reply(`Ã¢Å“ÂÃ¯Â¸Â Escribe el concepto o descripciÃƒÂ³n que deseas facturar para ${dialog.client.name}:`);
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
        
        await ctx.reply(`⏳ Generando y autorizando la factura en el SRI para ${client.name}...`);
        
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
            
            await ctx.replyWithDocument(new InputFile(pdfBuffer, `RIDE_factura_${result.emisor.emisorEstab}_${result.emisor.emisorPtoEmi}_${result.comprobante.secuencial}.pdf`), {
                caption: `✅ Factura generada y autorizada con éxito.\n\n**Concepto:** ${concept}\n**Total:** ${total.toFixed(2)}`,
                parse_mode: 'Markdown'
            });
        } catch (error: any) {
            console.error('Error emitiendo factura:', error);
            await ctx.reply(`❌ Ocurrió un error al emitir la factura:\n${error.message}`);
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
            await ctx.reply('Ã¢Å¡Â Ã¯Â¸Â Este menÃƒÂº ya expirÃƒÂ³. Por favor repite tu consulta. Baku.');
            return;
        }

        dialog.data.type = type;

        if (period) {
            dialog.data.periods = [period];
            dialog.step = 'ask_declaration_realizada';
            pendingDialogs.set(chatId, dialog);
            await ctx.reply(convertMarkdownToTelegramHtml(`Ã‚Â¿Esta declaraciÃƒÂ³n de **${type}** del periodo **${period}** ya fue realizada y enviada al SRI? (Responde **SÃƒÂ** o **NO**). Baku.`), { parse_mode: 'HTML' });
        } else {
            dialog.step = 'ask_declaration_period';
            pendingDialogs.set(chatId, dialog);
            const periodExample = type === 'IVA' ? '(ej: `2026-04` o `abril`)' : '(ej: `2025`)';
            await ctx.reply(convertMarkdownToTelegramHtml(`Ã‚Â¿Para quÃƒÂ© periodo es la declaraciÃƒÂ³n de **${type}**? ${periodExample}. Baku.`), { parse_mode: 'HTML' });
        }
        return;
    }

    if (data.startsWith('baku_cmd:')) {
        const cmd = data.replace('baku_cmd:', '');
        
        // Remove keyboard from the menu message
        try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
        
        if (cmd === 'view_profile') {
            pendingDialogs.set(chatId, {
                type: 'view_profile',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("Ã°Å¸â€˜Â¤ Ã‚Â¿De quÃƒÂ© cliente deseas ver el perfil y editar sus datos? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'reg_payment') {
            pendingDialogs.set(chatId, {
                type: 'mark_payment',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("Ã¢Å“ÂÃ¯Â¸Â Ã‚Â¿Para quÃƒÂ© cliente deseas registrar el pago? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'see_sri_key') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'sri_password' }
            });
            await ctx.reply("Ã°Å¸â€Â Ã‚Â¿De quÃƒÂ© cliente deseas consultar la clave SRI? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'see_sig_key') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'electronicSignaturePassword' }
            });
            await ctx.reply("Ã°Å¸â€â€˜ Ã‚Â¿De quÃƒÂ© cliente deseas ver la clave de la firma electrÃƒÂ³nica? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'download_p12') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'electronicSignaturePassword' }
            });
            await ctx.reply("Ã°Å¸â€œâ€š Ã‚Â¿De quÃƒÂ© cliente deseas descargar la firma electrÃƒÂ³nica (.p12)? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'check_expiry') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'signatureExpirationDate' }
            });
            await ctx.reply("Ã°Å¸â€œâ€¦ Ã‚Â¿De quÃƒÂ© cliente deseas ver la fecha de caducidad de la firma? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'download_proof') {
            pendingDialogs.set(chatId, {
                type: 'field_query',
                chatId,
                step: 'ask_client_name',
                data: { field: 'declaration_history' }
            });
            await ctx.reply("Ã°Å¸â€œâ€ž Ã‚Â¿De quÃƒÂ© cliente deseas ver/descargar comprobantes de declaraciones? (Escribe el nombre o RUC). Baku.");
        } else if (cmd === 'create_invoice') {
            pendingDialogs.set(chatId, {
                type: 'create_invoice',
                chatId,
                step: 'ask_client_name',
                data: {}
            });
            await ctx.reply("Ã°Å¸Â§Â¾ Ã‚Â¿A quÃƒÂ© cliente le deseas emitir la factura? (Escribe el nombre o RUC). Baku.");
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
        try { await ctx.editMessageText('Ã¢Å¡Â Ã¯Â¸Â Este menÃƒÂº ya expirÃƒÂ³. Por favor repite tu consulta. Baku.'); } catch(e) {}
        return;
    }

    const client = dialog.candidates?.find(c => c.ruc === ruc);
    if (!client) {
        await ctx.reply('Ã¢ÂÅ’ OcurriÃƒÂ³ un error al seleccionar el cliente. Baku.');
        return;
    }

    // Remove the inline keyboard from the original message to keep chat clean
    try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch(e) {}
    await ctx.reply(`Ã¢Å“â€¦ Seleccionado: <b>${client.name}</b>`, { parse_mode: 'HTML' });

    if (dialog.type === 'field_query') {
        const field = dialog.data.field!;
        if (field === 'declaration_history') {
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

  // 1. Try direct command (zero AI tokens Ã¢â‚¬â€ instant, with inline keyboard disambiguation)
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
    console.error(`Ã¢ÂÅ’ Error in direct command for chat ${chatId}:`, err);
  }

  // 2. Check if there is a pending dialog
  if (pendingDialogs.has(chatId)) {
      await handleDialogStep(chatId, text, ctx);
      return;
  }

  // 3. Check if a dialog is triggered by this message
  const triggered = await handleDialogTriggers(chatId, text, ctx);
  if (triggered) return;

  // Handle "SÃƒÂ GUARDAR" confirmation
  if (text.toUpperCase() === 'SÃƒÂ GUARDAR' || text.toUpperCase() === 'SI GUARDAR') {
    const pending = pendingPdfs.get(chatId);
    if (!pending) return ctx.reply("No tengo ningÃƒÂºn documento pendiente por guardar.");

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
      await ctx.reply(`Ã¢Å“â€¦ Ã‚Â¡Todo listo, Santiago!\n\n1. Archivo guardado en Google Drive (${folderName}/${fileName})\n2. Supabase actualizado (${dbResult}).\n\n${STATUS_ICON}`);
    } catch (err: any) {
      await ctx.reply("Error guardando el documento: " + err.message);
    }
    return;
  }

  // 4. Full AI agent loop Ã¢â‚¬â€ show thinking indicator only here
  const thinkingMsg = await ctx.reply(`Ã¢Å¡Â¡ Procesando...`);
  try {
    const response = await processChatWithAgentLoop(chatId, text);
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await handleAgentResponse(ctx, response);
  } catch (err: any) {
    console.error(`Ã¢ÂÅ’ Error in agent loop for chat ${chatId}:`, err);
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await ctx.reply('Ã¢Å¡Â Ã¯Â¸Â Santiago, he tenido un inconveniente tÃƒÂ©cnico. Por favor, intenta de nuevo.');
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

    console.log(`Ã°Å¸Å½â„¢Ã¯Â¸Â handleAgentResponse | isVoiceInput: ${isVoiceInput} | LLM Response contains [AUDIO]: ${response.toUpperCase().includes('[AUDIO]')}`);

    if (userText.includes('audio') || userText.includes('nota de voz') || userText.includes('hÃƒÂ¡blame') || userText.includes('hablame') || userText.includes('escuche') || userText.includes('escuchar')) {
      isAudio = true;
      console.log("Ã°Å¸Å½â„¢Ã¯Â¸Â Forcing audio due to user keywords.");
    }
    
    // Force audio output if input was voice
    if (isVoiceInput) {
      isAudio = true;
      console.log("Ã°Å¸Å½â„¢Ã¯Â¸Â Forcing audio due to voice input.");
    }

    console.log(`Ã°Å¸Å½â„¢Ã¯Â¸Â Final isAudio decision: ${isAudio}`);

    // If audio is requested but there is no [AUDIO] tag, and the response is very long, we don't want to speak the whole thing
    if (isAudio && !response.toUpperCase().includes('[AUDIO]') && textResponse.length > 300) {
      audioResponse = "Santiago, te he dejado los detalles por escrito en Telegram para no dictarte una lista muy larga. Baku.";
    }

    // Send text response with icon
    await ctx.reply(`${textResponse}\n\n${STATUS_ICON}`);
    
    // Send audio if requested OR if input was voice (forced audio)
    if (isAudio) {
      console.log("Ã°Å¸Å½â„¢Ã¯Â¸Â Attempting record_voice action...");
      await ctx.replyWithChatAction('record_voice');
      try {
        console.log(`Ã°Å¸Å½â„¢Ã¯Â¸Â Generating TTS for: "${audioResponse.substring(0, 60)}..."`);
        const voiceInputFile = await textToSpeech(audioResponse);
        console.log("Ã°Å¸Å½â„¢Ã¯Â¸Â Sending voice message...");
        await ctx.replyWithAudio(voiceInputFile, { caption: "Baku Voice" });
      } catch (ttsErr: any) {
        console.error("Ã¢Å¡Â Ã¯Â¸Â TTS Error:", ttsErr.message);
        // Better error reporting for audio failures
        const errorNote = isVoiceInput 
          ? "Ã°Å¸Å½â„¢Ã¯Â¸Â (Santiago, he transcrito tu audio arriba, pero no pude generar mi respuesta en voz por un error tÃƒÂ©cnico. Baku.)"
          : "Ã°Å¸Å½â„¢Ã¯Â¸Â (Nota: No pude generar el audio solicitado por un error tÃƒÂ©cnico. Baku.)";
        
        await ctx.reply(errorNote);
      }
    }
}

// Handle incoming documents (PDFs)
bot.on('message:document', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const doc = ctx.message.document;
  if (doc.mime_type !== 'application/pdf') {
    return ctx.reply("Por favor, envÃƒÂ­a ÃƒÂºnicamente archivos PDF del SRI.");
  }

  await ctx.replyWithChatAction('typing');
  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // 1. Validate PDF
    const validation = await validateSRIPDF(buffer);

    if (!validation.isValid) {
      return ctx.reply(`Ã¢Å¡Â Ã¯Â¸Â No he podido validar este documento como un archivo oficial del SRI.\n\nExtraje: RUC ${validation.ruc}, Tipo: ${validation.type}. Ã‚Â¿Es el archivo correcto?`);
    }

    // Store for confirmation
    pendingPdfs.set(chatId, { buffer, data: validation });

    // 2. Show Preview
    let preview = `Ã°Å¸â€œâ€ž *VISTA PREVIA DE DOCUMENTO VALIDADO*\n\n`;
    preview += `Ã°Å¸â€˜Â¤ *RUC:* \`${validation.ruc}\`\n`;
    preview += `Ã°Å¸â€œâ€¦ *Periodo:* ${validation.period}\n`;
    preview += `Ã°Å¸â€œÂ *Tipo:* ${validation.type}\n`;
    preview += `Ã°Å¸â€™Â° *Monto:* $${validation.amount}\n\n`;
    preview += `Ã¢Å“â€¦ El sistema ha detectado que el lenguaje y formato concuerdan con el SRI.\n`;
    preview += `--------------------------\n`;
    preview += `Ã‚Â¿Deseas guardar este archivo en la carpeta del cliente y sincronizar con la base de datos? (Responde "SÃƒÂ GUARDAR")`;

    await ctx.reply(convertMarkdownToTelegramHtml(preview), { parse_mode: 'HTML' });
  } catch (err: any) {
    console.error('Error processing document:', err);
    await ctx.reply('Error al procesar el PDF: ' + err.message);
  }
});

// Handle incoming photos (Payment Receipts OCR)
bot.on('message:photo', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  if (pendingDialogs.has(chatId)) {
      await ctx.reply('Ã°Å¸â€œÂ¸ Tengo un proceso interactivo pendiente. Por favor escribe tu respuesta en texto, o escribe **cancelar** para salir.');
      return;
  }

  await ctx.replyWithChatAction('typing');
  try {
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1]; // get highest resolution
    const file = await ctx.api.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const result = await processPaymentReceipt(buffer, 'image/jpeg');
    
    await ctx.reply(convertMarkdownToTelegramHtml(result.message), { parse_mode: 'HTML' });
  } catch (err: any) {
    console.error('Error processing photo:', err);
    await ctx.reply('Error al analizar la imagen: ' + err.message);
  }
});

// Handle incoming voice messages
bot.on('message:voice', async (ctx) => {
  const chatId = ctx.chat.id.toString();

  // 1. Check if there is a pending dialog first (same as text handler)
  if (pendingDialogs.has(chatId)) {
      await ctx.reply('Ã°Å¸Å½â„¢Ã¯Â¸Â Tengo un proceso interactivo pendiente. Por favor escribe tu respuesta en texto, o escribe **cancelar** para salir.');
      return;
  }

  // Indicate bot is thinking/listening
  await ctx.replyWithChatAction('typing');

  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Transcribe
    const transcription = await transcribeAudioUrl(fileUrl);
    await ctx.reply(`Ã°Å¸Å½Â¤ <b>Transcrito:</b> ${transcription}`, { parse_mode: 'HTML' });

    // 2. Check if a dialog is triggered by the transcribed text
    const triggered = await handleDialogTriggers(chatId, transcription, ctx);
    if (triggered) return;

    // 3. Send to agent loop via shared handler
    const response = await processChatWithAgentLoop(chatId, transcription);
    await handleAgentResponse(ctx, response);

  } catch (err: any) {
    console.error('Error in voice loop:', err);
    await ctx.reply('Ha ocurrido un error procesando tu audio: ' + err.message);
  }
});

// REMOVED duplicate bot.catch Ã¢â‚¬â€ the primary handler (line 53) already notifies the user.
// A second catch would silently override it.

// Start bot with drop_pending_updates to avoid conflict errors
bot.start({
  drop_pending_updates: true,
  onStart: (botInfo) => {
    console.log(`Ã¢Å“â€¦ ${BOT_NAME} listo: @${botInfo.username}`);
  }
}).catch(err => {
    if (err.description?.includes('Conflict')) {
        console.error('Ã¢Å¡Â Ã¯Â¸Â BOT CONFLICT: Another instance is running. Please stop it or wait for Render to cycle.');
    } else {
        console.error('Ã¢ÂÅ’ Bot startup error:', err);
    }
});

// Graceful shutdown to prevent 'Conflict: terminated by other getUpdates request'
const shutdown = async (signal: string) => {
    console.log(`Ã°Å¸â€ºâ€˜ Stopping bot gracefully (${signal})...`);
    try {
        await bot.stop();
        console.log('Ã¢Å“â€¦ Bot stopped.');
        process.exit(0);
    } catch (e) {
        console.error('Error during shutdown:', e);
        process.exit(1);
    }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Express dummy server for Render
const app = express();

// Uploadthing API
app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: ourFileRouter,
    config: {
        token: process.env.UPLOADTHING_TOKEN,
    },
  })
);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// "Anti-Sleep" Endpoint for self-pinging
app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`Ã°Å¸Å’Â Dummy server listening on port ${PORT}`);
  
  // Render Anti-Sleep Hack (Alejavi method)
  // Render spins down free web services after 15 minutes of inactivity.
  // We ping ourselves every 14 minutes (840000 ms) to keep it awake.
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL; // Optional: e.g. https://my-bot.onrender.com
  const pingUrl = RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  
  setInterval(() => {
    axios.get(`${pingUrl}/ping`)
      .then(() => console.log('Ã°Å¸â€â€ž Anti-sleep ping successful'))
      .catch((err) => console.log('Ã¢Å¡Â Ã¯Â¸Â Anti-sleep ping failed:', err.message));
  }, 14 * 60 * 1000); // 14 minutes
  
  // Initialize Active Assistant (Cron Jobs)
  startCronJobs(bot);
});
