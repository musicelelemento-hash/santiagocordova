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
        <div className="glass-card p-8 sm:p-12 transition-all group overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-8 relative z-10">
                <div className="flex items-center gap-5 min-w-0 flex-1 pr-4">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-all duration-500 ${isCompleted ? 'bg-emerald-400/5 border-emerald-400/20 text-emerald-400 shadow-primary' : 'bg-white/5 border-white/5 text-slate-500 group-hover:text-primary group-hover:border-primary/30'}`}>
                        <Calendar size={20} className={isCompleted ? 'animate-pulse' : ''} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-white text-base sm:text-lg tracking-tight leading-none transition-colors truncate">{title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest bg-white/5 py-1 px-3 rounded-lg border border-white/5 whitespace-nowrap">
                                {formatPeriodForDisplay(period)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`flex-shrink-0 self-start ${isCompleted ? 'px-4 py-1.5 rounded-lg text-[9px] font-medium uppercase tracking-widest border bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : (isDeclared ? 'px-4 py-1.5 rounded-lg text-[9px] font-medium uppercase tracking-widest border bg-primary/10 border-primary/20 text-primary' : (overdueStatus ? 'px-4 py-1.5 rounded-lg text-[9px] font-medium uppercase tracking-widest border bg-rose-400/10 border-rose-400/20 text-rose-400 animate-pulse' : 'px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] border bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse'))}`}>
                    {isCompleted ? 'Completado' : (isDeclared ? 'Pendiente Pago' : (overdueStatus ? 'Vencida' : 'FASE: TRÁMITE'))}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className={`px-4 py-2 rounded-xl text-[9px] font-medium uppercase tracking-widest border flex items-center gap-2 ${isCompleted ? 'bg-emerald-400/5 border-emerald-400/10 text-emerald-400/70' : (overdueStatus && !isDeclared ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-900/60 border-white/5 text-slate-400')}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-400' : (overdueStatus && !isDeclared ? 'bg-rose-500 animate-pulse' : 'bg-amber-400 animate-pulse')}`}></div>
                    {nextStep}
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                {/* Step: Declaration */}
                <div className={`flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 transition-all group/step ${overdueStatus && !isDeclared ? 'hover:border-rose-400/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'hover:border-primary/20'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isDeclared ? 'bg-primary shadow-primary scale-110' : (overdueStatus ? 'bg-rose-500 animate-ping' : 'bg-slate-800')}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Declaración SRI</span>
                            <span className={`text-[8px] font-medium uppercase tracking-widest mt-0.5 ${overdueStatus && !isDeclared ? 'text-rose-400' : 'text-slate-500'}`}>
                                {overdueStatus && !isDeclared ? 'Plazo Excedido' : 'Sincronizado'}
                            </span>
                        </div>
                    </div>
                    {isDeclared ? (
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 text-primary">
                                <FileCheck size={16} />
                                <span className="text-[10px] font-medium uppercase tracking-widest">OK</span>
                            </div>
                        </div>
                    ) : (
                        <button onClick={onDeclare} className={`px-4 py-2 border rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all ${overdueStatus ? 'bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border-rose-500/20' : 'bg-primary/10 hover:bg-primary text-primary hover:text-slate-950 border-primary/20'}`}>
                            {overdueStatus ? 'Urgente' : 'Declarar'}
                        </button>
                    )}
                </div>

                {/* Step: Fees */}
                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-400/20 transition-all group/step">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-400 shadow-primary scale-110' : 'bg-slate-800'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Honorarios</span>
                            <span className="text-[8px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Contabilidad</span>
                        </div>
                    </div>
                    {isPaid ? (
                        <div className="flex items-center gap-3 text-emerald-400 group/revert pr-2">
                            <span className="text-[11px] font-medium font-mono">${amount.toFixed(2)}</span>
                            {onRevertPayment && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                    className="p-1.5 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-400/20 text-rose-400 rounded-md transition-all active:scale-95" 
                                    title="Revertir"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            {isDeclared && onWhatsApp && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                    className="p-2.5 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400 hover:text-slate-950 rounded-lg transition-all border border-emerald-400/20"
                                >
                                    <MessageCircle size={16} />
                                </button>
                            )}
                            <button onClick={onPay} className="px-4 py-2 bg-emerald-400/10 hover:bg-emerald-400 text-emerald-400 hover:text-slate-950 border border-emerald-400/20 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all">
                                Cobrar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {!isPaid && (
                <div className="mt-8 flex gap-3 relative z-10">
                    <button onClick={onDeclare} className="flex-grow py-4 bg-primary text-slate-950 hover:bg-white rounded-xl text-[11px] font-medium uppercase tracking-widest transition-all shadow-primary active:scale-95">
                        Gestionar Trámite
                    </button>
                    <button onClick={onUpload} className="p-4 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-primary hover:border-primary/50 transition-all active:scale-95">
                        <UploadCloud size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
