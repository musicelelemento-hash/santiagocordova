
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime, Declaration, InternalStatus } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, differenceInCalendarDays, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import { getClientCompliance } from '../../services/complianceEngine';

interface ClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'deactivate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
    onPreview?: (client: Client, declaration: Declaration) => void;
    compact?: boolean;
    variant?: 'tactical' | 'zen' | 'digital';
}

export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, compact = false, variant = 'tactical' }) => {
    const [copied, setCopied] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const today = new Date();
    const compliance = getClientCompliance(client, today);
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

    const theme = !client.isActive && client.isDeleted ? cardThemes.deleted : (isFullyAlDia ? cardThemes.elite : (variant === 'tactical' ? cardThemes.vip : cardThemes.command));
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
                ${isHovered ? 'bg-surface-low border-primary/20 -translate-y-1' : 'bg-surface-lowest border-transparent'}
                shadow-sm border-2
                ${hasWorkOrder ? 'ring-2 ring-primary/30' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-tertiary/30' : ''}
                ${variant === 'zen' ? 'max-h-[140px]' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] ${isFullyAlDia ? 'bg-tertiary' : (isOverdue ? 'bg-primary' : 'bg-surface-low')}`}></div>
            
            <div className={`${compact ? 'p-3' : 'p-4 px-5'} relative z-10 flex flex-col md:flex-row md:items-center h-full justify-between gap-4`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center font-bold text-sm transition-all duration-700 ${isFullyAlDia ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        {/* Zen 3.1 Compliance Dot */}
                        <div 
                            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-lowest shadow-sm z-20 ${
                                compliance.overallColor === 'red' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' :
                                compliance.overallColor === 'orange' ? 'bg-orange-500' :
                                compliance.overallColor === 'yellow' ? 'bg-amber-400' :
                                compliance.overallColor === 'green' ? 'bg-emerald-500' :
                                'bg-slate-300'
                            }`}
                            title={`Salud Fiscal: ${compliance.score}%`}
                        />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-premium font-bold text-base truncate text-on-surface leading-tight" title={client.name}>
                                {client.tradeName || client.name}
                            </h3>
                            {client.hasElderlyDevolucionIva && (
                                <span className="shrink-0 text-[8px] px-1.5 py-0.5 bg-tertiary/20 text-tertiary rounded-md font-bold tracking-widest uppercase font-premium">
                                    Sr
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleCopy} className="flex items-center gap-1.5 transition-all text-on-surface-variant hover:text-primary">
                                <span className="font-mono text-[9px] font-bold tracking-widest">{client.ruc}</span>
                                {copied ? <LucideIcons.Check size={10} className="text-tertiary" /> : <LucideIcons.Copy size={10} className="opacity-30" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status and Actions Group */}
                <div className="flex items-center gap-4 md:gap-6">
                    {/* Tax Indicators - Vertical Sparks */}
                    {!client.isDeleted && variant !== 'digital' && (
                        <div className="flex items-center gap-3 mr-2">
                            {activeDecl && (
                                <div className="flex flex-col items-center">
                                    <span className={`text-[8px] font-bold uppercase tracking-tighter opacity-40 mb-1 ${isPaid ? 'text-tertiary opacity-100' : (isOverdue ? 'text-rose-500 opacity-100' : '')}`}>IVA</span>
                                    <div className={`w-2.5 h-2.5 rounded-full ${isPaid ? 'bg-tertiary' : (isOverdue ? 'bg-rose-500 h-3 w-3 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-surface-low')}`} />
                                </div>
                            )}
                            {needsRenta && (
                                <div className="flex flex-col items-center">
                                    <span className={`text-[8px] font-bold uppercase tracking-tighter opacity-40 mb-1 ${isRentaFullyDone ? 'text-tertiary opacity-100' : ''}`}>REN</span>
                                    <div className={`w-2.5 h-2.5 rounded-full ${isRentaFullyDone ? 'bg-tertiary' : 'bg-surface-low'}`} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Badge - Always visible but more compact */}
                    <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider font-premium ${statusBadge.color.replace('bg-white/5', 'bg-surface-low').replace('border-white/10', 'border-outline-variant/5')}`}>
                        <statusBadge.icon size={11} strokeWidth={2.5} />
                        {statusBadge.text}
                    </div>

                    {/* Actions - Permanently visible buttons, but subtle if not hovered */}
                    {client.isActive && !client.isDeleted && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => !isDeclared && handleAction(e, 'declare')}
                                disabled={isDeclared}
                                className={`flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 rounded-xl border transition-all font-bold text-[10px] uppercase font-premium ${
                                    isDeclared 
                                    ? 'bg-surface-low text-on-surface-variant opacity-40 border-transparent' 
                                    : 'bg-primary text-white border-primary hover:scale-105 active:scale-95 shadow-sm'
                                }`}
                                title="Declarar en SRI"
                            >
                                <LucideIcons.Zap size={14} className={isDeclared ? '' : 'fill-current'} />
                                <span className={compact ? 'hidden' : 'hidden md:inline ml-1.5'}>SRI</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                className={`flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 rounded-xl border transition-all font-bold text-[10px] uppercase font-premium ${
                                    activeDecl?.proof_file 
                                    ? 'bg-tertiary text-white border-tertiary shadow-sm' 
                                    : 'bg-surface-lowest text-on-surface-variant border-outline-variant/20 hover:border-primary hover:text-primary'
                                } active:scale-95`}
                                title={activeDecl?.proof_file ? 'Ver Comprobante' : 'Cargar Comprobante'}
                            >
                                {activeDecl?.proof_file ? <LucideIcons.FileCheck size={14} /> : <LucideIcons.Upload size={14} />}
                                <span className={compact ? 'hidden' : 'hidden md:inline ml-1.5'}>{activeDecl?.proof_file ? 'VER' : 'PDF'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
