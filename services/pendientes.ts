/**
 * Pendientes de Santiago en la web (22-nov-2026). Misma regla que Baku
 * (telegram-bot/src/pendientes.ts) — son DOS copias a mano, las pruebas de
 * tests/pendientes.test.ts fijan que digan lo mismo:
 *   - `dueDate` es un ISO.
 *   - Sin hora = 23:59 de Ecuador de ese día (Baku no avisa suelto; sale en el parte).
 *   - Con hora = Baku avisa a esa hora por Telegram.
 */
import { Task, TaskStatus } from '../types';

const OFFSET_EC_MS = -5 * 60 * 60 * 1000; // Ecuador: UTC-5, sin horario de verano.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function partesEc(d: Date) {
    const x = new Date(d.getTime() + OFFSET_EC_MS);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours(), min: x.getUTCMinutes(), dow: x.getUTCDay() };
}

export function instanteEc(y: number, m: number, d: number, h: number, min: number): Date {
    return new Date(Date.UTC(y, m, d, h, min) - OFFSET_EC_MS);
}

export function tieneHora(iso?: string | null): boolean {
    if (!iso || Number.isNaN(Date.parse(iso))) return false;
    const p = partesEc(new Date(iso));
    return !(p.h === 23 && p.min === 59);
}

export const estaAbierta = (t: Task) => t.status === TaskStatus.Pendiente || t.status === TaskStatus.EnProceso;

/** Fecha de un pendiente: `diasDesdeHoy` en Ecuador y, si se da, la hora «HH:mm». */
export function venceEn(diasDesdeHoy: number, hora?: string, ahora: Date = new Date()): string {
    const h = partesEc(ahora);
    const x = new Date(Date.UTC(h.y, h.m, h.d + diasDesdeHoy));
    const m = (hora || '').match(/^(\d{1,2}):(\d{2})$/);
    if (m) return instanteEc(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), Number(m[1]), Number(m[2])).toISOString();
    return instanteEc(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 23, 59).toISOString();
}

/** Días hasta el viernes de esta semana (si hoy es viernes o fin de semana, el próximo). */
export function diasHastaViernes(ahora: Date = new Date()): number {
    const dow = partesEc(ahora).dow;
    const k = (5 - dow + 7) % 7;
    return k === 0 ? 7 : k;
}

/** «hoy 10:30», «mañana», «vie 28 nov», «vencido · 20 nov». */
export function textoCuando(iso?: string | null, ahora: Date = new Date()): string {
    if (!iso || Number.isNaN(Date.parse(iso))) return 'sin fecha';
    const v = new Date(iso);
    const p = partesEc(v);
    const h = partesEc(ahora);
    const dias = Math.round((Date.UTC(p.y, p.m, p.d) - Date.UTC(h.y, h.m, h.d)) / 86400000);
    const hora = tieneHora(iso) ? ` ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}` : '';
    if (dias < 0 || (dias === 0 && hora && v.getTime() < ahora.getTime())) return `vencido · ${p.d} ${MESES[p.m]}${hora}`;
    if (dias === 0) return `hoy${hora}`;
    if (dias === 1) return `mañana${hora}`;
    return `${DIAS[p.dow]} ${p.d} ${MESES[p.m]}${hora}`;
}

export function estaVencido(iso?: string | null, ahora: Date = new Date()): boolean {
    return textoCuando(iso, ahora).startsWith('vencido');
}

/** Abiertos, ordenados por fecha (los sin fecha al final). */
export function ordenarAbiertos(tasks: Task[]): Task[] {
    const t = (x: Task) => (x.dueDate && !Number.isNaN(Date.parse(x.dueDate)) ? Date.parse(x.dueDate) : Infinity);
    return tasks.filter(estaAbierta).sort((a, b) => t(a) - t(b));
}
