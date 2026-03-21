
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, getYear, differenceInCalendarDays } from 'date-fns';
import { Crown, MessageCircle, Copy, ArrowRight, AlertTriangle, CheckCircle, Clock, ShieldCheck, Calendar, Star, Send, TrendingUp, Store, DollarSign, Coins, Zap, Sparkles, Paperclip, UserX } from 'lucide-react';

interface VipClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onClick: () => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'deactivate', period?: string) => void;
}

export const VipClientCard: React.FC<VipClientCardProps> = memo(({ client, serviceFees, onClick, onQuickAction }) => {
    const [copied, setCopied] = React.useState(false);
    const currentPeriod = getPeriod(client, new Date());
    const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
    const fee = getClientServiceFee(client, serviceFees);

    // Check if VIP (Subscription)
    const isVip = !!client.isVip;

    // Determine Status Logic
    // Determine Status Logic
    const isPaid = !!declaration?.isPaid;

    // Renta Logic for fully paid check
    const currentYear = getYear(new Date());
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = client.declarationHistory.find(d => d.period === rentaPeriod);
    const isRentaDeclared = !!rentaDecl?.proofFile || !!client.annualRentaProof || rentaDecl?.status === DeclarationStatus.Enviada;
    const isRentaPaid = !!client.annualRentaPaid || !!rentaDecl?.isPaid;
    const isRentaFullyDone = isRentaDeclared && isRentaPaid;

    // ICE & PVP Logic
    const icePeriod = `${currentPeriod}:ICE`;
    const iceAnexoPeriod = `${currentPeriod}:ANEXO_ICE`;
    const pvpPeriod = `${currentYear}:PVP`;

    const iceDecl = client.declarationHistory.find(d => d.period === icePeriod);
    const iceAnexoDecl = client.declarationHistory.find(d => d.period === iceAnexoPeriod);
    const pvpDecl = client.declarationHistory.find(d => d.period === pvpPeriod);

    const isIceDeclared = !!iceDecl?.proofFile || iceDecl?.status === DeclarationStatus.Enviada;
    const isIcePaid = !!iceDecl?.isPaid || !!client.iceDeclarationPaid;
    
    const isIceAnexoDone = !!iceAnexoDecl?.proofFile || iceAnexoDecl?.status === DeclarationStatus.Enviada || !!client.iceAnexoPaid;
    const isPvpDone = !!pvpDecl?.proofFile || pvpDecl?.status === DeclarationStatus.Enviada || !!client.anexoPvpPaid;

    const isIcePending = client.taxProfile?.requiresIce && (!isIceDeclared || !isIcePaid || !isIceAnexoDone);
    const isPvpPending = client.taxProfile?.requiresAnexoPvp && !isPvpDone;

    const isFullyPaid = (isPaid || !declaration) && (isRentaPaid || !needsRenta) && (!client.taxProfile?.requiresIce || (isIcePaid && isIceAnexoDone)) && !isPvpPending;
    const isFullyAlDia = isFullyPaid && (declaration?.status === DeclarationStatus.Enviada || !!declaration?.proofFile || !declaration) && (isRentaDeclared || !needsRenta) && (!client.taxProfile?.requiresIce || (isIceDeclared && isIceAnexoDone)) && (!client.taxProfile?.requiresAnexoPvp || isPvpDone);

    let status = declaration?.status || DeclarationStatus.Pendiente;
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const isOverdue = dueDate && isPast(dueDate) && !isPaid;

    // Main Display Name Logic
    const mainName = client.tradeName || client.name;
    const subName = client.tradeName ? client.name : null;

    // ORDEN DE TRABAJO (Prioridad)
    const hasWorkOrder = (client.declarationHistory || []).some(d => d.isPaid && d.status === DeclarationStatus.Pendiente) ||
        (client.annualRentaPaid && client.annualRentaStatus === DeclarationStatus.Pendiente) ||
        (client.iceAnexoPaid && client.iceAnexoStatus === DeclarationStatus.Pendiente) ||
        (client.iceDeclarationPaid && client.iceDeclarationStatus === DeclarationStatus.Pendiente) ||
        (client.anexoPvpPaid && client.anexoPvpStatus === DeclarationStatus.Pendiente);

    // Status Styles Configuration
    const getStatusConfig = (currentStatus: string, overdue: boolean, paid: boolean, fullyPaid: boolean) => {
        const isIcePending = client.taxProfile?.requiresIce && (!client.iceAnexoPaid || !client.iceDeclarationPaid);
        const isPvpPending = client.taxProfile?.requiresAnexoPvp && !client.anexoPvpPaid;

        if (fullyPaid && (paid || isRentaPaid) && !isIcePending && !isPvpPending) {
            return { color: 'text-white bg-emerald-600 border-emerald-700 shadow-xl scale-105', icon: CheckCircle, text: 'OBJETIVO CUMPLIDO' };
        }
        if (hasWorkOrder) {
            return { color: 'text-white bg-amber-500 border-amber-600 shadow-xl animate-pulse', icon: Zap, text: 'ORDEN DE TRABAJO' };
        }
        if (paid && !isRentaPaid && needsRenta) {
            return { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock, text: 'Pendiente Renta' };
        }
        if (isIcePending || isPvpPending) {
            return { color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: AlertTriangle, text: 'Pendiente Otros' };
        }
        if (paid) {
            return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck, text: 'Cuota Al Día' };
        }
        if (currentStatus === DeclarationStatus.Enviada || !!declaration?.proofFile) {
            return { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Send, text: 'Declarado' };
        }
        if (overdue) {
            return { color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, text: 'Vencido IVA' };
        }
        return { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock, text: 'Pendiente' };
    };

    const statusConfig = getStatusConfig(status, isOverdue || false, isPaid, isFullyPaid);
    const StatusIcon = statusConfig.icon;

    const handleCopyRuc = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!client.phones?.length) return;

        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        const message = `Estimado/a ${client.name}, le saludamos de Santiago Cordova. Estado actual: ${statusConfig.text} (${formatPeriodForDisplay(currentPeriod)}).`;

        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleWhatsAppPayment = (e: React.MouseEvent, periodType: 'IVA' | 'Renta') => {
        e.stopPropagation();
        if (!client.phones?.length) return;
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        const periodLabel = periodType === 'IVA' ? formatPeriodForDisplay(currentPeriod) : formatPeriodForDisplay(rentaPeriod);
        const message = `Hola ${client.name}, le saludamos de Santiago Cordova. Le recordamos que tiene pendiente el pago de sus honorarios por la declaración de ${periodLabel}. ¿Nos podría ayudar con la transferencia? ¡Gracias!`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleDetailsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick();
    };

    // --- CARA 2: RIMPE NEGOCIO POPULAR (Estacional/Anual) ---
    if (client.regime === TaxRegime.RimpeNegocioPopular) {
        const year = getYear(new Date());
        const fiscalPeriod = `${year - 1}`;
        const annualDecl = client.declarationHistory.find(d => d.period === fiscalPeriod);
        const isAnnualDone = annualDecl?.status === DeclarationStatus.Enviada || annualDecl?.status === DeclarationStatus.Pagada || !!annualDecl?.proofFile || !!client.annualRentaProof;
        const isAnnualPaid = !!client.annualRentaPaid || !!annualDecl?.isPaid;

        return (
            <div
                onClick={onClick}
                className={`relative group overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border ${hasWorkOrder ? 'border-amber-500 ring-4 ring-amber-400/50 animate-pulse-subtle' : 'border-purple-200 dark:border-purple-900/50'} shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
            >
                {/* Purple Accent for Popular */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500"></div>
                {hasWorkOrder && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl shadow-lg z-20 flex items-center gap-1">
                        <Sparkles size={8} className="animate-spin-slow" /> DINERO EN MANO
                    </div>
                )}
                
                <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`¿Desactivar a ${client.name}?`)) onQuickAction?.(client, 'deactivate'); }}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white z-30"
                    title="Desactivar Cliente"
                >
                    <UserX size={14} />
                </button>

                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 flex items-center justify-center font-display font-bold text-lg shadow-sm">
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-1">{mainName}</h3>
                                {subName && <p className="text-[10px] text-slate-400 font-medium truncate">{subName}</p>}
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Star size={10} className="text-purple-500" fill="currentColor" />
                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                                        Negocio Popular
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-1.5 rounded-lg text-purple-600">
                            <TrendingUp size={18} />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Renta {year - 1}</p>
                            <div className="flex items-center gap-2">
                                {isAnnualDone ? (
                                    <span className={`flex items-center ${isAnnualPaid ? 'text-emerald-600' : 'text-blue-600'} font-bold text-xs`}>
                                        <CheckCircle size={14} className="mr-1" /> {isAnnualPaid ? 'Listo' : 'Declarado'}
                                    </span>
                                ) : (
                                    <span className="flex items-center text-slate-600 dark:text-slate-300 font-bold text-xs"><Calendar size={14} className="mr-1" /> Mayo</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Cuota</p>
                            <p className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400">$60.00</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CARA 2.1: SEMESTRAL (Bloques Semestrales) ---
    if (client.taxProfile?.ivaFrequency === 'Semestral') {
        const currentYear = getYear(new Date());
        const sem1Period = `${currentYear}-S1`;
        const sem2Period = `${currentYear}-S2`;
        const s1Decl = client.declarationHistory.find(d => d.period === sem1Period);
        const s2Decl = client.declarationHistory.find(d => d.period === sem2Period);

        const getSemStyle = (decl?: any) => {
            if (decl?.isPaid) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            if (decl?.status === DeclarationStatus.Enviada) return 'bg-blue-100 text-blue-700 border-blue-200';
            return 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
        }

        const containerClass = isVip
            ? "border-amber-300 dark:border-amber-700/50 shadow-md hover:shadow-amber-500/20"
            : "border-slate-200 dark:border-slate-700 hover:border-sky-300";

        return (
            <div
                onClick={onClick}
                className={`relative group overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border ${containerClass} ${hasWorkOrder ? 'border-amber-500 ring-4 ring-amber-400/50 animate-pulse-subtle' : ''} transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
            >
                {/* Accent Line */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isVip ? 'from-amber-300 via-yellow-400 to-amber-500' : 'from-sky-400 to-blue-500'}`}></div>
                {hasWorkOrder && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl shadow-lg z-20 flex items-center gap-1">
                        <Sparkles size={8} className="animate-spin-slow" /> DINERO EN MANO
                    </div>
                )}

                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg shadow-sm ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-1">{mainName}</h3>
                                {subName && <p className="text-[10px] text-slate-400 font-medium truncate">{subName}</p>}
                                <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
                                    <span className="font-bold text-[9px] border border-sky-400/20 text-sky-600 px-1 rounded bg-sky-400/5">
                                        {client.regime} • Semestral
                                    </span>
                                    {client.taxProfile?.requiresAnnualRenta && <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Renta</span>}
                                    {client.taxProfile?.requiresAnexosGastos && <span className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Anexo</span>}
                                    {client.taxProfile?.hasActiveDevolucionIva && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Devolución</span>}
                                </div>
                                {isVip && (
                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                        <Crown size={10} fill="currentColor" /> VIP Semestral
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex flex-col items-center ${statusConfig.color}`}>
                            <StatusIcon size={12} className="mb-0.5" />
                            {statusConfig.text}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className={`rounded-lg p-2 border flex flex-col items-center justify-center ${getSemStyle(s1Decl)}`}>
                            <span className="text-[9px] font-bold uppercase tracking-wide">Ene - Jun</span>
                            <span className="text-xs font-bold">{s1Decl?.status === 'Pagada' ? 'Al Día' : (s1Decl?.status || '-')}</span>
                        </div>
                        <div className={`rounded-lg p-2 border flex flex-col items-center justify-center ${getSemStyle(s2Decl)}`}>
                            <span className="text-[9px] font-bold uppercase tracking-wide">Jul - Dic</span>
                            <span className="text-xs font-bold">{s2Decl?.status === 'Pagada' ? 'Al Día' : (s2Decl?.status || '-')}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CARA 1: VIP / MENSUAL (Default) ---
    // Premium Design Logic
    const containerClasses = isVip
        ? `${hasWorkOrder ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-amber-500/30 animate-pulse-subtle' : 'border-amber-300 dark:border-amber-700/50'} shadow-md hover:shadow-amber-500/20 bg-gradient-to-b from-white to-amber-50/20 dark:from-slate-800 dark:to-slate-900`
        : `${hasWorkOrder ? 'border-amber-500 ring-4 ring-amber-400/50 animate-pulse-subtle' : 'border-slate-200 dark:border-slate-700'} hover:border-brand-teal/50 bg-white dark:bg-slate-800`;

    const topAccent = isVip
        ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 h-1.5"
        : `${hasWorkOrder ? 'bg-amber-500' : 'bg-brand-navy'} h-1`;

    return (
        <div
            onClick={onClick}
            className={`relative group overflow-hidden rounded-2xl border ${containerClasses} transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
        >
            {/* Top Accent Line */}
            <div className={`absolute top-0 left-0 w-full ${topAccent}`}></div>
            {hasWorkOrder && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl shadow-lg z-20 flex items-center gap-1">
                    <Sparkles size={8} className="animate-spin-slow" /> DINERO EN MANO
                </div>
            )}

            <div className="p-5">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg shadow-sm ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            {isVip && (
                                <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white p-1 rounded-full shadow-sm border-2 border-white dark:border-slate-800">
                                    <Crown size={10} fill="currentColor" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-1 text-base flex items-center gap-1.5">
                                {mainName}
                                {needsRenta && isRentaFullyDone && (
                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20" title={`Renta ${rentaPeriod} al día`}>
                                        <ShieldCheck size={10} />
                                        <span className="text-[8px] font-black">{rentaPeriod}</span>
                                    </div>
                                )}
                                {client.tradeName && <Store size={12} className="text-slate-400" />}
                            </h3>
                            {subName && <p className="text-[10px] text-slate-400 font-medium truncate mb-0.5">{subName}</p>}
                            <div className="flex flex-wrap gap-1 mb-1 mt-0.5">
                                <span className="font-bold text-[9px] border border-brand-teal/20 text-brand-teal px-1 rounded bg-brand-teal/5">
                                    {client.regime} • {(client.regime === TaxRegime.RimpeEmprendedor || (client.taxProfile?.ivaFrequency as string) === 'Semestral') ? 'Sem. (E/J)' : 'Mensual'}
                                </span>
                                {client.taxProfile?.requiresAnnualRenta && <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Renta</span>}
                                {client.taxProfile?.requiresAnexosGastos && <span className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Anexo</span>}
                                {client.taxProfile?.requiresIce && <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">ICE</span>}
                                {client.taxProfile?.requiresAnexoPvp && <span className="bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">PVP</span>}
                                {client.taxProfile?.hasActiveDevolucionIva && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Devolución</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyRuc}
                                    className={`group/ruc flex items-center gap-2 px-2 py-1 rounded-xl border transition-all shadow-sm relative overflow-hidden ${copied ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:shadow-md hover:translate-y-[-1px] active:scale-95'}`}
                                    title="Copiar RUC al portapapeles"
                                >
                                    <span className={`font-mono text-[10px] font-black tracking-widest ${copied ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {client.ruc}
                                    </span>
                                    {copied ? (
                                        <CheckCircle size={12} strokeWidth={3} className="animate-in zoom-in duration-300" />
                                    ) : (
                                        <Copy size={12} className="text-slate-400 group-hover/ruc:text-amber-500 transition-all duration-300" />
                                    )}
                                    {copied && <div className="absolute inset-0 bg-white/20 animate-fade-out pointer-events-none"></div>}
                                </button>
                                {client.rucCertificate && (
                                    <div className="flex items-center text-brand-teal" title="Certificado RUC Validado">
                                        <ShieldCheck size={12} strokeWidth={3} />
                                    </div>
                                )}
                                {client.rucPdf && !client.rucCertificate && (
                                    <div className="flex items-center text-slate-400" title="PDF de RUC disponible">
                                        <Paperclip size={12} className="rotate-45" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border flex flex-col items-center justify-center min-w-[70px] ${statusConfig.color}`}>
                        <StatusIcon size={14} className="mb-0.5" />
                        {statusConfig.text}
                    </div>
                </div>

                {/* Info Grid - Analysis */}
                <div className="flex-1 flex flex-col">
                    {isFullyPaid ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 mb-4 relative overflow-hidden group/vip-success">
                            <div className="absolute top-0 right-0 p-2 opacity-20 transform translate-x-2 -translate-y-2 group-hover/vip-success:translate-x-0 group-hover/vip-success:translate-y-0 transition-transform duration-1000">
                                <Star size={40} className="text-amber-400 fill-amber-400" />
                            </div>
                            <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
                                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 shadow-lg border-2 border-emerald-100 dark:border-emerald-500/20">
                                    <ShieldCheck size={28} className="text-emerald-500" />
                                </div>
                                <h4 className="text-emerald-800 dark:text-emerald-300 font-black text-xs uppercase tracking-[0.2em] mb-1">Estatus Premium</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-4 italic">"Excelencia en cumplimiento tributario"</p>

                                <div className="py-1.5 px-4 bg-emerald-500 text-white rounded-full shadow-md flex items-center gap-2 border border-emerald-400">
                                    <Clock size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-50">
                                        Próximo Hito: {dueDate ? safeFormat(dueDate, 'dd MMM') : 'Por definir'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 mb-4 space-y-2 border border-slate-100 dark:border-slate-700/50">
                            {/* IVA Info Cluster - Refined to focus on declared status */}
                            <div className={`flex flex-col gap-1 p-2 rounded-lg border ${declaration?.status === DeclarationStatus.Enviada || !!declaration?.proofFile ? 'bg-emerald-50/30 border-emerald-100/30' : 'bg-white/50 border-white/20'}`}>
                                <div className="flex justify-between items-center text-[10px]">
                                    <p className="text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${declaration?.status === DeclarationStatus.Enviada || !!declaration?.proofFile ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></div>
                                        IVA {formatPeriodForDisplay(currentPeriod)}
                                    </p>
                                    <p className={`font-black ${declaration?.status === DeclarationStatus.Enviada || !!declaration?.proofFile ? 'text-emerald-500' : 'text-slate-500'}`}>{declaration?.status === DeclarationStatus.Enviada || !!declaration?.proofFile ? 'DECLARADO' : 'PENDIENTE'}</p>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <p className="font-bold text-slate-400">Vence:</p>
                                    <p className={`font-black ${!declaration && isOverdue ? 'text-red-500' : 'text-slate-600'}`}>
                                        {dueDate ? safeFormat(dueDate, 'dd MMM') : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <div className="flex-1 flex gap-1">
                        <button
                            onClick={handleWhatsApp}
                            className="flex-1 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <MessageCircle size={14} /> WhatsApp
                        </button>
                    </div>
                    <button
                        onClick={handleDetailsClick}
                        className="flex-1 bg-slate-100 text-slate-600 hover:bg-brand-navy hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
                    >
                        Detalles <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
});