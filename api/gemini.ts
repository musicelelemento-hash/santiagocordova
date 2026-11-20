/**
 * POST /api/gemini — proxy de Gemini para el panel (Vercel Function).
 *
 * Por qué: la web llamaba a Gemini con VITE_GEMINI_API_KEY, que Vite mete en el
 * JavaScript público: cualquiera podía copiar la llave y gastar la cuota. Y el
 * modelo `gemini-1.5-flash` ya no existe (404), así que la IA del panel estaba
 * caída. Aquí la llave se lee del lado del servidor (la misma variable de
 * Vercel; como el navegador ya no la referencia, no se incluye en el bundle).
 *
 * Seguridad: sólo responde a usuarios con sesión de Supabase iniciada (el
 * panel de administración). El token se verifica contra Supabase Auth.
 *
 * Cuerpo: { contents, tools?, generationConfig?, systemInstruction? }.
 * El modelo lo decide el servidor (GEMINI_MODEL o gemini-2.5-flash), con
 * respaldo si Google responde 404 por un modelo retirado.
 */

const MODELOS_POR_DEFECTO = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
const MAX_BYTES = 8 * 1024 * 1024; // fotos de RUC / PDF en base64

const json = (obj: unknown, status: number) =>
    new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function usuarioValido(authorization: string | null): Promise<boolean> {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!authorization?.startsWith('Bearer ') || !url || !anon) return false;
    try {
        const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
            headers: { apikey: anon, Authorization: authorization },
        });
        return r.ok;
    } catch {
        return false;
    }
}

export async function POST(request: Request): Promise<Response> {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) return json({ error: 'Falta GEMINI_API_KEY en Vercel.' }, 503);

    if (!(await usuarioValido(request.headers.get('authorization')))) {
        return json({ error: 'Inicia sesión en el panel para usar la IA.' }, 401);
    }

    const crudo = await request.text();
    if (crudo.length > MAX_BYTES) return json({ error: 'El archivo es demasiado grande.' }, 413);

    let body: any;
    try { body = JSON.parse(crudo); } catch { return json({ error: 'JSON inválido.' }, 400); }
    if (!body || !Array.isArray(body.contents)) return json({ error: 'Falta contents.' }, 400);

    // La API REST de Gemini usa el rol 'function' para devolver resultados de
    // herramientas; el asistente del panel los manda como 'tool'.
    const contents = body.contents.map((c: any) => (c && c.role === 'tool' ? { ...c, role: 'function' } : c));
    const payload: Record<string, unknown> = { contents };
    if (body.tools) payload.tools = body.tools;
    if (body.generationConfig) payload.generationConfig = body.generationConfig;
    if (body.systemInstruction) payload.systemInstruction = body.systemInstruction;

    const forzado = (process.env.GEMINI_MODEL || '').trim();
    const modelos = [...(forzado ? [forzado] : []), ...MODELOS_POR_DEFECTO].filter((m, i, a) => a.indexOf(m) === i);

    let ultimo = '';
    for (const modelo of modelos) {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) },
        );
        const texto = await r.text();
        if (r.status === 404) { ultimo = `${modelo}: 404`; continue; } // modelo retirado: probar el siguiente
        return new Response(texto, { status: r.status, headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': modelo } });
    }
    return json({ error: `Ningún modelo de Gemini disponible (${ultimo}).` }, 502);
}
