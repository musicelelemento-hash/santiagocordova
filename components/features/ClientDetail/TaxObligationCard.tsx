import React from 'react';
import { Calendar, ShieldCheck, FileCheck, Send, DollarSign, UploadCloud, MessageCircle, RotateCcw } from 'lucide-react';
import { DeclarationStatus } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';

interface TaxObligationCardProps {
    title: string;
    period: string;
    status: DeclarationStatus;
    isPaid: boolean;
    amount: number;
    description?: string;
    onDeclare: () => void;
    onPay: () => void;
    onUpload?: () => void;
    onWhatsApp?: () => void;
    declarationDate?: string;
    onRevertPayment?: () => void;
    dueDate?: Date;
    isOverdue?: boolean;
}

export const TaxObligationCard: React.FC<TaxObligationCardProps> = ({
    title,
    period,
    status,
    isPaid,
    amount,
    description,
    onDeclare,
    onPay,
    onUpload,
    onWhatsApp,
    declarationDate,
    onRevertPayment,
    dueDate,
    isOverdue
}) => {
    const isDeclared = status === DeclarationStatus.Enviada || status === DeclarationStatus.Pagada;
    const isCompleted = isDeclared && isPaid;
    const overdueStatus = isOverdue ?? (dueDate ? (new Date() > dueDate) : false);

    let nextStep = "";
    if (overdueStatus && !isDeclared) nextStep = "OBLIGACIÓN VENCIDA";
    else if (!isDeclared) nextStep = "REQUERIDO: DECLARACIÓN";
    else if (!isPaid) nextStep = "REQUERIDO: COBRO HONORARIOS";
    else nextStep = "ESTADO: OPERATIVO";

    return (
        <div className="bg-surface-lowest dark:bg-surface-lowest p-8 sm:p-12 rounded-[2.5rem] shadow-architect transition-all duration-500 group overflow-hidden relative border border-transparent hover:border-primary/10">
            {/* Tonal Accent - Bottom Glow */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] opacity-20 transition-all duration-700 ${isCompleted ? 'bg-tertiary shadow-[0_0_20px_rgba(var(--tertiary-rgb),0.5)]' : (overdueStatus ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]')}`}></div>

            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-6 mb-8 relative z-10">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 transition-all duration-700 ${isCompleted ? 'bg-tertiary/5 text-tertiary' : 'bg-surface-low text-secondary group-hover:text-primary group-hover:bg-primary/5'}`}>
                        <Calendar size={24} className={isCompleted ? 'animate-pulse' : ''} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.25em] font-premium mb-2">{formatPeriodForDisplay(period)}</p>
                        <h4 className="font-bold text-on-surface text-lg sm:text-2xl tracking-tight leading-tight transition-colors font-premium">{title}</h4>
                    </div>
                </div>
                <div className={`flex-shrink-0 self-start px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isCompleted ? 'bg-tertiary/10 text-tertiary border border-tertiary/20' : (isDeclared ? 'bg-primary/10 text-primary border border-primary/20' : (overdueStatus ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse' : 'bg-secondary/10 text-secondary border border-secondary/20 shadow-sm'))}`}>
                    {isCompleted ? 'Operativo' : (isDeclared ? 'Pendiente Pago' : (overdueStatus ? 'Vencida' : 'Fase: Trámite'))}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-10 relative z-10">
                <div className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2.5 font-premium ${isCompleted ? 'bg-tertiary/5 border-tertiary/10 text-tertiary/70' : (overdueStatus && !isDeclared ? 'bg-rose-500/5 border-rose-500/10 text-rose-500' : 'bg-surface-low border-on-surface/5 text-secondary')}`}>
                    <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-tertiary' : (overdueStatus && !isDeclared ? 'bg-rose-500 animate-pulse' : 'bg-primary animate-pulse')}`}></div>
                    {nextStep}
                </div>
            </div>

            <div className="space-y-5 relative z-10">
                {/* Step: Declaration */}
                <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-low border border-transparent transition-all duration-500 group/step ${overdueStatus && !isDeclared ? 'hover:border-rose-500/30' : 'hover:border-primary/20 shadow-sm'}`}>
                    <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isDeclared ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] scale-110' : (overdueStatus ? 'bg-rose-500 animate-ping' : 'bg-on-surface/10')}`}></div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-on-surface uppercase tracking-widest leading-normal truncate font-premium">Logística:<br/><span className="text-secondary opacity-70">Declaración Digital</span></span>
                        </div>
                    </div>
                    {isDeclared ? (
                        <div className="flex items-center gap-2.5 text-primary bg-primary/5 px-4 py-2 rounded-xl">
                            <ShieldCheck size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Validado</span>
                        </div>
                    ) : (
                        <button onClick={onDeclare} className={`flex w-full justify-center sm:w-auto items-center gap-2.5 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 font-premium ${overdueStatus ? 'bg-rose-500 text-white shadow-lg active:scale-95' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'}`}>
                            {overdueStatus ? 'Urgente' : 'Ejecutar'}
                            <Send size={14} className="opacity-80" />
                        </button>
                    )}
                </div>

                {/* Step: Fees */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-low border border-transparent hover:border-tertiary/20 transition-all duration-500 group/step shadow-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isPaid ? 'bg-tertiary shadow-[0_0_10px_rgba(var(--tertiary-rgb),0.5)] scale-110' : 'bg-on-surface/10'}`}></div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-on-surface uppercase tracking-widest leading-normal truncate font-premium">Finanzas:<br/><span className="text-secondary opacity-70">Liquidación Honorarios</span></span>
                        </div>
                    </div>
                    {isPaid ? (
                        <div className="flex items-center justify-end w-full sm:w-auto gap-4 text-tertiary bg-tertiary/5 px-4 py-2 rounded-xl group/revert">
                            <span className="text-sm font-bold font-mono tracking-tight">${amount.toFixed(2)}</span>
                            {onRevertPayment && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                    className="p-1.5 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all active:scale-90" 
                                    title="Revertir"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex w-full sm:w-auto items-center gap-3">
                            {isDeclared && onWhatsApp && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                    className="p-3.5 bg-tertiary text-on-tertiary rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-tertiary/20"
                                >
                                    <MessageCircle size={18} />
                                </button>
                            )}
                            <button onClick={onPay} className="flex-1 sm:flex-initial text-center justify-center px-8 py-3 bg-surface-variant text-on-surface-variant border border-on-surface/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:bg-on-surface hover:text-surface-lowest font-premium">
                                Registrar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {!isPaid && (
                <div className="mt-10 flex gap-4 relative z-10 transition-all duration-700">
                    <button onClick={onDeclare} className="flex-grow py-5 bg-on-surface text-surface-lowest rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] transition-all shadow-xl hover:scale-[1.02] active:scale-95 text-center font-premium">
                        Gestionar Expediente
                    </button>
                    <button onClick={onUpload} className="p-5 bg-surface-low border border-on-surface/5 rounded-2xl text-secondary hover:text-primary hover:border-primary/30 transition-all duration-500 active:scale-95 flex-shrink-0 shadow-sm">
                        <UploadCloud size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};
