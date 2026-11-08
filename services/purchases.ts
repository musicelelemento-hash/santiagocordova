/**
 * Compras del mes, agrupadas por proveedor y clasificadas por crédito
 * tributario.
 *
 * El contador necesita ver, de un vistazo: a quién le compró, cuánto, cuánto
 * IVA y si ese IVA es crédito o no. Los datos llegan del resumen que arma la
 * extensión al declarar (`purchaseSummary`), no se inventan acá.
 */

export interface FacturaCompra {
    /** RUC del emisor (proveedor). */
    ruc: string;
    razonSocial?: string;
    /** Base imponible. */
    base: number;
    /** IVA de la factura. */
    iva: number;
    /** Tarifa aplicada (15, 5, 0…). */
    tarifa?: number;
    /** `true` si el contador la marcó sin derecho a crédito. */
    sinCredito?: boolean;
    /** Número o clave del comprobante. */
    numero?: string;
}

export interface ProveedorResumen {
    ruc: string;
    razonSocial: string;
    facturas: number;
    base: number;
    iva: number;
    /** IVA que sí es crédito tributario. */
    credito: number;
    /** IVA que no lo es (sin derecho). */
    sinCredito: number;
    /** `true` si todas sus facturas están sin derecho. */
    todoSinCredito: boolean;
}

export interface ResumenCompras {
    proveedores: ProveedorResumen[];
    totalBase: number;
    totalIva: number;
    totalCredito: number;
    totalSinCredito: number;
    facturas: number;
}

const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};

const redondear = (v: number): number => Math.round((n(v) + Number.EPSILON) * 100) / 100;

/** Agrupa por RUC de proveedor y separa el IVA con derecho del que no. */
export function agruparPorProveedor(facturas: FacturaCompra[] | undefined): ResumenCompras {
    const mapa = new Map<string, ProveedorResumen>();
    for (const f of facturas || []) {
        const ruc = String(f?.ruc || '').trim();
        if (!ruc) continue;
        const base = n(f.base);
        const iva = n(f.iva);
        const conCredito = !f.sinCredito;

        const prev = mapa.get(ruc) || {
            ruc,
            razonSocial: f.razonSocial || ruc,
            facturas: 0,
            base: 0,
            iva: 0,
            credito: 0,
            sinCredito: 0,
            todoSinCredito: true,
        };
        prev.facturas += 1;
        prev.base = redondear(prev.base + base);
        prev.iva = redondear(prev.iva + iva);
        if (conCredito) prev.credito = redondear(prev.credito + iva);
        else prev.sinCredito = redondear(prev.sinCredito + iva);
        if (conCredito) prev.todoSinCredito = false;
        mapa.set(ruc, prev);
    }

    const proveedores = Array.from(mapa.values()).sort((a, b) => b.base - a.base);
    return {
        proveedores,
        totalBase: redondear(proveedores.reduce((s, p) => s + p.base, 0)),
        totalIva: redondear(proveedores.reduce((s, p) => s + p.iva, 0)),
        totalCredito: redondear(proveedores.reduce((s, p) => s + p.credito, 0)),
        totalSinCredito: redondear(proveedores.reduce((s, p) => s + p.sinCredito, 0)),
        facturas: proveedores.reduce((s, p) => s + p.facturas, 0),
    };
}

/** Formato corto para tablas: $1.234,56 */
export function dinero(v: number): string {
    return `$${n(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
