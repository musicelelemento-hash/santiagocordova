import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { esRucSociedad } from '../../services/sri';
import { SupplierCatalogService } from '../../services/supplierCatalogService';
import { atsDesdeCompras, descargarAts } from '../../utils/atsXml';

/**
 * Descargar el ATS de un período sin salir de la ficha.
 * No bloquea los meses en cero: el anexo va con <compras> vacío.
 */
const AtsQuickDownload: React.FC<{ client: Client }> = ({ client }) => {
    const { toast } = useToast();
    const [generando, setGenerando] = useState(false);
    const ahora = new Date();
    const inicial = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const [periodo, setPeriodo] = useState(`${inicial.getFullYear()}-${String(inicial.getMonth() + 1).padStart(2, '0')}`);

    const opciones = useMemo(() => {
        const lista: string[] = [];
        for (let i = 1; i <= 6; i++) {
            const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return lista;
    }, [ahora.getFullYear(), ahora.getMonth()]);

    if (!esRucSociedad(client.ruc)) return null;

    const descargar = async () => {
        setGenerando(true);
        try {
            const audit = SupplierCatalogService.getClientPurchases(client, periodo);
            const facturas = audit?.invoices || [];
            const ventas: any = (client.taxProfile as any)?.ventasPorPeriodo?.[periodo] || null;
            const ventasBase = Number(ventas?.total) || 0;
            const atsRazonSocial = String((client.taxProfile as any)?.atsRazonSocial || '').trim();
            const { datos, faltantes } = atsDesdeCompras({ ruc: client.ruc, name: client.name }, periodo, facturas, { ventasBase, razonSocial: atsRazonSocial || undefined });
            if (faltantes.length) {
                toast.error(`Faltan ${faltantes.length} datos (clave de acceso). Completá los comprobantes.`);
                return;
            }
            await descargarAts(datos);
            toast.success(facturas.length ? `ATS de ${periodo} descargado (XML + ZIP).` : `ATS de ${periodo} descargado SIN compras (mes en cero).`);
        } catch (e: any) {
            toast.error(`No se pudo generar el ATS: ${e?.message || e}`);
        } finally {
            setGenerando(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2">
            <FileSpreadsheet size={14} className="text-sky-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">ATS</span>
            <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1 font-mono text-[10px] text-slate-700 dark:border-white/10 dark:bg-black/30 dark:text-slate-200"
            >
                {opciones.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
                type="button"
                onClick={() => void descargar()}
                disabled={generando}
                className="flex items-center gap-1.5 rounded-lg border border-[#C9A96E]/40 bg-[#C9A96E]/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#C9A96E] hover:bg-[#C9A96E]/20 disabled:opacity-50"
            >
                <Download size={12} />
                {generando ? `Generando…` : `Descargar ATS`}
            </button>
        </div>
    );
};

export default AtsQuickDownload;