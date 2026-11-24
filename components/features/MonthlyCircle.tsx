import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FileSpreadsheet, Download, Upload, Calculator, Building2 } from 'lucide-react';
import type { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SupplierCatalogService } from '../../services/supplierCatalogService';
import { atsDesdeCompras, descargarAts } from '../../utils/atsXml';
import { abrirAnexoSri, entrarAlSriSinDeclarar } from '../../services/extensionBridge';
import { useAppStore } from '../../store/useAppStore';
import { DeclarationStatus } from '../../types';
import { clienteRequiereAts, esRucSociedad } from '../../services/sri';

/**
 * CÃRCULO MENSUAL â€” el orden que importa.
 *
 *   1. Extraer comprobantes (compras) del mes
 *   2. Declarar el IVA (104) â€” ahÃ­ quedan confirmadas las VENTAS y las retenciones
 *   3. Generar el ATS con esas compras + las ventas confirmadas
 *   4. Subirlo al SRI (popup â†’ ðŸ“¤)
 *   5. Guardar el acuse
 *
 * La web guÃ­a: cada paso dice quÃ© falta y con quÃ© botÃ³n se resuelve.
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
    const { updateClient } = useAppStore();
    const [registrando, setRegistrando] = useState(false);
    const [atsGenerado, setAtsGenerado] = useState(false);
    const ahora = new Date();
    const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const periodoInicial = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    const [periodo, setPeriodo] = useState(periodoInicial);
    const [generando, setGenerando] = useState(false);

    const sociedad = esRucSociedad(client.ruc);
    // ATS sÃ³lo si su RUC/obligaciones lo exigen (editable en la ficha).
    const requiereAts = clienteRequiereAts(client);
    const compras = useMemo(() => SupplierCatalogService.getClientPurchases(client, periodo), [client, periodo]);
    const facturas = compras?.invoices || [];

    // El IVA declarado de ese perÃ­odo (con sus ventas y CEP).
    const declaracionIva = (client.declarations || []).find(
        (d) => (d.period === periodo || d.period === `${periodo}:IVA`) && (!d.type || d.type === 'IVA'),
    );

    // Ventas confirmadas en el 104: la extensiÃ³n las deja en metadata del comprobante.
    const ventasDeclaradas = useMemo(() => {
        const meta: any = (declaracionIva as any)?.proof_file?.metadata || (declaracionIva as any) || {};
        const total = Number(meta.ventas15 || 0) + Number(meta.ventas5 || 0) + Number(meta.ventas8 || 0) + Number(meta.ventas0 || 0);
        return Number.isFinite(total) ? total : 0;
    }, [declaracionIva]);

    /** Ventas capturadas del formulario 104 por la extensiÃ³n (con IVA y sin IVA).
 *  Sirven aunque la cuenta estÃ© bloqueada y no se haya podido declarar. */
const ventasCapturadas = useMemo(() => {
    const v: any = (client.taxProfile as any)?.ventasPorPeriodo?.[periodo] || null;
    if (!v) return null;
    const conIva = Number(v.conIva) || 0;
    const sinIva = Number(v.sinIva) || 0;
    const base5 = Number(v.base5) || 0;
    const base8 = Number(v.base8) || 0;
    const total = Number(v.total) || (conIva + sinIva + base5 + base8);
    return { conIva, sinIva, base5, base8, total, cuando: v.cuando as string | undefined };
}, [client, periodo]);

/** Base de ventas para el ATS: la declarada manda; si no hay, la capturada. */
const ventasBaseEfectiva = ventasDeclaradas > 0 ? ventasDeclaradas : (ventasCapturadas?.total || 0);

const [acuse, setAcuse] = useState<any>(null);
const registrarAtsAutoRef = React.useRef(false);
    React.useEffect(() => {
        const leer = () => {
            try {
                const crudo = localStorage.getItem('sc_anexo_ultimo');
                if (!crudo) return;
                const a = JSON.parse(crudo);
                const texto = `${a?.nombre || ''} ${a?.mensaje || ''}`;
                const [anio, mm] = periodo.split('-');
                if (new RegExp(`${anio}[-_/]?${mm}|${mm}[-_/]?${anio}`).test(texto)) setAcuse(a);
            } catch { /* sin acuse */ }
        };
        leer();
        const timer = setInterval(leer, 4000);
        return () => clearInterval(timer);
    }, [periodo]);



    // Cuando la extensiÃ³n captura el acuse del ATS, se registra solo:
    // antes habÃ­a que tocar Â«Marcar presentadoÂ» a mano.
    React.useEffect(() => {
        if (!acuse || registrarAtsAutoRef.current) return;
        const ya = (client.declarations || []).some((d) => d.period === periodo && d.type === 'ATS');
        if (ya) return;
        registrarAtsAutoRef.current = true;
        void registrarAts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [acuse, periodo]);

    const generar = async () => {
        // Sin compras NO se bloquea: un mes en cero lleva el ATS con <compras> vacÃ­o.
        const sinCompras = facturas.length === 0;
        setGenerando(true);
        try {
            const atsRazonSocial = String((client.taxProfile as any)?.atsRazonSocial || '').trim();
            const { datos, faltantes } = atsDesdeCompras({ ruc: client.ruc, name: client.name }, periodo, facturas, { ventasBase: ventasBaseEfectiva, razonSocial: atsRazonSocial || undefined });
            if (sinCompras) {
                toast.info(`ATS de ${nombrePeriodo(periodo)} sin compras registradas (mes en cero).`);
            }
            if (faltantes.length) {
                toast.error(`Faltan ${faltantes.length} datos (clave de acceso).`);
                return;
            }
            await descargarAts(datos);
            setAtsGenerado(true);
            toast.success(`ATS de ${nombrePeriodo(periodo)} generado (XML + ZIP).`);
        } catch (e: any) {
            toast.error(`No se pudo generar: ${e?.message || e}`);
        } finally {
            setGenerando(false);
        }
    };

    const registrarAts = async () => {
        if (!acuse) return;
        setRegistrando(true);
        try {
            const declaraciones = client.declarations || [];
            const sinEse = declaraciones.filter((d) => !(d.type === 'ATS' && d.period === periodo));
            const nueva = {
                period: periodo,
                type: 'ATS',
                status: DeclarationStatus.Enviada,
                updatedAt: new Date().toISOString(),
                declaredAt: new Date().toISOString().slice(0, 10),
                amount: 0,
                transactionId: acuse.acuse || undefined,
                is_paid: false,
            } as any;
            await updateClient(client.id, { declarations: [...sinEse, nueva] });
            toast.success('ATS de ' + nombrePeriodo(periodo) + ' registrado como presentado.');
        } catch (e: any) {
            toast.error('No se pudo registrar: ' + (e?.message || e));
        } finally {
            setRegistrando(false);
        }
    };

    const pasosBase = [
        {
            numero: 1,
            titulo: 'Extraer comprobantes del mes',
            detalle: facturas.length
                ? `${facturas.length} factura(s) de compra con sus claves de acceso.`
                : 'AbrÃ­ SRI â†’ Comprobantes recibidos del mes â†’ extractor ðŸ“„ de la extensiÃ³n.',
            hecho: facturas.length > 0,
            icono: Download,
            accion: facturas.length ? null : () => toast.info('SRI â†’ Comprobantes recibidos â†’ mes â†’ botÃ³n ðŸ“„ de la extensiÃ³n.'),
            boton: facturas.length ? '' : 'CÃ³mo extraer',
        },
        {
            numero: 2,
            titulo: 'Declarar el IVA (104)',
            detalle: declaracionIva
                ? `Declarada${declaracionIva.transactionId ? ` Â· CEP ${declaracionIva.transactionId}` : ''}. Las ventas confirmadas ya quedaron en la declaraciÃ³n.`
                : (ventasCapturadas
            ? `Formulario 104 prellenado Â· ventas con IVA ${ventasCapturadas.conIva.toFixed(2)} Â· sin IVA ${ventasCapturadas.sinIva.toFixed(2)}${ventasCapturadas.base5 || ventasCapturadas.base8 ? ` Â· 5% ${ventasCapturadas.base5.toFixed(2)} Â· 8% ${ventasCapturadas.base8.toFixed(2)}` : ''}.`
            : 'El formulario llega con las VENTAS prellenadas desde FacturaciÃ³n ElectrÃ³nica: confirmÃ¡ y revisÃ¡ notas de crÃ©dito.'),
            hecho: !!declaracionIva,
            icono: Calculator,
            accion: declaracionIva ? null : () => { if (!entrarAlSriSinDeclarar(client)) { toast.error('Falta la clave SRI del cliente.'); return; } toast.info('Entrando al SRI: andÃ¡ a Declaraciones â†’ IVA y confirmÃ¡ el 104.'); },
            boton: declaracionIva ? '' : 'Entrar al SRI',
        },
        {
            numero: 3,
            titulo: 'Generar el ATS con lo declarado',
            detalle: ventasDeclaradas > 0 ? `Compras del paso 1 + ventas declaradas en el 104: ${ventasDeclaradas.toFixed(2)}.` : 'Compras del paso 1. DeclarÃ¡ el IVA (paso 2) para incluir las ventas en el ATS.',
            hecho: atsGenerado || !!acuse,
            icono: FileSpreadsheet,
            accion: () => void generar(),
            boton: generando ? 'Generandoâ€¦' : 'Generar ATS',
        },
        {
            numero: 4,
            titulo: 'Subir el ATS al SRI',
            detalle: 'Popup de la extensiÃ³n â†’ menÃº â‹® â†’ ðŸ“¤ Subir ZIP del anexoâ€¦ (adjunta, Cargar y Aceptar).',
            hecho: !!acuse,
            icono: Upload,
            accion: () => abrirAnexoSri(client, 'ATS'),
            boton: 'Abrir Anexos',
        },
        {
            numero: 5,
            titulo: 'Guardar el acuse',
            detalle: acuse
                ? `${acuse.mensaje || 'Anexo recibido'}${acuse.acuse ? ` Â· acuse ${acuse.acuse}` : ''}`
                : 'Al subirlo, la extensiÃ³n guarda el mensaje y el acuse del portal.',
            hecho: !!acuse,
            icono: CheckCircle2,
            accion: acuse ? () => void registrarAts() : null,
            boton: acuse ? (registrando ? 'Guardandoâ€¦' : 'Marcar presentado') : '',
        },
    ];

    // Sin ATS: el mes son dos pasos (comprobantes + IVA) y su comprobante.
    const pasos = (requiereAts ? pasosBase : [
        pasosBase[0],
        pasosBase[1],
        {
            numero: 0,
            titulo: 'Comprobante del IVA guardado',
            detalle: declaracionIva ? 'Queda en la bÃ³veda del cliente.' : 'La extensiÃ³n lo guarda al enviar el IVA.',
            hecho: !!declaracionIva,
            icono: CheckCircle2,
            accion: null,
            boton: '',
        },
    ]).map((p, i) => ({ ...p, numero: i + 1 }));

    const hechos = pasos.filter((p) => p.hecho).length;

    return (
        <div className="mb-4 rounded-2xl border border-sky-500/25 bg-sky-500/[0.04] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300">
                    <Building2 size={13} /> CÃ­rculo mensual Â· {nombrePeriodo(periodo)}
                </p>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-slate-400">{hechos}/{pasos.length} pasos</span>
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
                {requiereAts ? (
                <>Orden correcto: <b className="text-slate-300">IVA primero</b> (ahÃ­ se confirman las ventas y retenciones), despuÃ©s el ATS con las compras y las ventas ya declaradas.</>
            ) : (
                <>Este cliente <b className="text-slate-300">no presenta ATS</b> segÃºn sus obligaciones: el mes se cierra con el IVA y su comprobante. Si el SRI se lo agrega, activalo en la ficha â†’ Obligaciones.</>
            )}
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
                    {client.taxProfile?.requiresIce && (
            <p className="mt-1.5 text-[9px] text-amber-500/90">
                TambiÃ©n presenta <b>ICE</b>: el formulario y el anexo se manejan desde la herramienta de ICE en el SRI.
            </p>
        )}

        {requiereAts ? (<>Sociedad: suma <b className="text-slate-300">ATS + IVA mensual</b> y las anuales (REBEFICS/1021/ADI) en su panel.</>) : (<>Sin ATS activo. PodÃ©s activarlo en la ficha â†’ Obligaciones si el SRI lo exige.</>)}
                </p>
            )}
        </div>
    );
};

export default MonthlyCircle;
