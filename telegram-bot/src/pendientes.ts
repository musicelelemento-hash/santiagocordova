import { InlineKeyboard } from 'grammy';
import { supabase } from './supabase';

/**
 * Pendientes de Santiago (pedido el 22-nov-2026): «anótame…», «recuérdame…»,
 * y que Baku avise a la hora como un asistente de verdad: «¿ya lo hiciste?».
 *
 * Se guardan en la tabla `tasks`, la misma que usa la pantalla Tareas de la web
 * (las dos ven las mismas). Sin columnas nuevas:
 *   - `due_date` es un ISO (como lo guarda la web).
 *   - Un pendiente SIN hora se guarda a las 23:59 de Ecuador de ese día: no
 *     dispara aviso suelto; aparece en el parte de la mañana y en /pendientes.
 *   - Con hora, el bucle de recordatorios (cada 2 min) avisa al llegar la hora.
 *
 * Sólo le escribe a Santiago. Nunca a un cliente.
 */

const OFFSET_EC_MS = -5 * 60 * 60 * 1000; // Ecuador: UTC-5, sin horario de verano.
const ABIERTOS = ['Pendiente', 'En Proceso'];

export interface PendienteInterpretado {
    titulo: string;
    venceIso: string;
    conHora: boolean;
}

export interface FilaPendiente {
    id: string;
    title: string;
    due_date: string | null;
    status: string;
}

// ── Fechas en hora de Ecuador ───────────────────────────────────────────────

/** Partes de fecha/hora de un instante, vistas en Ecuador. */
export function partesEc(d: Date) {
    const x = new Date(d.getTime() + OFFSET_EC_MS);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours(), min: x.getUTCMinutes(), dow: x.getUTCDay() };
}

/** Instante para una fecha y hora de Ecuador. */
export function instanteEc(y: number, m: number, d: number, h: number, min: number): Date {
    return new Date(Date.UTC(y, m, d, h, min) - OFFSET_EC_MS);
}

/** ¿El pendiente tiene hora? (sin hora = 23:59 de Ecuador). */
export function tieneHora(iso: string | null | undefined): boolean {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    const p = partesEc(new Date(t));
    return !(p.h === 23 && p.min === 59);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_TXT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_TXT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** «hoy 10:30», «mañana», «vie 28 nov 09:00», «vencido · 20 nov». */
export function textoCuando(iso: string | null, ahora: Date = new Date()): string {
    if (!iso || Number.isNaN(Date.parse(iso))) return 'sin fecha';
    const v = new Date(iso);
    const p = partesEc(v);
    const h = partesEc(ahora);
    const dias = Math.round((Date.UTC(p.y, p.m, p.d) - Date.UTC(h.y, h.m, h.d)) / 86400000);
    const hora = tieneHora(iso) ? ` ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}` : '';
    if (dias < 0 || (dias === 0 && hora && v.getTime() < ahora.getTime())) {
        return `vencido · ${p.d} ${MESES_TXT[p.m]}${hora}`;
    }
    if (dias === 0) return `hoy${hora}`;
    if (dias === 1) return `mañana${hora}`;
    return `${DIAS_TXT[p.dow]} ${p.d} ${MESES_TXT[p.m]}${hora}`;
}

// ── Entender la frase ───────────────────────────────────────────────────────

const PREFIJO = /^\s*(?:baku[,:]?\s*)?(?:por\s+favor\s+)?(?:an[oó]ta(?:me|lo)?|ap[uú]nta(?:me|lo)?|recu[eé]rdame|record[aá]me|ag[eé]nda(?:me|lo)?|nuevo\s+pendiente|pendiente)\s*[:,-]?\s*(?:que\s+)?/i;

/** ¿El mensaje es un pedido de anotar? (sin pasar por la IA). */
export function esPedidoDeAnotar(texto: string): boolean {
    if (!PREFIJO.test(texto) || texto.replace(PREFIJO, '').trim().length < 2) return false;
    // «anota el pago de Pérez» / «apunta que Gómez pagó» / «anota la declaración de…»
    // son cobros o declaraciones, no recordatorios: los atiende su propio flujo.
    // «recuérdame pagar el IESS» sí es un recordatorio (empieza con recuérdame).
    if (/^\s*(?:baku[,:]?\s*)?(?:an[oó]ta|ap[uú]nta)/i.test(texto) && /(?:^|[^a-záéíóúñ])(?:pag(?:o|ó|ado|aron)|cancel[oó]|declaraci[oó]n|declar[oó])(?![a-záéíóúñ])/i.test(texto)) return false;
    return true;
}

/**
 * Interpreta «recuérdame mañana a las 10 llamar a Juan» → título + fecha.
 * Sin fecha: hoy. Sin hora: sin aviso suelto (sale en el parte del día).
 * Hora sola ya pasada hoy: mañana a esa hora.
 */
export function interpretarPendiente(texto: string, ahora: Date = new Date()): PendienteInterpretado {
    // NFC: así el texto sin tildes mide lo mismo y los índices coinciden.
    let resto = texto.normalize('NFC').replace(PREFIJO, ' ');
    const hoy = partesEc(ahora);
    let fecha: { y: number; m: number; d: number } | null = null;
    let hora: { h: number; min: number } | null = null;
    let relativoMs: number | null = null;

    const quitar = (re: RegExp) => { resto = resto.replace(re, ' '); };
    const n = () => sinTildes(resto.toLowerCase());
    const sumarDias = (k: number) => {
        const x = new Date(Date.UTC(hoy.y, hoy.m, hoy.d + k));
        return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() };
    };

    // «en 20 minutos», «en 2 horas», «en 3 días»
    let mm = n().match(/\ben\s+(\d{1,3})\s*(minutos?|mins?|horas?|hrs?|h|dias?)\b/);
    if (mm) {
        const k = Number(mm[1]);
        const u = mm[2];
        if (/^d/.test(u)) fecha = sumarDias(k);
        else relativoMs = k * (/^m/.test(u) ? 60000 : 3600000);
        quitar(/\ben\s+\d{1,3}\s*(minutos?|mins?|horas?|hrs?|h|d[ií]as?)\b/i);
    }

    // Día
    if (!fecha && relativoMs === null) {
        if (/\bpasado\s+manana\b/.test(n())) { fecha = sumarDias(2); quitar(/\bpasado\s+ma[nñ]ana\b/i); }
        // «mañana» como día, no «de la mañana» (la hora).
        else if (/(?<!la\s)\bmanana\b/.test(n())) { fecha = sumarDias(1); quitar(/(?<!la\s)\bma[nñ]ana\b/i); }
        else if (/\bhoy\b/.test(n())) { fecha = sumarDias(0); quitar(/\bhoy\b/i); }
    }
    if (!fecha && relativoMs === null) {
        mm = n().match(/\b(?:el\s+|este\s+|el\s+proximo\s+|proximo\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
        if (mm) {
            const objetivo = DIAS.indexOf(mm[1]);
            let k = (objetivo - hoy.dow + 7) % 7;
            if (k === 0) k = 7;
            fecha = sumarDias(k);
            quitar(/\b(?:el\s+|este\s+|el\s+pr[oó]ximo\s+|pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/i);
        }
    }
    if (!fecha && relativoMs === null) {
        mm = n().match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
        if (mm) {
            const d = Number(mm[1]), m = Number(mm[2]) - 1;
            let y = mm[3] ? Number(mm[3].length === 2 ? `20${mm[3]}` : mm[3]) : hoy.y;
            if (!mm[3] && Date.UTC(y, m, d) < Date.UTC(hoy.y, hoy.m, hoy.d)) y++;
            if (m >= 0 && m < 12 && d >= 1 && d <= 31) { fecha = { y, m, d }; quitar(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/); }
        } else {
            mm = n().match(/\b(?:el|para\s+el)\s+(\d{1,2})\b(?!\s*(?::|h\b|horas?|am|pm))/);
            if (mm) {
                const d = Number(mm[1]);
                if (d >= 1 && d <= 31) {
                    let y = hoy.y, m = hoy.m;
                    if (d < hoy.d) { m++; if (m > 11) { m = 0; y++; } }
                    fecha = { y, m, d };
                    quitar(/\b(?:el|para\s+el)\s+\d{1,2}\b/i);
                }
            }
        }
    }

    // Hora: «a las 10», «a la 1», «a las 3:30 pm», «10:30», «10h30», «9am», «de la tarde»
    if (relativoMs === null) {
        // Se toma el primer número que de verdad es una hora: dice «a las», trae
        // minutos o am/pm. «llamar a 3 clientes a las 10» → 10:00, no 3.
        const re = /\b(?:a\s+las?\s+)?(\d{1,2})(?:[:h](\d{2}))?\s*(am|a\.m\.|pm|p\.m\.|de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche)?(?![\w\/-])/g;
        for (const m of n().matchAll(re)) {
            if (!(/^a\s+las?\s/.test(m[0]) || m[2] || m[3])) continue;
            let h = Number(m[1]);
            const min = m[2] ? Number(m[2]) : 0;
            const marca = m[3] || '';
            if (/pm|p\.m\.|tarde|noche/.test(marca) && h < 12) h += 12;
            else if (/am|a\.m\.|manana/.test(marca) && h === 12) h = 0;
            else if (!marca && h >= 1 && h <= 6) h += 12; // «a las 3» en horario de oficina = 15:00
            if (h > 23 || min > 59) continue;
            hora = { h, min };
            const i = m.index ?? 0;
            resto = resto.slice(0, i) + ' ' + resto.slice(i + m[0].length);
            break;
        }
        if (!hora) {
            if (/\besta\s+tarde\b/.test(n())) { hora = { h: 15, min: 0 }; fecha = fecha || sumarDias(0); quitar(/\besta\s+tarde\b/i); }
            else if (/\besta\s+noche\b/.test(n())) { hora = { h: 20, min: 0 }; fecha = fecha || sumarDias(0); quitar(/\besta\s+noche\b/i); }
            else if (/\b(de|en|por)\s+la\s+manana\b/.test(n())) { hora = { h: 9, min: 0 }; quitar(/\b(de|en|por)\s+la\s+ma[nñ]ana\b/i); }
        }
    }

    const titulo = limpiarTitulo(resto) || 'Pendiente';

    if (relativoMs !== null) {
        return { titulo, venceIso: new Date(ahora.getTime() + relativoMs).toISOString(), conHora: true };
    }
    if (hora && !fecha) {
        const hoyALaHora = instanteEc(hoy.y, hoy.m, hoy.d, hora.h, hora.min);
        fecha = hoyALaHora.getTime() > ahora.getTime() ? sumarDias(0) : sumarDias(1);
    }
    const f = fecha || sumarDias(0);
    if (hora) return { titulo, venceIso: instanteEc(f.y, f.m, f.d, hora.h, hora.min).toISOString(), conHora: true };
    return { titulo, venceIso: instanteEc(f.y, f.m, f.d, 23, 59).toISOString(), conHora: false };
}

function limpiarTitulo(s: string): string {
    const t = s
        .replace(/\s+/g, ' ')
        .replace(/^[\s,.:;\-]+|[\s,.:;\-]+$/g, '')
        .replace(/^(de|que|el|la|para|a)\s+/i, '')
        .replace(/\s+(de|para|el|la|a)$/i, '')
        .trim();
    return t ? t[0].toUpperCase() + t.slice(1) : '';
}

// ── Base de datos ───────────────────────────────────────────────────────────

export async function crearPendiente(p: PendienteInterpretado): Promise<FilaPendiente> {
    const { data, error } = await supabase
        .from('tasks')
        .insert({ title: p.titulo.slice(0, 200), description: 'Anotado por Baku', due_date: p.venceIso, status: 'Pendiente' })
        .select('id, title, due_date, status')
        .single();
    if (error) throw error;
    return data as FilaPendiente;
}

export async function listarPendientes(): Promise<FilaPendiente[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .in('status', ABIERTOS)
        .order('due_date', { ascending: true })
        .limit(100);
    if (error) throw error;
    return (data || []) as FilaPendiente[];
}

export async function marcarHecho(id: string): Promise<FilaPendiente | null> {
    const { data, error } = await supabase
        .from('tasks').update({ status: 'Completada', updated_at: new Date().toISOString() })
        .eq('id', id).select('id, title, due_date, status').maybeSingle();
    if (error) throw error;
    return (data as FilaPendiente) || null;
}

export async function posponer(id: string, venceIso: string): Promise<FilaPendiente | null> {
    const { data, error } = await supabase
        .from('tasks').update({ due_date: venceIso, updated_at: new Date().toISOString() })
        .eq('id', id).select('id, title, due_date, status').maybeSingle();
    if (error) throw error;
    return (data as FilaPendiente) || null;
}

/** Nueva fecha al posponer: «1h» = dentro de una hora; «manana» = mañana 09:00 (o sin hora si no tenía). */
export function nuevaFecha(modo: '1h' | 'manana', venceActual: string | null, ahora: Date = new Date()): string {
    if (modo === '1h') return new Date(ahora.getTime() + 3600000).toISOString();
    const h = partesEc(ahora);
    const x = new Date(Date.UTC(h.y, h.m, h.d + 1));
    const conHora = tieneHora(venceActual);
    return instanteEc(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), conHora ? 9 : 23, conHora ? 0 : 59).toISOString();
}

// ── Mensajes ────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Los que tocan hoy o ya pasaron (para el parte del día). */
export function pendientesDeHoy(filas: FilaPendiente[], ahora: Date = new Date()): FilaPendiente[] {
    const h = partesEc(ahora);
    const finHoy = instanteEc(h.y, h.m, h.d, 23, 59).getTime() + 60000;
    return filas.filter((f) => f.due_date && Date.parse(f.due_date) < finHoy);
}

export function textoLista(filas: FilaPendiente[], ahora: Date = new Date()): string {
    if (!filas.length) return '📝 <b>No tienes pendientes anotados.</b>\n\nPara anotar uno escríbeme, por ejemplo:\n<i>recuérdame mañana a las 10 llamar al SRI</i>';
    const lineas = filas.slice(0, 15).map((f) => `• ${esc(f.title)} · <i>${esc(textoCuando(f.due_date, ahora))}</i>`);
    const mas = filas.length > 15 ? `\n… y ${filas.length - 15} más (en la web, pantalla Tareas).` : '';
    return `📝 <b>Tus pendientes (${filas.length})</b>\n${lineas.join('\n')}${mas}\n\n<i>Toca ✅ cuando lo termines.</i>`;
}

export function botonesLista(filas: FilaPendiente[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const f of filas.slice(0, 8)) {
        const corto = f.title.length > 28 ? `${f.title.slice(0, 27)}…` : f.title;
        kb.text(`✅ ${corto}`, `baku_tarea:ok:${f.id}`).text('📅 Mañana', `baku_tarea:manana:${f.id}`).row();
    }
    return kb;
}

export function textoRecordatorio(f: FilaPendiente): string {
    return `⏰ <b>Recordatorio</b>\n${esc(f.title)}\n\n¿Ya lo hiciste?`;
}

export function botonesRecordatorio(id: string): InlineKeyboard {
    return new InlineKeyboard()
        .text('✅ Ya lo hice', `baku_tarea:ok:${id}`).row()
        .text('⏰ En 1 hora', `baku_tarea:1h:${id}`)
        .text('📅 Mañana', `baku_tarea:manana:${id}`);
}

export function textoAnotado(f: FilaPendiente, ahora: Date = new Date()): string {
    const aviso = tieneHora(f.due_date) ? 'Te aviso a esa hora.' : 'Te lo recuerdo en el parte de la mañana.';
    return `📝 Anotado: <b>${esc(f.title)}</b>\n🗓️ ${esc(textoCuando(f.due_date, ahora))} · ${aviso}`;
}

// ── Recordatorios a la hora ─────────────────────────────────────────────────

/** Los que tienen hora y les tocó entre `desde` (excluido) y `hasta` (incluido). */
export function tocaAvisar(filas: FilaPendiente[], desde: Date, hasta: Date): FilaPendiente[] {
    return filas.filter((f) => {
        if (!ABIERTOS.includes(f.status) || !tieneHora(f.due_date)) return false;
        const t = Date.parse(f.due_date as string);
        return t > desde.getTime() && t <= hasta.getTime();
    });
}

let ultimaRevision = new Date();
const yaAvisados = new Set<string>();

/** Llamar cada pocos minutos. Avisa una vez por pendiente y hora. */
export async function revisarRecordatorios(api: { sendMessage: (chatId: string | number, text: string, other?: any) => Promise<any> }, chatId: string | number): Promise<number> {
    const ahora = new Date();
    const desde = ultimaRevision;
    ultimaRevision = ahora;
    const filas = await listarPendientes();
    let enviados = 0;
    for (const f of tocaAvisar(filas, desde, ahora)) {
        const clave = `${f.id}|${f.due_date}`;
        if (yaAvisados.has(clave)) continue;
        yaAvisados.add(clave);
        await api.sendMessage(chatId, textoRecordatorio(f), { parse_mode: 'HTML', reply_markup: botonesRecordatorio(f.id) });
        enviados++;
    }
    return enviados;
}
