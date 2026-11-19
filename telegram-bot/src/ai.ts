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

/**
 * Nombres de modelo de la cascada.
 *
 * Gemini NO va escrito a mano: Google retira modelos (gemini-2.0-flash y
 * gemini-1.5-flash ya responden 404) y el bot quedaba fallando en el primer
 * intento de cada mensaje. Se resuelve con modelosGemini(), que pregunta a la
 * API qué modelos existen. Los demás proveedores sí van fijos.
 */
export const MODELS = {
    openRouterGemini: 'google/gemini-2.5-flash',
    openRouterGemini25: 'google/gemini-2.5-flash',
    groqLlama: 'llama-3.3-70b-versatile',
    groqLlamaSpecdec: 'llama-3.3-70b-versatile', // el specdec fue retirado por Groq
    groqMixtral: 'llama-3.1-8b-instant',         // mixtral-8x7b fue retirado por Groq
    freeLlama: 'meta-llama/llama-3.3-70b-instruct:free',
    freeMistral: 'mistralai/mistral-7b-instruct:free',
    freeGemma: 'google/gemma-3-27b-it:free',
    perplexitySearch: 'perplexity/sonar',
};

/** Orden de preferencia cuando la API los ofrece. Lo que no esté, se salta. */
const PREFERENCIA_GEMINI = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
];
const POR_DEFECTO = { principal: 'gemini-2.5-flash', respaldo: 'gemini-2.5-flash-lite' };
const REINTENTO_MS = 10 * 60 * 1000;

let cacheModelos: { valor: { principal: string; respaldo: string }; hasta: number } | null = null;

/** Versión numérica de un nombre tipo gemini-3.1-flash (para ordenar los no listados). */
const version = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);

/**
 * Modelos Gemini vigentes: { principal, respaldo }. Se consulta la lista de la
 * API una vez y se guarda; si la consulta falla, se usan los por defecto y se
 * reintenta en 10 min. GEMINI_MODEL (Render) fuerza el principal.
 */
export async function modelosGemini(): Promise<{ principal: string; respaldo: string }> {
    if (cacheModelos && Date.now() < cacheModelos.hasta) return cacheModelos.valor;
    const key = getGeminiApiKey();
    const forzado = (process.env.GEMINI_MODEL || '').trim();
    let valor = { ...POR_DEFECTO, ...(forzado ? { principal: forzado } : {}) };
    let hasta = Date.now() + REINTENTO_MS;
    if (key) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data: any = await r.json();
            const disponibles: string[] = (data.models || [])
                .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map((m: any) => String(m.name || '').replace(/^models\//, ''));
            const flash = disponibles
                .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n))
                .sort((a, b) => version(b) - version(a) || a.length - b.length);
            const candidatos = [
                ...(forzado && disponibles.includes(forzado) ? [forzado] : []),
                ...PREFERENCIA_GEMINI.filter((n) => disponibles.includes(n)),
                ...flash,
            ].filter((n, i, arr) => arr.indexOf(n) === i);
            if (candidatos.length) {
                valor = { principal: candidatos[0], respaldo: candidatos[1] || candidatos[0] };
                hasta = Date.now() + 12 * 60 * 60 * 1000; // la lista cambia poco
            }
            if (forzado && !disponibles.includes(forzado)) {
                console.warn(`⚠️ [AI] GEMINI_MODEL=${forzado} no está disponible; se usa ${valor.principal}.`);
            }
            console.log(`🧠 [AI] Gemini vigente: ${valor.principal} (respaldo ${valor.respaldo}).`);
        } catch (e: any) {
            console.warn(`⚠️ [AI] No se pudo listar modelos de Gemini (${e.message}); se usa ${valor.principal}.`);
        }
    }
    cacheModelos = { valor, hasta };
    return valor;
}

/** Si un modelo respondió 404 (retirado), se vuelve a consultar la lista en la próxima llamada. */
export function avisarErrorGemini(mensaje: string): void {
    if (/404|not found|is not supported/i.test(mensaje)) cacheModelos = null;
}

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
                model: (await modelosGemini()).principal,
                ...(SYSTEM_INSTRUCTION ? { systemInstruction: SYSTEM_INSTRUCTION } : {}),
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (text) return text;
        } catch (e: any) {
            console.error('⚠️ [AI] Gemini SDK falló:', e.message);
            avisarErrorGemini(String(e.message));
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
