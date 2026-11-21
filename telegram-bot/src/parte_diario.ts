import { InlineKeyboard } from 'grammy';
import { cargarCierre, type Cierre, type FilaCierre } from './cierre';
import { calcularVencimiento, hoyEnEcuador, textoFecha } from './vencimientos';
import { getSignaturesVaultList } from './database_ops';

/**
 * Parte diario de Baku (pedido por Santiago el 21-nov-2026): un solo mensaje
 * por la mañana con lo que hay que hacer hoy, y un recordatorio a la tarde
 * sólo si algo vence hoy y sigue sin declarar.
 *
 * Avisa SÓLO a Santiago. No escribe a los clientes: eso sigue siendo de a
 * uno y a mano (sala de envío de la web), por la regla de §5 del tablero.
 *
 * Fuentes:
 *   - qué falta declarar / qué está declarado: clasificarCierre (/cierre),
 *     que mira las dos fuentes (sri_declaraciones y declaration_history);
 *   - cuándo vence: calcularVencimiento, con traslado por fin de semana y por
 *     los feriados de FERIADOS_EC (Render). Sin esa variable, sólo fin de semana;
 *   - avisado por WhatsApp: isNotifiedWhatsApp que la web guarda en el historial;
 *   - firmas: getSignaturesVaultList.
 *
 * Anexos (ATS, RDEP, gastos personales…): la base no guarda por período qué
 * anexo falta, así que el parte no los lista. Ver la nota al pie del mensaje.
 */

export interface ItemVence {
    ruc: string;
    name: string;
    periodo: string;
    fecha: string; // AAAA-MM-DD ya trasladada
    dias: number;  // negativos: vencido
}

export interface FirmaPorVencer {
    name: string;
    ruc: string;
    dias: number;
}

export interface Parte {
    hoy: string;
    vencenHoy: ItemVence[];
    manana: ItemVence[];
    semana: ItemVence[];
    vencidos: ItemVence[];
    sinComprobante: FilaCierre[];
    sinAvisar: FilaCierre[];
    firmas: FirmaPorVencer[];
    conFeriados: boolean;
}

const WEB_DECLARACIONES = 'https://santiagocordova.com/dashboard?screen=declaraciones';
const DIAS_SEMANA = 7;
const DIAS_FIRMA = 15;
const MAX_NOMBRES = 8;

/** Feriados nacionales configurados en Render: FERIADOS_EC=2026-12-25,2027-01-01,… */
export function feriadosConfigurados(valor = process.env.FERIADOS_EC || ''): string[] {
    return valor.split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

const isoLocal = (f: Date) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const diasEntre = (desde: string, hasta: string) =>
    Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** Arma el parte sin red: recibe el cierre ya clasificado y las firmas. */
export function armarParte(cierre: Cierre, hoy: Date, feriados: string[], firmas: { name: string; ruc: string; daysRemaining: number | null }[] = []): Parte {
    const hoyIso = isoLocal(hoy);
    const p: Parte = {
        hoy: hoyIso,
        vencenHoy: [], manana: [], semana: [], vencidos: [],
        sinComprobante: [], sinAvisar: [], firmas: [],
        conFeriados: feriados.length > 0,
    };

    for (const f of cierre.filas) {
        const sinDeclarar = f.cuadrante === 'pendiente' || f.cuadrante === 'verificar';
        if (sinDeclarar) {
            let fecha: string;
            try {
                fecha = calcularVencimiento(f.ruc, f.periodo, '', { feriados }).fecha;
            } catch {
                continue; // RUC incompleto: /cierre ya lo muestra
            }
            const item: ItemVence = { ruc: f.ruc, name: f.name, periodo: f.periodo, fecha, dias: diasEntre(hoyIso, fecha) };
            if (item.dias < 0) p.vencidos.push(item);
            else if (item.dias === 0) p.vencenHoy.push(item);
            else if (item.dias === 1) p.manana.push(item);
            else if (item.dias <= DIAS_SEMANA) p.semana.push(item);
            continue;
        }
        // Declarado (cobrado o no): ¿falta el PDF?, ¿falta avisar al cliente?
        if (f.sinComprobante) p.sinComprobante.push(f);
        else if (!f.avisadoWhatsApp) p.sinAvisar.push(f);
    }

    p.firmas = firmas
        .filter((s) => s.daysRemaining !== null && s.daysRemaining >= 0 && s.daysRemaining <= DIAS_FIRMA)
        .map((s) => ({ name: s.name, ruc: s.ruc, dias: s.daysRemaining as number }))
        .sort((a, b) => a.dias - b.dias);

    const porFecha = (a: ItemVence, b: ItemVence) => a.fecha.localeCompare(b.fecha) || a.name.localeCompare(b.name);
    p.vencenHoy.sort(porFecha);
    p.manana.sort(porFecha);
    p.semana.sort(porFecha);
    p.vencidos.sort(porFecha);
    return p;
}

function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function lista(nombres: string[]): string {
    const vis = nombres.slice(0, MAX_NOMBRES).map((n) => `  • ${n}`);
    if (nombres.length > MAX_NOMBRES) vis.push(`  … y ${nombres.length - MAX_NOMBRES} más`);
    return vis.join('\n');
}

const fechaCorta = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return textoFecha(new Date(y, m - 1, d));
};

/** Mensaje de la mañana (HTML de Telegram). */
export function textoParte(p: Parte, hoy: Date): string {
    const bloques: string[] = [`☀️ <b>Parte del día</b> — ${esc(textoFecha(hoy))}`];

    if (p.vencenHoy.length) {
        bloques.push(`🔴 <b>Vencen HOY y siguen sin declarar (${p.vencenHoy.length})</b>\n${lista(p.vencenHoy.map((i) => `${esc(i.name)} · ${esc(i.periodo)}`))}`);
    }
    if (p.manana.length) {
        bloques.push(`🟠 <b>Vencen mañana (${p.manana.length})</b>\n${lista(p.manana.map((i) => `${esc(i.name)} · ${esc(i.periodo)}`))}`);
    }
    if (p.semana.length) {
        bloques.push(`🟡 <b>Esta semana (${p.semana.length})</b>\n${lista(p.semana.map((i) => `${esc(i.name)} · ${esc(fechaCorta(i.fecha))}`))}`);
    }
    if (p.vencidos.length) {
        bloques.push(`⚠️ <b>Ya vencidos sin declarar (${p.vencidos.length})</b>\n${lista(p.vencidos.map((i) => `${esc(i.name)} · ${esc(i.periodo)}`))}`);
    }
    if (p.sinComprobante.length) {
        bloques.push(`📎 <b>Declarados sin comprobante subido (${p.sinComprobante.length})</b>\n${lista(p.sinComprobante.map((f) => esc(f.name)))}`);
    }
    if (p.sinAvisar.length) {
        bloques.push(`💬 <b>Falta avisarles por WhatsApp (${p.sinAvisar.length})</b>\n${lista(p.sinAvisar.map((f) => esc(f.name)))}\n<i>Se mandan de a uno desde la sala de envío.</i>`);
    }
    if (p.firmas.length) {
        bloques.push(`✍️ <b>Firmas por vencer (${p.firmas.length})</b>\n${lista(p.firmas.map((s) => `${esc(s.name)} · ${s.dias === 0 ? 'hoy' : `en ${s.dias} día${s.dias === 1 ? '' : 's'}`}`))}`);
    }

    if (bloques.length === 1) bloques.push('✅ Todo al día: nada vence esta semana y no hay pendientes.');

    const notas: string[] = [];
    if (!p.conFeriados) notas.push('Fechas trasladadas por fin de semana; los feriados no están cargados (FERIADOS_EC).');
    notas.push('Los anexos todavía no se listan: la base no guarda cuál falta por período.');
    bloques.push(`<i>${notas.map(esc).join(' ')}</i>`);
    return bloques.join('\n\n');
}

/** Recordatorio de la tarde: sólo si algo vence hoy y sigue sin declarar. */
export function textoTarde(p: Parte): string | null {
    if (!p.vencenHoy.length) return null;
    return `⏰ <b>Quedan horas: vencen HOY y siguen sin declarar (${p.vencenHoy.length})</b>\n${lista(p.vencenHoy.map((i) => `${esc(i.name)} · ${esc(i.periodo)}`))}`;
}

export function botonesParte(p: Parte): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (p.vencenHoy.length || p.manana.length || p.semana.length || p.vencidos.length) {
        kb.text('📋 Ver sin declarar', 'baku_cierre:ver:pendiente:1').row();
    }
    kb.url('🖥️ Abrir Declaraciones en la web', WEB_DECLARACIONES);
    return kb;
}

/** Carga datos frescos y arma el parte de hoy (hora de Ecuador). */
export async function prepararParte(): Promise<{ parte: Parte; hoy: Date }> {
    const hoy = hoyEnEcuador();
    const [cierre, firmas] = await Promise.all([cargarCierre(true), getSignaturesVaultList()]);
    return { parte: armarParte(cierre, hoy, feriadosConfigurados(), firmas), hoy };
}

/** Envía el parte de la mañana (o el de la tarde, que puede no enviarse) al chat dado. */
export async function enviarParte(api: { sendMessage: (chatId: string | number, text: string, other?: any) => Promise<any> }, chatId: string | number, momento: 'manana' | 'tarde'): Promise<boolean> {
    const { parte, hoy } = await prepararParte();
    const texto = momento === 'manana' ? textoParte(parte, hoy) : textoTarde(parte);
    if (!texto) return false;
    await api.sendMessage(chatId, texto, { parse_mode: 'HTML', reply_markup: botonesParte(parte), link_preview_options: { is_disabled: true } });
    return true;
}
