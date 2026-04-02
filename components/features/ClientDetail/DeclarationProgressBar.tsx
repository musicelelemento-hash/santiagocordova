import React, { useMemo } from 'react';
import { Client, DeclarationStatus } from '../../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../services/sri';
import { isPast, format, startOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';

interface DeclarationProgressBarProps {
    client: Client;
    className?: string;
}

/**
 * DeclarationProgressBar: Visual timeline of for the last 12 months of tax compliance.
 * Migrated from legacy ClientsScreen for architectural consolidation (Zen v3.1).
 */
export const DeclarationProgressBar: React.FC<DeclarationProgressBarProps> = ({ client, className = "" }) => {
    const today = useMemo(() => new Date(), []);
    
    // Generate last 12 months for compliance tracking
    const periods = useMemo(() => {
        const result = [];
        for (let i = 11; i >= 0; i--) {
            const date = subMonths(today, i);
            const periodKey = getPeriod(client, date);
            const dueDate = getDueDateForPeriod(client, periodKey);
            
            const declaration = client.declarations?.find(d => d.period === periodKey);
            const isDeclared = !!declaration?.proof_file || declaration?.status === DeclarationStatus.Enviada;
            const isPaid = !!declaration?.is_paid;
            const isVencido = dueDate && isPast(dueDate) && !isDeclared;
            const isCurrent = i === 0;

            result.push({
                date,
                periodKey,
                label: (format(date, 'MMM', { locale: es }) || '').toUpperCase(),
                fullLabel: formatPeriodForDisplay(periodKey),
                isDeclared,
                isPaid,
                isVencido,
                isCurrent,
                status: isDeclared ? (isPaid ? 'complete' : 'pending-payment') : (isVencido ? 'overdue' : 'upcoming')
            });
        }
        return result;
    }, [client, today]);

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/80 font-mono">
                    Compliance Timeline / 12 Months
                </span>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">OK</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">MORA</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-surface-container-low/30 backdrop-blur-md p-4 rounded-3xl border border-outline-variant/10 shadow-inner">
                {periods.map((p, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip v3.1 */}
                        <div className="absolute bottom-full mb-4 hidden group-hover:block z-50 pointer-events-none">
                            <div className="bg-surface-container-high/95 backdrop-blur-xl border border-outline-variant text-[10px] px-4 py-3 rounded-2xl shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono font-bold text-primary tracking-tighter">{p.fullLabel}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${p.isDeclared ? 'bg-emerald-500/10 text-emerald-500' : (p.isVencido ? 'bg-rose-500/10 text-rose-500' : 'bg-surface-low text-on-surface-variant')}`}>
                                        {p.isDeclared ? 'DECLARED' : 'PENDING'}
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${p.isPaid ? 'bg-emerald-500' : 'bg-outline-variant'}`}></div>
                                        <span className="text-on-surface-variant font-medium">Pago: {p.isPaid ? 'Confirmado' : 'Pendiente'}</span>
                                    </div>
                                    {p.isVencido && !p.isDeclared && (
                                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                                            <LucideIcons.AlertCircle size={10} />
                                            <span>Mora detectada</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={`
                            w-full h-12 rounded-xl transition-all duration-300 flex items-center justify-center relative overflow-hidden group/bar
                            ${p.status === 'complete' ? 'bg-emerald-500/10 hover:bg-emerald-500/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]' : 
                              p.status === 'pending-payment' ? 'bg-amber-500/5 border border-amber-500/20' :
                              p.status === 'overdue' ? 'bg-rose-500/10 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 
                              'bg-surface-low/30 opacity-40 hover:opacity-100'}
                            ${p.isCurrent ? 'ring-1 ring-primary/40 shadow-lg shadow-primary/5' : ''}
                        `}>
                            {p.status === 'complete' && (
                                <div className="relative">
                                    <LucideIcons.ShieldCheck size={16} className="text-emerald-500/60 group-hover/bar:text-emerald-500 transition-colors" />
                                    <div className="absolute inset-0 bg-emerald-500 blur-md opacity-0 group-hover/bar:opacity-30 transition-opacity"></div>
                                </div>
                            )}
                            {p.status === 'overdue' && <LucideIcons.Zap size={16} className="text-rose-500 animate-[pulse_1.5s_infinite]" />}
                            {p.status === 'pending-payment' && <LucideIcons.Clock size={16} className="text-amber-500/60" />}
                            
                            {/* Current month indicator (Tactical Pulse) */}
                            {p.isCurrent && (
                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary overflow-hidden">
                                    <div className="w-full h-full bg-white/40 animate-[shimmer_2s_infinite]"></div>
                                </div>
                            )}
                        </div>
                        <span className={`text-[9px] font-mono font-bold tracking-widest transition-colors ${p.isCurrent ? 'text-primary' : 'text-on-surface-variant/50 group-hover:text-on-surface'}`}>
                            {p.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
