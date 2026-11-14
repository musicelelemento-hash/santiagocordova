import { InlineKeyboard } from 'grammy';
import { supabase } from './supabase';
import { arePeriodsEqual, isPeriodBeforeClientStart } from './database_ops';

// /cierre — el cruce honorarios × SRI del período activo.
//
// La obligación ante el SRI y el cobro de honorarios son dos cosas distintas.
// Y el estado 'Pagada' NO prueba una declaración: la web y el bot lo ponen al
// cobrar, incluso sobre un período que nunca se declaró. Por eso a quien figura
// cobrado sólo se lo da por declarado si hay comprobante guardado.

export type Cuadrante = 'ok' | 'cobrar' | 'verificar' | 'pendiente';

export interface FilaCierre {
    ruc: string;
    name: string;
    periodo: string;
    dueDay: number | null;
    vencido: boolean;
    honorario: number;
    sinComprobante: boolean;
    aviso?: string;
    cuadrante: Cuadrante;
}

export interface Cierre {
    mensual: string;
    semestral: string;
    filas: FilaCierre[];
    noAplica: number;
}

const PREFIJO = 'baku_cierre:';
const POR_PAGINA = 8;
const SRI_DUE_DATES: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };
// Estados que deja la extensión cuando llenó el formulario y NO envió.
const FRENOS: Record<string, string> = { por_pagar: 'saldo a pagar', inconsistencia: 'inconsistencia', sin_declarar: 'sin declarar' };

function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function usd(n: number): string {
    return `$${(n || 0).toFixed(2)}`;
}

/** El período que se declara este mes (el mes anterior) y el semestre vigente. */
export function periodosActivos(hoy: Date): { mensual: string; semestral: string } {
    const y = hoy.getFullYear();
    const m = hoy.getMonth() + 1;
    return {
        mensual: m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`,
        semestral: m <= 6 ? `${y - 1}-S2` : `${y}-S1`,
    };
}

/** Un comprobante de verdad: una URL, una ruta de almacenamiento o un PDF embebido. Un fragmento suelto no cuenta. */
function tieneComprobante(d: any): boolean {
    const pf = d?.proof_file;
    if (typeof pf === 'string') return pf.length > 0;
    if (pf) {
        if (pf.url) return true;
        if (typeof pf.content === 'string' && (/^(https?:|__SPLIT__)/.test(pf.content) || pf.content.length > 200)) return true;
    }
    return !!(d?.pdfUrl || d?.pdf_url || d?.proofFile);
}

function esDelPeriodo(d: any, periodo: string, semestral: boolean): boolean {
    if (!d || (d.type && d.type !== 'IVA')) return false;
    const p = String(d.period || '').split(':')[0].trim();
    return semestral ? arePeriodsEqual(p, periodo) : p === periodo;
}

export function clasificarCierre(clients: any[], hoy: Date): Cierre {
    const { mensual, semestral } = periodosActivos(hoy);
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();
    const filas: FilaCierre[] = [];
    let noAplica = 0;

    for (const c of clients || []) {
        if (!c || c.is_deleted === true || c.is_active === false) continue;
        const tp = c.tax_profile || {};
        if (tp.requiresDeclarations === false || tp.clientType === 'solo_plan'
            || tp.isSignatureOnly === true || c.requires_declarations === false) continue;

        const regime = String(c.regime || 'Régimen General').trim();
        const esPopular = regime.toLowerCase().includes('popular');
        const frecuencia = tp.ivaFrequency || (regime === 'Rimpe Emprendedor' ? 'Semestral' : (esPopular ? 'Ninguno' : 'Mensual'));
        if (frecuencia !== 'Mensual' && frecuencia !== 'Semestral') continue;

        const esSemestral = frecuencia === 'Semestral';
        const periodo = esSemestral ? semestral : mensual;
        const inicio = tp.clientStartPeriod || c.client_start_period || '';
        if (isPeriodBeforeClientStart(inicio, periodo)) { noAplica++; continue; }

        const todas = [...(c.sri_declaraciones || []), ...(Array.isArray(c.declaration_history) ? c.declaration_history : [])];
        const delPeriodo = todas.filter(d => esDelPeriodo(d, periodo, esSemestral));

        const comprobante = delPeriodo.some(tieneComprobante);
        const enviada = delPeriodo.some(d => d.status === 'Enviada' || d.status === 'Realizada' || d.isRealizada === true);
        const cobrado = delPeriodo.some(d => d.is_paid === true || d.status === 'Pagada');
        const aviso = delPeriodo.map(d => FRENOS[String(d.status)]).find(Boolean);

        const cuadrante: Cuadrante = cobrado
            ? (comprobante ? 'ok' : 'verificar')
            : ((comprobante || enviada) ? 'cobrar' : 'pendiente');

        const noveno = parseInt(String(c.ruc || '').charAt(8), 10);
        const dueDay = Number.isNaN(noveno) ? null : SRI_DUE_DATES[noveno];
        // El semestre se declara en enero y en julio; fuera de esos meses, lo que falte ya venció.
        const esMesDeDeclarar = !esSemestral || mes === 1 || mes === 7;
        const sinDeclarar = cuadrante === 'pendiente' || cuadrante === 'verificar';

        const fee = c.fee_structure || {};
        filas.push({
            ruc: String(c.ruc || ''),
            name: String(c.name || '(sin nombre)'),
            periodo,
            dueDay,
            vencido: sinDeclarar && dueDay !== null && (!esMesDeDeclarar || dia > dueDay),
            honorario: Number(esSemestral ? (fee.semestral ?? 10) : (fee.monthly ?? 5)) || 0,
            sinComprobante: !comprobante,
            aviso,
            cuadrante,
        });
    }

    return { mensual, semestral, filas, noAplica };
}

export function filasDe(cierre: Cierre, q: Cuadrante): FilaCierre[] {
    const lista = cierre.filas.filter(f => f.cuadrante === q);
    if (q === 'cobrar') return lista.sort((a, b) => b.honorario - a.honorario || a.name.localeCompare(b.name));
    if (q === 'pendiente' || q === 'verificar') {
        return lista.sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.name.localeCompare(b.name));
    }
    return lista.sort((a, b) => a.name.localeCompare(b.name));
}

export function textoResumen(cierre: Cierre): string {
    const cobrar = filasDe(cierre, 'cobrar');
    const pendientes = filasDe(cierre, 'pendiente');
    const verificar = filasDe(cierre, 'verificar');
    const haySemestrales = cierre.filas.some(f => f.periodo === cierre.semestral);

    let msg = `📊 <b>CIERRE IVA · ${cierre.mensual}</b>\n`;
    msg += `<i>${cierre.filas.length} con obligación`;
    if (haySemestrales) msg += ` · semestrales: ${cierre.semestral}`;
    if (cierre.noAplica) msg += ` · ${cierre.noAplica} todavía no aplican`;
    msg += `</i>\n\n`;

    msg += `✅ Al día (comprobante y cobrado): <b>${filasDe(cierre, 'ok').length}</b>\n`;
    msg += `💰 Declarado sin cobrar: <b>${cobrar.length}</b>`;
    if (cobrar.length) msg += ` · <b>${usd(cobrar.reduce((s, f) => s + f.honorario, 0))}</b>`;
    msg += `\n⚠️ Cobrado sin comprobante: <b>${verificar.length}</b>\n`;
    msg += `⏳ Sin declarar ni cobrar: <b>${pendientes.length}</b>`;
    const vencidos = pendientes.filter(f => f.vencido).length;
    if (vencidos) msg += ` · 🔴 ${vencidos} vencidos`;
    msg += `\n`;

    const sinComprobante = cobrar.filter(f => f.sinComprobante).length;
    if (sinComprobante) msg += `\n🧾 ${sinComprobante} de las declaradas sin cobrar no tienen comprobante guardado.`;
    return msg;
}

function tecladoResumen(cierre: Cierre): InlineKeyboard {
    const kb = new InlineKeyboard();
    const boton = (q: Cuadrante, etiqueta: string) => {
        const n = cierre.filas.filter(f => f.cuadrante === q).length;
        return n ? [InlineKeyboard.text(`${etiqueta} (${n})`, `${PREFIJO}ver:${q}:1`)] : [];
    };
    const fila1 = [...boton('cobrar', '💰 Por cobrar'), ...boton('verificar', '⚠️ Verificar')];
    const fila2 = [...boton('pendiente', '⏳ Pendientes'), ...boton('ok', '✅ Al día')];
    if (fila1.length) kb.row(...fila1);
    if (fila2.length) kb.row(...fila2);
    kb.row(InlineKeyboard.text('🔄 Refrescar', `${PREFIJO}resumen`), InlineKeyboard.text('🏠 Menú Principal', 'baku_nav:home'));
    return kb;
}

const TITULOS: Record<Cuadrante, string> = {
    cobrar: '💰 <b>DECLARADO SIN COBRAR</b>',
    verificar: '⚠️ <b>COBRADO SIN COMPROBANTE</b>',
    pendiente: '⏳ <b>SIN DECLARAR NI COBRAR</b>',
    ok: '✅ <b>AL DÍA</b>',
};

export function textoLista(cierre: Cierre, q: Cuadrante, pagina: number): { texto: string; items: FilaCierre[]; pagina: number; paginas: number } {
    const lista = filasDe(cierre, q);
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const p = Math.min(Math.max(1, pagina), paginas);
    const items = lista.slice((p - 1) * POR_PAGINA, p * POR_PAGINA);

    let texto = `${TITULOS[q]} · ${lista.length}`;
    if (q === 'cobrar' && lista.length) texto += ` · <b>${usd(lista.reduce((s, f) => s + f.honorario, 0))}</b>`;
    texto += `\n<i>Página ${p} de ${paginas}</i>\n`;
    if (q === 'verificar') {
        texto += `<i>Figuran cobrados, pero no hay comprobante que pruebe la declaración. Verificalos con 🧾 en la extensión: si está presentada baja el comprobante; si no, hay que declarar.</i>\n`;
    }
    texto += `\n`;

    for (const f of items) {
        const partes = [`<code>${esc(f.ruc)}</code>`, f.periodo];
        if ((q === 'pendiente' || q === 'verificar') && f.dueDay !== null) partes.push(`vence ${f.dueDay}${f.vencido ? ' 🔴' : ''}`);
        if (q === 'cobrar') {
            partes.push(usd(f.honorario));
            if (f.sinComprobante) partes.push('🧾 sin comprobante');
        }
        if (f.aviso) partes.push(`🛑 ${f.aviso}`);
        texto += `<b>${esc(f.name)}</b>\n${partes.join(' · ')}\n\n`;
    }
    if (!items.length) texto += `Nadie en esta lista.\n`;
    return { texto, items, pagina: p, paginas };
}

function hoyEnEcuador(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
}

export async function cargarCierre(): Promise<Cierre> {
    const { data, error } = await supabase.from('clients').select('*, sri_declaraciones(*)').eq('is_deleted', false);
    if (error) throw error;
    return clasificarCierre(data || [], hoyEnEcuador());
}

async function pintar(ctx: any, texto: string, kb: InlineKeyboard, editar: boolean): Promise<void> {
    if (editar) {
        try {
            await ctx.editMessageText(texto, { parse_mode: 'HTML', reply_markup: kb });
            return;
        } catch (e: any) {
            if (/not modified/i.test(e?.description || e?.message || '')) return;
        }
    }
    await ctx.reply(texto, { parse_mode: 'HTML', reply_markup: kb });
}

export async function mostrarCierre(ctx: any, editar: boolean = false): Promise<void> {
    try {
        const cierre = await cargarCierre();
        await pintar(ctx, textoResumen(cierre), tecladoResumen(cierre), editar);
    } catch (e: any) {
        console.error('Error en mostrarCierre:', e);
        await ctx.reply(`❌ No pude armar el cierre: ${e?.message || e}`);
    }
}

async function mostrarLista(ctx: any, q: Cuadrante, pagina: number): Promise<void> {
    try {
        const cierre = await cargarCierre();
        const { texto, items, pagina: p, paginas } = textoLista(cierre, q, pagina);

        const kb = new InlineKeyboard();
        if (q === 'cobrar') {
            items.forEach(f => {
                const corto = f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name;
                kb.text(`💵 ${corto} (${usd(f.honorario)})`, `baku_hub_pay:${f.ruc}`).row();
            });
        }
        const nav = [];
        if (p > 1) nav.push(InlineKeyboard.text('◀ Anterior', `${PREFIJO}ver:${q}:${p - 1}`));
        if (p < paginas) nav.push(InlineKeyboard.text('Siguiente ▶', `${PREFIJO}ver:${q}:${p + 1}`));
        if (nav.length) kb.row(...nav);
        if (q === 'cobrar') kb.row(InlineKeyboard.text('📧 Cobro por correo', 'baku_cobro:lista:1'));
        kb.row(InlineKeyboard.text('🔙 Cierre', `${PREFIJO}resumen`), InlineKeyboard.text('🏠 Menú Principal', 'baku_nav:home'));

        await pintar(ctx, texto, kb, true);
    } catch (e: any) {
        console.error('Error en la lista del cierre:', e);
        await ctx.reply(`❌ No pude armar la lista: ${e?.message || e}`);
    }
}

/** Devuelve true si el callback era del cierre y ya se atendió. */
export async function manejarCallbackCierre(ctx: any, data: string): Promise<boolean> {
    if (!data.startsWith(PREFIJO)) return false;
    const [accion, q, pagina] = data.slice(PREFIJO.length).split(':');

    if (accion === 'ver' && (q === 'ok' || q === 'cobrar' || q === 'verificar' || q === 'pendiente')) {
        await mostrarLista(ctx, q, parseInt(pagina, 10) || 1);
        return true;
    }
    await mostrarCierre(ctx, true);
    return true;
}
