import { Bot, InlineKeyboard } from 'grammy';
import { supabase } from './supabase';
import { COMANDOS_MENU } from './comandos';

// Botones que Santiago arma en la web (Bot → Auditoría) y Baku muestra en /menu.
// Viven en bot_web_config, NO en bot_settings: ahí están los tokens de Gmail.

export type BotonWeb = { id: string; label: string; action: string };

export const PREFIJO_BOTON_WEB = 'baku_btn:';
const MAX_EN_MENU = 6;
const COMANDOS_VALIDOS = new Set(COMANDOS_MENU.map(c => c.command));

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** De lo que guardó la web, sólo los activos y bien formados, hasta el tope del menú. */
export function botonesDesdeFila(data: unknown): BotonWeb[] {
    if (!Array.isArray(data)) return [];
    return data
        .filter(b => b && b.isActive === true
            && typeof b.id === 'string' && /^[\w-]{1,40}$/.test(b.id)
            && typeof b.label === 'string' && b.label.trim()
            && typeof b.action === 'string' && b.action.trim())
        .slice(0, MAX_EN_MENU)
        .map(b => ({ id: b.id, label: b.label.trim().slice(0, 40), action: b.action.trim() }));
}

export async function botonesActivos(): Promise<BotonWeb[]> {
    try {
        const { data, error } = await supabase
            .from('bot_web_config').select('data').eq('id', 'custom_buttons').maybeSingle();
        if (error) throw error;
        return botonesDesdeFila(data?.data);
    } catch (e: any) {
        console.warn('⚠️ [BOTONES] No pude leer bot_web_config:', e?.message || e);
        return [];
    }
}

export function agregarBotonesWeb(kb: InlineKeyboard, botones: BotonWeb[]): InlineKeyboard {
    botones.forEach((b, i) => {
        if (i % 2 === 0) kb.row();
        kb.text(b.label, `${PREFIJO_BOTON_WEB}${b.id}`);
    });
    return kb;
}

/** '/cobranza 3' → 'cobranza'. Un texto que no es comando → null. */
export function comandoDe(accion: string): string | null {
    if (!accion.startsWith('/')) return null;
    return accion.slice(1).split(/[\s@]/)[0].toLowerCase();
}

/** La acción, vista como si Santiago la hubiera escrito en el chat. */
export function mensajeSintetico(ctx: any, accion: string) {
    const esComando = accion.startsWith('/');
    return {
        update_id: ctx.update.update_id,
        message: {
            message_id: ctx.callbackQuery?.message?.message_id ?? 0,
            date: Math.floor(Date.now() / 1000),
            chat: ctx.chat,
            from: ctx.from,
            text: accion,
            ...(esComando ? { entities: [{ type: 'bot_command', offset: 0, length: accion.split(/\s/)[0].length }] } : {}),
        },
    };
}

export async function ejecutarBotonWeb(bot: Bot, ctx: any, id: string): Promise<void> {
    const boton = (await botonesActivos()).find(b => b.id === id);
    if (!boton) {
        await ctx.reply('⚠️ Ese botón ya no está activo. /menu para ver los actuales.');
        return;
    }

    const comando = comandoDe(boton.action);
    if (comando !== null && !COMANDOS_VALIDOS.has(comando)) {
        await ctx.reply(
            `⚠️ El botón <b>${esc(boton.label)}</b> apunta a <code>/${esc(comando)}</code>, que Baku no tiene.\nCorregilo en la web → Bot → Auditoría.`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    // Un pedido en palabras va al agente: que se vea qué se le está pidiendo.
    if (comando === null) {
        await ctx.reply(`▶️ <i>${esc(boton.action)}</i>`, { parse_mode: 'HTML' });
    }
    await bot.handleUpdate(mensajeSintetico(ctx, boton.action) as any);
}
