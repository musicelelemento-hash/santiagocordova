/**
 * Aviso de errores de la web (22-nov-2026).
 *
 * Antes un error del panel quedaba sólo en la consola del navegador: nadie se
 * enteraba hasta que algo dejaba de andar. Ahora se anota en la tabla
 * `web_errors` (database/web_errors.sql) y Baku lo cuenta en el parte diario.
 *
 * Reglas:
 *  - Sólo con sesión iniciada (la tabla no acepta otra cosa).
 *  - Un mismo mensaje se anota una vez por pestaña, y como mucho 20 por pestaña:
 *    un error en un bucle no llena la tabla.
 *  - Nunca rompe nada: si la tabla no existe o no hay red, se calla.
 *  - Se recortan los textos; no se manda el estado de la app ni datos de clientes.
 */

const yaVistos = new Set<string>();
const MAX_POR_PESTANA = 20;
let enviados = 0;

const recortar = (s: unknown, n: number) => String(s ?? '').slice(0, n);

export async function reportarError(error: unknown, origen: string): Promise<void> {
  try {
    if (!import.meta.env.PROD) return;
    const e = error instanceof Error ? error : new Error(recortar(error, 500) || 'Error sin mensaje');
    const message = recortar(e.message || e.name, 500);
    // Errores del navegador que no son nuestros (extensiones, scripts de terceros).
    if (/ResizeObserver loop|Script error\.?$|chrome-extension:\/\//i.test(message + (e.stack || ''))) return;
    const clave = `${origen}|${message}`;
    if (yaVistos.has(clave) || enviados >= MAX_POR_PESTANA) return;
    yaVistos.add(clave);

    // Import tardío: la página pública no carga Supabase por culpa de esto.
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    enviados++;
    await supabase.from('web_errors').insert({
      message,
      stack: recortar(e.stack, 2000),
      url: recortar(location.pathname + location.search, 300),
      origen: recortar(origen, 40),
      user_agent: recortar(navigator.userAgent, 300),
    });
  } catch {
    /* el aviso de errores nunca debe causar otro error */
  }
}

let instalado = false;
export function instalarAvisoDeErrores(): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('error', (ev) => reportarError(ev.error ?? ev.message, 'window.error'));
  window.addEventListener('unhandledrejection', (ev) => reportarError(ev.reason, 'promesa'));
}
