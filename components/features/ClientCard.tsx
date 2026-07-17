
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

    // ── MODO CAMPAÑA vs MODO GLOBAL ──────────────────────────────────
    // Si se especifica un `frequency` (Mensual/Semestral), evaluamos SOLO el periodo
    // actual de esa campaña. Esto evita que meses históricos sin declarar (ej: enero)
    // pinten de rojo a un cliente que ya tiene el mes actual declarado.
    const isCampaignMode = frequency === 'Mensual' || frequency === 'Semestral';

    // Lógica de Estado Multi-período Táctica
    const debtSummary = getClientDebtSummary(client, serviceFees, today);
    const undeclaredSummary = getClientUndeclaredSummary(client, today);

    // Un cliente tiene cobro de IVA pendiente en el periodo actual
    const isPaid = !!activeDecl?.is_paid;
    // Un cliente tiene la declaración de IVA enviada en el periodo actual
    const isDeclared = activeDecl?.status === DeclarationStatus.Enviada || activeDecl?.status === DeclarationStatus.Pagada || !!activeDecl?.proof_file;
    
    const fee = getClientServiceFee(client, serviceFees, currentPeriod);
    const dueDate = getDueDateForPeriod(client, currentPeriod);

    // Cálculos de Tiempo
    const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : null;

    // En modo campaña: isOverdue solo si el PERIODO ACTUAL está vencido y sin declarar
    // En modo global: revisa todo el historial (comportamiento original)
    const isOverdue = isCampaignMode
        ? (!isDeclared && dueDate !== null && differenceInCalendarDays(dueDate, today) < 0)
        : undeclaredSummary.overduePeriodsCount > 0;

    const isUrgent = daysUntilDue !== null && daysUntilDue <= 3 && 
        (isCampaignMode ? !isDeclared : undeclaredSummary.hasPendingObligation);

    // Renta Extra Buttons Logic
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
    const currentYear = today.getFullYear();
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
    const isRentaDeclared = !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;
    const isRentaPaid = !!rentaDecl?.is_paid;
    const isRentaFullyDone = isRentaDeclared && isRentaPaid;

    // En modo campaña mensual/semestral: "Al Día" = periodo actual declarado (y cobrado o sin deuda del periodo)
    // En modo global: revisa todo el historial
    const isFullyPaid = isCampaignMode
        ? (isPaid || !isDeclared) // si el periodo actual está pagado (o no declarado aún, eso no cuenta)
        : !debtSummary.hasPendingPayment && (isRentaPaid || !needsRenta);
    const isFullyDeclared = isCampaignMode
        ? isDeclared  // en campaña, "declarado" = el periodo de campaña está hecho
        : !undeclaredSummary.hasPendingObligation && (isRentaDeclared || !needsRenta);
    
    // Al Día: En modo campaña = el mes/semestre actual está declarado
    //         En modo global  = historial completo limpio
    const isFullyAlDia = isCampaignMode ? isDeclared : (isFullyPaid && isFullyDeclared);

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
                relative rounded-[1.5rem] transition-all duration-500 cursor-pointer overflow-hidden group/card
                bg-white dark:bg-[#020617]
                backdrop-blur-xl border border-slate-100 dark:border-white/5
                ${isHovered ? '-translate-y-1 shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:hover:bg-white/[0.02] dark:border-white/10' : 'shadow-sm shadow-slate-100 dark:shadow-none'}
                ${hasWorkOrder ? 'ring-1 ring-blue-400/30 bg-blue-50/10' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-1 ring-emerald-500/30' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] transition-all duration-700 opacity-90 ${
                isFullyAlDia ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 
                isOverdue ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 
                isUrgent ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                'bg-gradient-to-r from-blue-300 to-blue-500 dark:from-blue-600 dark:to-blue-400'
            }`}></div>
            
            <div className={`p-5 sm:p-6 relative z-10 flex flex-col md:flex-row md:items-center h-full justify-between gap-6`}>
                {/* 1. Identity & Contact Zone */}
                <div className="flex items-start md:items-center gap-5 flex-1 min-w-0 md:border-r border-slate-100 dark:border-white/5 md:pr-6">
                    <div className="relative shrink-0 mt-1 md:mt-0">
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] flex items-center justify-center font-black text-xl sm:text-2xl transition-all duration-700 shadow-inner ${
                            isFullyAlDia ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-200/50' : 
                            isOverdue ? 'bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-200/50' :
                            'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-200/50'
                        }`}>
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Health Ring Indicator */}
                        <div className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-[9px] sm:text-[10px] font-black shadow-sm ${
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
                            <h3 className="font-display font-bold text-lg sm:text-xl truncate text-slate-800 dark:text-slate-100 tracking-tight" title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            <span className="shrink-0 text-[9px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-md font-bold tracking-wider uppercase">
                                {client.regime.replace('RIMPE - ', 'R-').substring(0, 15)}
                            </span>
                            {client.hasElderlyDevolucionIva && (
                                <span className="shrink-0 text-[9px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md font-bold tracking-wider uppercase">
                                    3ra Edad
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                            <button onClick={handleCopy} className="group/copy flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300">
                                <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-wider">{client.ruc}</span>
                                {copied ? <LucideIcons.Check size={12} className="text-emerald-500" /> : <LucideIcons.Copy size={12} className="opacity-0 group-hover/copy:opacity-100 transition-opacity" />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {client.phones && client.phones[0] && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${client.phones![0].replace(/\D/g,'')}`, '_blank'); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-[10px] font-semibold uppercase tracking-wider"
                                >
                                    <LucideIcons.MessageCircle size={12} />
                                    <span>WhatsApp</span>
                                </button>
                            )}
                            {client.email && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${client.email}`; }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-[10px] font-semibold uppercase tracking-wider"
                                >
                                    <LucideIcons.Mail size={12} />
                                    <span>Email</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Intelligence Zone (Obligaciones & Pagos) */}
                <div className="flex flex-col justify-center gap-2.5 flex-1 md:border-r border-slate-100 dark:border-white/5 md:pr-6 py-2 md:py-0">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 hidden md:block">
                        Estado Express
                    </div>
                    
                    {dueDate && !client.isDeleted && client.isActive && (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border w-full sm:w-auto ${
                            isDeclared ? 'bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' :
                            isOverdue ? 'bg-rose-50/50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' :
                            isUrgent ? 'bg-amber-50/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' :
                            'bg-blue-50/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'
                        }`}>
                            <div className="flex items-center gap-2">
                                <LucideIcons.CalendarDays size={14} className="opacity-70" />
                                <span className="text-[11px] font-medium">Próx. Vencimiento</span>
                            </div>
                            <span className="text-[11px] font-bold">{isDeclared ? 'Cumplido' : safeFormat(dueDate, 'dd MMM yyyy')}</span>
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                             <div className="flex items-center gap-2">
                                <LucideIcons.CreditCard size={14} className="text-slate-400" />
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Honorarios</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">${fee.toFixed(2)}/mes</span>
                        </div>

                        {(debtSummary.hasPendingPayment || undeclaredSummary.hasPendingObligation) && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {debtSummary.hasPendingPayment && (
                                    <span className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 transition-all duration-300">
                                        <LucideIcons.DollarSign size={12} strokeWidth={2.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Debe ${debtSummary.totalDebt.toFixed(2)}</span>
                                    </span>
                                )}
                                {undeclaredSummary.hasPendingObligation && (
                                    <span className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 transition-all duration-300">
                                        <LucideIcons.AlertCircle size={12} strokeWidth={2.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Falta SRI ({undeclaredSummary.overduePeriodsCount})</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Action Zone */}
                <div className="flex flex-col items-start sm:items-end justify-center gap-3 flex-shrink-0 w-full md:w-auto">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider w-fit ${statusBadge.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
                        <statusBadge.icon size={12} strokeWidth={2.5} />
                        <span>{statusBadge.text}</span>
                        {daysUntilDue !== null && !isDeclared && !isOverdue && (
                            <span className="ml-1 opacity-60">({daysUntilDue}d)</span>
                        )}
                    </div>

                    {isTrashView ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto mt-2">
                            <button onClick={(e) => handleAction(e, 'restore')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider transition-transform active:scale-95">
                                <LucideIcons.RotateCcw size={14} className="mr-1.5" />
                                Restaurar
                            </button>
                            <button onClick={(e) => handleAction(e, 'purge')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider transition-transform active:scale-95">
                                <LucideIcons.Trash2 size={14} className="mr-1.5" />
                                Eliminar
                            </button>
                        </div>
                    ) : (
                        client.isActive && !client.isDeleted && (
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    onClick={(e) => !isDeclared && handleAction(e, 'declare', currentPeriod)}
                                    disabled={isDeclared}
                                    className={`group/btn flex-1 sm:flex-none flex items-center justify-center h-10 sm:w-auto sm:px-5 rounded-lg border transition-all font-bold text-[10px] uppercase tracking-wider ${
                                        isDeclared 
                                        ? 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-500 opacity-60 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white border-transparent hover:shadow-md hover:shadow-blue-500/20 active:scale-95'
                                    }`}
                                >
                                    <LucideIcons.Zap size={14} className={isDeclared ? '' : 'fill-current'} />
                                    <span className="ml-1.5">Declarar SRI</span>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                    className={`flex items-center justify-center h-10 w-12 sm:w-auto sm:px-4 rounded-lg border transition-all font-bold text-[10px] uppercase tracking-wider ${
                                        activeDecl?.proof_file 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/30' 
                                        : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                                    } active:scale-95`}
                                >
                                    {activeDecl?.proof_file ? <LucideIcons.FileCheck size={16} /> : <LucideIcons.UploadCloud size={16} />}
                                    <span className="hidden sm:inline ml-1.5">{activeDecl?.proof_file ? 'VER COMP.' : 'SUBIR PDF'}</span>
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
});
