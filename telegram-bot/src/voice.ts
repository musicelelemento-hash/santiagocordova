import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { InputFile } from 'grammy';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

import { getServiceAccount } from './firebase-admin-init';

// Voice Configuration (can be updated via commands)
let ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || "").replace(/['"]/g, '');
let ELEVENLABS_VOICE_ID = (process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL').replace(/['"]/g, '');

// Google Cloud TTS Client setup
let ttsClient: TextToSpeechClient;

const credentials = getServiceAccount();

if (credentials) {
    console.log("🎙️ Initializing Google Cloud TTS with shared credentials...");
    ttsClient = new TextToSpeechClient({ credentials });
} else {
    console.warn("⚠️ Google Cloud TTS requested but no credentials found. Falling back to Application Default Credentials.");
    ttsClient = new TextToSpeechClient();
}

export async function transcribeAudioUrl(fileUrl: string): Promise<string> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY!;
    const groqClient = new Groq({ apiKey: GROQ_API_KEY });

    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const tempPath = path.resolve(__dirname, `../temp_voice_${Date.now()}.ogg`);

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(undefined));
        writer.on('error', reject);
    });

    try {
        const transcription = await groqClient.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: 'whisper-large-v3',
        });
        fs.unlinkSync(tempPath);
        return transcription.text;
    } catch (e) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw e;
    }
}

async function googleTranslateTTS(text: string): Promise<InputFile> {
    console.log("🎙️ Using Google Translate TTS (Free, no billing)...");
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es-ES&client=tw-ob&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return new InputFile(Buffer.from(response.data), 'response.mp3');
    } catch (e: any) {
        console.error("❌ Google Translate TTS failed:", e.message);
        throw e;
    }
}

export function updateVoiceConfig(key?: string, voiceId?: string) {
    if (key) ELEVENLABS_API_KEY = key;
    if (voiceId) ELEVENLABS_VOICE_ID = voiceId;
    console.log(`🎙️ Voice config updated. Key: ${ELEVENLABS_API_KEY ? 'Present' : 'Missing'}, ID: ${ELEVENLABS_VOICE_ID}`);
    return { keySet: !!ELEVENLABS_API_KEY, voiceId: ELEVENLABS_VOICE_ID };
}

export function getVoiceStatus() {
    return {
        elevenLabs: !!ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID,
        googleCloud: false
    };
}

export async function textToSpeech(text: string): Promise<InputFile> {
    
    // REGRESIÓN: El bot a veces envía "[AUDIO]" como texto a leer. Lo limpiamos.
    const cleanText = text.replace(/\[AUDIO\]/g, '').trim();

    // Try ElevenLabs first if key is present
    if (ELEVENLABS_API_KEY) {
        console.log(`🎙️ Attempting ElevenLabs TTS (Length: ${cleanText.length})...`);
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

        try {
            const response = await axios.post(url, {
                text: cleanText,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            });

            console.log("✅ ElevenLabs TTS successful");
            return new InputFile(Buffer.from(response.data), 'response.mp3');
        } catch (error: any) {
            let errorMsg = error.message;
            if (error.response?.data) {
                try {
                    const errorDetail = JSON.parse(Buffer.from(error.response.data).toString());
                    errorMsg = errorDetail.detail?.message || errorMsg;
                } catch(e) {}
            }
            console.error("⚠️ ElevenLabs failed, falling back to Google Translate...", errorMsg);
        }
    }

    // Fallback to Google Translate TTS
    try {
        return await googleTranslateTTS(cleanText);
    } catch (e: any) {
        console.error("❌ Google Translate TTS failed:", e.message);
        throw e;
    }
}
