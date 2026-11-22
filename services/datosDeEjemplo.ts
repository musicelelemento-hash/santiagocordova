/**
 * Datos de EJEMPLO que CRM, Cotizaciones y Caja chica guardaban como si fueran
 * reales cuando estaban vacías (hasta el 22-nov-2026). Ya no se crean; estas
 * funciones los sacan de lo que quedó guardado en el navegador, sin tocar los
 * registros que haya cargado Santiago.
 */

const LEADS_DE_EJEMPLO = new Set(['LEAD-001', 'LEAD-002', 'LEAD-003']);
const COTIZACIONES_DE_EJEMPLO = new Set(['COT-1001']);
const MOVIMIENTOS_DE_EJEMPLO: Record<string, string> = {
    m1: 'Cobro de Honorarios Contables - Enero 2026',
    m2: 'Emisión e Instalación Firma .p12',
    m3: 'Compra de Papel Bond y Toners de Imprenta',
};

export function sinLeadsDeEjemplo<T extends { id: string }>(lista: T[]): T[] {
    return (lista || []).filter(l => !LEADS_DE_EJEMPLO.has(l?.id));
}

export function sinCotizacionesDeEjemplo<T extends { id: string }>(lista: T[]): T[] {
    return (lista || []).filter(c => !COTIZACIONES_DE_EJEMPLO.has(c?.id));
}

const esMovimientoDeEjemplo = (m: { id?: string; concepto?: string }) =>
    !!m?.id && MOVIMIENTOS_DE_EJEMPLO[m.id] === m.concepto;

/** Saca la sesión de caja de ejemplo (sólo traía los 3 movimientos inventados). */
export function sinCajaDeEjemplo<T extends { movimientos?: { id?: string; concepto?: string }[] }>(lista: T[]): T[] {
    return (lista || []).filter(s => {
        const movs = s?.movimientos || [];
        return !(movs.length > 0 && movs.every(esMovimientoDeEjemplo));
    });
}
