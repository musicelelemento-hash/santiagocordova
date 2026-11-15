import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FileSpreadsheet, Download, Upload, Calculator, Building2 } from 'lucide-react';
import type { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SupplierCatalogService } from '../../services/supplierCatalogService';
import { atsDesdeCompras, descargarAts } from '../../utils/atsXml';
import { abrirAnexoSri } from '../../services/extensionBridge';
import { esRucSociedad } from '../../services/sri';

/**
 * CÍRCULO MENSUAL — el orden que importa.
 *
 *   1. Extraer comprobantes (compras) del mes
 *   2. Declarar el IVA (104) — ahí quedan confirmadas las VENTAS y las retenciones
 *   3. Generar el ATS con esas compras + las ventas confirmadas
 *   4. Subirlo al SRI (popup → 📤)
 *   5. Guardar el acuse
 *
 * La web guía: cada paso dice qué falta y con qué botón se resuelve.
 */
interface Props {
    client: Client;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const nombrePeriodo = (p: string): string => {
    const [a, m] = p.split('-').map(Number);
    return `${MESES[(m || 1) - 1]} ${a}`;
};

const MonthlyCircle: React.FC<Props> = ({ client }) => {
    const { toast } = useToast();
    const ahora = new Date();
    const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const periodoInicial = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    const [periodo, setPeriodo] = useState(periodoInicial);
    const [generando, setGenerando] = useState(false);

    const sociedad = esRucSociedad(client.ruc);
    const compras = useMemo(() => SupplierCatalogService.getClientPurchases(client, periodo), [client, periodo]);
    const facturas = compras?.invoices || [];

    // El IVA declarado de ese período (con sus ventas y CEP).
    const declaracionIva = (client.declarations || []).find(
        (d) => (d.period === periodo || d.period === `${periodo}:IVA`) && (!d.type || d.type === 'IVA'),
    );

    const acuse = useMemo(() => {
        try {
            const crudo = localStorage.getItem('sc_anexo_ultimo');
            if (!crudo) return null;
            const a = JSON.parse(crudo);
            const texto = `${a?.nombre || ''} ${a?.mensaje || ''}`;
            const mm = periodo.split('-')[1];
            const anio = periodo.split('-')[0];
            return new RegExp(`${anio}[-_/]?${mm}|${mm}[-_/]?${anio}`).test(texto) ? a : null;
        } catch { return null; }
    }, [periodo]);

    const generar = async () => {
        if (!facturas.length) {
            toast.error(`No hay compras de ${nombrePeriodo(periodo)}. Extraelas primero desde el SRI.`);
            return;
        }
        setGenerando(true);
        try {
            const { datos, faltantes } = atsDesdeCompras({ ruc: client.ruc, name: client.name }, periodo, facturas);
            if (faltantes.length) {
                toast.error(`Faltan ${faltantes.length} datos (clave de acceso).`);
                return;
            }
            await descargarAts(datos);
            toast.success(`ATS de ${nombrePeriodo(periodo)} generado (XML + ZIP).`);
        } catch (e: any) {
            toast.error(`No se pudo generar: ${e?.message || e}`);
        } finally {
            setGenerando(false);
        }
    };

    const pasos = [
        {
            numero: 1,
            titulo: 'Extraer comprobantes del mes',
            detalle: facturas.length
                ? `${facturas.length} factura(s) de compra con sus claves de acceso.`
                : 'Abrí SRI → Comprobantes recibidos del mes → extractor 📄 de la extensión.',
            hecho: facturas.length > 0,
            icono: Download,
            accion: facturas.length ? null : () => toast.info('SRI → Comprobantes recibidos → mes → botón 📄 de la extensión.'),
            boton: facturas.length ? '' : 'Cómo extraer',
        },
        {
            numero: 2,
            titulo: 'Declarar el IVA (104)',
            detalle: declaracionIva
                ? `Declarada${declaracionIva.transactionId ? ` · CEP ${declaracionIva.transactionId}` : ''}. Las ventas confirmadas ya quedaron en la declaración.`
                : 'El formulario llega con las VENTAS prellenadas desde Facturación Electrónica: confirmá y revisá notas de crédito.',
            hecho: !!declaracionIva,
            icono: Calculator,
            accion: declaracionIva ? null : () => { if (!abrirAnexoSri(client, 'ATS')) toast.error('No se pudo abrir el SRI.'); },
            boton: declaracionIva ? '' : 'Abrir SRI',
        },
        {
            numero: 3,
            titulo: 'Generar el ATS con lo declarado',
            detalle: 'Usa las mismas compras del paso 1. El IVA de ventas ya fue confirmado en el paso 2.',
            hecho: !!acuse,
            icono: FileSpreadsheet,
            accion: () => void generar(),
            boton: generando ? 'Generando…' : 'Generar ATS',
        },
        {
            numero: 4,
            titulo: 'Subir el ATS al SRI',
            detalle: 'Popup de la extensión → menú ⋮ → 📤 Subir ZIP del anexo… (adjunta, Cargar y Aceptar).',
            hecho: !!acuse,
            icono: Upload,
            accion: () => abrirAnexoSri(client, 'ATS'),
            boton: 'Abrir Anexos',
        },
        {
            numero: 5,
            titulo: 'Guardar el acuse',
            detalle: acuse
                ? `${acuse.mensaje || 'Anexo recibido'}${acuse.acuse ? ` · acuse ${acuse.acuse}` : ''}`
                : 'Al subirlo, la extensión guarda el mensaje y el acuse del portal.',
            hecho: !!acuse,
            icono: CheckCircle2,
            accion: null,
            boton: '',
        },
    ];

    const hechos = pasos.filter((p) => p.hecho).length;

    return (
        <div className="mb-4 rounded-2xl border border-sky-500/25 bg-sky-500/[0.04] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300">
                    <Building2 size={13} /> Círculo mensual · {nombrePeriodo(periodo)}
                </p>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-slate-400">{hechos}/5 pasos</span>
                    <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 font-mono text-[10px] text-slate-100 outline-none">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const d = new Date(ahora.getFullYear(), ahora.getMonth() - i - 1, 1);
                            const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return <option key={valor} value={valor}>{valor}</option>;
                        })}
                    </select>
                </div>
            </div>

            <p className="mt-1 text-[10px] text-slate-500">
                Orden correcto: <b className="text-slate-300">IVA primero</b> (ahí se confirman las ventas y retenciones), después el ATS con las compras y las ventas ya declaradas.
            </p>

            <div className="mt-2 space-y-1">
                {pasos.map((p) => {
                    const Icono = p.hecho ? CheckCircle2 : p.icono;
                    return (
                        <div key={p.numero} className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 ${p.hecho ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-white/10 bg-black/20'}`}>
                            <Icono size={12} className={p.hecho ? 'text-emerald-300' : 'text-slate-400'} />
                            <span className={`text-[9px] font-black ${p.hecho ? 'text-emerald-300' : 'text-slate-500'}`}>{p.numero}</span>
                            <div className="min-w-0 flex-1">
                                <p className={`text-[10px] font-bold ${p.hecho ? 'text-emerald-200' : 'text-slate-200'}`}>{p.titulo}</p>
                                <p className="truncate text-[9px] text-slate-500" title={p.detalle}>{p.detalle}</p>
                            </div>
                            {p.boton && (
                                <button
                                    type="button"
                                    onClick={() => { if (p.accion) p.accion(); }}
                                    className="rounded-md border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/10"
                                >
                                    {p.boton}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {sociedad && (
                <p className="mt-1.5 text-[9px] text-slate-500">
                    Sociedad: suma <b className="text-slate-300">ATS + IVA mensual</b> y las anuales (REBEFICS/1021/ADI) en su panel.
                </p>
            )}
        </div>
    );
};

export default MonthlyCircle;
