import { Bot, InlineKeyboard } from 'grammy';
import { getDebtorClientsRaw } from './database_ops';
import { sendEmail } from './gmail';

// Lunes Financiero: Baku arma la lista de deudores y PREGUNTA. Los correos salen
// sólo cuando Santiago toca un botón — misma regla que la sala de envío de la web.

const PREFIJO = 'baku_cobro:';
const POR_PAGINA = 5;
const SEIS_DIAS = 6 * 24 * 60 * 60 * 1000;

type Deudor = { ruc: string; name: string; email: string; clientDebt: number };

// RUC → cuándo se le mandó. Vive en memoria: un reinicio sólo borra el marcador ✅.
const enviados = new Map<string, number>();

function yaEnviado(ruc: string): boolean {
    const cuando = enviados.get(ruc);
    return !!cuando && Date.now() - cuando < SEIS_DIAS;
}

function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function usd(n: number): string {
    return `$${(n || 0).toFixed(2)}`;
}

function suma(xs: Deudor[]): number {
    return xs.reduce((s, d) => s + (d.clientDebt || 0), 0);
}

async function deudores(): Promise<{ conEmail: Deudor[]; sinEmail: Deudor[] }> {
    const todos = await getDebtorClientsRaw();
    todos.sort((a, b) => (b.clientDebt || 0) - (a.clientDebt || 0));
    return {
        conEmail: todos.filter(d => d.email && d.clientDebt > 0),
        sinEmail: todos.filter(d => !d.email && d.clientDebt > 0),
    };
}

async function mandarCorreoDeCobro(chatId: string, d: Deudor): Promise<void> {
    const subject = 'Recordatorio de Honorarios Pendientes - Soluciones Contables Pro';
    const body = `Estimado/a ${d.name},\n\nEspero que se encuentre excelente.\n\nEl presente correo es un recordatorio cordial de que mantiene un saldo pendiente por servicios contables y declaraciones SRI por el valor de ${usd(d.clientDebt)}.\n\nPor favor, realizar el pago a la brevedad posible para mantener sus obligaciones fiscales al día y evitar recargos o multas del SRI.\n\nAtentamente,\nSoluciones Contables Pro`;
    await sendEmail(chatId, d.email, subject, body);
    enviados.set(d.ruc, Date.now());
}

export async function proponerCobranzaSemanal(bot: Bot, chatId: string): Promise<void> {
    const { conEmail, sinEmail } = await deudores();

    if (conEmail.length === 0 && sinEmail.length === 0) {
        await bot.api.sendMessage(chatId, '🎉 <b>Cartera al día.</b> Nada que cobrar esta semana.', {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text('🏠 Menú Principal', 'baku_nav:home'),
        });
        return;
    }

    let msg = `💰 <b>LUNES FINANCIERO</b>\n`;
    msg += `<b>${conEmail.length}</b> deudores con correo · <b>${usd(suma(conEmail))}</b>\n`;
    if (sinEmail.length) {
        msg += `<i>${sinEmail.length} más sin correo cargado (${usd(suma(sinEmail))}) — sólo por WhatsApp</i>\n`;
    }
    msg += '\n';
    conEmail.slice(0, 5).forEach(d => { msg += `• ${esc(d.name)} — <b>${usd(d.clientDebt)}</b>\n`; });
    if (conEmail.length > 5) msg += `… y ${conEmail.length - 5} más\n`;
    msg += `\nNo se mandó nada todavía.`;

    const kb = new InlineKeyboard();
    if (conEmail.length) {
        kb.text(`📧 Mandar a los ${conEmail.length}`, `${PREFIJO}todos`).row()
          .text('👀 Uno por uno', `${PREFIJO}lista:1`);
    }
    kb.text('⏭️ Esta semana no', `${PREFIJO}saltar`).row();
    if (sinEmail.length) kb.text('💰 Deudores & Mora', 'baku_page_debt:1');

    await bot.api.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: kb });
}

async function editarOResponder(ctx: any, texto: string, kb: InlineKeyboard): Promise<void> {
    try {
        await ctx.editMessageText(texto, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e: any) {
        const motivo = e?.description || e?.message || '';
        if (!/not modified/i.test(motivo)) {
            await ctx.reply(texto, { parse_mode: 'HTML', reply_markup: kb });
        }
    }
}

async function mostrarUnoPorUno(ctx: any, pagina: number): Promise<void> {
    const { conEmail } = await deudores();
    if (conEmail.length === 0) {
        await editarOResponder(ctx, '🎉 <b>Nadie con correo y saldo pendiente.</b>',
            new InlineKeyboard().text('💰 Deudores & Mora', 'baku_page_debt:1').row().text('🏠 Menú Principal', 'baku_nav:home'));
        return;
    }

    const paginas = Math.max(1, Math.ceil(conEmail.length / POR_PAGINA));
    const p = Math.min(Math.max(1, pagina), paginas);
    const items = conEmail.slice((p - 1) * POR_PAGINA, p * POR_PAGINA);

    let msg = `📧 <b>COBRO UNO POR UNO</b> · ${conEmail.length} con correo · ${usd(suma(conEmail))}\n`;
    msg += `<i>Página ${p} de ${paginas}</i> · ✅ = ya se le mandó esta semana\n\n`;

    const kb = new InlineKeyboard();
    items.forEach(d => {
        const marca = yaEnviado(d.ruc) ? '✅ ' : '';
        msg += `${marca}<b>${esc(d.name)}</b> — <b>${usd(d.clientDebt)}</b>\n`;
        msg += `<code>${esc(d.ruc)}</code> · ${esc(d.email)}\n\n`;
        const corto = d.name.length > 22 ? d.name.slice(0, 20) + '…' : d.name;
        kb.text(`${marca || '📧 '}${corto} (${usd(d.clientDebt)})`, `${PREFIJO}uno:${d.ruc}:${p}`).row();
    });

    const nav = [];
    if (p > 1) nav.push(InlineKeyboard.text('◀ Anterior', `${PREFIJO}lista:${p - 1}`));
    if (p < paginas) nav.push(InlineKeyboard.text('Siguiente ▶', `${PREFIJO}lista:${p + 1}`));
    if (nav.length) kb.row(...nav);
    kb.row(InlineKeyboard.text('🏠 Menú Principal', 'baku_nav:home'));

    await editarOResponder(ctx, msg, kb);
}

async function mandarATodos(ctx: any, chatId: string): Promise<void> {
    try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); } catch (e) {}

    const { conEmail } = await deudores();
    if (conEmail.length === 0) {
        await ctx.reply('🎉 Nadie con correo y saldo pendiente. No se mandó nada.');
        return;
    }
    await ctx.reply(`⏳ Mandando ${conEmail.length} correos de cobro…`);

    const ok: Deudor[] = [];
    const mal: { d: Deudor; motivo: string }[] = [];
    for (const d of conEmail) {
        try {
            await mandarCorreoDeCobro(chatId, d);
            ok.push(d);
        } catch (e: any) {
            mal.push({ d, motivo: e?.message || String(e) });
        }
    }

    let msg = `✅ <b>${ok.length} correos de cobro enviados</b> · ${usd(suma(ok))}\n`;
    ok.slice(0, 40).forEach(d => { msg += `• ${esc(d.name)} — ${usd(d.clientDebt)}\n`; });
    if (ok.length > 40) msg += `… y ${ok.length - 40} más\n`;
    if (mal.length) {
        msg += `\n⚠️ <b>${mal.length} no salieron</b>\n`;
        mal.forEach(m => { msg += `• ${esc(m.d.name)}: ${esc(m.motivo)}\n`; });
    }

    await ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
            .text('💰 Deudores & Mora', 'baku_page_debt:1')
            .text('🏠 Menú Principal', 'baku_nav:home'),
    });
}

async function mandarAUno(ctx: any, chatId: string, ruc: string, pagina: number): Promise<void> {
    const { conEmail } = await deudores();
    const d = conEmail.find(x => x.ruc === ruc);
    if (!d) {
        await ctx.reply(`⚠️ <code>${esc(ruc)}</code> ya no figura como deudor con correo.`, { parse_mode: 'HTML' });
        await mostrarUnoPorUno(ctx, pagina);
        return;
    }
    try {
        await mandarCorreoDeCobro(chatId, d);
        await ctx.reply(`✅ Cobro a <b>${esc(d.name)}</b> (${usd(d.clientDebt)}) → <code>${esc(d.email)}</code>`, { parse_mode: 'HTML' });
    } catch (e: any) {
        await ctx.reply(`❌ No salió el correo a <b>${esc(d.name)}</b>: ${esc(e?.message || e)}`, { parse_mode: 'HTML' });
    }
    await mostrarUnoPorUno(ctx, pagina);
}

/** Devuelve true si el callback era de la cobranza semanal y ya se atendió. */
export async function manejarCallbackCobro(ctx: any, data: string, chatId: string): Promise<boolean> {
    if (!data.startsWith(PREFIJO)) return false;
    const [accion, arg1, arg2] = data.slice(PREFIJO.length).split(':');

    if (accion === 'saltar') {
        await editarOResponder(ctx, '⏭️ Cobranza semanal omitida. Vuelve el lunes a las 08:00.',
            new InlineKeyboard().text('💰 Deudores & Mora', 'baku_page_debt:1'));
        return true;
    }
    if (accion === 'lista') {
        await mostrarUnoPorUno(ctx, parseInt(arg1, 10) || 1);
        return true;
    }
    if (accion === 'uno') {
        await mandarAUno(ctx, chatId, arg1, parseInt(arg2, 10) || 1);
        return true;
    }
    if (accion === 'todos') {
        await mandarATodos(ctx, chatId);
        return true;
    }
    return false;
}
