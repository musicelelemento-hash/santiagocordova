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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface Hito { nombre: string; fecha: Date; dias: number }

/**
 * Aviso corto (22-nov-2026): una línea por sociedad. Antes salía una línea por
 * obligación (VIMARBO ocupaba 5) y todos los días igual. Ahora:
 *   - a diario sólo si algo vence en 7 días o menos (o hoy);
 *   - lo ya vencido o más lejano se recuerda los lunes.
 */
export function armarAvisoSociedades(porEmpresa: { name: string; ruc: string; hitos: Hito[] }[], hoy: Date = new Date()): string | null {
    const conAlgo = porEmpresa.filter(e => e.hitos.length);
    if (!conAlgo.length) return null;
    const urgente = conAlgo.some(e => e.hitos.some(h => h.dias >= 0 && h.dias <= 7));
    if (!urgente && hoy.getDay() !== 1) return null;

    const corta = (f: Date) => `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
    const lineas = conAlgo.map(e => {
        const vencidas = e.hitos.filter(h => h.dias < 0);
        const proximas = e.hitos.filter(h => h.dias >= 0).sort((a, b) => a.dias - b.dias);
        const partes: string[] = [];
        if (proximas.length) partes.push(proximas.map(h => `${h.nombre} ${h.dias === 0 ? '⏰ HOY' : `en ${h.dias} d (${corta(h.fecha)})`}`).join(' · '));
        if (vencidas.length) partes.push(`⚠️ ${vencidas.length} vencida${vencidas.length === 1 ? '' : 's'}: ${vencidas.map(h => h.nombre).join(', ')}`);
        return `• *${e.name}* — ${partes.join(' · ')}`;
    });
    return ['🏢 *Sociedades: obligaciones anuales*', ...lineas, '', '_SCVS en el portal de la Superintendencia; REBEFICS siempre se presenta._'].join('\n');
}

export async function revisarObligacionesAnualesEmpresas(): Promise<string | null> {
    const { data, error } = await supabase
        .from('clients')
        .select('id,ruc,name,tax_profile')
        .eq('is_deleted', false);
    if (error || !data) return null;

    const sociedades = data.filter((c: any) => esSociedad(c.ruc));
    if (!sociedades.length) return null;

    const anio = new Date().getFullYear();
    const porEmpresa: { name: string; ruc: string; hitos: Hito[] }[] = [];

    for (const c of sociedades) {
        const tp: any = c.tax_profile || {};
        const company: any = tp.company || {};
        const dia = diaVencimiento(c.ruc);
        const hitos: Array<{ nombre: string; fecha: Date | null; nota?: string }> = [];

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

        // ── Superintendencia de Compañías (SCVS) ──────────────────────
        // Paquete anual: nómina (febrero) y EEFF + actas + copia del 101 (abril).
        // Se omiten los documentos que la ficha ya marca como subidos.
        const scvsDocs: any = (tp.scvs && tp.scvs.documentos) || {};
        const finFebrero = new Date(anio, 2, 0);
        const treintaAbril = new Date(anio, 3, 30);
        if (!(scvsDocs.nomina && scvsDocs.nomina.subido)) {
            hitos.push({ nombre: 'SCVS · Nómina de socios', fecha: finFebrero, nota: 'portal SCVS · notariada si hay socio extranjero' });
        }
        if (!(scvsDocs.eeff && scvsDocs.eeff.subido)) {
            hitos.push({ nombre: 'SCVS · Estados financieros', fecha: treintaAbril, nota: 'firmados por representante legal y contador' });
        }
        if (!(scvsDocs.actas && scvsDocs.actas.subido)) {
            hitos.push({ nombre: 'SCVS · Actas de junta', fecha: treintaAbril, nota: 'junta ordinaria antes del 31-marzo' });
        }
        if (!(scvsDocs.form101 && scvsDocs.form101.subido)) {
            hitos.push({ nombre: 'SCVS · Copia del 101', fecha: treintaAbril, nota: 'adjuntar al paquete anual' });
        }

        const cercanos: Hito[] = [];
        for (const h of hitos) {
            if (!h.fecha) continue;
            const dias = diasHasta(h.fecha);
            if (dias > 45) continue;
            cercanos.push({ nombre: h.nombre.replace(/^SCVS · /, 'SCVS '), fecha: h.fecha, dias });
        }
        porEmpresa.push({ name: c.name, ruc: c.ruc, hitos: cercanos });
    }

    return armarAvisoSociedades(porEmpresa);
}
