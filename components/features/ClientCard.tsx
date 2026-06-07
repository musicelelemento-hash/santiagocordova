
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
                relative rounded-[2rem] transition-all duration-500 cursor-pointer overflow-hidden group/card
                bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10
                ${isHovered ? '-translate-y-1.5 border-primary/40 shadow-[0_15px_40px_-10px_rgba(43,106,255,0.15)] dark:shadow-[0_15px_40px_-10px_rgba(43,106,255,0.2)]' : 'shadow-xl shadow-slate-200/30 dark:shadow-none'}
                ${hasWorkOrder ? 'ring-1 ring-primary/30 bg-primary/[0.02]' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-1 ring-emerald-500/30' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] transition-all duration-700 opacity-90 ${
                isFullyAlDia ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 
                isOverdue ? 'bg-gradient-to-r from-rose-400 to-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 
                isUrgent ? 'bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.5)]' :
                'bg-gradient-to-r from-slate-200 to-slate-300 dark:from-white/10 dark:to-white/5'
            }`}></div>
            
            <div className={`p-5 sm:p-6 relative z-10 flex flex-col md:flex-row md:items-center h-full justify-between gap-6`}>
                {/* 1. Identity & Contact Zone */}
                <div className="flex items-start md:items-center gap-5 flex-1 min-w-0 md:border-r border-slate-100 dark:border-white/5 md:pr-6">
                    <div className="relative shrink-0 mt-1 md:mt-0">
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all duration-700 shadow-inner ${
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
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="font-display font-bold text-xl sm:text-2xl truncate text-slate-900 dark:text-white tracking-tight" title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            <span className="shrink-0 text-[8px] sm:text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 rounded-lg font-black tracking-widest uppercase font-premium">
                                {client.regime.replace('RIMPE - ', 'R-').substring(0, 15)}
                            </span>
                            {client.hasElderlyDevolucionIva && (
                                <span className="shrink-0 text-[8px] sm:text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-black tracking-widest uppercase font-premium">
                                    3ra Edad
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                            <button onClick={handleCopy} className="group/copy flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                <span className="font-mono text-[10px] sm:text-[11px] font-black tracking-widest uppercase">{client.ruc}</span>
                                {copied ? <LucideIcons.Check size={12} className="text-emerald-500" /> : <LucideIcons.Copy size={12} className="opacity-0 group-hover/copy:opacity-100 transition-opacity" />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {client.phones && client.phones[0] && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${client.phones![0].replace(/\D/g,'')}`, '_blank'); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-[10px] font-bold uppercase tracking-wider"
                                >
                                    <LucideIcons.MessageCircle size={12} />
                                    <span>WhatsApp</span>
                                </button>
                            )}
                            {client.email && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${client.email}`; }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-[10px] font-bold uppercase tracking-wider"
                                >
                                    <LucideIcons.Mail size={12} />
                                    <span>Email</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Intelligence Zone */}
                <div className="flex flex-col justify-center gap-3 flex-1 md:border-r border-slate-100 dark:border-white/5 md:pr-6 py-2 md:py-0">
                    {dueDate && !client.isDeleted && client.isActive && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm w-fit ${
                            isDeclared ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                            isOverdue ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' :
                            isUrgent ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' :
                            'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                        }`}>
                            <LucideIcons.CalendarDays size={14} />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70">Campaña SRI • Dígito {client.ruc[8]}</span>
                                <span className="text-[11px] font-bold">{isDeclared ? 'Cumplido' : `Vence ${safeFormat(dueDate, 'dd MMM')}`}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-white/5">
                            <LucideIcons.CreditCard size={12} className="opacity-70" />
                            ${fee.toFixed(2)}/mes
                        </div>

                        {debtSummary.hasPendingPayment && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm transition-all duration-300">
                                <LucideIcons.DollarSign size={12} strokeWidth={3} className="text-amber-500" />
                                <span>Debe ${debtSummary.totalDebt.toFixed(2)}</span>
                            </span>
                        )}
                        {undeclaredSummary.hasPendingObligation && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm transition-all duration-300">
                                <LucideIcons.AlertCircle size={12} strokeWidth={3} className="text-rose-500" />
                                <span>Falta SRI ({undeclaredSummary.overduePeriodsCount})</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 3. Action Zone */}
                <div className="flex flex-col items-start sm:items-end justify-center gap-3 flex-shrink-0 w-full md:w-auto">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.1em] font-premium w-fit ${statusBadge.color}`}>
                        <statusBadge.icon size={12} strokeWidth={3} />
                        <span>{statusBadge.text}</span>
                        {daysUntilDue !== null && !isDeclared && !isOverdue && (
                            <span className="ml-1 opacity-60">-{daysUntilDue}d</span>
                        )}
                    </div>

                    {isTrashView ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button onClick={(e) => handleAction(e, 'restore')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/25 transition-transform active:scale-95">
                                <LucideIcons.RotateCcw size={14} className="mr-2" />
                                Restaurar
                            </button>
                            <button onClick={(e) => handleAction(e, 'purge')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/25 transition-transform active:scale-95">
                                <LucideIcons.Trash2 size={14} className="mr-2" />
                                Eliminar
                            </button>
                        </div>
                    ) : (
                        client.isActive && !client.isDeleted && (
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    onClick={(e) => !isDeclared && handleAction(e, 'declare')}
                                    disabled={isDeclared}
                                    className={`group/btn flex-1 sm:flex-none flex items-center justify-center h-11 sm:w-auto sm:px-6 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${
                                        isDeclared 
                                        ? 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-white/5 dark:border-white/5 dark:text-slate-600 opacity-60 cursor-not-allowed' 
                                        : 'bg-slate-900 dark:bg-primary text-white border-transparent hover:scale-105 active:scale-95 shadow-xl shadow-slate-300/50 dark:shadow-primary/20 hover:shadow-primary/30'
                                    }`}
                                >
                                    <LucideIcons.Zap size={16} className={isDeclared ? '' : 'fill-current group-hover/btn:animate-pulse'} />
                                    <span className="ml-2">Declarar SRI</span>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                    className={`flex items-center justify-center h-11 w-14 sm:w-auto sm:px-5 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${
                                        activeDecl?.proof_file 
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500 hover:text-white shadow-lg shadow-emerald-500/10' 
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-primary/50 hover:text-primary dark:hover:text-primary hover:bg-primary/5'
                                    } active:scale-95`}
                                >
                                    {activeDecl?.proof_file ? <LucideIcons.FileCheck size={18} /> : <LucideIcons.UploadCloud size={18} />}
                                    <span className="hidden sm:inline ml-2">{activeDecl?.proof_file ? 'VER COMP.' : 'SUBIR PDF'}</span>
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
});
