
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import isPast from 'date-fns/isPast';
import format from 'date-fns/format';
import getYear from 'date-fns/getYear';
import es from 'date-fns/locale/es';
import { Crown, MessageCircle, Copy, ArrowRight, AlertTriangle, CheckCircle, Clock, ShieldCheck, Calendar, Star, Send, TrendingUp, Store } from 'lucide-react';

interface VipClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onClick: () => void;
}

export const VipClientCard: React.FC<VipClientCardProps> = memo(({ client, serviceFees, onClick }) => {
    const currentPeriod = getPeriod(client, new Date());
    const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
    const fee = getClientServiceFee(client, serviceFees);
    
    // Check if VIP (Subscription)
    const isVip = client.category.includes('Suscripción');
    
    // Determine Status Logic
    let status = declaration?.status || DeclarationStatus.Pendiente;
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const isOverdue = dueDate && isPast(dueDate) && status !== DeclarationStatus.Pagada;
    
    // Main Display Name Logic
    const mainName = client.tradeName || client.name;
    const subName = client.tradeName ? client.name : null;
    
    // Status Styles Configuration
    const getStatusConfig = (currentStatus: string, overdue: boolean) => {
        if (currentStatus === DeclarationStatus.Pagada) {
            return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck, text: 'Al Día' };
        }
        if (currentStatus === DeclarationStatus.Enviada) {
            return { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Send, text: 'Declarado' };
        }
        if (overdue) {
            return { color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, text: 'Vencido' };
        }
        return { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock, text: 'Pendiente' };
    };

    const statusConfig = getStatusConfig(status, isOverdue || false);
    const StatusIcon = statusConfig.icon;

    const handleCopyRuc = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
    };

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!client.phones?.length) return;
        
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        const message = `Estimado/a ${client.name}, le saludamos de Santiago Cordova. Estado actual: ${statusConfig.text} (${formatPeriodForDisplay(currentPeriod)}).`;
        
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
        const isAnnualDone = annualDecl?.status === DeclarationStatus.Pagada || annualDecl?.status === DeclarationStatus.Enviada;
        
        return (
            <div 
                onClick={onClick}
                className="relative group overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-purple-200 dark:border-purple-900/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
                {/* Purple Accent for Popular */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500"></div>
                
                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 flex items-center justify-center font-display font-bold text-lg shadow-sm">
                                {client.name.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-1">{mainName}</h3>
                                {subName && <p className="text-[10px] text-slate-400 font-medium truncate">{subName}</p>}
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Star size={10} className="text-purple-500" fill="currentColor"/>
                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                                        Negocio Popular
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-1.5 rounded-lg text-purple-600">
                            <TrendingUp size={18}/>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                         <div>
                             <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Renta {year - 1}</p>
                             <div className="flex items-center gap-2">
                                 {isAnnualDone ? (
                                     <span className="flex items-center text-emerald-600 font-bold text-xs"><CheckCircle size={14} className="mr-1"/> Listo</span>
                                 ) : (
                                     <span className="flex items-center text-slate-600 dark:text-slate-300 font-bold text-xs"><Calendar size={14} className="mr-1"/> Mayo</span>
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
    if (client.category.includes('Semestral')) {
        const currentYear = getYear(new Date());
        const sem1Period = `${currentYear}-S1`;
        const sem2Period = `${currentYear}-S2`;
        const s1Decl = client.declarationHistory.find(d => d.period === sem1Period);
        const s2Decl = client.declarationHistory.find(d => d.period === sem2Period);

        const getSemStyle = (decl?: any) => {
            if (decl?.status === DeclarationStatus.Pagada) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            if (decl?.status === DeclarationStatus.Enviada) return 'bg-blue-100 text-blue-700 border-blue-200';
            return 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'; 
        }

        const containerClass = isVip 
            ? "border-amber-300 dark:border-amber-700/50 shadow-md hover:shadow-amber-500/20"
            : "border-slate-200 dark:border-slate-700 hover:border-sky-300";

        return (
             <div 
                onClick={onClick}
                className={`relative group overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border ${containerClass} transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
            >
                {/* Accent Line */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isVip ? 'from-amber-300 via-yellow-400 to-amber-500' : 'from-sky-400 to-blue-500'}`}></div>
                
                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg shadow-sm ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {client.name.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-1">{mainName}</h3>
                                {subName && <p className="text-[10px] text-slate-400 font-medium truncate">{subName}</p>}
                                {isVip && (
                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                        <Crown size={10} fill="currentColor"/> VIP Semestral
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex flex-col items-center ${statusConfig.color}`}>
                            <StatusIcon size={12} className="mb-0.5"/>
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
        ? "border-amber-300 dark:border-amber-700/50 shadow-md hover:shadow-amber-500/20 bg-gradient-to-b from-white to-amber-50/20 dark:from-slate-800 dark:to-slate-900"
        : "border-slate-200 dark:border-slate-700 hover:border-brand-teal/50 bg-white dark:bg-slate-800";

    const topAccent = isVip 
        ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 h-1.5" 
        : "bg-brand-navy h-1";

    return (
        <div 
            onClick={onClick}
            className={`relative group overflow-hidden rounded-2xl border ${containerClasses} transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
        >
            {/* Top Accent Line */}
            <div className={`absolute top-0 left-0 w-full ${topAccent}`}></div>
            
            <div className="p-5">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg shadow-sm ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {client.name.substring(0,2).toUpperCase()}
                            </div>
                            {isVip && (
                                <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white p-1 rounded-full shadow-sm border-2 border-white dark:border-slate-800">
                                    <Crown size={10} fill="currentColor" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-1 text-base flex items-center gap-1">
                                {mainName}
                                {client.tradeName && <Store size={12} className="text-slate-400"/>}
                            </h3>
                            {subName && <p className="text-[10px] text-slate-400 font-medium truncate mb-0.5">{subName}</p>}
                            <button 
                                onClick={handleCopyRuc}
                                className="text-[11px] text-slate-400 hover:text-brand-teal flex items-center gap-1 transition-colors font-mono"
                            >
                                {client.ruc} <Copy size={10}/>
                            </button>
                        </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border flex flex-col items-center justify-center min-w-[70px] ${statusConfig.color}`}>
                        <StatusIcon size={14} className="mb-0.5"/>
                        {statusConfig.text}
                    </div>
                </div>

                {/* Info Grid */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 mb-4 grid grid-cols-2 gap-y-2 border border-slate-100 dark:border-slate-700/50">
                    <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Periodo</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatPeriodForDisplay(currentPeriod).split(' ')[0]}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Honorarios</p>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-white">${fee.toFixed(2)}</p>
                    </div>
                    {dueDate && (
                        <div className="col-span-2 border-t border-slate-200 dark:border-slate-700/50 pt-2 mt-1 flex justify-between items-center">
                             <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                                <Calendar size={10}/> Vencimiento
                             </p>
                             <p className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                {format(dueDate, 'EEEE, d MMMM', { locale: es })}
                             </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button 
                        onClick={handleWhatsApp}
                        className="flex-1 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <MessageCircle size={14}/> WhatsApp
                    </button>
                    <button 
                        onClick={handleDetailsClick}
                        className="flex-1 bg-slate-100 text-slate-600 hover:bg-brand-navy hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn"
                    >
                        Detalles <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform"/>
                    </button>
                </div>
            </div>
        </div>
    );
});