import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, KeyRound, ShieldAlert } from 'lucide-react';
import type { Client } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { publicarCredencialActualizada } from '../../services/extensionBridge';
import { guardarClaveCliente } from '../../services/sriPasswords';
import { useToast } from '../../context/ToastContext';

/** Portal oficial del SRI para generar o recuperar la clave. */
export const SRI_RECUPERAR_CLAVE =
    'https://srienlinea.sri.gob.ec/sri-generacion-claves-web-internet/publico/opciones-clave.jsf?pathMPT=Cita%20previa&actualMPT=Generar%20o%20recuperar%20clave';

/**
 * Alerta de credencial SRI rechazada / bloqueada.
 *
 * El SRI bloquea la cuenta a los 5 intentos fallidos. Cuando la extensión detecta
 * «Clave bloqueada, acceda a recuperar clave» deja marcado `sriCredencial.estado`,
 * y aquí se ve qué pasó y cómo resolverlo en dos caminos:
 *   1) recuperar la clave en el portal,
 *   2) cargar la clave nueva acá (y limpiar la marca para que el bucle vuelva a tomarlo).
 */
const SriCredentialAlert: React.FC<{ client: Client }> = ({ client }) => {
    const { updateClient } = useAppStore();
    const { toast } = useToast();
    const [nueva, setNueva] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const cred: any = (client.taxProfile as any)?.sriCredencial;
    const estado = cred?.estado;
    if (!estado || estado === 'ok') return null;

    const esBloqueo = estado === 'bloqueada';
    const esCaducada = estado === 'caducada';
    const titulo = esBloqueo ? 'Cuenta del SRI BLOQUEADA' : esCaducada ? 'El SRI pide cambiar la clave' : 'El SRI rechazó la clave';
    const motivo = cred?.motivo || (esBloqueo ? 'Exceso de intentos fallidos (el SRI bloquea a los 5)' : 'Credencial rechazada por el portal');
    const clases = esBloqueo
        ? 'border-rose-500/35 bg-rose-500/[0.07] text-rose-200'
        : esCaducada
            ? 'border-amber-500/35 bg-amber-500/[0.07] text-amber-200'
            : 'border-orange-500/35 bg-orange-500/[0.07] text-orange-200';

    const guardar = async () => {
        const clave = nueva.trim();
        if (clave.length < 6) {
            toast.error('La clave parece muy corta.');
            return;
        }
        setGuardando(true);
        try {
            const res = await guardarClaveCliente(client, clave, updateClient, { origen: 'manual' });
            if (!res.ok) {
                toast.error(res.motivo || res.aviso || 'No se pudo guardar la clave.');
                return;
            }
            publicarCredencialActualizada({ ...client, sriPassword: clave } as any);
            toast.success(res.enNube ? 'Clave guardada y confirmada en la nube. La extensión ya la recibió.' : 'Clave guardada en este navegador (la nube no la confirmó).');
            setNueva('');
            setAbierto(false);
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    const limpiar = async () => {
        try {
            const tp: any = (client.taxProfile as any) || {};
            await updateClient(client.id, {
                taxProfile: { ...tp, sriCredencial: { estado: 'ok', motivo: 'Alerta limpiada por el usuario' } },
            } as any);
            toast.success('Alerta limpiada.');
        } catch (e: any) {
            toast.error(`No se pudo limpiar: ${e?.message || e}`);
        }
    };

    return (
        <div className={`mb-4 rounded-2xl border px-4 py-3 ${clases}`}>
            <div className="flex flex-wrap items-start gap-2">
                {esBloqueo ? <ShieldAlert size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest">{titulo}</p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                        {motivo}
                        {cred?.cuando ? ` · detectado ${new Date(cred.cuando).toLocaleString('es-EC')}` : ''}
                    </p>

                    {esBloqueo && (
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[10px] opacity-90">
                            <li>Entrá a <b>Recuperar clave</b> del SRI (te llega al correo registrado o por preguntas de seguridad).</li>
                            <li>Cuando la tengas, cargala acá con <b>Actualizar clave</b>.</li>
                            <li>Recién ahí volvé a correr el bucle con este cliente.</li>
                        </ol>
                    )}
                    {esCaducada && (
                        <p className="mt-1 text-[10px] opacity-90">
                            El portal exige cambiarla al entrar. Cambiala en el SRI y después actualizala acá.
                        </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a
                            href={SRI_RECUPERAR_CLAVE}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider hover:bg-white/10"
                        >
                            <ExternalLink size={11} /> Recuperar en el SRI
                        </a>
                        <button
                            type="button"
                            onClick={() => setAbierto((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider hover:bg-white/10"
                        >
                            <KeyRound size={11} /> Actualizar clave
                        </button>
                        <button
                            type="button"
                            onClick={() => void limpiar()}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
                            title="Si ya recuperaste la cuenta y no querés cargar la clave ahora"
                        >
                            Ya la recuperé
                        </button>
                    </div>

                    {abierto && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                                type="password"
                                value={nueva}
                                onChange={(e) => setNueva(e.target.value)}
                                placeholder="Nueva clave SRI"
                                autoComplete="new-password"
                                className="w-44 rounded-lg border border-white/15 bg-black/30 px-2 py-1 font-mono text-[11px] outline-none"
                            />
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={() => void guardar()}
                                className="rounded-lg bg-[#00A896] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50"
                            >
                                {guardando ? 'Guardando…' : 'Guardar clave'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SriCredentialAlert;
