/**
 * Vencimientos SRI con el traslado oficial por fin de semana o feriado.
 *
 * Misma lógica que la skill `sri-ecuador` (scripts/sri.py) y que
 * services/sri.ts de la web, más el traslado que la web todavía no aplica:
 *   - día por 9.º dígito: 1→10, 2→12 … 9→26, 0→28;
 *   - si cae sábado, domingo o feriado → siguiente día hábil;
 *   - si ese traslado lo pasa al mes siguiente → último día hábil del mes.
 * (Guía de deberes formales del SRI; reiterado en el Boletín 026-2026.)
 *
 * Existe para que Baku no calcule fechas ni días de la semana «de cabeza»:
 * los modelos de lenguaje se equivocan en eso.
 */
import { esPopular, esEmprendedor } from './regimen';

const DIA_POR_DIGITO: Record<string, number> = { '1': 10, '2': 12, '3': 14, '4': 16, '5': 18, '6': 20, '7': 22, '8': 24, '9': 26, '0': 28 };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface Vencimiento {
    fecha: string;          // AAAA-MM-DD, ya trasladada
    nominal: string;        // AAAA-MM-DD según el dígito
    texto: string;          // «lunes 23 de noviembre de 2026»
    regla: string;
    traslado: string | null;
}

/** Fecha sin hora (UTC) ajustando el día al último del mes si hace falta. */
function fecha(y: number, m1: number, d: number): Date {
    const base = new Date(Date.UTC(y, m1 - 1, 1));
    const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Math.min(d, ultimo)));
}
const iso = (f: Date) => f.toISOString().slice(0, 10);
const texto = (f: Date) => `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;

export function trasladar(f: Date, feriados: Set<string> = new Set()): { fecha: Date; traslado: string | null } {
    const habil = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !feriados.has(iso(d));
    if (habil(f)) return { fecha: f, traslado: null };
    const sumar = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    let g = f;
    while (!habil(g)) g = sumar(g, 1);
    if (g.getUTCMonth() === f.getUTCMonth()) return { fecha: g, traslado: 'trasladado al siguiente día hábil' };
    g = f;
    while (!habil(g)) g = sumar(g, -1);
    return { fecha: g, traslado: 'adelantado al último día hábil del mes (el traslado caía en el mes siguiente)' };
}

/**
 * Vencimiento de un período.
 * periodo: '2026-10' (IVA mensual) · '2026-S1' | '2026-S2' (IVA semestral) · '2025' (renta).
 */
export function calcularVencimiento(ruc: string, periodo: string, regimen = '', opciones: { sociedad?: boolean; feriados?: string[] } = {}): Vencimiento {
    const digitos = String(ruc || '').replace(/\D/g, '');
    if (digitos.length < 9) throw new Error('El RUC o la cédula necesita al menos 9 dígitos.');
    const dia = DIA_POR_DIGITO[digitos[8]];
    const sociedad = opciones.sociedad ?? (digitos.length === 13 && digitos[2] === '9');
    const p = String(periodo || '').trim().toUpperCase().replace(/^(\d{4})-([12])S$/, '$1-S$2');

    let nominal: Date;
    let regla: string;
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^(\d{4})-S([12])$/))) {
        if (esPopular(regimen)) throw new Error('RIMPE Negocio Popular no declara IVA.');
        const y = Number(m[1]);
        nominal = m[2] === '1' ? fecha(y, 7, dia) : fecha(y + 1, 1, dia);
        regla = m[2] === '1' ? 'IVA semestral S1 (ene–jun): julio' : 'IVA semestral S2 (jul–dic): enero del año siguiente';
    } else if ((m = p.match(/^(\d{4})-(\d{2})$/))) {
        if (esPopular(regimen)) throw new Error('RIMPE Negocio Popular no declara IVA.');
        nominal = fecha(Number(m[1]), Number(m[2]) + 1, dia);
        regla = 'IVA mensual: mes siguiente al período';
    } else if ((m = p.match(/^(\d{4})$/))) {
        const y = Number(m[1]);
        if (sociedad) { nominal = fecha(y + 1, 4, dia); regla = 'Renta de sociedades (1021): abril'; }
        else if (esPopular(regimen) || esEmprendedor(regimen)) { nominal = fecha(y + 1, 5, dia); regla = 'Renta persona natural RIMPE: mayo'; }
        else { nominal = fecha(y + 1, 3, dia); regla = 'Renta persona natural Régimen General (102): marzo'; }
    } else {
        throw new Error(`No entiendo el período «${periodo}». Usa 2026-10, 2026-S1 o 2025.`);
    }

    const { fecha: final, traslado } = trasladar(nominal, new Set(opciones.feriados || []));
    return { fecha: iso(final), nominal: iso(nominal), texto: texto(final), regla: `${regla} · día ${dia} por 9.º dígito ${digitos[8]}`, traslado };
}

/**
 * Períodos que el cliente tiene en curso hoy (lo que toca declarar ahora),
 * con la misma regla que getPeriod de la web (services/sri.ts):
 * mensual → mes anterior; semestral → S1 desde junio, S2 desde diciembre;
 * renta → año anterior.
 */
export function periodosEnCurso(regimen: string, frecuenciaIva: string | undefined, hoy = new Date()): { iva: string | null; renta: string } {
    const y = hoy.getFullYear();
    const m = hoy.getMonth(); // 0-11
    const renta = String(y - 1);
    const freq = esPopular(regimen) || frecuenciaIva === 'Ninguno'
        ? 'Ninguno'
        : (frecuenciaIva || (esEmprendedor(regimen) ? 'Semestral' : 'Mensual'));
    if (freq === 'Ninguno') return { iva: null, renta };
    if (freq === 'Semestral') {
        if (m === 5) return { iva: `${y}-S1`, renta };
        if (m === 11) return { iva: `${y}-S2`, renta };
        return { iva: m < 5 ? `${y - 1}-S2` : `${y}-S1`, renta };
    }
    const prev = new Date(y, m - 1, 1);
    return { iva: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`, renta };
}

/**
 * Dígitos del RUC cuyo vencimiento mensual cae HOY, ya trasladado por fin de
 * semana o feriado (un sábado 22 se presenta el lunes 24: ese lunes vencen el 7
 * y el 8). Lista vacía si hoy no vence nadie. `hoy` en hora de Ecuador.
 */
export function digitosQueVencenHoy(hoy: Date, feriados: Set<string> = new Set()): string[] {
    const y = hoy.getFullYear(), m = hoy.getMonth() + 1, d = hoy.getDate();
    const clave = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return Object.keys(DIA_POR_DIGITO)
        .filter((dig) => iso(trasladar(fecha(y, m, DIA_POR_DIGITO[dig]), feriados).fecha) === clave)
        .sort((a, b) => DIA_POR_DIGITO[a] - DIA_POR_DIGITO[b]);
}

/** Fecha de hoy en Ecuador (UTC-5) como Date local con año/mes/día de Guayaquil. */
export function hoyEnEcuador(ahora = new Date()): Date {
    const ec = new Date(ahora.getTime() - 5 * 3600 * 1000);
    return new Date(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate());
}

export function textoFecha(f: Date): string {
    return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}
