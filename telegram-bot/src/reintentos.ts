/**
 * fetch con reintentos para el cliente de Supabase.
 *
 * Por qué: Supabase a veces no responde a tiempo y Cloudflare contesta 522
 * (Connection timed out). Pasaba varias veces por semana y en ese segundo fallaba
 * lo que el bot estuviera haciendo: cargar el token de Gmail, guardar el
 * historial del chat, leer la bandeja de notificaciones. Además supabase-js
 * metía la página de error HTML entera en el mensaje y el log de Render se
 * llenaba de 60 líneas por falla.
 *
 * Reglas:
 *  - Lecturas (GET/HEAD): se reintentan ante 5xx transitorios y errores de red.
 *  - Escrituras: sólo se reintentan cuando es seguro que el pedido NO llegó a
 *    la base (521/522/523: Cloudflare no pudo conectar; o la conexión ni se
 *    abrió). Un 524 o un corte a mitad pudo haberse aplicado: no se repite,
 *    para no duplicar un cobro o un mensaje.
 *  - Si al final sigue fallando con HTML, se devuelve un JSON corto.
 */

type Fetch = typeof fetch;

const TRANSITORIOS = new Set([502, 503, 504, 520, 521, 522, 523, 524]);
const NO_LLEGO_AL_ORIGEN = new Set([521, 522, 523]);
const RED_SIN_ENVIAR = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|ConnectTimeoutError/;

export interface OpcionesReintento {
    intentos?: number;
    esperasMs?: number[];
    dormir?: (ms: number) => Promise<void>;
    avisar?: (msg: string) => void;
}

export function crearFetchConReintentos(base: Fetch, op: OpcionesReintento = {}): Fetch {
    const intentos = op.intentos ?? 3;
    const esperas = op.esperasMs ?? [500, 1500, 3000];
    const dormir = op.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const avisar = op.avisar ?? ((m: string) => console.warn(m));

    return (async (input: any, init?: any) => {
        const metodo = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
        const lectura = metodo === 'GET' || metodo === 'HEAD';
        const ruta = (() => {
            try { return new URL(typeof input === 'string' ? input : input.url).pathname; } catch { return '?'; }
        })();

        for (let i = 0; ; i++) {
            const quedan = i < intentos - 1;
            let r: Response;
            try {
                r = await base(input, init);
            } catch (e: any) {
                const codigo = String(e?.cause?.code || e?.code || e?.cause?.name || e?.message || e);
                if (quedan && (lectura || RED_SIN_ENVIAR.test(codigo))) {
                    avisar(`↻ [Supabase] ${metodo} ${ruta}: ${codigo}. Reintento ${i + 1}/${intentos - 1}.`);
                    await dormir(esperas[Math.min(i, esperas.length - 1)]);
                    continue;
                }
                throw e;
            }

            if (TRANSITORIOS.has(r.status)) {
                if (quedan && (lectura || NO_LLEGO_AL_ORIGEN.has(r.status))) {
                    avisar(`↻ [Supabase] ${metodo} ${ruta}: HTTP ${r.status}. Reintento ${i + 1}/${intentos - 1}.`);
                    try { await r.body?.cancel(); } catch { /* nada */ }
                    await dormir(esperas[Math.min(i, esperas.length - 1)]);
                    continue;
                }
                if ((r.headers.get('content-type') || '').includes('text/html')) {
                    try { await r.body?.cancel(); } catch { /* nada */ }
                    return new Response(
                        JSON.stringify({ message: `Supabase no respondió (HTTP ${r.status}) tras ${i + 1} intento(s)`, code: `HTTP_${r.status}`, details: null, hint: null }),
                        { status: r.status, headers: { 'content-type': 'application/json' } },
                    );
                }
            }
            return r;
        }
    }) as Fetch;
}
