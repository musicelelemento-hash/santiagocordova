/**
 * Configuración y orquestación compartida de IA para Baku.
 *
 * Centraliza:
 *  - La resolución de la clave de Gemini (GEMINI_API_KEY con fallback a VITE_GEMINI_API_KEY).
 *  - Los nombres de modelo usados por la cascada de respaldo (agent y cron ya no divergen).
 *  - La generación de texto simple con cascada (sin tool-calling), usada por los reportes de cron.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

/** Clave de Gemini resolviendo el fallback de variables de entorno. */
export function getGeminiApiKey(): string | null {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    return (key && !key.includes('dummy')) ? key : null;
}

/** Nombres de modelo consistentes para toda la cascada. */
export const MODELS = {
    geminiPrimary: 'gemini-2.0-flash',
    geminiFallbackSDK: 'gemini-1.5-flash',
    openRouterGemini: 'google/gemini-2.0-flash-001',
    openRouterGemini25: 'google/gemini-2.5-flash',
    groqLlama: 'llama-3.3-70b-versatile',
    groqLlamaSpecdec: 'llama-3.3-70b-specdec',
    groqMixtral: 'mixtral-8x7b-32768',
    freeLlama: 'meta-llama/llama-3.3-70b-instruct:free',
    freeMistral: 'mistralai/mistral-7b-instruct:free',
    freeGemma: 'google/gemma-3-27b-it:free',
};

interface GenerateAiTextOpts {
    prompt: string;
    systemInstruction?: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Genera texto con una cascada de proveedores (sin tool-calling):
 *   1. Google Gemini (SDK oficial)
 *   2. OpenRouter (Gemini 2.5 Flash)
 *   3. Groq (Llama 3.3) → retry (Mixtral)
 * Lanza Error si todos fallan.
 */
export async function generateAiText({ prompt, systemInstruction, maxTokens = 1500, temperature = 0.3 }: GenerateAiTextOpts): Promise<string> {
    const SYSTEM_INSTRUCTION = systemInstruction;
    const messages = [
        ...(SYSTEM_INSTRUCTION ? [{ role: 'system' as const, content: SYSTEM_INSTRUCTION }] : []),
        { role: 'user' as const, content: prompt },
    ];

    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
                model: MODELS.geminiPrimary,
                ...(SYSTEM_INSTRUCTION ? { systemInstruction: SYSTEM_INSTRUCTION } : {}),
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (text) return text;
        } catch (e: any) {
            console.error('⚠️ [AI] Gemini SDK falló:', e.message);
        }
    }

    if (process.env.OPENROUTER_API_KEY) {
        try {
            const openai = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: process.env.OPENROUTER_API_KEY,
            });
            const response = await openai.chat.completions.create({
                model: MODELS.openRouterGemini25,
                messages,
                max_tokens: maxTokens,
            });
            if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
        } catch (e: any) {
            console.error('⚠️ [AI] OpenRouter falló:', e.message);
        }
    }

    if (process.env.GROQ_API_KEY) {
        try {
            const openai = new OpenAI({
                baseURL: 'https://api.groq.com/openai/v1',
                apiKey: process.env.GROQ_API_KEY,
            });
            const response = await openai.chat.completions.create({
                model: MODELS.groqLlamaSpecdec,
                messages,
                max_tokens: maxTokens,
                temperature,
            });
            if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
        } catch (e: any) {
            try {
                const openai = new OpenAI({
                    baseURL: 'https://api.groq.com/openai/v1',
                    apiKey: process.env.GROQ_API_KEY,
                });
                const response = await openai.chat.completions.create({
                    model: MODELS.groqMixtral,
                    messages,
                    max_tokens: maxTokens,
                    temperature,
                });
                if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
            } catch (e2: any) {
                console.error('⚠️ [AI] Groq falló:', e2.message);
            }
        }
    }

    throw new Error('No AI providers available or all of them failed');
}
