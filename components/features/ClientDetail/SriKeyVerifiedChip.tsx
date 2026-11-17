import React from 'react';
import { CalendarClock, ShieldCheck } from 'lucide-react';
import type { Client } from '../../../types';

/**
 * Chip de auditoría de la clave SRI de la ficha del cliente.
 *
 * - «Verificada: dd/mm hh:mm» sale de `sriCredencial.ultimo_ingreso`, que lo
 *   escribe la extensión Nueva Luz cuando entra OK al portal del SRI.
 * - «Actualizada: dd/mm hh:mm» sale de `sriCredencial.claveActualizadaEn`, que
 *   lo escriben `guardarClaveCliente` y el importador de CSV.
 *
 * Si nunca entró la extensión con esta clave, muestra «Sin verificar». Es sólo
 * lectura: no toca el estado ni pide guardar nada.
 */

/** Formatea un ISO a «dd/mm hh:mm» en hora local. Devuelve null si no es válido. */
export const formatearFechaClave = (iso?: string): string | null => {
    if (!iso) return null;
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return null;
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const hh = String(fecha.getHours()).padStart(2, '0');
    const min = String(fecha.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
};

interface Props {
    client: Client;
    className?: string;
}

export const SriKeyVerifiedChip: React.FC<Props> = ({ client, className = '' }) => {
    const cred = client.taxProfile?.sriCredencial;
    const verificada = formatearFechaClave(cred?.ultimo_ingreso);
    const actualizada = formatearFechaClave(cred?.claveActualizadaEn);

    return (
        <div className={`flex flex-wrap items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider ${className}`}>
            {verificada ? (
                <span
                    title={`La extensión Nueva Luz entró OK al SRI con esta clave el ${verificada}.`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.12)] dark:text-emerald-400"
                >
                    <ShieldCheck size={11} strokeWidth={2.5} />
                    Verificada: {verificada}
                </span>
            ) : (
                <span
                    title="Todavía nadie entró al SRI con esta clave desde la extensión, o la clave nunca se guardó."
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    Sin verificar
                </span>
            )}
            {actualizada && (
                <span
                    title={`Última vez que se guardó/cambió la clave SRI en el sistema (origen: ${cred?.origenClave || 'manual'}).`}
                    className="inline-flex items-center gap-1 rounded-full border border-[#C9A96E]/40 bg-[#C9A96E]/10 px-2.5 py-1 text-amber-700 dark:text-[#e6d3ab]"
                >
                    <CalendarClock size={11} strokeWidth={2.5} />
                    Actualizada: {actualizada}
                </span>
            )}
        </div>
    );
};

export default SriKeyVerifiedChip;
