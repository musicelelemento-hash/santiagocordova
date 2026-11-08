import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Check } from 'lucide-react';
import type { AnnulmentPolicy, ModoPoliticaAnulacion } from '../../types/annulment';
import { resolverPolitica } from '../../services/annulmentBilling';

/**
 * Editor de la política de cobro de anulaciones de un cliente.
 *
 * Cuatro modos: heredar el global ($2 sin cupo), gratis, precio fijo o cupo por
 * período. El dato se guarda en `billingPlan.annulmentPolicy` del cliente y lo
 * lee el mismo `resolverPolitica` que usan la Bóveda, Cobranza y el bot.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    cliente: { ruc: string; nombre?: string };
    policy?: AnnulmentPolicy | null;
    onSave: (policy: AnnulmentPolicy) => Promise<void> | void;
}

const MODOS: Array<{ id: ModoPoliticaAnulacion; titulo: string; detalle: string }> = [
    { id: 'heredado', titulo: 'Heredar', detalle: 'El precio global ($2 por anulación, sin cupo).' },
    { id: 'gratis', titulo: 'Gratis', detalle: 'Este cliente no paga anulaciones.' },
    { id: 'fijo', titulo: 'Precio propio', detalle: 'Un precio distinto para este cliente.' },
    { id: 'cupo', titulo: 'Cupo incluido', detalle: 'N incluidas por período y el resto al precio.' },
];

const AnnulmentPolicyModal: React.FC<Props> = ({ isOpen, onClose, cliente, policy, onSave }) => {
    const inicial = policy?.modo || 'heredado';
    const [modo, setModo] = useState<ModoPoliticaAnulacion>(inicial);
    const [precio, setPrecio] = useState<string>(String(policy?.precio ?? 2));
    const [cupo, setCupo] = useState<string>(String(policy?.cupoPorPeriodo ?? 2));
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setModo(policy?.modo || 'heredado');
        setPrecio(String(policy?.precio ?? 2));
        setCupo(String(policy?.cupoPorPeriodo ?? 2));
    }, [isOpen, policy]);

    const resultado = useMemo(() => resolverPolitica({
        modo,
        precio: Number(precio),
        cupoPorPeriodo: Number(cupo),
    }), [modo, precio, cupo]);

    const guardar = async () => {
        setGuardando(true);
        try {
            await onSave({
                modo,
                precio: modo === 'gratis' ? 0 : Number(precio) || 0,
                cupoPorPeriodo: modo === 'cupo' ? Math.max(0, Number(cupo) || 0) : 0,
            });
            onClose();
        } finally {
            setGuardando(false);
        }
    };

    const etiqueta = resultado.gratis
        ? 'Gratis'
        : resultado.cupo > 0
            ? `$${resultado.precio.toFixed(2)} c/u · ${resultado.cupo} incluidas por período`
            : `$${resultado.precio.toFixed(2)} por anulación`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cobro de anulaciones" size="md">
            <div className="p-5 space-y-4 text-slate-200">
                <p className="text-xs text-slate-400">
                    {cliente.nombre || cliente.ruc} · <span className="font-mono">{cliente.ruc}</span>
                </p>

                <div className="grid gap-2">
                    {MODOS.map((m) => {
                        const activo = modo === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setModo(m.id)}
                                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${activo
                                    ? 'border-emerald-400/50 bg-emerald-500/10'
                                    : 'border-white/10 hover:bg-white/5'}`}
                            >
                                <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${activo ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/25'}`}>
                                    {activo && <Check size={11} strokeWidth={3} />}
                                </span>
                                <span>
                                    <span className="block text-[12px] font-bold text-slate-100">{m.titulo}</span>
                                    <span className="block text-[10.5px] leading-relaxed text-slate-400">{m.detalle}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {modo === 'fijo' && (
                    <label className="block text-[11px] text-slate-300">
                        Precio por anulación
                        <input
                            type="number" min={0} step={0.5} value={precio}
                            onChange={(e) => setPrecio(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400/60"
                        />
                    </label>
                )}

                {modo === 'cupo' && (
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block text-[11px] text-slate-300">
                            Incluidas por período
                            <input
                                type="number" min={0} step={1} value={cupo}
                                onChange={(e) => setCupo(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400/60"
                            />
                        </label>
                        <label className="block text-[11px] text-slate-300">
                            Precio del excedente
                            <input
                                type="number" min={0} step={0.5} value={precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400/60"
                            />
                        </label>
                    </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-slate-300">
                    Regla resultante: <b className="text-emerald-300">{etiqueta}</b>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={guardar}
                        disabled={guardando}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50"
                    >
                        {guardando ? 'Guardando…' : 'Guardar regla'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AnnulmentPolicyModal;
