
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime, Declaration } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, differenceInCalendarDays, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';

interface ClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'deactivate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
    onPreview?: (client: Client, declaration: Declaration) => void;
    compact?: boolean;
}

export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, compact = false }) => {
    const [copied, setCopied] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const today = new Date();
    const currentPeriod = getPeriod(client, today);
    const activeDecl = client.declarations.find(d => d.period === currentPeriod);

    // Lógica de Estado
    const isPaid = !!activeDecl?.is_paid;
    const isDeclared = !!activeDecl?.proof_file || activeDecl?.status === DeclarationStatus.Enviada;
    const fee = getClientServiceFee(client, serviceFees);
    const isVip = true;
    const dueDate = getDueDateForPeriod(client, currentPeriod);

    // Cálculos de Tiempo
    const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : 99;
    const isOverdue = dueDate && isPast(dueDate) && !isDeclared;
    const isUrgent = daysUntilDue <= 3 && !isDeclared;

    // Renta Extra Buttons Logic
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const rentaStartMonth = serviceFees.rentaButtonsStartMonth || 1;
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);

    // For annual income in year Y, the period name is Y-1. E.g. in 2025 declaring 2024.
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
    const isRentaDeclared = !!rentaDecl?.proof_file || false || rentaDecl?.status === DeclarationStatus.Enviada;
    const isRentaPaid = false || !!rentaDecl?.is_paid;
    const isRentaFullyDone = isRentaDeclared && isRentaPaid;
    const showRentaExtraButtons = !compact && needsRenta && currentMonth >= rentaStartMonth;

    const isFullyPaid = isPaid && (isRentaPaid || !needsRenta);
    const isFullyDeclared = isDeclared && (isRentaDeclared || !needsRenta);
    const isFullyAlDia = isFullyPaid && isFullyDeclared;

    // ORDEN DE TRABAJO (Prioridad)
    const hasWorkOrder = (client.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente);

    // REFRESH PULSE LOGIC (Discrete Heartbeat)
    const isRefundAlertActive = 
        (client.rentaRefundStatus === 'Solicitado' && client.rentaRefundRequestedAt && differenceInHours(today, new Date(client.rentaRefundRequestedAt)) >= 6) ||
        (client.rentaRefundStatus === 'Esperando Confirmación');

    // Elite Tactical Design System
    const cardThemes = {
        elite: {
            bg: 'bg-emerald-50/50 dark:bg-emerald-400/5',
            border: 'border-emerald-200/50 dark:border-emerald-400/20',
            glow: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
            icon: 'text-emerald-400',
            text: 'text-emerald-700 dark:text-emerald-400',
            title: 'text-slate-800 dark:text-emerald-400'
        },
        vip: {
            bg: 'bg-gradient-to-br from-[#0B2149] to-[#122A5A] text-white outline outline-amber-400/20',
            border: 'border-amber-400/30',
            glow: 'shadow-[0_0_25px_rgba(245,158,11,0.15)]',
            icon: 'text-amber-400',
            text: 'text-slate-200',
            title: 'text-white'
        },
        alert: {
            bg: 'bg-rose-50/50 dark:bg-rose-900/10',
            border: 'border-rose-200/50 dark:border-rose-400/20',
            glow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]',
            icon: 'text-rose-400',
            text: 'text-rose-700 dark:text-rose-400',
            title: 'text-slate-900 dark:text-rose-300'
        },
        command: {
            bg: 'bg-white dark:bg-slate-900',
            border: 'border-slate-200 dark:border-white/5',
            glow: 'shadow-sm',
            icon: 'text-sky-400',
            text: 'text-slate-500 dark:text-slate-400',
            title: 'text-slate-800 dark:text-white'
        },
        deleted: {
            bg: 'bg-slate-50 opacity-60 grayscale',
            border: 'border-slate-200 border-dashed',
            glow: 'shadow-none',
            icon: 'text-slate-400',
            text: 'text-slate-400',
            title: 'text-slate-500'
        }
    };

    const theme = !client.isActive && client.isDeleted ? cardThemes.deleted : (isFullyAlDia ? cardThemes.elite : (true ? cardThemes.vip : (isOverdue ? cardThemes.alert : cardThemes.command)));
    const titleColor = theme.title;
    const textColor = theme.text;

    // Indicador de Estado (Semáforo Táctico)
    let statusBadge = { color: 'bg-white/5 text-slate-500 border-white/10', text: 'Pendiente', icon: LucideIcons.Clock };
    if (client.isDeleted) statusBadge = { color: 'bg-white/5 text-slate-500 border-white/10', text: 'Archivado', icon: LucideIcons.Trash2 };
    else if (!client.isActive) statusBadge = { color: 'bg-white/5 text-slate-400 border-white/5', text: 'Inactivo', icon: LucideIcons.Lock };
    else if (isFullyAlDia) statusBadge = { color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', text: 'Al Día', icon: LucideIcons.ShieldCheck };
    else if (hasWorkOrder) statusBadge = { color: 'bg-primary/10 text-primary border-primary/20', text: 'En Proceso', icon: LucideIcons.Zap };
    else if (isOverdue) statusBadge = { color: 'bg-rose-400/10 text-rose-400 border-rose-400/20', text: 'Vencido', icon: LucideIcons.AlertTriangle };
    else if (isDeclared && !isPaid) statusBadge = { color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', text: 'Por Cobrar', icon: LucideIcons.Timer };
    else if (isUrgent) statusBadge = { color: 'bg-amber-400/10 text-amber-400 border-amber-400/20', text: 'Vence Pronto', icon: LucideIcons.Timer };

    // ALERTA DE PDF FALTANTE
    const isMissingPdf = isDeclared && !activeDecl?.proof_file;
    const isRentaMissingPdf = isRentaDeclared && !rentaDecl?.proof_file;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAction = (e: React.MouseEvent, action: 'declare' | 'pay' | 'restore' | 'purge', customPeriod?: string) => {
        e.stopPropagation();
        if (onQuickAction) onQuickAction(client, action, customPeriod);
    };

    const handleWhatsAppPayment = (e: React.MouseEvent, periodType: 'IVA' | 'Renta') => {
        e.stopPropagation();
        if (!client.phones?.length) return;
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        const periodLabel = periodType === 'IVA' ? formatPeriodForDisplay(currentPeriod) : formatPeriodForDisplay(rentaPeriod);
        const message = `Hola ${client.name}, le saludamos de Soluciones Contables Pro. Le recordamos que tiene pendiente el pago de sus honorarios por la declaración de ${periodLabel}. ¿Nos podría ayudar con la transferencia? ¡Gracias!`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };


    return (
        <div
            onClick={() => onView(client)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                relative rounded-[2rem] transition-all duration-500 cursor-pointer overflow-hidden group
                ${isHovered ? 'bg-surface-low -translate-y-1.5' : 'bg-surface-lowest'}
                shadow-architect border-0
                ${hasWorkOrder ? 'ring-2 ring-primary/30' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-tertiary/30' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] ${isFullyAlDia ? 'bg-tertiary' : (isOverdue ? 'bg-primary' : 'bg-surface-low')}`}></div>
            
            <div className={`${compact ? 'p-5' : 'p-8'} relative z-10 flex flex-col h-full justify-between`}>
                <div className={`flex justify-between items-start ${compact ? 'mb-4' : 'mb-8'}`}>
                    <div className="flex items-center gap-5">
                        <div className={`relative`}>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-700 ${isFullyAlDia ? 'bg-tertiary/5 text-tertiary' : 'bg-primary/5 text-primary'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            {isFullyAlDia && !client.isDeleted && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-tertiary rounded-full border-[3px] border-surface-lowest flex items-center justify-center">
                                    <LucideIcons.Check size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-premium font-bold text-lg line-clamp-1 leading-tight text-on-surface`} title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                                <button onClick={handleCopy} className={`flex items-center gap-2 transition-all text-on-surface-variant hover:text-primary`}>
                                    <span className="font-mono text-[10px] font-bold tracking-[0.2em]">{client.ruc}</span>
                                    {copied ? <LucideIcons.Check size={10} className="text-tertiary" /> : <LucideIcons.Copy size={10} className="opacity-40" />}
                                </button>
                                {client.hasElderlyDevolucionIva && (
                                    <span className="text-[9px] px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-md font-bold tracking-[0.1em] flex items-center gap-1 uppercase font-premium">
                                        <LucideIcons.Heart size={8} /> Senior
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className={`px-4 py-1.5 rounded-xl border-0 text-[10px] font-bold tracking-[0.15em] flex items-center gap-2 uppercase font-premium ${statusBadge.color.replace('border-white/10', '').replace('bg-white/5', 'bg-surface-low')}`}>
                            <statusBadge.icon size={12} strokeWidth={2.5} />
                            {statusBadge.text}
                        </div>
                    </div>
                </div>

                {!compact && !client.isDeleted && (
                    <div className="flex-1 flex flex-col justify-center px-1 mb-6">
                        <div className="grid grid-cols-2 gap-3">
                            {activeDecl && (
                                <div className={`flex flex-col p-4 rounded-[1.5rem] ${isPaid ? 'bg-tertiary/5' : (isOverdue ? 'bg-primary/5' : 'bg-surface-low')} transition-colors`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isPaid ? 'text-tertiary' : (isOverdue ? 'text-primary' : 'text-on-surface-variant')}`}>Ciclo IVA</span>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-on-surface uppercase tracking-tight font-premium">{dueDate ? safeFormat(dueDate, 'dd MMM') : 'N/A'}</span>
                                        <LucideIcons.ChevronRight size={14} className="opacity-20" />
                                    </div>
                                </div>
                            )}
                            {needsRenta && (
                                <div className={`flex flex-col p-4 rounded-[1.5rem] ${isRentaFullyDone ? 'bg-tertiary/5' : 'bg-surface-low'} transition-colors`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isRentaFullyDone ? 'text-tertiary' : 'text-on-surface-variant'}`}>Ciclo Anual</span>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-on-surface uppercase tracking-tight font-premium">{rentaPeriod}</span>
                                        <LucideIcons.ChevronRight size={14} className="opacity-20" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`flex items-center justify-between pt-5 border-t border-outline-variant/10 mt-1`}>
                    {!compact && (
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant font-premium">
                            Intel Matrix Enabled
                        </div>
                    )}
                    
                    {client.isActive && !client.isDeleted && (
                        <div className={`flex gap-2.5 transition-all duration-500 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                            <button
                                onClick={(e) => !isDeclared && handleAction(e, 'declare')}
                                className={`flex items-center justify-center gap-2 rounded-xl transition-all font-bold border-0 px-4 py-2 text-[10px] uppercase font-premium ${isDeclared ? 'bg-surface-low text-on-surface-variant opacity-50' : 'bg-primary text-white hover:bg-primary/90 shadow-sm active:scale-95'}`}
                            >
                                <LucideIcons.Zap size={14} /> {compact ? 'ACT' : 'ACT EN SRI'}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                className={`flex items-center justify-center gap-2 rounded-xl transition-all font-bold border-0 px-4 py-2 text-[10px] uppercase font-premium ${activeDecl?.proof_file ? 'bg-tertiary text-white shadow-sm' : 'bg-surface-low text-on-surface-variant hover:text-primary'} active:scale-95`}
                            >
                                <LucideIcons.UploadCloud size={14} /> {activeDecl?.proof_file ? 'VER PDF' : 'CARGAR PDF'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
