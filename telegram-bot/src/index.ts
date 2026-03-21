import { Bot } from 'grammy';
require('dotenv').config();
import { processChatWithAgentLoop, BOT_NAME, STATUS_ICON } from './agent';
import { clearChatHistory } from './database';
import { getAuthUrl, setTokenFromCode } from './gmail';
import express from 'express';
import { transcribeAudioUrl, textToSpeech, updateVoiceConfig, getVoiceStatus } from './voice';
import { validateSRIPDF, ValidatedPDF } from './pdf-validator';
import { uploadToDrive } from './google-sync';
import { updateClientData } from './database_ops';
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

// Handle all incoming text messages
bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text.trim();

  // Handle "SÍ GUARDAR" confirmation
  if (text.toUpperCase() === 'SÍ GUARDAR' || text.toUpperCase() === 'SI GUARDAR') {
    const pending = pendingPdfs.get(chatId);
    if (!pending) return ctx.reply("No tengo ningún documento pendiente por guardar.");

    await ctx.replyWithChatAction('typing');
    try {
      const { buffer, data } = pending;
      const folderName = `SantiagoBot/Clientes/${data.ruc}`;
      const fileName = `${data.type}_${data.period.replace(/\//g, '-')}.pdf`;

      // 1. Upload to Drive
      const driveFile = await uploadToDrive(fileName, buffer, folderName);

      // 2. Update Supabase & Sync
      const note = `Documento ${data.type} periodo ${data.period} cargado el ${new Date().toLocaleDateString()}. [Drive: ${driveFile.id}]`;
      await updateClientData(data.ruc, {
        notes: note,
        last_update: new Date().toISOString()
      });

      pendingPdfs.delete(chatId);
      await ctx.reply(`✅ ¡Todo listo, Santiago!\n\n1. Archivo guardado en Google Drive (${folderName}/${fileName})\n2. Firestore actualizado.\n3. Respaldo en Google Sheets sincronizado.\n\n${STATUS_ICON}`);
    } catch (err: any) {
      await ctx.reply("Error guardando el documento: " + err.message);
    }
    return;
  }

  // Indicate bot is thinking/searching
  const thinkingMsg = await ctx.reply(`${STATUS_ICON} Analizando solicitud...`);

  try {
    const response = await processChatWithAgentLoop(chatId, text);
    // Delete thinking message
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await handleAgentResponse(ctx, response);
  } catch (err: any) {
    console.error(`❌ Error in agent loop for chat ${chatId}:`, err);
    try { await ctx.api.deleteMessage(chatId, thinkingMsg.message_id); } catch(e) {}
    await ctx.reply('⚠️ Santiago, he tenido un inconveniente técnico procesando tu solicitud. Por favor, intenta de nuevo o verifica mi conexión.');
  }
});

/**
 * Shared logic to send text/audio response
 */
async function handleAgentResponse(ctx: any, response: string) {
    const chatId = ctx.chat.id.toString();
    let isAudio = false;
    let finalResponse = response;
    
    // Check if the agent decided to reply with audio (be flexible with whitespace/case)
    if (finalResponse.toUpperCase().includes('[AUDIO]')) {
      isAudio = true;
      finalResponse = finalResponse.replace(/\[AUDIO\]/gi, '').trim();
    }

    const userText = (ctx.message?.text || ctx.message?.caption || "").toLowerCase();
    const isVoiceInput = !!(ctx.message && ctx.message.voice);

    console.log(`🎙️ handleAgentResponse | isVoiceInput: ${isVoiceInput} | LLM Response starts with [AUDIO]: ${response.toUpperCase().startsWith('[AUDIO]')}`);

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

    // Send text response with icon
    await ctx.reply(`${finalResponse}\n\n${STATUS_ICON}`);
    
    // Send audio if requested OR if input was voice (forced audio)
    if (isAudio) {
      console.log("🎙️ Attempting record_voice action...");
      await ctx.replyWithChatAction('record_voice');
      try {
        console.log("🎙️ Generating TTS...");
        const voiceInputFile = await textToSpeech(finalResponse);
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

  // Indicate bot is thinking/listening
  await ctx.replyWithChatAction('typing');

  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Transcribe
    const transcription = await transcribeAudioUrl(fileUrl);
    await ctx.reply(`🎤 *Transcrito:* ${transcription}`, { parse_mode: 'Markdown' });

    // Send to agent loop via shared handler
    const response = await processChatWithAgentLoop(chatId, transcription);
    await handleAgentResponse(ctx, response);

  } catch (err: any) {
    console.error('Error in voice loop:', err);
    await ctx.reply('Ha ocurrido un error procesando tu audio: ' + err.message);
  }
});

// Handle errors 
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  console.error("Unknown error:", e);
});

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
