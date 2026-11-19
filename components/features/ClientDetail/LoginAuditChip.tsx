import React from 'react';
import { History } from 'lucide-react';
import type { Client } from '../../../types';

/** Auditoría de accesos al SRI: qué dijo el portal y cuándo entró de verdad. */
export const LoginAuditChip: React.FC<{ client: Client; className?: string }> = ({ client, className = '' }) => {
    const lista = (((client.taxProfile as any)?.loginAuditoria || []) as any[]).slice(0, 3);
    if (!lista.length) return null;
    const icono = (evento?: string) => evento === 'exito' || evento === 'sesion_abierta' ? '✅' : evento === 'bloqueo' ? '⛔' : evento === 'fallo' ? '⚠️' : '•';
    return (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-3 py-2 ${className}`}>
            <History size={12} className="text-slate-400" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Accesos SRI</span>
            {lista.map((x, i) => (
                <span key={i} className="font-mono text-[9px] text-slate-500 dark:text-slate-400" title={x.motivo || ''}>
                    {icono(x.evento)} {x.cuando ? new Date(x.cuando).toLocaleDateString('es-EC') + ' ' + new Date(x.cuando).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
            ))}
        </div>
    );
};