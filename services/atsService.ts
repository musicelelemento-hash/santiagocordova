import type { Client } from '../types';
import { SupplierCatalogService } from './supplierCatalogService';
import { atsDesdeCompras, descargarAts } from '../utils/atsXml';

/**
 * Descarga el ATS de un período (XML + ZIP listo para subir a Anexos).
 *
 * A diferencia del comprobante de una declaración, este ZIP es el **anexo**
 * transaccional: se sube en Anexos → Envío, no es prueba de una declaración.
 * No bloquea los meses en cero: van con <compras> vacío.
 */
export async function descargarAtsDeCliente(
    client: Client,
    periodo: string,
): Promise<{ ok: boolean; facturas: number; faltantes: string[]; error?: string }> {
    try {
        const audit = SupplierCatalogService.getClientPurchases(client, periodo);
        const facturas = audit?.invoices || [];
        const ventas: any = (client.taxProfile as any)?.ventasPorPeriodo?.[periodo] || null;
        const ventasBase = Number(ventas?.total) || 0;
        const { datos, faltantes } = atsDesdeCompras(
            { ruc: client.ruc, name: client.name },
            periodo,
            facturas,
            { ventasBase },
        );
        if (faltantes.length) return { ok: false, facturas: facturas.length, faltantes };
        await descargarAts(datos);
        return { ok: true, facturas: facturas.length, faltantes: [] };
    } catch (e: any) {
        return { ok: false, facturas: 0, faltantes: [], error: e?.message || String(e) };
    }
}
