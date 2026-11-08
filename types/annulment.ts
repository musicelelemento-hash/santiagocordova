/**
 * Cobro de anulaciones de comprobantes.
 *
 * Cada comprobante anulado al SRI se cobra una sola vez ($2 por defecto). La
 * clave de acceso (49 dígitos) es la identidad del cobro: reintentar el mismo
 * comprobante no genera otra línea.
 *
 * El registro lo produce la extensión 04 (`sc_anulaciones` en
 * chrome.storage.local) y llega acá por CSV o por el puente de la extensión.
 * La web lo muestra en la Bóveda del cliente y lo convierte en línea de
 * factura al cerrar el mes o el semestre.
 */

export type AnnulmentStatus =
    | 'pendiente'    // cobrable, todavía no facturado
    | 'facturado'    // incluido en una factura (ver facturaRef)
    | 'pagado'       // el cliente ya pagó
    | 'no_cobrable'  // el SRI rechazó la anulación: queda el registro, sin precio
    | 'exonerado';   // decisión comercial: no se cobra

export interface AnnulmentCharge {
    /** Consecutivo propio, ej. AN-2026-000123. Nunca se reutiliza. */
    consecutivo: string;
    /** Clave de acceso del comprobante anulado (49 dígitos). */
    clave: string;
    /** RUC del emisor = el cliente al que se le cobra. */
    ruc: string;
    cliente?: string;
    /** RUC/nombre del comprador que figura en el PDF (dato de referencia). */
    receptor?: string;
    tipo?: string;
    /** Número de factura mostrado, ej. 001-001-000000123. */
    factura?: string;
    /** ISO 8601. */
    fecha: string;
    /** Período del cobro, YYYY-MM. */
    periodo: string;
    /** Lote del día al que pertenece, ej. L-20261107. */
    lote?: string;
    precio: number;
    estado: AnnulmentStatus;
    resultado?: 'success' | 'error';
    detalle?: string;
    intentos?: number;
    /** Secuencial de la factura que la cobró (cuando estado = 'facturado'). */
    facturaRef?: string;
}

export interface AnnulmentBillingLine {
    concepto: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    /** Claves incluidas, para poder auditar la línea. */
    claves: string[];
}

export interface AnnulmentSummary {
    total: number;
    cantidad: number;
    clientes: number;
    periodos: string[];
}

// ── Política de cobro por cliente ────────────────────────────────────────────
// Cada cliente puede tener su regla: gratis, precio fijo o un cupo incluido
// por período. Si no tiene ninguna, se usa la global ($2, sin cupo).

export type ModoPoliticaAnulacion = 'heredado' | 'gratis' | 'fijo' | 'cupo';

export interface AnnulmentPolicy {
    modo: ModoPoliticaAnulacion;
    /** Precio cuando no es gratis (fijo, o el que aplica fuera del cupo). */
    precio?: number;
    /** Cantidad incluida sin cobro en cada período (mes o semestre). */
    cupoPorPeriodo?: number;
}

export interface PoliticaResuelta {
    precio: number;
    cupo: number;
    gratis: boolean;
    origen: 'cliente' | 'global';
}

export interface ResultadoCupo {
    /** Quedan dentro del cupo: no se cobran. */
    incluidas: AnnulmentCharge[];
    /** Fuera del cupo: se cobran al precio de la política. */
    cobrables: AnnulmentCharge[];
    total: number;
    cupo: number;
    precio: number;
    gratis: boolean;
}

// ── Meses de cobro (plan mensual) ────────────────────────────────────────────
// Los meses son predecibles: desde el inicio del plan hasta el mes actual. Cada
// uno está pagado, facturado o pendiente. Es lo que Cobranza tiene que mostrar
// claro, igual que el menú de declaraciones.

export type EstadoMesCobro = 'pagado' | 'facturado' | 'pendiente' | 'cortesia';

export interface MesDeCobro {
    /** YYYY-MM */
    periodo: string;
    estado: EstadoMesCobro;
    monto: number;
    facturaRef?: string;
}

// ── Recordatorio de cobro ────────────────────────────────────────────────────
// Lo que se le muestra al contador (y lo que contesta el bot cuando pregunta).

export interface CobroPendiente {
    ruc: string;
    cliente?: string;
    anulaciones: {
        cantidad: number;
        total: number;
        incluidas: number;
    };
    meses: MesDeCobro[];
    mesesPendientes: number;
    total: number;
    /** Frase corta lista para mostrar o mandar por WhatsApp. */
    texto: string;
}