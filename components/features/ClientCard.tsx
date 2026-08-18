
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime, Declaration, InternalStatus } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, safeFormat, getWhatsAppUrl, isSriPasswordUpdated } from '../../services/sri';
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
    isCobrosView?: boolean;
}


export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, compact = false, variant = 'tactical', frequency, customPeriod, isTrashView = false, isCobrosView = false }) => {
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
        if (client.requiresDeclarations === false || client.clientType === 'solo_plan') {
            return { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', text: 'Solo Plan / Firma', icon: LucideIcons.Zap };
        }
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
                relative rounded-2xl transition-all duration-500 cursor-pointer overflow-hidden group/card
                bg-white/80 dark:bg-[#051424]/90
                backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 dark:border-t-white/20
                ${isHovered ? '-translate-y-1 shadow-2xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-black/60 dark:border-white/25' : 'shadow-sm shadow-slate-100 dark:shadow-none'}
                ${hasWorkOrder ? 'ring-1 ring-[#2B6AFF]/40 bg-blue-50/10' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-1 ring-emerald-500/40' : ''}
            `}
        >
            {/* Ambient subtle glow */}
            <div className="absolute top-0 left-0 w-48 h-48 bg-[#00A896]/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#2B6AFF]/5 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

            {/* Tonal Accent Top Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] transition-all duration-700 opacity-90 ${
                isCobrosView ? (debtSummary.totalDebt >= fee * 3 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : debtSummary.totalDebt > 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-slate-200 to-slate-300') :
                isFullyAlDia ? 'bg-gradient-to-r from-[#00A896] via-emerald-400 to-teal-300' : 
                isOverdue ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-orange-500' : 
                isUrgent ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500' :
                'bg-gradient-to-r from-[#2B6AFF] via-indigo-400 to-teal-400'
            }`}></div>
            
            <div className={`p-5 sm:p-6 relative z-10 flex flex-col md:flex-row md:items-center h-full justify-between gap-6 ${isCobrosView && debtSummary.totalDebt > 0 ? 'bg-rose-50/10 dark:bg-rose-950/10' : ''}`}>
                {/* 1. Identity & Contact Zone */}
                <div className="flex items-start md:items-center gap-5 flex-1 min-w-0 md:border-r border-slate-100 dark:border-white/10 md:pr-6">
                    <div className="relative shrink-0 mt-1 md:mt-0">
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl transition-all duration-700 border border-white/10 ${
                            isFullyAlDia ? 'bg-gradient-to-br from-[#00A896] to-teal-700 text-white shadow-lg shadow-[#00A896]/20' : 
                            isOverdue ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-500/20' :
                            'bg-gradient-to-br from-[#2B6AFF] to-indigo-700 text-white shadow-lg shadow-[#2B6AFF]/20'
                        }`}>
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Health Ring Indicator */}
                        <div className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white dark:border-[#051424] flex items-center justify-center text-[9px] sm:text-[10px] font-mono font-black shadow-md ${
                                compliance.overallColor === 'green' ? 'bg-[#00A896] text-white shadow-[0_0_8px_#00A896]' :
                                compliance.overallColor === 'red' ? 'bg-rose-500 text-white shadow-[0_0_8px_#f43f5e]' :
                                'bg-amber-400 text-slate-950 shadow-[0_0_8px_#f59e0b]'
                            }`}>
                                {compliance.score}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="font-display font-black text-lg sm:text-xl truncate text-slate-900 dark:text-white tracking-tight group-hover/card:text-[#00A896] transition-colors" title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            <span className="shrink-0 text-[9px] px-2.5 py-0.5 bg-[#2B6AFF]/10 text-[#2B6AFF] dark:text-[#bfc6e0] border border-[#2B6AFF]/20 rounded-full font-mono font-bold tracking-wider uppercase">
                                {client.regime.replace('RIMPE - ', 'R-').substring(0, 15)}
                            </span>
                            {client.hasElderlyDevolucionIva && (
                                <span className="shrink-0 text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-mono font-bold tracking-wider uppercase">
                                    3ra Edad
                                </span>
                            )}
                            {(() => {
                                const statusInfo = isSriPasswordUpdated(client);
                                if (!client.sriPassword) return null;
                                return statusInfo.isUpdated ? (
                                    <span title={statusInfo.tooltip} className="shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]">
                                        <LucideIcons.Key size={10} className="text-[#00A896]" />
                                        <span>{statusInfo.label}</span>
                                    </span>
                                ) : (
                                    <span title={statusInfo.tooltip} className="shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                        <LucideIcons.Key size={10} className="text-amber-500 animate-pulse" />
                                        <span>{statusInfo.label}</span>
                                    </span>
                                );
                            })()}
                            {client.signatureFile ? (() => {
                                const expDate = client.signatureExpirationDate ? new Date(client.signatureExpirationDate) : null;
                                let daysLeft = null;
                                if (expDate) {
                                    const dExp = new Date(expDate);
                                    const dToday = new Date(today);
                                    dExp.setHours(0, 0, 0, 0);
                                    dToday.setHours(0, 0, 0, 0);
                                    daysLeft = Math.ceil((dExp.getTime() - dToday.getTime()) / (1000 * 60 * 60 * 24));
                                }
                                const isNearExpiry = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
                                const isExpired = daysLeft !== null && daysLeft <= 0;

                                return (
                                    <span 
                                        title={client.signatureExpirationDate ? `Firma Electrónica Vence: ${new Date(client.signatureExpirationDate + 'T12:00:00').toLocaleDateString()}` : 'Firma cargada'}
                                        className={`shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border
                                            ${isExpired
                                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                : isNearExpiry
                                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                    : 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_10px_rgba(0,168,150,0.1)]'
                                            }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full
                                            ${isExpired
                                                ? 'bg-rose-500'
                                                : isNearExpiry
                                                    ? 'bg-amber-500 animate-pulse'
                                                    : 'bg-[#00A896] shadow-[0_0_8px_#00A896]'
                                            }`} 
                                        />
                                        <span>{daysLeft !== null ? `${daysLeft}d Firma` : 'Firma .P12'}</span>
                                    </span>
                                );
                            })() : (
                                <span className="shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/5 rounded-full font-mono font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    <span>Sin Firma</span>
                                </span>
                            )}
                        </div>

                        {/* RUC Badge & 9th Digit Semaphore (Stitch Token) */}
                        <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                            <button onClick={handleCopy} className="group/copy flex items-center gap-2 px-2.5 py-1 -ml-1 rounded-lg transition-all bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/50 dark:border-white/10 text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-[#00A896] shadow-[0_0_6px_#00A896]"></span>
                                <span className="font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100">{client.ruc}</span>
                                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 border-l border-slate-300 dark:border-white/10 pl-1.5">
                                    DÍG {client.ruc[8] || '—'}
                                </span>
                                {copied ? <LucideIcons.Check size={12} className="text-emerald-500" /> : <LucideIcons.Copy size={12} className="opacity-40 group-hover/copy:opacity-100 transition-opacity text-slate-400" />}
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onView(client, 'vault'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-all text-[10px] font-mono font-bold uppercase tracking-wider border border-purple-500/20"
                                title="Abrir Bóveda de Claves y Firma"
                            >
                                <LucideIcons.Lock size={12} />
                                <span>Bóveda</span>
                            </button>
                            {client.phones && client.phones.length > 0 && client.phones[0] && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.open(getWhatsAppUrl(client.phones![0]), '_blank'); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00A896]/10 text-[#00A896] hover:bg-[#00A896]/20 transition-all text-[10px] font-mono font-bold uppercase tracking-wider border border-[#00A896]/20"
                                    title="Abrir chat de WhatsApp"
                                >
                                    <LucideIcons.MessageCircle size={12} />
                                    <span>WhatsApp</span>
                                </button>
                            )}
                            {client.email && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${client.email}`; }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-[10px] font-mono font-bold uppercase tracking-wider border border-slate-200 dark:border-white/5"
                                >
                                    <LucideIcons.Mail size={12} />
                                    <span>Email</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Intelligence Zone OR Cobros Zone */}
                {isCobrosView ? (
                    <div className="flex flex-col justify-center gap-1.5 flex-1 md:border-r border-slate-100 dark:border-white/10 md:pr-6 py-2 md:py-0 text-center md:text-left">
                        <div className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                            Resumen Financiero
                        </div>
                        {debtSummary.totalDebt > 0 ? (
                            <>
                                <div className="text-3xl md:text-4xl font-black font-mono text-rose-500 tracking-tighter">
                                    ${debtSummary.totalDebt.toFixed(2)}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider">Honorarios Pendientes:</span>
                                    {debtSummary.unpaidPeriods.slice(0, 3).map(p => (
                                        <span key={p} className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono font-bold uppercase">{formatPeriodForDisplay(p).replace('IVA ', '')}</span>
                                    ))}
                                    {debtSummary.unpaidPeriods.length > 3 && (
                                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono font-bold uppercase">+{debtSummary.unpaidPeriods.length - 3} más</span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-xl font-black font-mono text-[#00A896] flex items-center gap-2">
                                <LucideIcons.ShieldCheck size={24} />
                                SIN DEUDA
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col justify-center gap-2.5 flex-1 md:border-r border-slate-100 dark:border-white/10 md:pr-6 py-2 md:py-0">
                        <div className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 hidden md:block">
                            Estado Express
                        </div>
                    
                    {dueDate && !client.isDeleted && client.isActive && (
                        <div className={`flex items-center justify-between px-3.5 py-2 rounded-xl border w-full sm:w-auto font-mono ${
                            isDeclared ? 'bg-[#00A896]/10 text-[#00A896] border-[#00A896]/20' :
                            isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            isUrgent ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-[#2B6AFF]/10 text-[#2B6AFF] dark:text-[#bfc6e0] border-[#2B6AFF]/20'
                        }`}>
                            <div className="flex items-center gap-2">
                                <LucideIcons.CalendarDays size={14} className="opacity-70" />
                                <span className="text-[11px] font-bold">Próx. Vencimiento</span>
                            </div>
                            <span className="text-[11px] font-black">{isDeclared ? 'Cumplido' : safeFormat(dueDate, 'dd MMM yyyy')}</span>
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 font-mono">
                             <div className="flex items-center gap-2">
                                <LucideIcons.CreditCard size={14} className="text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Honorarios</span>
                            </div>
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">${fee.toFixed(2)}/mes</span>
                        </div>

                        {(debtSummary.hasPendingPayment || undeclaredSummary.hasPendingObligation) && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {debtSummary.hasPendingPayment && (
                                    <span className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono transition-all duration-300">
                                        <LucideIcons.DollarSign size={12} strokeWidth={2.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Debe ${debtSummary.totalDebt.toFixed(2)}</span>
                                    </span>
                                )}
                                {undeclaredSummary.hasPendingObligation && (
                                    <span className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono transition-all duration-300">
                                        <LucideIcons.AlertCircle size={12} strokeWidth={2.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Falta SRI ({undeclaredSummary.overduePeriodsCount})</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* 3. Action Zone */}
                <div className="flex flex-col items-start sm:items-end justify-center gap-3 flex-shrink-0 w-full md:w-auto">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-wider w-fit ${statusBadge.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
                        <statusBadge.icon size={12} strokeWidth={2.5} />
                        <span>{statusBadge.text}</span>
                        {daysUntilDue !== null && !isDeclared && !isOverdue && (
                            <span className="ml-1 opacity-60">({daysUntilDue}d)</span>
                        )}
                    </div>

                    {isTrashView ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto mt-2">
                            <button onClick={(e) => handleAction(e, 'restore')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-xl bg-[#00A896] hover:bg-[#00A896]/90 text-white font-mono font-bold text-[10px] uppercase tracking-wider transition-transform active:scale-95 shadow-md shadow-[#00A896]/20">
                                <LucideIcons.RotateCcw size={14} className="mr-1.5" />
                                Restaurar
                            </button>
                            <button onClick={(e) => handleAction(e, 'purge')} className="flex-1 sm:flex-none flex items-center justify-center h-10 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-mono font-bold text-[10px] uppercase tracking-wider transition-transform active:scale-95 shadow-md shadow-rose-500/20">
                                <LucideIcons.Trash2 size={14} className="mr-1.5" />
                                Eliminar
                            </button>
                        </div>
                    ) : isCobrosView ? (
                        <div className="flex flex-col gap-2 w-full mt-2 sm:mt-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const msg = encodeURIComponent(`Estimado/a ${client.tradeName || client.name}, le recordamos cordialmente que tiene un saldo pendiente de $${debtSummary.totalDebt.toFixed(2)} correspondiente a sus honorarios contables. Agradecemos su pronto pago.`);
                                    const phone = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                    if (phone) {
                                        window.open(`https://wa.me/593${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`, '_blank');
                                    } else {
                                        alert('El cliente no tiene teléfono registrado.');
                                    }
                                }}
                                disabled={debtSummary.totalDebt === 0}
                                className={`flex items-center justify-center gap-2 h-10 w-full px-4 rounded-xl font-mono font-bold text-[10px] uppercase tracking-wider transition-all ${debtSummary.totalDebt > 0 ? 'bg-[#C9A96E] hover:bg-amber-600 text-slate-950 shadow-md active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'}`}
                            >
                                <LucideIcons.MessageCircle size={14} />
                                Recordatorio Amistoso
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const msg = encodeURIComponent(`Aviso Urgente: Estimado/a ${client.tradeName || client.name}, sus servicios contables y declaraciones al SRI se encuentran suspendidos debido a un saldo pendiente de $${debtSummary.totalDebt.toFixed(2)}. Por favor regularizar su pago de inmediato.`);
                                    const phone = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                    if (phone) {
                                        window.open(`https://wa.me/593${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`, '_blank');
                                    } else {
                                        alert('El cliente no tiene teléfono registrado.');
                                    }
                                }}
                                disabled={debtSummary.totalDebt === 0}
                                className={`flex items-center justify-center gap-2 h-10 w-full px-4 rounded-xl font-mono font-bold text-[10px] uppercase tracking-wider transition-all ${debtSummary.totalDebt > 0 ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'}`}
                            >
                                <LucideIcons.AlertTriangle size={14} />
                                Notificación Suspensión
                            </button>
                        </div>
                    ) : (
                        client.isActive && !client.isDeleted && (
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    onClick={(e) => !isDeclared && handleAction(e, 'declare', currentPeriod)}
                                    disabled={isDeclared}
                                    className={`group/btn flex-1 sm:flex-none flex items-center justify-center h-10 sm:w-auto sm:px-5 rounded-xl border transition-all font-mono font-bold text-[10px] uppercase tracking-wider ${
                                        isDeclared 
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-500 opacity-60 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-[#2B6AFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-transparent shadow-md shadow-[#2B6AFF]/20 hover:shadow-lg hover:shadow-[#2B6AFF]/30 active:scale-95'
                                    }`}
                                >
                                    <LucideIcons.Zap size={14} className={isDeclared ? '' : 'fill-current'} />
                                    <span className="ml-1.5">Declarar SRI</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (activeDecl?.proof_file && onPreview) {
                                            onPreview(client, activeDecl);
                                        } else {
                                            onUploadReceipt?.(client, currentPeriod);
                                        }
                                    }}
                                    className={`flex items-center justify-center h-10 w-12 sm:w-auto sm:px-4 rounded-xl border transition-all font-mono font-bold text-[10px] uppercase tracking-wider ${
                                        activeDecl?.proof_file 
                                        ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 hover:bg-[#00A896]/25 shadow-sm' 
                                        : 'bg-slate-100 dark:bg-white/5 text-[#2B6AFF] dark:text-[#bfc6e0] border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                                    } active:scale-95 cursor-pointer`}
                                    title={activeDecl?.proof_file ? "Visualizar comprobante PDF de la declaración" : "Subir comprobante PDF"}
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
