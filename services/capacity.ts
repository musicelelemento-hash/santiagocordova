/**
 * Capacidad del sistema — cuánto ocupa lo que se sube y cuánto margen queda.
 *
 * La idea es no adivinar: cada anulación es una fila chica en Supabase, así que
 * el número de clientes que entran se calcula, no se estima a ojo. Los valores
 * de los planes gratuitos están acá para poder actualizarlos en un solo lugar
 * el día que cambien.
 */

/** Peso aproximado de una anulación (fila + índices) en bytes. */
export const PESO_ANULACION_BYTES = 420;

/** Base de datos del plan gratuito de Supabase. */
export const DB_FREE_MB = 500;

/** Almacenamiento de archivos del plan gratuito de Supabase. */
export const STORAGE_FREE_MB = 1024;

/** Ritmo de referencia: anulaciones por cliente al mes (para el margen). */
export const RITMO_POR_CLIENTE = 3;

export interface UsoCapacidad {
    anulaciones: number;
    bytesAnulaciones: number;
    /** Porcentaje de la base usado por anulaciones. */
    porcentajeDb: number;
    /** Anulaciones que todavía entran en la base. */
    margenAnulaciones: number;
    /** Clientes que entran al ritmo de referencia. */
    margenClientes: number;
    mbLibres: number;
}

/**
 * Calcula el uso con los bytes reales si se conocen, o con el peso típico si
 * sólo se sabe cuántas anulaciones hay.
 */
export function calcularCapacidad(
    anulaciones: number,
    opciones: { bytesReales?: number; archivosBytes?: number; ritmoPorCliente?: number } = {},
): UsoCapacidad {
    const ritmo = Math.max(1, opciones.ritmoPorCliente ?? RITMO_POR_CLIENTE);
    const n = Math.max(0, Math.floor(anulaciones || 0));
    const bytesAnulaciones = Math.max(0, Math.round(opciones.bytesReales ?? n * PESO_ANULACION_BYTES));

    const totalBytes = DB_FREE_MB * 1024 * 1024;
    const archivos = Math.max(0, opciones.archivosBytes ?? 0);
    const libre = Math.max(0, totalBytes - bytesAnulaciones - archivos);

    return {
        anulaciones: n,
        bytesAnulaciones,
        porcentajeDb: totalBytes > 0 ? (bytesAnulaciones / totalBytes) * 100 : 0,
        margenAnulaciones: Math.floor(libre / PESO_ANULACION_BYTES),
        margenClientes: Math.floor(libre / PESO_ANULACION_BYTES / ritmo),
        mbLibres: libre / (1024 * 1024),
    };
}

/** Formatea bytes en algo legible (B, KB, MB, GB). */
export function formatearBytes(bytes: number): string {
    const b = Math.max(0, Number(bytes) || 0);
    if (b < 1024) return `${Math.round(b)} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Frase corta para mostrar o mandar por WhatsApp. */
export function resumenCapacidad(uso: UsoCapacidad): string {
    const pct = uso.porcentajeDb < 0.01 ? '<0,01%' : `${uso.porcentajeDb.toFixed(2)}%`;
    return `${uso.anulaciones} anulaciones · ${formatearBytes(uso.bytesAnulaciones)} · ${pct} de la base · margen ~${uso.margenClientes} clientes`;
}
