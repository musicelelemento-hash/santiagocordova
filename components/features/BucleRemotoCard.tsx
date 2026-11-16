import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MonitorSmartphone, Play, RefreshCw, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
    BucleRemotoJob,
    ETIQUETA_ESTADO,
    cancelarTrabajoBucle,
    crearTrabajoBucle,
    listarTrabajosBucle,
} from '../../services/bucleRemoto';

interface Props {
    periodo: string;
    clientes: Array<{ ruc: string; name?: string }>;
    etiquetaPeriodo: string;
}

const colorEstado: Record<string, string> = {
    pendiente: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    corriendo: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    hecho: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
    cancelado: 'border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-300',
};

/**
 * Tarjeta de **bucle remoto**.
 *
 * La idea: el celular encola y una PC con Chrome + la extensión ejecuta.
 * Acá se crea el trabajo (`bucle_remoto`) y se muestra el avance que reporta
 * el runner. No abre el SRI desde el teléfono.
 */
export const BucleRemotoCard: React.FC<Props> = ({ periodo, clientes, etiquetaPeriodo }) => {
    const { toast } = useToast();
    const [jobs, setJobs] = useState<BucleRemotoJob[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [cargando, setCargando] = useState(false);

    const refrescar = useCallback(async () => {
        try {
            setJobs(await listarTrabajosBucle(5));
        } catch {
            /* sin tabla, la tarjeta queda con el botón nomás */
        }
    }, []);

    useEffect(() => {
        void refrescar();
        const id = window.setInterval(() => void refrescar(), 6000);
        return () => window.clearInterval(id);
    }, [refrescar]);

    const enviar = async (modo: 'declarar' | 'solo_perfil') => {
        if (!clientes.length) {
            toast.error('No hay clientes pendientes para enviar.');
            return;
        }
        setEnviando(true);
        try {
            await crearTrabajoBucle({ periodo, clientes, modo });
            toast.success(`Trabajo enviado al runner: ${clientes.length} cliente(s) de ${etiquetaPeriodo}.`);
            await refrescar();
        } catch (e: any) {
            toast.error(e?.message || 'No se pudo encolar el trabajo.');
        } finally {
            setEnviando(false);
        }
    };

    const cancelar = async (id: string) => {
        try {
            await cancelarTrabajoBucle(id);
            await refrescar();
            toast.info('Trabajo cancelado.');
        } catch (e: any) {
            toast.error(e?.message || e);
        }
    };

    const activo = useMemo(() => jobs.find((j) => j.estado === 'corriendo'), [jobs]);

    return (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.04] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300">
                    <MonitorSmartphone size={13} /> Bucle remoto · runner
                </p>
                <span className="font-mono text-[9px] text-slate-500">
                    {clientes.length} cliente(s) · {etiquetaPeriodo}
                </span>
            </div>

            <p className="mt-1 text-[10px] text-slate-500">
                La PC con Chrome + la extensión ejecuta el mes; el celular sólo mira. El runner consulta esta cola cada 30 s.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={enviando || !clientes.length}
                    onClick={() => void enviar('declarar')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00A896] px-2.5 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-950 hover:brightness-110 disabled:opacity-50"
                >
                    <Play size={11} /> Enviar al runner
                </button>
                <button
                    type="button"
                    disabled={enviando || !clientes.length}
                    onClick={() => void enviar('solo_perfil')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 disabled:opacity-50"
                >
                    Sólo entrar (mirar)
                </button>
                <button
                    type="button"
                    onClick={() => void refrescar()}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                    title="Actualizar estado"
                >
                    <RefreshCw size={11} className={cargando ? 'animate-spin' : ''} /> Estado
                </button>
                {activo && (
                    <span className="font-mono text-[9px] text-emerald-400">
                        corriendo: {activo.progreso?.hecho ?? 0}/{activo.progreso?.total ?? activo.clientes.length}
                    </span>
                )}
            </div>

            {jobs.length > 0 && (
                <div className="mt-2 space-y-1">
                    {jobs.map((j) => {
                        const hecho = Number(j.progreso?.hecho) || 0;
                        const total = Number(j.progreso?.total) || j.clientes?.length || 1;
                        const pct = Math.min(100, Math.round((hecho / Math.max(1, total)) * 100));
                        return (
                            <div key={j.id} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`rounded border px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider ${colorEstado[j.estado] || colorEstado.pendiente}`}>
                                        {ETIQUETA_ESTADO[j.estado] || j.estado}
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-400">{j.periodo} · {j.clientes?.length || 0} cliente(s)</span>
                                    {j.created_at && (
                                        <span className="font-mono text-[8.5px] text-slate-500">
                                            {new Date(j.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    {(j.estado === 'pendiente' || j.estado === 'corriendo') && (
                                        <button
                                            type="button"
                                            onClick={() => void cancelar(j.id)}
                                            className="ml-auto text-slate-500 hover:text-rose-400"
                                            title="Cancelar trabajo"
                                        >
                                            <XCircle size={12} />
                                        </button>
                                    )}
                                </div>
                                {(j.estado === 'corriendo' || j.estado === 'hecho') && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full bg-gradient-to-r from-[#00A896] to-[#C9A96E] transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="font-mono text-[8.5px] text-slate-500">{hecho}/{total}</span>
                                    </div>
                                )}
                                {j.mensaje && <p className="mt-0.5 text-[9px] text-slate-500">{j.mensaje}</p>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BucleRemotoCard;
