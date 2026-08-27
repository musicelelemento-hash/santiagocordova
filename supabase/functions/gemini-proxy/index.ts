// supabase/functions/gemini-proxy/index.ts
// ---------------------------------------------------------------------
// Proxy serverless para Google Gemini (Edge Function de Supabase).
// Mantiene la API key FUERA del bundle del navegador:
//   - El cliente web llama a este endpoint sin conocer la key.
//   - La key vive solo como secreto en Supabase (GEMINI_API_KEY).
//
// Despliegue (requiere Supabase CLI):
//   1. supabase login && supabase link --project-ref <TU_PROJECT_REF>
//   2. supabase secrets set GEMINI_API_KEY=<tu_key>
//      (opcional) supabase secrets set GEMINI_PROXY_ACCESS_KEY=<token_compartido>
//   3. supabase functions deploy gemini-proxy --no-verify-jwt
//   4. En el frontend, definir VITE_GEMINI_PROXY_URL con la URL de la función
//      (Settings > Edge Functions > gemini-proxy > URL pública).
//
// Si defines GEMINI_PROXY_ACCESS_KEY, el cliente debe enviarla en la
// cabecera `x-proxy-key` (configurable en services/geminiProxyClient.ts).
// ---------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-proxy-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  // 1) Validar que la key del servidor exista
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return json(
      { error: 'GEMINI_API_KEY no configurada en el servidor (supabase secrets set GEMINI_API_KEY=...)' },
      500
    );
  }

  // 2) Access key compartida opcional (protege el endpoint de abuso público)
  const accessKey = Deno.env.get('GEMINI_PROXY_ACCESS_KEY');
  if (accessKey) {
    const provided = req.headers.get('x-proxy-key');
    if (!provided || provided !== accessKey) return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();

    // 3) Validar modelo y payload mínimo
    if (!body || typeof body !== 'object' || !body.contents || !Array.isArray(body.contents)) {
      return json({ error: 'Payload inválido: se requiere { model, contents }' }, 400);
    }

    const model = typeof body.model === 'string' && body.model ? body.model : 'gemini-1.5-flash';

    // 4) Construir payload hacia la REST API de Gemini (solo campos conocidos)
    const payload: Record<string, unknown> = { contents: body.contents };
    if (body.systemInstruction) payload.systemInstruction = body.systemInstruction;
    if (body.tools) payload.tools = body.tools;
    if (body.generationConfig) payload.generationConfig = body.generationConfig;

    // 5) Llamar a Gemini con la key del servidor
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await upstream.json();
    return json(data, upstream.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `Gemini proxy error: ${msg}` }, 500);
  }
});
