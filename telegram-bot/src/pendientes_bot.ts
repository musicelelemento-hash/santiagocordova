import type { Context } from 'grammy';
import {
    esPedidoDeAnotar, interpretarPendiente, crearPendiente, listarPendientes, marcarHecho,
    posponer, nuevaFecha, textoAnotado, textoLista, botonesLista, textoCuando,
} from './pendientes';

/** «anota…» / «recuérdame…»: lo guarda sin pasar por la IA. Devuelve true si lo atendió. */
export async function intentarAnotar(ctx: Context, texto: string): Promise<boolean> {
    if (!esPedidoDeAnotar(texto)) return false;
    try {
        const p = interpretarPendiente(texto);
        const fila = await crearPendiente(p);
        await ctx.reply(textoAnotado(fila), { parse_mode: 'HTML' });
    } catch (e: any) {
        console.error('❌ anotar pendiente:', e);
        await ctx.reply('No pude guardar el pendiente ahora (falló la base). Inténtalo de nuevo en un rato.');
    }
    return true;
}

/** /pendientes */
export async function mostrarPendientes(ctx: Context): Promise<void> {
    try {
        const filas = await listarPendientes();
        await ctx.reply(textoLista(filas), { parse_mode: 'HTML', reply_markup: botonesLista(filas) });
    } catch (e: any) {
        console.error('❌ /pendientes:', e);
        await ctx.reply('No pude leer tus pendientes ahora. Inténtalo de nuevo en un rato.');
    }
}

/** /anota <texto> (también vale «/anota» solo: explica cómo). */
export async function comandoAnota(ctx: Context, resto: string): Promise<void> {
    const texto = `anota ${resto || ''}`.trim();
    if (!esPedidoDeAnotar(texto)) {
        await ctx.reply('Escríbeme qué anoto, por ejemplo:\n/anota mañana a las 10 llamar al SRI\n\nTambién puedes escribir directo: «recuérdame el viernes mandar comprobantes».');
        return;
    }
    await intentarAnotar(ctx, texto);
}

/** Botones baku_tarea:<accion>:<id>. Devuelve true si era suyo. */
export async function manejarCallbackPendiente(ctx: Context, data: string): Promise<boolean> {
    if (!data.startsWith('baku_tarea:')) return false;
    const [, accion, id] = data.split(':');
    try {
        if (accion === 'lista') {
            await mostrarPendientes(ctx);
            return true;
        }
        if (!id) return true;
        if (accion === 'ok') {
            const f = await marcarHecho(id);
            const texto = f ? `✅ Listo: <b>${escHtml(f.title)}</b>. Buen trabajo.` : 'Ese pendiente ya no existe.';
            try { await ctx.editMessageText(texto, { parse_mode: 'HTML' }); } catch { await ctx.reply(texto, { parse_mode: 'HTML' }); }
            return true;
        }
        if (accion === '1h' || accion === 'manana') {
            const actuales = await listarPendientes();
            const actual = actuales.find((x) => x.id === id);
            if (!actual) {
                try { await ctx.editMessageText('Ese pendiente ya está cerrado.'); } catch { /* nada */ }
                return true;
            }
            const f = await posponer(id, nuevaFecha(accion, actual.due_date));
            const texto = f ? `⏰ Movido: <b>${escHtml(f.title)}</b> → ${escHtml(textoCuando(f.due_date))}` : 'No pude moverlo.';
            try { await ctx.editMessageText(texto, { parse_mode: 'HTML' }); } catch { await ctx.reply(texto, { parse_mode: 'HTML' }); }
            return true;
        }
    } catch (e: any) {
        console.error('❌ botón de pendiente:', e);
        await ctx.reply('No pude actualizar el pendiente ahora. Inténtalo de nuevo en un rato.');
    }
    return true;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
