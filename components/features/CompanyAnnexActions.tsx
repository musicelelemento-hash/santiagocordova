import React, { useState } from 'react';
import { Building2, Download, FileSpreadsheet, Settings2, Users } from 'lucide-react';
import type { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { esRucSociedad } from '../../services/sri';
import { apsDesdeCliente, descargarAps } from '../../utils/apsXml';
import { atsDesdeCompras, descargarAts } from '../../utils/atsXml';
import { SupplierCatalogService } from '../../services/supplierCatalogService';
import CompanyInfoModal from './CompanyInfoModal';

/**
 * Panel de una SOCIEDAD dentro de Declaraciones: descargar el REBEFICS (APS),
 * editar socios y ver las obligaciones anuales con su vencimiento.
 */
interface Props {
    client: Client;
}

const CompanyAnnexActions: React.FC<Props> = ({ client }) => {
    const { toast } = useToast();
    const [editar, setEditar] = useState(false);
    const ahora = new Date();
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const periodoInicial = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;
    const [periodoAts, setPeriodoAts] = useState(periodoInicial);

    if (!esRucSociedad(client.ruc)) return null;

    const company: any = (client.taxProfile as any)?.company || {};
    const socios: any[] = Array.isArray(company.accionistas) ? company.accionistas : [];
    const suma = socios.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0);
    const anio = new Date().getFullYear();

    const descargar = async () => {
        if (!socios.length) {
            toast.error('Primero cargá los socios con “Editar socios”.');
            return;
        }
        try {
            await descargarAps(apsDesdeCliente(client, anio));
            toast.success('APS/REBEFICS descargado (XML + ZIP).');
        } catch (e: any) {
            toast.error(`No se pudo generar: ${e?.message || e}`);
        }
    };

    const generarAts = async () => {
        const audit = SupplierCatalogService.getClientPurchases(client, periodoAts);
        const facturas = audit?.invoices || [];
        if (!facturas.length) {
            toast.error(`No hay compras registradas para ${periodoAts}. Extraelas primero desde la extensión.`);
            return;
        }
        const { datos, faltantes } = atsDesdeCompras({ ruc: client.ruc, name: client.name }, periodoAts, facturas);
        if (faltantes.length) {
            toast.error(`Faltan ${faltantes.length} datos (clave de acceso). Completa los comprobantes antes de presentar el ATS.`);
            return;
        }
        try {
            await descargarAts(datos);
            toast.success(`ATS de ${periodoAts} descargado (XML + ZIP).`);
        } catch (e: any) {
            toast.error(`No se pudo generar el ATS: ${e?.message || e}`);
        }
    };

    return (
        <div className="mb-4 rounded-2xl border border-[#C9A96E]/25 bg-[#C9A96E]/5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                    <Building2 size={13} /> REBEFICS · APS
                </p>
                <span className={`text-[10px] font-mono ${Math.abs(suma - 100) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {socios.length} socio(s) · {suma.toFixed(2)}%
                </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => void descargar()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A96E]/35 bg-[#C9A96E]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#e6d3ab] hover:bg-[#C9A96E]/20">
                    <Download size={12} /> Descargar APS ({anio})
                </button>
                <select value={periodoAts} onChange={(e) => setPeriodoAts(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-[10px] text-slate-100 outline-none">
                    {Array.from({ length: 12 }).map((_, i) => {
                        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i - 1, 1);
                        const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return <option key={valor} value={valor}>{valor}</option>;
                    })}
                </select>
                <button type="button" onClick={() => void generarAts()} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20">
                    <FileSpreadsheet size={12} /> Generar ATS
                </button>
                <button type="button" onClick={() => setEditar(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/5">
                    <Settings2 size={12} /> Editar socios
                </button>
                {socios.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-slate-400">
                        <Users size={11} /> {socios.map((p) => `${(p.nombres || '').split(' ')[0]} ${Number(p.porcentaje) || 0}%`).join(' · ')}
                    </span>
                )}
            </div>

            <p className="mt-1.5 text-[10px] text-slate-500">
                Anuales: <b className="text-slate-300">REBEFICS</b> febrero · <b className="text-slate-300">1021 Renta</b> abril · <b className="text-slate-300">ADI</b> mayo (si reparte) · <b className="text-slate-300">ATS</b> mensual.
            </p>

            {editar && <CompanyInfoModal client={client} onClose={() => setEditar(false)} />}
        </div>
    );
};

export default CompanyAnnexActions;
