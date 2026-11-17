import React from 'react';
import { Check, FileSignature } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { Client } from '../../../types';

interface Props {
    client: Client;
    className?: string;
}

/**
 * Declaración ya presentada que espera la firma del contador.
 * El SRI no la rechaza, pero la empresa la necesita firmada: no debe pasar
 * desapercibida. Se muestra hasta que el contador firme y se marque acá.
 */
export const FirmaPendienteChip: React.FC<Props> = ({ client, className = '' }) => {
    const updateClient = useAppStore((s) => s.updateClient);
    const pend = (client.taxProfile as any)?.firmaContadorPendiente;
    if (!pend) return null;

    const fecha = pend.cuando ? new Date(pend.cuando).toLocaleDateString('es-EC') : '';
    const marcar = async () => {
        const tp: any = client.taxProfile || {};
        await updateClient(client.id, { taxProfile: { ...tp, firmaContadorPendiente: undefined } } as any);
    };

    return (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.07] px-3 py-2 ${className}`}>
            <FileSignature size={13} className="text-sky-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Pendiente de firma del contador
            </span>
            <span className="font-mono text-[10px] text-slate-400">
                {pend.periodo || ''}{fecha ? ` · ${fecha}` : ''}
            </span>
            <button
                type="button"
                onClick={() => void marcar()}
                title="Marcar como firmada por el contador"
                className="ml-auto flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
            >
                <Check size={10} /> Marcar firmada
            </button>
        </div>
    );
};