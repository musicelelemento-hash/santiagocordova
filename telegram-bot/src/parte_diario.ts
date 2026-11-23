import { InlineKeyboard } from 'grammy';
import { cargarCierre, type Cierre, type FilaCierre } from './cierre';
import { calcularVencimiento, hoyEnEcuador, textoFecha } from './vencimientos';
import { getSignaturesVaultList, datosReporteDiario } from './database_ops';
import { lineasDeDatos, bloqueEstado, type DatosReporte } from './reporte_diario';
import { supabase } from './supabase';
import { listarPendientes, pendientesDeHoy, textoCuando, type FilaPendiente } from './pendientes';

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
 *   - firmas: getSignaturesVaultList;
 *   - errores de la web: tabla web_errors (últimas 24 h), que anota el panel
 *     (services/errorReporter.ts de la web). Si la tabla no existe, no se dice nada.
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
    /** Datos del reporte diario (claves, fichas, estado). 23-nov-2026: el parte
     *  reemplaza al reporte de las 03:30, así llega UN solo mensaje por la mañana. */
    reporte?: DatosReporte | null;
    /** Pendientes de Santiago que tocan hoy o ya pasaron (src/pendientes.ts). */
    misPendientes?: FilaPendiente[];
    /** Errores que anotó la web en las últimas 24 h (null = no se pudo saber). */
    erroresWeb?: ErroresWeb | null;
}

export interface ErroresWeb {
    total: number;
    /** Mensajes distintos, el más reciente primero. */
    mensajes: string[];
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

    if (p.misPendientes && p.misPendientes.length) {
        bloques.splice(1, 0, `📝 <b>Tus pendientes de hoy (${p.misPendientes.length})</b>\n${lista(p.misPendientes.map((t) => `${esc(t.title)} · ${esc(textoCuando(t.due_date))}`))}`);
    }
    if (p.erroresWeb && p.erroresWeb.total > 0) {
        const e = p.erroresWeb;
        bloques.push(`🛠️ <b>La web anotó ${e.total} error${e.total === 1 ? '' : 'es'} en las últimas 24 h</b>\n${lista(e.mensajes.map((m) => esc(m.slice(0, 120))))}\n<i>Pásaselos a Claude para que los revise.</i>`);
    }

    const datos = p.reporte ? lineasDeDatos(p.reporte) : [];
    if (datos.length) bloques.push(`🔐 <b>Claves y fichas</b>\n${datos.map(l => `• ${l}`).join('\n')}`);

    if (bloques.length === 1) bloques.push('✅ Todo al día: nada vence esta semana y no hay pendientes.');

    if (p.reporte) bloques.push(bloqueEstado(p.reporte, false));

    const notas: string[] = [];
    if (!p.conFeriados) notas.push('Fechas trasladadas por fin de semana; los feriados no están cargados (FERIADOS_EC).');
    notas.push('Los anexos todavía no se listan: la base no guarda cuál falta por período.');
    bloques.push(`<i>${notas.map(esc).join(' ')}</i>`);
    return bloques.join('\n\n');
}

/** Recordatorio de la tarde: sólo si algo vence hoy y sigue sin declarar. */
export function textoTarde(p: Parte): string | null {
    const mios = p.misPendientes || [];
    if (!p.vencenHoy.length && !mios.length) return null;
    if (!p.vencenHoy.length) {
        return `📝 <b>¿Ya hiciste esto de hoy? (${mios.length})</b>\n${lista(mios.map((t) => esc(t.title)))}\n<i>Márcalos con ✅ en /pendientes.</i>`;
    }
    return `⏰ <b>Quedan horas: vencen HOY y siguen sin declarar (${p.vencenHoy.length})</b>\n${lista(p.vencenHoy.map((i) => `${esc(i.name)} · ${esc(i.periodo)}`))}`;
}

export function botonesParte(p: Parte): InlineKeyboard {
    // 23-nov-2026: un botón por cada cosa que el parte pide atender, de a dos por fila.
    const acciones: [string, string][] = [];
    if (p.vencenHoy.length || p.manana.length || p.semana.length || p.vencidos.length) acciones.push(['📋 Ver sin declarar', 'baku_cierre:ver:pendiente:1']);
    if (p.misPendientes && p.misPendientes.length) acciones.push(['📝 Mis pendientes', 'baku_tarea:lista']);
    if (p.reporte && p.reporte.clavesConProblema.some(c => /rechazada|bloqueada|caducada/i.test(c.reason))) acciones.push(['🔑 Claves que no entran', 'baku_nav:sri_keys']);
    if (p.reporte && p.reporte.porCobrar > 0) acciones.push(['💳 Cobrar', 'baku_page_debt:1']);
    const kb = new InlineKeyboard();
    acciones.forEach(([t, d], i) => { kb.text(t, d); if (i % 2 === 1) kb.row(); });
    if (acciones.length % 2 === 1) kb.row();
    kb.url('🖥️ Abrir Declaraciones en la web', WEB_DECLARACIONES);
    return kb;
}

/** Carga datos frescos y arma el parte de hoy (hora de Ecuador). */
export async function prepararParte(): Promise<{ parte: Parte; hoy: Date }> {
    const hoy = hoyEnEcuador();
    const [cierre, firmas, erroresWeb, mios, reporte] = await Promise.all([
        cargarCierre(true), getSignaturesVaultList(), cargarErroresWeb(),
        listarPendientes().catch(() => [] as FilaPendiente[]),
        datosReporteDiario().catch(() => null),
    ]);
    const parte = armarParte(cierre, hoy, feriadosConfigurados(), firmas);
    parte.erroresWeb = erroresWeb;
    parte.misPendientes = pendientesDeHoy(mios);
    parte.reporte = reporte;
    return { parte, hoy };
}

/** Agrupa filas de web_errors (más recientes primero) en total + mensajes distintos. */
export function resumirErroresWeb(filas: { message: string | null }[], max = 3): ErroresWeb {
    const mensajes: string[] = [];
    for (const f of filas) {
        const m = String(f.message || '').trim();
        if (m && !mensajes.includes(m)) mensajes.push(m);
        if (mensajes.length >= max) break;
    }
    return { total: filas.length, mensajes };
}

/** Errores de la web en las últimas 24 h. Nunca tira: si falla, devuelve null. */
async function cargarErroresWeb(): Promise<ErroresWeb | null> {
    try {
        const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data, error } = await supabase
            .from('web_errors')
            .select('message')
            .gte('created_at', desde)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error || !data) return null;
        return resumirErroresWeb(data as { message: string | null }[]);
    } catch {
        return null;
    }
}

/** Envía el parte de la mañana (o el de la tarde, que puede no enviarse) al chat dado. */
export async function enviarParte(api: { sendMessage: (chatId: string | number, text: string, other?: any) => Promise<any> }, chatId: string | number, momento: 'manana' | 'tarde'): Promise<boolean> {
    const { parte, hoy } = await prepararParte();
    const texto = momento === 'manana' ? textoParte(parte, hoy) : textoTarde(parte);
    if (!texto) return false;
    await api.sendMessage(chatId, texto, { parse_mode: 'HTML', reply_markup: botonesParte(parte), link_preview_options: { is_disabled: true } });
    return true;
}
