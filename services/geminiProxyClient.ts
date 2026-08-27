/**
 * services/geminiProxyClient.ts
 * ---------------------------------------------------------------------
 * Cliente alternativo de Gemini que NO conoce la API key: todas las
 * llamadas pasan por el proxy backend (Supabase Edge Function
 * `gemini-proxy`), que es quien guarda la key como secreto.
 *
 * Exposición mínima compatible con la forma en que `geminiService.ts`
 * consume el SDK `@google/genai`: expone `models.generateContent(...)`
 * y devuelve `{ text?, functionCalls?, candidates? }`.
 *
 * Configuración:
 *   VITE_GEMINI_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/gemini-proxy
 *   (opcional) VITE_GEMINI_PROXY_ACCESS_KEY=<token> si el proxy lo exige.
 */

export interface GeminiProxyPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: unknown } };
}

export interface GeminiProxyContent {
  role?: string;
  parts?: GeminiProxyPart[];
}

export interface GeminiProxyRequest {
  model: string;
  contents: GeminiProxyContent[];
  config?: {
    tools?: Array<{ functionDeclarations?: unknown[] }>;
    responseMimeType?: string;
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiProxyFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface GeminiProxyResponse {
  text?: string;
  functionCalls?: GeminiProxyFunctionCall[];
  candidates?: Array<{ content?: GeminiProxyContent }>;
}

const PROXY_URL = (import.meta as any).env?.VITE_GEMINI_PROXY_URL as string | undefined;
const PROXY_ACCESS_KEY = (import.meta as any).env?.VITE_GEMINI_PROXY_ACCESS_KEY as string | undefined;

export function isProxyConfigured(): boolean {
  return typeof PROXY_URL === 'string' && PROXY_URL.length > 0;
}

async function generateContent(req: GeminiProxyRequest): Promise<GeminiProxyResponse> {
  if (!PROXY_URL) throw new Error('VITE_GEMINI_PROXY_URL no configurada');

  // Traducir `config` del SDK a `generationConfig`/`tools` de la REST API
  const body: Record<string, unknown> = {
    model: req.model,
    contents: req.contents,
  };
  if (req.config) {
    if (req.config.tools) body.tools = req.config.tools;
    const generationConfig: Record<string, unknown> = {};
    const keys = ['responseMimeType', 'temperature', 'topP', 'maxOutputTokens'] as const;
    for (const k of keys) {
      const v = (req.config as Record<string, unknown>)[k];
      if (v !== undefined) generationConfig[k] = v;
    }
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROXY_ACCESS_KEY) headers['x-proxy-key'] = PROXY_ACCESS_KEY;

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini proxy error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const raw: {
    candidates?: Array<{ content?: GeminiProxyContent }>;
  } = await res.json();

  const candidate = raw.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const textParts = parts.filter((p) => typeof p.text === 'string');
  const text = textParts.length > 0 ? textParts.map((p) => p.text as string).join('') : undefined;

  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => ({
      name: p.functionCall!.name,
      args: p.functionCall!.args,
    }));

  return {
    text,
    functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
    candidates: raw.candidates,
  };
}

/** Objeto con la misma forma que usa geminiService (`.models.generateContent`). */
export function getProxyClient(): { models: { generateContent: (req: GeminiProxyRequest) => Promise<GeminiProxyResponse> } } {
  return {
    models: {
      generateContent,
    },
  };
}
