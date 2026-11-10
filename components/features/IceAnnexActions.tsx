import React, { useMemo, useState } from 'react';
import { CalendarDays, Download, ExternalLink, FileText, Flame, Settings2 } from 'lucide-react';
import type { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { MESES_CORTOS, descargarAnexoIceXml, descargarAnexoIceZip, type AnexoIceDatos } from '../../utils/iceXml';
import { entrarAlSriSinDeclarar } from '../../services/extensionBridge';
import IceConfigModal from './IceConfigModal';

/**
 * Anexo ICE del cliente, dentro de Declaraciones.
 *
 * Tres acciones: bajar el XML del mes, bajar el ZIP con el nombre del SRI
 * (AICEmmaaaa.zip) y abrir el perfil del cliente en el SRI con la extensión 01.
 */
interface Props {
    client: Client;
}

const periodoAnterior = (): string => {
    const hoy = new Date();
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

const nombreLargo = (periodo: string): string => {
    const [y, m] = periodo.split('-').map(Number);
    if (!y || !m) return periodo;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
        'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${meses[m - 1]} ${y}`;
};

const IceAnnexActions: React.FC<Props> = ({ client }) => {
    const { toast } = useToast();
    const [configAbierta, setConfigAbierta] = useState(false);

    const iceVentas: Record<string, any> = (client.taxProfile as any)?.ice_ventas || {};
    const iceConfig = (client.taxProfile as any)?.ice_config || null;
    const meses = useMemo(() => {
        const lista = Object.keys(iceVentas).sort().reverse();
        const objetivo = periodoAnterior();
        return lista.includes(objetivo) ? lista : [objetivo, ...lista];
    }, [iceVentas]);
    const [periodo, setPeriodo] = useState<string>(meses[0] || periodoAnterior());

    // Sin configuración y sin ventas publicadas: este cliente no lleva ICE.
    if (!iceConfig && !Object.keys(iceVentas).length) return null;

    const datos = (): AnexoIceDatos => {
        const [anio, mes] = periodo.split('-').map(Number);
        const productos = iceVentas[periodo]?.productos;
        return {
            ruc: client.ruc,
            nombre: client.name,
            anio,
            mes,
            productos: Array.isArray(productos) && productos.length
                ? productos
                : [{
                    codProdICE: iceConfig?.codProdICE || '3031-053-049147-013-000750-66-593-000012',
                    tipoIdCliente: iceConfig?.tipoIdCliente || 'F',
                    idCliente: iceConfig?.idCliente || '9999999999999',
                    tipoVentaICE: iceConfig?.tipoVentaICE || '1',
                }],
        };
    };

    return (
        <div className="mb-4 rounded-2xl border border-[#C9A96E]/25 bg-[#C9A96E]/5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A96E]">
                    <Flame size={13} /> Anexo ICE
                </p>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <CalendarDays size={12} />
                    <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-slate-200 outline-none"
                    >
                        {meses.map((m) => <option key={m} value={m}>{nombreLargo(m)}</option>)}
                    </select>
                </label>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => descargarAnexoIceXml(datos())}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A96E]/35 bg-[#C9A96E]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#e6d3ab] hover:bg-[#C9A96E]/20"
                >
                    <FileText size={12} /> Descargar XML
                </button>
                <button
                    type="button"
                    onClick={() => { void descargarAnexoIceZip(datos()).catch((e) => toast.error(`No se pudo armar el ZIP: ${e?.message || e}`)); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A96E]/35 bg-[#C9A96E]/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#e6d3ab] hover:bg-[#C9A96E]/20"
                >
                    <Download size={12} /> Descargar ZIP
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (!entrarAlSriSinDeclarar(client)) {
                            toast.error('Falta la clave SRI de este cliente.');
                            return;
                        }
                        toast.info('Abriendo el perfil del cliente en el SRI…');
                        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/5"
                >
                    <ExternalLink size={12} /> Abrir perfil SRI
                </button>
                <button
                    type="button"
                    onClick={() => setConfigAbierta(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                >
                    <Settings2 size={12} /> Configurar
                </button>
            </div>

            <p className="mt-1.5 text-[10px] text-slate-500">
                {nombreLargo(periodo)} · {iceVentas[periodo] ? `ventas ${Number(iceVentas[periodo].ventaTotal || 0).toFixed(2)}` : 'sin ventas publicadas (va en cero)'} · ZIP: <code>AICE{String(Number(periodo.split('-')[1])).padStart(2, '0')}{periodo.split('-')[0]}.zip</code>
            </p>

            {configAbierta && <IceConfigModal client={client} onClose={() => setConfigAbierta(false)} />}
        </div>
    );
};

export default IceAnnexActions;
