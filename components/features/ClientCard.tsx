
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
                ${isHovered ? 'glass-elite -translate-y-1.5' : 'glass-card'}
                ${hasWorkOrder ? 'ring-2 ring-amber-400/50' : ''}
                ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-sky-400/50' : ''}
            `}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
            
            {true && !client.isDeleted && (
                <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-1000 rotate-12">
                    <LucideIcons.Crown size={200} />
                </div>
            )}

            <div className={`${compact ? 'p-4' : 'p-6'} relative z-10 flex flex-col h-full justify-between`}>
                <div className={`flex justify-between items-start ${compact ? 'mb-4' : 'mb-6'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`relative group/avatar`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-medium text-sm transition-all duration-500 ${true && !client.isDeleted ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            {isFullyAlDia && !client.isDeleted && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center"><LucideIcons.Check size={10} className="text-white" /></div>}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-medium tracking-widest uppercase border ${true && !client.isDeleted ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                                    {client.taxProfile?.ivaFrequency || 'Mensual'}
                                </span>
                                {true && !client.isDeleted && <span className="text-[9px] px-2 py-0.5 bg-primary/15 text-primary rounded-lg font-medium tracking-widest border border-primary/20">Activo</span>}
                                {client.hasElderlyDevolucionIva && (
                                    <span className="text-[9px] px-2 py-0.5 bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-lg font-medium tracking-widest flex items-center gap-1">
                                        <LucideIcons.Heart size={8} /> 3ra Edad
                                    </span>
                                )}
                            </div>
                                <h3 className={`font-premium font-medium text-base line-clamp-1 leading-tight text-white`} title={client.name}>
                                    {client.tradeName || client.name}
                                </h3>
                                {client.tradeName && (
                                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate uppercase mt-0.5" title={client.name}>
                                        {client.name}
                                    </p>
                                )}
                            <div className="flex items-center gap-2 mt-1">
                                <button onClick={handleCopy} className={`group/ruc flex items-center gap-2 px-2 py-1 rounded-lg border transition-all ${copied ? 'bg-emerald-400 border-emerald-400 text-white' : 'bg-slate-50/50 dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-sky-400'}`}>
                                    <span className="font-mono text-[10px] font-semibold tracking-widest">{client.ruc}</span>
                                    {copied ? <LucideIcons.Check size={10} strokeWidth={3} /> : <LucideIcons.Copy size={10} className="text-slate-400 group-hover/ruc:text-sky-400" />}
                                </button>
                                {client.declarations && client.declarations.find(d => d.period === currentPeriod && !!d.proof_file) && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onView(client, 'operative'); // Trigger view in operative tab for pdf
                                        }}
                                        className="p-1 px-2.5 bg-sky-400/10 hover:bg-sky-400/20 text-sky-400 rounded-lg border border-sky-400/20 transition-all group/pdf"
                                        title="Ver Comprobante Actual"
                                    >
                                        <LucideIcons.FileText size={10} className="group-hover/pdf:scale-110 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-medium tracking-widest flex items-center gap-2 ${statusBadge.color}`}>
                            <statusBadge.icon size={12} strokeWidth={2} />
                            {statusBadge.text}
                        </div>
                        
                        {/* Fee Dots Removed Phase 4 */}
                    </div>
                </div>

                {!compact && !client.isDeleted && (
                    <div className="flex-1 flex flex-col justify-center px-1 mb-4 mt-2">
                        <div className="flex flex-col gap-2">
                            {activeDecl && (
                                <div className={`flex items-center justify-between p-3 rounded-2xl border ${isPaid ? 'bg-emerald-50 dark:bg-emerald-400/5 border-emerald-100 dark:border-emerald-400/10' : (isOverdue ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5')}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-400' : (isOverdue ? 'bg-rose-400' : 'bg-slate-400')}`}></div>
                                        <span className="text-xs font-semibold tracking-tighter uppercase">IVA {dueDate ? safeFormat(dueDate, 'dd MMM') : 'N/A'}</span>
                                    </div>
                                    <span className={`text-[10px] font-semibold ${isPaid ? 'text-emerald-400' : 'text-slate-400'}`}>{isPaid ? 'CONFIRMED' : 'DUE'}</span>
                                </div>
                            )}
                            {needsRenta && !isRentaFullyDone && (
                                <div className="flex items-center justify-between p-3 rounded-2xl border bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isRentaPaid ? 'bg-emerald-400' : 'bg-violet-500'}`}></div>
                                        <span className="text-xs font-semibold tracking-tighter uppercase">RENTA {rentaPeriod}</span>
                                    </div>
                                    <span className={`text-[10px] font-semibold ${isRentaPaid ? 'text-emerald-400' : 'text-violet-500'}`}>{isRentaPaid ? 'CONFIRMED' : 'PENDING'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50 mt-1 transition-all`}>
                    {!compact && (
                        <div className={`text-[9px] font-semibold uppercase tracking-wider ${textColor} opacity-60`}>
                            {client.taxProfile?.ivaFrequency || 'Sin IVA'}
                        </div>
                    )}
                    
                    {client.isActive && !client.isDeleted && (
                        <div className={`flex gap-1.5 transition-all duration-500 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                            <button
                                onClick={(e) => !isDeclared && handleAction(e, 'declare')}
                                className={`flex items-center justify-center gap-1 rounded-lg transition-all font-medium border px-2.5 py-1.5 text-[10px] ${isDeclared ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-default' : 'bg-white text-slate-400 border-slate-200 hover:bg-blue-100 hover:text-blue-700 active:scale-95'}`}
                            >
                                <LucideIcons.Send size={12} /> {compact ? 'DECLARAR' : 'SRI'}
                            </button>
                            {/* Cobrar Button removed from main list per Phase 4 plan */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onUploadReceipt?.(client, currentPeriod); }}
                                className={`flex items-center justify-center gap-1.5 rounded-xl transition-all font-semibold border px-3 py-1.5 text-[9px] uppercase ${activeDecl?.proof_file ? 'bg-emerald-50 text-emerald-500 border-emerald-200' : 'bg-sky-50 text-sky-500 border-sky-200'} shadow-sm active:scale-95`}
                            >
                                <LucideIcons.UploadCloud size={13} /> {activeDecl?.proof_file ? 'PDF OK' : 'IVA PDF'}
                            </button>

                            {(activeDecl?.proof_file || isRentaDeclared) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const fileToPreview = activeDecl?.proof_file || (needsRenta ? (rentaDecl?.proof_file || undefined) : null);
                                        if (fileToPreview && onPreview && activeDecl) onPreview(client, activeDecl);
                                        else if (fileToPreview) {
                                            const blob = new Blob([Uint8Array.from(atob(fileToPreview.content.split(',')[1] || fileToPreview.content), c => c.charCodeAt(0))], { type: 'application/pdf' });
                                            window.open(URL.createObjectURL(blob), '_blank');
                                        }
                                    }}
                                    className="p-1.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-sky-400/10 transition-all active:scale-90"
                                >
                                    <LucideIcons.Eye size={14} className="text-sky-400" />
                                </button>
                            )}

                            {(isMissingPdf || isRentaMissingPdf) && (
                                <div className="p-1.5 rounded-xl bg-rose-400 text-white border border-rose-400 animate-pulse shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]" title="PDF de declaración faltante">
                                    <LucideIcons.FileWarning size={14} strokeWidth={3} />
                                </div>
                            )}
                        </div>
                    )}

                    {client.isDeleted && isHovered && (
                        <div className="flex gap-1.5 animate-in slide-in-from-right-2">
                            <button
                                onClick={(e) => handleAction(e, 'restore')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 text-white rounded-xl text-[10px] font-semibold hover:bg-emerald-500 active:scale-95"
                            >
                                <LucideIcons.RotateCcw size={12} /> RESTAURAR
                            </button>
                            <button
                                onClick={(e) => handleAction(e, 'purge')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-400 text-white rounded-xl text-[10px] font-semibold hover:bg-rose-500 active:scale-95"
                            >
                                <LucideIcons.Trash2 size={12} /> ELIMINAR
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
