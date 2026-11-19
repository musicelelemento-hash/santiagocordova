/**
 * Régimen tributario del cliente — una sola fuente para el bot.
 *
 * La base (`clients.regime`) y la web (`TaxRegime` en types/client.ts) usan
 * 'RIMPE Negocio Popular' / 'RIMPE Emprendedor'. El bot comparaba con
 * 'Rimpe …' y las comparaciones nunca daban true: los 20 clientes RIMPE se
 * trataban como Régimen General (IVA mensual, renta en marzo). Por eso aquí
 * se compara sin mayúsculas ni tildes, y al escribir se usa la forma canónica.
 */

export const REGIMEN_GENERAL = 'Régimen General';
export const REGIMEN_POPULAR = 'RIMPE Negocio Popular';
export const REGIMEN_EMPRENDEDOR = 'RIMPE Emprendedor';
export const REGIMENES = [REGIMEN_GENERAL, REGIMEN_EMPRENDEDOR, REGIMEN_POPULAR] as const;

const normalizar = (r: unknown): string =>
    String(r ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const esPopular = (r: unknown): boolean => normalizar(r).includes('popular');
export const esEmprendedor = (r: unknown): boolean => normalizar(r).includes('emprendedor');
export const esRimpe = (r: unknown): boolean => esPopular(r) || esEmprendedor(r);

/** Lleva cualquier escritura ('rimpe emprendedor', 'Rimpe Negocio Popular'…) a la forma de la base. */
export function regimenCanonico(r: unknown): string {
    if (esPopular(r)) return REGIMEN_POPULAR;
    if (esEmprendedor(r)) return REGIMEN_EMPRENDEDOR;
    const n = normalizar(r);
    if (!n || n.includes('general')) return REGIMEN_GENERAL;
    return String(r).trim();
}

/**
 * Mes (1–12) en que una persona natural declara la renta anual.
 * Régimen General: marzo. Todo el RIMPE (Negocio Popular y Emprendedor): mayo
 * (SRI, Boletín 026-2026). Igual que getAnnualIncomeTaxDueDate de services/sri.ts.
 */
export const mesRentaPersonaNatural = (r: unknown): number => (esRimpe(r) ? 5 : 3);
