import React, { useMemo, useState } from 'react';
import { AlertTriangle, KeyRound, FileDown, Send, ShieldCheck, ExternalLink, Clock } from 'lucide-react';
import type { Client } from '../../types/client';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { sendToSRIExtension, sendRecoverProofToExtension } from '../../services/extensionBridge';

/**
 * Panel de "qué le falta a este cliente y qué hago ahora".
 *
 * Cuatro estados, cuatro acciones — y ninguna miente:
 *  - clave rechazada  → actualizar la clave acá mismo y reintentar.
 *  - sin comprobante  → recuperar SÓLO el PDF (no vuelve a declarar).
 *  - por declarar     → declarar ahora.
 *  - al día           → nada que hacer.
 */

interface Props {
    client: Client;
    periodo?: string;
}

const mesAnterior = (): string => {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

const nombrePeriodo = (p: string): string => {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [y, m] = String(p || '').split('-').map(Number);
    return y && m ? `${meses[m - 1]} ${y}` : String(p || '');
};

const ClientAttentionPanel: React.FC<Props> = ({ client, periodo }) => {
    const { updateClient } = useAppStore();
    const { toast } = useToast();
    const [mostrarClave, setMostrarClave] = useState(false);
    const [nuevaClave, setNuevaClave] = useState('');
    const [guardando, setGuardando] = useState(false);

    const periodoActivo = useMemo(
        () => periodo || client.declarations?.[0]?.period || mesAnterior(),
        [periodo, client.declarations],
    );

    const cred = (client.taxProfile as any)?.sriCredencial;
    const claveRechazada = Boolean(cred && cred.estado && cred.estado !== 'ok');
    const decl = (client.declarations || []).find((d) => d.period === periodoActivo);
    const tieneComprobante = Boolean(decl?.proof_file);
    const ultimaRevision = cred?.cuando ? new Date(cred.cuando).toLocaleString() : '';

    const guardarClaveYReintentar = async () => {
        const clave = nuevaClave.trim();
        if (clave.length < 4) {
            toast.error('La clave parece muy corta.');
            return;
        }
        setGuardando(true);
        try {
            await updateClient(client.id, { sriPassword: clave, sriPasswordUpdatedAt: new Date().toISOString() } as Partial<Client>);
            sendToSRIExtension({ ...client, sriPassword: clave }, periodoActivo);
            toast.success('Clave guardada. Abriendo el SRI para reintentar…');
            setNuevaClave('');
            setMostrarClave(false);
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`);
        } finally {
            setGuardando(false);
        }
    };

    if (claveRechazada) {
        return (
            <section className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-rose-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-300">
                            <AlertTriangle size={14} /> El SRI rechazó la clave
                        </p>
                        <p className="mt-1 text-[12px] text-rose-100/90">
                            {cred?.motivo || 'La credencial guardada no sirve.'}
                            {ultimaRevision && <span className="ml-1 text-rose-200/60">· {ultimaRevision}</span>}
                        </p>
                    </div>
                    <a
                        href="https://srienlinea.sri.gob.ec/tuportal-internet/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/15"
                    >
                        <ExternalLink size={12} /> Abrir SRI
                    </a>
                </div>

                {!mostrarClave ? (
                    <button
                        type="button"
                        onClick={() => setMostrarClave(true)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-500/90 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-rose-500"
                    >
                        <KeyRound size={13} /> Actualizar la clave
                    </button>
                ) : (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-black/25 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-rose-200/70">Cómo conseguirla</p>
                        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] text-rose-100/85">
                            <li>Entrá al portal del SRI → <b>Recuperar clave</b> (te llega al correo registrado).</li>
                            <li>Esperá <b>15 minutos</b> antes de volver a intentar (el portal bloquea reintentos).</li>
                            <li>Pegala acá y reintentá: la guardamos y abrimos el SRI por vos.</li>
                        </ol>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                                type="password"
                                value={nuevaClave}
                                onChange={(e) => setNuevaClave(e.target.value)}
                                placeholder="Nueva clave SRI"
                                autoComplete="new-password"
                                className="min-w-[180px] flex-1 rounded-lg border border-rose-500/30 bg-black/40 px-3 py-2 font-mono text-[12px] text-rose-50 outline-none placeholder:text-rose-200/30 focus:border-rose-400/60"
                            />
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={guardarClaveYReintentar}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                            >
                                <Send size={12} /> {guardando ? 'Guardando…' : 'Guardar y reintentar'}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        );
    }

    if (decl && !tieneComprobante) {
        return (
            <section className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-amber-50">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    <Clock size={14} /> Declaración de {nombrePeriodo(periodoActivo)} sin comprobante
                </p>
                <p className="mt-1 text-[12px] text-amber-100/90">
                    Se declaró, pero el PDF no quedó guardado. Recuperarlo <b>no vuelve a declarar</b>.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        sendRecoverProofToExtension(client, periodoActivo);
                        toast.success('Pedido enviado: la extensión va a recuperar el comprobante.');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-950 hover:bg-amber-400"
                >
                    <FileDown size={13} /> Recolectar comprobante
                </button>
            </section>
        );
    }

    if (!decl) {
        return (
            <section className="rounded-2xl border border-white/10 bg-[#051424]/70 p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Send size={13} /> {nombrePeriodo(periodoActivo)} sin declarar
                </p>
                <button
                    type="button"
                    onClick={() => {
                        sendToSRIExtension(client, periodoActivo);
                        toast.success('Pedido enviado: la extensión va a declarar.');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 hover:bg-[#00c3ab]"
                >
                    <Send size={13} /> Declarar ahora
                </button>
            </section>
        );
    }

    return (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck size={12} /> {nombrePeriodo(periodoActivo)} presentada con comprobante
        </div>
    );
};

export default ClientAttentionPanel;
