import { supabase } from './supabase';

/**
 * Recordatorios de las obligaciones ANUALES de las sociedades.
 *
 * Una S.A.S. no solo declara IVA: tiene
 *   · REBEFICS (APS) — febrero, o 28 días después de constituirse
 *   · 1021 Renta Sociedades — abril
 *   · ADI Dividendos — mayo (solo si reparte utilidades)
 *
 * Devuelve el texto listo para Telegram o `null` si no hay nada próximo.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esSociedad = (ruc: string): boolean => {
    const limpio = String(ruc || '').replace(/\D/g, '');
    return limpio.length === 13 && limpio[2] === '9';
};

/** Día de vencimiento por 9.º dígito (10, 12, …, 28). */
const diaVencimiento = (ruc: string): number => {
    const d9 = Number(String(ruc || '').replace(/\D/g, '')[8]);
    return d9 === 0 ? 28 : 10 + (d9 - 1) * 2;
};

const diasHasta = (fecha: Date): number => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const objetivo = new Date(fecha);
    objetivo.setHours(0, 0, 0, 0);
    return Math.round((objetivo.getTime() - hoy.getTime()) / 86400000);
};

const fmt = (f: Date): string => `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;

export async function revisarObligacionesAnualesEmpresas(): Promise<string | null> {
    const { data, error } = await supabase
        .from('clients')
        .select('id,ruc,name,tax_profile')
        .eq('is_deleted', false);
    if (error || !data) return null;

    const sociedades = data.filter((c: any) => esSociedad(c.ruc));
    if (!sociedades.length) return null;

    const anio = new Date().getFullYear();
    const lineas: string[] = [];

    for (const c of sociedades) {
        const tp: any = c.tax_profile || {};
        const company: any = tp.company || {};
        const dia = diaVencimiento(c.ruc);
        const hitos: Array<{ nombre: string; fecha: Date | null }> = [];

        // REBEFICS: 28 días desde la constitución si es nueva; si no, febrero.
        // La regla de «28 días desde la constitución» es solo para la PRIMERA
        // presentación; después va al calendario de febrero del año siguiente.
        const constitucion = company.constitutionDate ? new Date(company.constitutionDate) : null;
        let fechaRebefics: Date | null = null;
        if (constitucion && !Number.isNaN(constitucion.getTime())) {
            const primera = new Date(constitucion);
            primera.setDate(primera.getDate() + 28);
            fechaRebefics = primera.getTime() >= Date.now() ? primera : new Date(anio + 1, 1, dia);
        } else {
            fechaRebefics = new Date(anio, 1, dia);
        }
        hitos.push({ nombre: 'REBEFICS (APS)', fecha: fechaRebefics });
        hitos.push({ nombre: '1021 Renta Sociedades', fecha: new Date(anio, 3, dia) });
        if (company.distribuyoDividendos === true) {
            hitos.push({ nombre: 'ADI Dividendos', fecha: new Date(anio, 4, dia) });
        }

        for (const h of hitos) {
            if (!h.fecha) continue;
            const dias = diasHasta(h.fecha);
            if (dias > 45) continue;
            const estado = dias < 0 ? `⚠️ vencida hace ${Math.abs(dias)} día(s)` : dias === 0 ? '⏰ vence HOY' : `faltan ${dias} día(s)`;
            lineas.push(`• *${c.name}* (${c.ruc}) — ${h.nombre}: ${fmt(h.fecha)} · ${estado}`);
        }
    }

    if (!lineas.length) return null;

    return [
        '🏢 *OBLIGACIONES ANUALES DE SOCIEDADES*',
        '',
        ...lineas,
        '',
        '_Las anuales no dependen del mes: REBEFICS SIEMPRE se presenta (no admite “en cero”); 1021 y ADI pueden ir sin valores._',
    ].join('\n');
}
