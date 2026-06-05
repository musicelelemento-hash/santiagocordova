
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime, Declaration, InternalStatus } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, differenceInCalendarDays, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import { getClientCompliance, getClientDebtSummary, getClientUndeclaredSummary } from '../../services/complianceEngine';

interface ClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
    onPreview?: (client: Client, declaration: Declaration) => void;
    compact?: boolean;
    variant?: 'tactical' | 'zen' | 'digital';
    frequency?: 'Mensual' | 'Semestral' | 'Anual' | 'all';
    customPeriod?: string;
    isTrashView?: boolean;
}


export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, compact = false, variant = 'tactical', frequency, customPeriod, isTrashView = false }) => {
    const [copied, setCopied] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const today = new Date();
    const compliance = getClientCompliance(client, today, frequency);
    const currentPeriod = customPeriod || getPeriod(client, today, frequency);
    const activeDecl = client.declarations.find(d => d.period === currentPeriod);

    // Lógica de Estado Multi-período Táctica
    const debtSummary = getClientDebtSummary(client, serviceFees, today);
    const undeclaredSummary = getClientUndeclaredSummary(client, today);

    // Un cliente tiene cobro de IVA pendiente en el periodo actual
    const isPaid = !debtSummary.hasPendingPayment;
    // Un cliente tiene la declaración de IVA enviada en el periodo actual
    const isDeclared = !undeclaredSummary.hasPendingObligation;
    
    const fee = getClientServiceFee(client, serviceFees, currentPeriod);
    const dueDate = getDueDateForPeriod(client, currentPeriod);

    // Cálculos de Tiempo
    const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : null;
    const isOverdue = undeclaredSummary.overduePeriodsCount > 0;
    const isUrgent = daysUntilDue !== null && daysUntilDue <= 3 && undeclaredSummary.hasPendingObligation;

    // Renta Extra Buttons Logic
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
    const currentYear = today.getFullYear();
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
    const isRentaDeclared = !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;
    const isRentaPaid = !!rentaDecl?.is_paid;
    const isRentaFullyDone = isRentaDeclared && isRentaPaid;

    // Is fully paid and declared across the ENTIRE history (2026+)
    const isFullyPaid = !debtSummary.hasPendingPayment && (isRentaPaid || !needsRenta);
    const isFullyDeclared = !undeclaredSummary.hasPendingObligation && (isRentaDeclared || !needsRenta);
    const isFullyAlDia = isFullyPaid && isFullyDeclared;

    // ORDEN DE TRABAJO (Prioridad)
    const hasWorkOrder = (client.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente);

    // REFRESH PULSE LOGIC
    const isRefundAlertActive = 
        (client.rentaRefundStatus === 'Solicitado' && client.rentaRefundRequestedAt && differenceInHours(today, new Date(client.rentaRefundRequestedAt)) >= 6) ||
        (client.rentaRefundStatus === 'Esperando Confirmación');

    // Elite Tactical Design System
    const getStatusInfo = () => {
        if (client.isDeleted) return { color: 'bg-slate-100 text-slate-500 border-slate-200', text: 'Archivado', icon: LucideIcons.Trash2 };
        if (!client.isActive) return { color: 'bg-slate-50 text-slate-400 border-slate-100', text: 'Inactivo', icon: LucideIcons.Power };
        if (isFullyAlDia) return { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'Al Día', icon: LucideIcons.ShieldCheck };
        if (hasWorkOrder) return { color: 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse', text: 'Orden de Trabajo', icon: LucideIcons.Zap };
        if (isOverdue) return { color: 'bg-rose-50 text-rose-600 border-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.1)]', text: 'Vencido', icon: LucideIcons.AlertCircle };
        if (debtSummary.hasPendingPayment) return { color: 'bg-amber-50 text-amber-600 border-amber-200', text: 'Cobro Pendiente', icon: LucideIcons.DollarSign };
        if (isUrgent) return { color: 'bg-orange-50 text-orange-600 border-orange-200', text: 'Vence Pronto', icon: LucideIcons.Clock };
        return { color: 'bg-slate-100 text-slate-500 border-slate-200', text: 'Pendiente', icon: LucideIcons.Calendar };
    };

    const statusBadge = getStatusInfo();

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAction = (e: React.MouseEvent, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'restore' | 'purge', customPeriod?: string) => {
        e.stopPropagation();
        if (onQuickAction) onQuickAction(client, action, customPeriod);
    };

    return (
        <div
            onClick={() => onView(client)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                relative rounded-3xl transition-all duration-500 cursor-pointer overflow-hidden group/card
                ${isHovered ? 'shadow-premium -translate-y-1.5 border-primary/20 bg-white dark:bg-surface-low' : 'shadow-sm border-transparent bg-white/60 dark:bg-surface/40'}
                border-2 backdrop-blur-xl
                ${hasWorkOrder ? 'ring-2 ring-primary/20 bg-blue-50/10' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-emerald-500/20' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-700 ${
                isFullyAlDia ? 'bg-emerald-500' : 
                isOverdue ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 
                isUrgent ? 'bg-amber-500' :
                'bg-slate-200 dark:bg-white/10'
            }`}></div>
            
            <div className={`${compact ? 'p-4' : 'p-6'} relative z-10 flex flex-col sm:flex-row sm:items-center h-full justify-between gap-6`}>
                {/* Identity Zone */}
                <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="relative shrink-0">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg transition-all duration-700 shadow-inner ${
                            isFullyAlDia ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                            isOverdue ? 'bg-rose-500 text-white shadow-rose-200' :
                            'bg-slate-900 dark:bg-primary text-white shadow-slate-200'
                        }`}>
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Health Ring Indicator */}
                        <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                            <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-surface-low flex items-center justify-center text-[8px] font-black shadow-sm ${
                                compliance.overallColor === 'green' ? 'bg-emerald-500 text-white' :
                                compliance.overallColor === 'red' ? 'bg-rose-500 text-white' :
                                'bg-amber-400 text-slate-900'
                            }`}>
                                {compliance.score}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-premium font-extrabold text-lg truncate text-slate-900 dark:text-slate-100 tracking-tight" title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            {client.hasElderlyDevolucionIva && (
                                <span className="shrink-0 text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-black tracking-widest uppercase font-premium">
                                    3ra Edad
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button onClick={handleCopy} className="group/copy flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <span className="font-mono text-[10px] font-black tracking-widest uppercase">{client.ruc}</span>
                                {copied ? <LucideIcons.Check size={12} className="text-emerald-500" /> : <LucideIcons.Copy size={12} className="opacity-0 group-hover/copy:opacity-100 transition-opacity" />}
                            </button>
                            
                            {/* Campaign Intelligence Badge */}
                            {dueDate && !client.isDeleted && client.isActive && (
                                <div className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${
                                    isDeclared ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                                    isOverdue ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' :
                                    isUrgent ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' :
                                    'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                }`}>
                                    <LucideIcons.CalendarDays size={10} />
                                    <span>Dígito {client.ruc[8]} • {isDeclared ? 'Cumplido' : `Vence ${safeFormat(dueDate, 'dd MMM')}`}</span>
                                </div>
                            )}

                            {!compact && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-100 dark:border-white/5">
                                    <LucideIcons.CreditCard size={10} />
                                    ${fee.toFixed(2)}
                                </div>
                            )}
                        </div>

                        {/* Micro-resumen de deudas o pendientes */}
                        {client.isActive && !client.isDeleted && (
                            <div className="mt-2 flex flex-wrap gap-2 items-center text-[10px] font-bold font-premium text-slate-500 dark:text-slate-400">
                                {debtSummary.hasPendingPayment && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm transition-all duration-300 animate-fade-in">
                                        <LucideIcons.DollarSign size={10} strokeWidth={3} className="text-amber-500" />
                                        <span>Debe ${debtSummary.totalDebt.toFixed(2)} ({debtSummary.unpaidPeriods.map(formatPeriodForDisplay).join(', ')})</span>
                                    </span>
                                )}
                                {undeclaredSummary.hasPendingObligation && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm transition-all duration-300 animate-fade-in">
                                        <LucideIcons.AlertCircle size={10} strokeWidth={3} className="text-rose-500" />
                                        <span>Pendiente SRI: {undeclaredSummary.undeclaredPeriods.map(formatPeriodForDisplay).join(', ')}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pulse & Action Zone */}
                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-white/5">
                    {/* Visual Status Sparks */}
                    {!client.isDeleted && !compact && (
                        <div className="flex items-center gap-4 px-4 border-x border-slate-100 dark:border-white/5 h-10">
                            <div className="flex flex-col items-center">
                                <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isPaid ? 'text-emerald-500' : (isOverdue ? 'text-rose-500' : 'text-slate-300')}`}>IVA</span>
                                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-500 scale-125' : (isOverdue ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-slate-200 dark:bg-white/10')}`} />
                            </div>
                            {needsRenta && (
                                <div className="flex flex-col items-center">
                                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isRentaFullyDone ? 'text-emerald-500' : 'text-slate-300'}`}>RENTA</span>
                                    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isRentaFullyDone ? 'bg-emerald-500 scale-125' : 'bg-slate-200 dark:bg-white/10'}`} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Badge & Quick Actions */}
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.1em] font-premium transition-all duration-500 ${statusBadge.color}`}>
                            <statusBadge.icon size={12} strokeWidth={3} />
                            <span className="hidden sm:inline">{statusBadge.text}</span>
                            {daysUntilDue !== null && !isDeclared && !isOverdue && (
                                <span className="ml-1 opacity-60">-{daysUntilDue}d</span>
                            )}
                        </div>

                        {isTrashView ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleAction(e, 'restore')}
                                    className="flex items-center justify-center h-11 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/25"
                                >
                                    <LucideIcons.RotateCcw size={14} className="mr-2" />
                                    Restaurar
                                </button>
                                <button
                                    onClick={(e) => handleAction(e, 'purge')}
                                    className="flex items-center justify-center h-11 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/25"
                                >
                                    <LucideIcons.Trash2 size={14} className="mr-2" />
                                    Eliminar
                                </button>
                            </div>
                        ) : (
                            client.isActive && !client.isDeleted && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => !isDeclared && handleAction(e, 'declare')}
                                        disabled={isDeclared}
                                        className={`group/btn flex items-center justify-center h-11 w-11 sm:w-auto sm:px-5 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest font-premium ${
                                            isDeclared 
                                            ? 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-white/5 dark:border-transparent opacity-50' 
                                            : 'bg-slate-900 dark:bg-primary text-white border-slate-900 dark:border-primary hover:scale-105 active:scale-95 shadow-lg shadow-slate-200 dark:shadow-primary/20'
                                        }`}
                                    >
                                        <LucideIcons.Zap size={15} className={isDeclared ? '' : 'fill-current group-hover/btn:animate-pulse'} />
                                        <span className="hidden md:inline ml-2">SRI</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                        className={`flex items-center justify-center h-11 w-11 sm:w-auto sm:px-5 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest font-premium ${
                                            activeDecl?.proof_file 
                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200' 
                                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-500'
                                        } active:scale-95`}
                                    >
                                        {activeDecl?.proof_file ? <LucideIcons.FileCheck size={16} /> : <LucideIcons.UploadCloud size={16} />}
                                        <span className="hidden md:inline ml-2">{activeDecl?.proof_file ? 'VER' : 'PDF'}</span>
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
