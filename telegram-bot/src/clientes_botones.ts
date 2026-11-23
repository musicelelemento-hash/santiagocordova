import { InlineKeyboard } from 'grammy';
import { supabase } from './supabase';
import { esc, nombreCorto } from './reporte_diario';

/**
 * Navegar los clientes con botones, como en la web (pedido de Santiago,
 * 23-nov-2026: «que sea por selección, no por escribir»).
 *
 *   Clientes → Todos A–Z / Por letra / Por 9.º dígito / Por tipo / Inactivos
 *            → lista de 8 en 8 con ◀ ▶ → tocar un nombre abre su expediente 360°.
 *
 * Liviano: una sola consulta con columnas justas (sin PDF), guardada 60 s para
 * paginar sin volver a la base. Callback: «bc:<acción>:…» (≤ 64 bytes).
 */

export interface ItemCliente {
    id: string;
    name: string;
    ruc: string;
    tipo: 'mensual' | 'semestral' | 'popular';
    sociedad: boolean;
    digito: number | null;
    activo: boolean;
}

export const POR_PAGINA = 8;
const DIA: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28 };
const TIPOS: Record<string, string> = { mensual: 'IVA mensual', semestral: 'IVA semestral', popular: 'Negocio popular', sociedad: 'Sociedades' };

/** Clasifica una fila de la base (misma regla que el bot: tax_profile manda, si no el régimen). */
export function aItem(c: any): ItemCliente {
    const ruc = String(c.ruc || '').replace(/\D/g, '');
    const reg = String(c.regime || '').toLowerCase();
    const f = c.tax_profile?.ivaFrequency;
    const tipo: ItemCliente['tipo'] =
        f === 'Ninguno' || reg.includes('popular') ? 'popular'
        : f === 'Semestral' || (!f && reg.includes('emprendedor')) ? 'semestral'
        : 'mensual';
    const d = ruc.length >= 9 ? Number(ruc[8]) : NaN;
    return {
        id: String(c.id),
        name: String(c.name || '(sin nombre)'),
        ruc,
        tipo,
        sociedad: ruc.length === 13 && ruc[2] === '9',
        digito: Number.isNaN(d) ? null : d,
        activo: c.is_active !== false,
    };
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const inicial = (n: string) => {
    const l = sinTildes(n.trim().charAt(0).toUpperCase());
    return /[A-Z]/.test(l) ? l : '#';
};

/** Filtro: «t» todos · «l:A» letra · «d:4» dígito · «r:mensual» tipo · «i» inactivos. */
export function filtrar(items: ItemCliente[], filtro: string): ItemCliente[] {
    const [k, v] = filtro.split(':');
    const activos = items.filter(i => i.activo);
    let out: ItemCliente[];
    if (k === 'i') out = items.filter(i => !i.activo);
    else if (k === 'l') out = activos.filter(i => inicial(i.name) === v);
    else if (k === 'd') out = activos.filter(i => i.digito === Number(v));
    else if (k === 'r') out = v === 'sociedad' ? activos.filter(i => i.sociedad) : activos.filter(i => i.tipo === v);
    else out = activos;
    return out.sort((a, b) => sinTildes(a.name).localeCompare(sinTildes(b.name), 'es'));
}

export function tituloFiltro(filtro: string): string {
    const [k, v] = filtro.split(':');
    if (k === 'i') return 'Inactivos';
    if (k === 'l') return `Letra ${v}`;
    if (k === 'd') return `9.º dígito ${v} · vence el día ${DIA[Number(v)]}`;
    if (k === 'r') return TIPOS[v] || v;
    return 'Todos (A–Z)';
}

// ── Pantallas ───────────────────────────────────────────────────────────────

export function pantallaIndice(items: ItemCliente[]): { texto: string; kb: InlineKeyboard } {
    const activos = items.filter(i => i.activo).length;
    const inactivos = items.length - activos;
    const kb = new InlineKeyboard()
        .text('📇 Todos A–Z', 'bc:l:t:0').text('🔤 Por letra', 'bc:letras').row()
        .text('🔢 Por 9.º dígito', 'bc:digitos').text('🏷️ Por tipo', 'bc:tipos').row();
    if (inactivos) kb.text(`⏸️ Inactivos (${inactivos})`, 'bc:l:i:0');
    kb.text('🔎 Buscar escribiendo', 'baku_nav:search').row()
        .text('🧰 Más de clientes', 'baku_hub:clients_crm').text('🔙 Menú', 'baku_nav:home');
    return { texto: `👥 <b>Clientes</b> · ${activos} activos\nElige cómo verlos:`, kb };
}

export function pantallaLetras(items: ItemCliente[]): { texto: string; kb: InlineKeyboard } {
    const cuenta = new Map<string, number>();
    for (const i of items) if (i.activo) cuenta.set(inicial(i.name), (cuenta.get(inicial(i.name)) || 0) + 1);
    const letras = Array.from(cuenta.keys()).sort();
    const kb = new InlineKeyboard();
    letras.forEach((l, n) => { kb.text(`${l} · ${cuenta.get(l)}`, `bc:l:l:${l}:0`); if (n % 4 === 3) kb.row(); });
    if (letras.length % 4) kb.row();
    kb.text('🔙 Clientes', 'bc:i');
    return { texto: '🔤 <b>Clientes por letra</b>\nEl número es cuántos hay:', kb };
}

export function pantallaDigitos(items: ItemCliente[]): { texto: string; kb: InlineKeyboard } {
    const kb = new InlineKeyboard();
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((d, n) => {
        const c = items.filter(i => i.activo && i.digito === d).length;
        kb.text(`${d} · día ${DIA[d]} (${c})`, `bc:l:d:${d}:0`);
        if (n % 2 === 1) kb.row();
    });
    kb.text('🔙 Clientes', 'bc:i');
    return { texto: '🔢 <b>Por 9.º dígito del RUC</b>\nCada uno con su día de vencimiento y cuántos clientes tiene:', kb };
}

export function pantallaTipos(items: ItemCliente[]): { texto: string; kb: InlineKeyboard } {
    const c = (f: string) => filtrar(items, f).length;
    const kb = new InlineKeyboard()
        .text(`🗓️ IVA mensual (${c('r:mensual')})`, 'bc:l:r:mensual:0').text(`📆 Semestral (${c('r:semestral')})`, 'bc:l:r:semestral:0').row()
        .text(`🏷️ Negocio popular (${c('r:popular')})`, 'bc:l:r:popular:0').text(`🏢 Sociedades (${c('r:sociedad')})`, 'bc:l:r:sociedad:0').row()
        .text('🔙 Clientes', 'bc:i');
    return { texto: '🏷️ <b>Clientes por tipo</b>', kb };
}

/** Lista paginada. `filtro` y `pagina` viajan en el callback. */
export function pantallaLista(items: ItemCliente[], filtro: string, pagina: number): { texto: string; kb: InlineKeyboard } {
    const lista = filtrar(items, filtro);
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const p = Math.min(Math.max(0, pagina), paginas - 1);
    const trozo = lista.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
    const kb = new InlineKeyboard();
    for (const c of trozo) {
        const dig = c.digito === null ? '' : ` · ${c.digito}`;
        kb.text(`${nombreCorto(c.name)}${dig}`, `bc:v:${c.id}`).row();
    }
    if (paginas > 1) {
        if (p > 0) kb.text('◀', `bc:l:${filtro}:${p - 1}`);
        kb.text(`${p + 1}/${paginas}`, 'bc:nada');
        if (p < paginas - 1) kb.text('▶', `bc:l:${filtro}:${p + 1}`);
        kb.row();
    }
    const volver = filtro.startsWith('l:') ? 'bc:letras' : filtro.startsWith('d:') ? 'bc:digitos' : filtro.startsWith('r:') ? 'bc:tipos' : 'bc:i';
    kb.text('🔙 Atrás', volver).text('👥 Clientes', 'bc:i');
    const texto = lista.length
        ? `👥 <b>${esc(tituloFiltro(filtro))}</b> · ${lista.length} cliente${lista.length === 1 ? '' : 's'}\nToca uno para abrir su expediente. El número es el 9.º dígito.`
        : `👥 <b>${esc(tituloFiltro(filtro))}</b>\nNo hay clientes aquí.`;
    return { texto, kb };
}

// ── Datos ───────────────────────────────────────────────────────────────────

let cache: { en: number; items: ItemCliente[] } | null = null;

export async function cargarItems(forzar = false): Promise<ItemCliente[]> {
    if (!forzar && cache && Date.now() - cache.en < 60000) return cache.items;
    const { data, error } = await supabase
        .from('clients')
        .select('id, name, ruc, regime, tax_profile, is_active')
        .eq('is_deleted', false);
    if (error) throw error;
    const items = (data || []).map(aItem);
    cache = { en: Date.now(), items };
    return items;
}

/**
 * Atiende los botones «bc:…». `abrirFicha` muestra el expediente 360° (vive en index.ts).
 * Devuelve true si el botón era suyo.
 */
export async function manejarCallbackClientes(
    ctx: any,
    data: string,
    abrirFicha: (cliente: any) => Promise<void>,
): Promise<boolean> {
    if (!data.startsWith('bc:')) return false;
    const partes = data.split(':');
    const accion = partes[1];
    if (accion === 'nada') return true;
    const mostrar = async (p: { texto: string; kb: InlineKeyboard }) => {
        try { await ctx.editMessageText(p.texto, { parse_mode: 'HTML', reply_markup: p.kb }); }
        catch { await ctx.reply(p.texto, { parse_mode: 'HTML', reply_markup: p.kb }); }
    };
    try {
        if (accion === 'v') {
            const { data: c, error } = await supabase.from('clients').select('*').eq('id', partes[2]).maybeSingle();
            if (error || !c) { await ctx.reply('No encontré ese cliente; puede que lo hayan borrado.'); return true; }
            await abrirFicha(c);
            return true;
        }
        const items = await cargarItems(accion === 'i');
        if (accion === 'i') await mostrar(pantallaIndice(items));
        else if (accion === 'letras') await mostrar(pantallaLetras(items));
        else if (accion === 'digitos') await mostrar(pantallaDigitos(items));
        else if (accion === 'tipos') await mostrar(pantallaTipos(items));
        else if (accion === 'l') {
            // bc:l:<filtro>:<pagina>  · el filtro puede traer «:» (l:A, d:4, r:mensual)
            const pagina = Number(partes[partes.length - 1]) || 0;
            const filtro = partes.slice(2, -1).join(':') || 't';
            await mostrar(pantallaLista(items, filtro, pagina));
        }
    } catch (e: any) {
        console.error('❌ clientes por botones:', e);
        await ctx.reply('No pude cargar los clientes ahora. Prueba de nuevo en un momento.');
    }
    return true;
}
