import { Bot, InlineKeyboard } from 'grammy';
require('dotenv').config();
import { processChatWithAgentLoop, BOT_NAME, STATUS_ICON } from './agent';
import { clearChatHistory } from './database';
import { getAuthUrl, setTokenFromCode } from './gmail';
import express from 'express';
import { transcribeAudioUrl, textToSpeech, updateVoiceConfig, getVoiceStatus } from './voice';
import { validateSRIPDF, ValidatedPDF } from './pdf-validator';
import { uploadToDrive } from './google-sync';
import { updateClientData, getDebtorClients, getUpcomingDeadlines, getDatabaseSummary, getClientsStatusReport, getClientField, quickUpdateClient, markPaymentAsPaid, findClients, markPaymentsList, markDeclaration } from './database_ops';
import axios from 'axios';
import { createRouteHandler } from "uploadthing/express";
import { ourFileRouter } from "./uploadthing";
import { startCronJobs, triggerProactiveReport } from './cron';


const pendingPdfs = new Map<string, { buffer: Buffer, data: ValidatedPDF }>();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN must be set");

const bot = new Bot(TELEGRAM_BOT_TOKEN);

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

// Base commands
bot.command('start', async (ctx) => {
  await ctx.reply(`¡Hola! Soy ${BOT_NAME}. Tu agente privado enfocado en solucionar problemas, ejecutar herramientas y ayudarte con IA. Control total garantizado.\n\nEscríbeme para empezar.`);
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
    const vStatus = getVoiceStatus();
    let statusMsg = "📊 **ESTADO DEL SISTEMA:**\n\n";
    statusMsg += `🎙️ ElevenLabs: ${vStatus.elevenLabs ? '✅ Conectado' : '❌ Sin Clave'}\n`;
    statusMsg += `🆔 Voz Actual: \`${vStatus.voiceId}\`\n`;
    statusMsg += `☁️ Google TTS: ${vStatus.googleCloud ? '✅ Activo (Respaldo)' : '⚠️ No configurado'}\n`;
    statusMsg += `🧠 Groq: ✅ Activo\n`;
    statusMsg += "\nBaku.";
    await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
});

bot.command('testcron', async (ctx) => {
    await ctx.reply('⏳ Forzando la generación del reporte proactivo matutino. Por favor espera...');
    await triggerProactiveReport(bot);
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

/** Sets up a pending dialog and shows a client selection keyboard */
async function showClientSelection(
    chatId: string,
    clients: any[],
    dialogType: 'mark_payment' | 'mark_declaration' | 'field_query',
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
    await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: buildClientKeyboard(clients)
    });
}

/**
 * Pre-AI shortcut engine. Returns true if the message was handled.
 * Uses inline keyboard buttons when multiple clients match — no context loss.
 */
async function tryDirectCommand(text: string, chatId: string, ctx: any): Promise<boolean> {
    const t = text.toLowerCase().trim();

    // Stop identifier capture at " y " to avoid compound query false positives
    // e.g. "RUC de aleida y su clave" → identifier = "aleida"
    const extractId = (raw: string): string => raw.split(/\s+y\s+/)[0].trim();

    /** Handles a field read with inline disambiguation if needed */
    async function doFieldQuery(rawId: string, field: string): Promise<boolean> {
        const identifier = extractId(rawId);
        if (!identifier || identifier.length < 2) return false;
        const clients = await findClients(identifier, '*');
        if (clients.length === 0) {
            await ctx.reply(`❌ No encontré ningún cliente con "${identifier}". Baku.`);
            return true;
        }
        if (clients.length === 1) {
            const result = await getClientField(clients[0].ruc, field);
            await ctx.reply(result, { parse_mode: 'Markdown' });
            return true;
        }
        // Multiple matches → inline keyboard, preserves field context
        await showClientSelection(
            chatId, clients, 'field_query', { field },
            ctx, `🔍 Encontré *${clients.length}* clientes con "${identifier}".\_Selecciona el que necesitas:`
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
            await ctx.reply(result, { parse_mode: 'Markdown' });
            return true;
        }
        await showClientSelection(
            chatId, clients, 'field_query', { field, value },
            ctx, `🔍 Encontré *${clients.length}* coincidencias. ¿Cuál deseas editar?`
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

    // --- FIELD WRITE shortcuts ---
    const editClaveMatch = t.match(/(?:edita|cambia|actualiza|pon|poner)\s+(?:la\s+)?clave\s+(?:sri\s+)?de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editClaveMatch) return doFieldUpdate(editClaveMatch[1], 'sri_password', editClaveMatch[2].trim());

    const editEmailMatch = t.match(/(?:edita|cambia|actualiza)\s+(?:el\s+)?(?:email|correo)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editEmailMatch) return doFieldUpdate(editEmailMatch[1], 'email', editEmailMatch[2].trim());

    const editTelMatch = t.match(/(?:edita|cambia|actualiza)\s+(?:el\s+)?(?:tel[eé]fono|tel|cel(?:ular)?)\s+de\s+(.+?)\s+(?:a|por|=)\s+(.+)/);
    if (editTelMatch) return doFieldUpdate(editTelMatch[1], 'phones', editTelMatch[2].trim());

    // --- PAYMENT shortcuts (simple, unambiguous) ---
    const marcaPagoMatch = t.match(/(?:marca|registra|anota)\s+(?:como\s+)?pagado\s+(?:a\s+)?(.+)|(?:a\s+)?(.+?)\s+(?:ya\s+)?pag[oó]/);
    const payClient = marcaPagoMatch ? (marcaPagoMatch[1] || marcaPagoMatch[2])?.trim() : null;
    if (payClient && payClient.length > 2) {
        const result = await markPaymentAsPaid(payClient, 'IVA');
        await ctx.reply(result, { parse_mode: 'Markdown' });
        return true;
    }

    // --- REPORT shortcuts ---
    if (/(?:quien(?:es)?\s+(?:me\s+)?deb[e|en]|deudores|cartera\s+vencida|cobros\s+pendientes)/.test(t)) {
        await ctx.reply(await getDebtorClients(), { parse_mode: 'Markdown' });
        return true;
    }
    if (/(?:quien(?:es)?\s+falt[a|an]|falta\s+declarar|pendientes\s+(?:de\s+)?(?:sri|declarar)|quien\s+no\s+ha\s+declarado|no\s+han\s+declarado)/.test(t)) {
        await ctx.reply(await getClientsStatusReport(), { parse_mode: 'Markdown' });
        return true;
    }
    if (/(?:vencimiento|vence\s+(?:esta|la)\s+semana|pr[oó]ximos?\s+vencimientos?|cuando\s+vence)/.test(t)) {
        await ctx.reply(await getUpcomingDeadlines(), { parse_mode: 'Markdown' });
        return true;
    }
    if (/(?:^resumen$|estado\s+general|c[oó]mo\s+va\s+(?:todo|la\s+cartera)|panorama\s+general|cu[aá]ntos\s+clientes)/.test(t)) {
        await ctx.reply(await getDatabaseSummary(), { parse_mode: 'Markdown' });
        return true;
    }

    return false; // No shortcut matched — send to AI
}

export interface DialogState {
  type: 'mark_payment' | 'mark_declaration' | 'field_query';
  chatId: string;
  step: 'select_client' | 'ask_payment_period' | 'ask_payment_future_period' | 'confirm_payment' | 'ask_declaration_type' | 'ask_declaration_period' | 'ask_declaration_realizada' | 'ask_declaration_method' | 'confirm_declaration' | 'ask_client_name';
  client?: any;
  candidates?: any[];
  data: {
    periods?: string[];
    method?: 'pdf' | 'click';
    type?: 'IVA' | 'RENTA';
    isFuture?: boolean;
    field?: string;    // For field_query: which field to read/write
    value?: any;       // For field_query: value to write (if update)
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

async function startPaymentFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'Régimen General';
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

    await ctx.reply(
        `👤 *Cliente:* ${client.name}\n` +
        `📅 *Frecuencia IVA:* ${ivaFrequency}\n` +
        `💼 *Régimen:* ${regime}\n\n` +
        pendingMsg +
        `¿Qué período(s) deseas marcar como pagado?\n` +
        `• Escribe el periodo (ej: \`2026-04\` o \`abril\`)\n` +
        `• Escribe varios separados por coma (ej: \`2026-04, 2026-05\`)\n` +
        `• Escribe \`adelantado\` para registrar pagos de meses futuros.\n\n` +
        `Escribe **cancelar** en cualquier momento para salir. Baku.`,
        { parse_mode: 'Markdown' }
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

async function startDeclarationFlowForClient(chatId: string, client: any, ctx: any) {
    const regime = client.regime || 'Régimen General';
    const isPopular = regime === 'Rimpe Negocio Popular';
    const isEmprendedor = regime === 'Rimpe Emprendedor';
    const ivaFrequency = client.tax_profile?.ivaFrequency || (isEmprendedor ? 'Semestral' : (isPopular ? 'Ninguno' : 'Mensual'));

    pendingDialogs.set(chatId, {
        type: 'mark_declaration',
        chatId,
        step: 'ask_declaration_type',
        client,
        data: {}
    });

    await ctx.reply(
        `👤 *Cliente:* ${client.name}\n` +
        `¿Qué tipo de declaración de impuestos deseas registrar?\n` +
        `1. **IVA** (Frecuencia: ${ivaFrequency})\n` +
        `2. **RENTA** (Anual)\n\n` +
        `Responde **IVA** o **RENTA**.\n\n` +
        `Escribe **cancelar** en cualquier momento para salir. Baku.`,
        { parse_mode: 'Markdown' }
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
                await ctx.reply(`❌ No encontré ningún cliente con "${text}". Intenta con otro nombre, o escribe **cancelar** para salir. Baku.`);
                return;
            }
            if (dialog.type === 'mark_payment') {
                await initiatePaymentFlow(chatId, matches, ctx);
            } else {
                await initiateDeclarationFlow(chatId, matches, ctx);
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
            } else {
                await startDeclarationFlowForClient(chatId, selected, ctx);
            }
        } else {
            await ctx.reply("⚠️ Selección inválida. Por favor, responde con el número de la lista (ej: 1) o escribe **cancelar** para salir.");
        }
        return;
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
}

// ─────────────────────────────────────────────────────────
// INLINE KEYBOARD CALLBACK HANDLER
// Handles button taps from client selection menus
// ─────────────────────────────────────────────────────────
bot.on('callback_query:data', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const data = ctx.callbackQuery.data;

    // Always answer to dismiss the loading spinner on the button
    await ctx.answerCallbackQuery();

    if (data === 'baku_cancel') {
        pendingDialogs.delete(chatId);
        try { await ctx.editMessageText('❌ Operación cancelada. Baku.'); } catch(e) {}
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
    await ctx.reply(`✅ Seleccionado: *${client.name}*`, { parse_mode: 'Markdown' });

    if (dialog.type === 'field_query') {
        const field = dialog.data.field!;
        if (dialog.data.value !== undefined) {
            // Quick update flow
            const result = await quickUpdateClient(ruc, field, dialog.data.value);
            pendingDialogs.delete(chatId);
            await ctx.reply(result, { parse_mode: 'Markdown' });
        } else {
            // Field read flow
            const result = await getClientField(ruc, field);
            pendingDialogs.delete(chatId);
            await ctx.reply(result, { parse_mode: 'Markdown' });
        }
    } else if (dialog.type === 'mark_payment') {
        await startPaymentFlowForClient(chatId, client, ctx);
    } else if (dialog.type === 'mark_declaration') {
        await startDeclarationFlowForClient(chatId, client, ctx);
    }
});

// Handle all incoming text messages
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();

  // 1. Check if there is a pending dialog first
  if (pendingDialogs.has(chatId)) {
      await handleDialogStep(chatId, text, ctx);
      return;
  }

  // 2. Check if a dialog is triggered by this message
  const triggered = await handleDialogTriggers(chatId, text, ctx);
  if (triggered) return;

  // 3. Try direct command (zero AI tokens — instant, with inline keyboard disambiguation)
  try {
    const directHandled = await tryDirectCommand(text, chatId, ctx);
    if (directHandled) return;
  } catch (err: any) {
    console.error(`❌ Error in direct command for chat ${chatId}:`, err);
  }

  // Handle "SÍ GUARDAR" confirmation
  if (text.toUpperCase() === 'SÍ GUARDAR' || text.toUpperCase() === 'SI GUARDAR') {
    const pending = pendingPdfs.get(chatId);
    if (!pending) return ctx.reply("No tengo ningún documento pendiente por guardar.");

    await ctx.replyWithChatAction('typing');
    try {
      const { buffer, data } = pending;
      const folderName = `SantiagoBot/Clientes/${data.ruc}`;
      const fileName = `${data.type}_${data.period.replace(/\//g, '-')}.pdf`;
      const driveFile = await uploadToDrive(fileName, buffer, folderName);
      const note = `Documento ${data.type} periodo ${data.period} cargado el ${new Date().toLocaleDateString()}. [Drive: ${driveFile.id}]`;
      await updateClientData(data.ruc, { notes: note, last_update: new Date().toISOString() });
      pendingPdfs.delete(chatId);
      await ctx.reply(`✅ ¡Todo listo, Santiago!\n\n1. Archivo guardado en Google Drive (${folderName}/${fileName})\n2. Supabase actualizado.\n\n${STATUS_ICON}`);
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
  if (doc.mime_type !== 'application/pdf') {
    return ctx.reply("Por favor, envía únicamente archivos PDF del SRI.");
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
      return ctx.reply(`⚠️ No he podido validar este documento como un archivo oficial del SRI.\n\nExtraje: RUC ${validation.ruc}, Tipo: ${validation.type}. ¿Es el archivo correcto?`);
    }

    // Store for confirmation
    pendingPdfs.set(chatId, { buffer, data: validation });

    // 2. Show Preview
    let preview = `📄 *VISTA PREVIA DE DOCUMENTO VALIDADO*\n\n`;
    preview += `👤 *RUC:* \`${validation.ruc}\`\n`;
    preview += `📅 *Periodo:* ${validation.period}\n`;
    preview += `📝 *Tipo:* ${validation.type}\n`;
    preview += `💰 *Monto:* $${validation.amount}\n\n`;
    preview += `✅ El sistema ha detectado que el lenguaje y formato concuerdan con el SRI.\n`;
    preview += `--------------------------\n`;
    preview += `¿Deseas guardar este archivo en la carpeta del cliente y sincronizar con la base de datos? (Responde "SÍ GUARDAR")`;

    await ctx.reply(preview, { parse_mode: 'Markdown' });
  } catch (err: any) {
    console.error('Error processing document:', err);
    await ctx.reply('Error al procesar el PDF: ' + err.message);
  }
});

// Handle incoming voice messages
bot.on('message:voice', async (ctx) => {
  const chatId = ctx.chat.id.toString();

  // 1. Check if there is a pending dialog first (same as text handler)
  if (pendingDialogs.has(chatId)) {
      await ctx.reply('🎙️ Tengo un proceso interactivo pendiente. Por favor escribe tu respuesta en texto, o escribe **cancelar** para salir.');
      return;
  }

  // Indicate bot is thinking/listening
  await ctx.replyWithChatAction('typing');

  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Transcribe
    const transcription = await transcribeAudioUrl(fileUrl);
    await ctx.reply(`🎤 *Transcrito:* ${transcription}`, { parse_mode: 'Markdown' });

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

// REMOVED duplicate bot.catch — the primary handler (line 53) already notifies the user.
// A second catch would silently override it.

// Start bot with drop_pending_updates to avoid conflict errors
bot.start({
  drop_pending_updates: true,
  onStart: (botInfo) => {
    console.log(`✅ ${BOT_NAME} listo: @${botInfo.username}`);
  }
}).catch(err => {
    if (err.description?.includes('Conflict')) {
        console.error('⚠️ BOT CONFLICT: Another instance is running. Please stop it or wait for Render to cycle.');
    } else {
        console.error('❌ Bot startup error:', err);
    }
});

// Graceful shutdown to prevent 'Conflict: terminated by other getUpdates request'
const shutdown = async (signal: string) => {
    console.log(`🛑 Stopping bot gracefully (${signal})...`);
    try {
        await bot.stop();
        console.log('✅ Bot stopped.');
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
  console.log(`🌐 Dummy server listening on port ${PORT}`);
  
  // Render Anti-Sleep Hack (Alejavi method)
  // Render spins down free web services after 15 minutes of inactivity.
  // We ping ourselves every 14 minutes (840000 ms) to keep it awake.
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL; // Optional: e.g. https://my-bot.onrender.com
  const pingUrl = RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  
  setInterval(() => {
    axios.get(`${pingUrl}/ping`)
      .then(() => console.log('🔄 Anti-sleep ping successful'))
      .catch((err) => console.log('⚠️ Anti-sleep ping failed:', err.message));
  }, 14 * 60 * 1000); // 14 minutes
  
  // Initialize Active Assistant (Cron Jobs)
  startCronJobs(bot);
});
