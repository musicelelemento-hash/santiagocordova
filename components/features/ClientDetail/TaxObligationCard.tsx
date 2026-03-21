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
    onRevertPayment
}) => {
    const isDeclared = status === DeclarationStatus.Enviada || status === DeclarationStatus.Pagada;
    const isCompleted = isDeclared && isPaid;

    let nextStep = "";
    if (!isDeclared) nextStep = "REQUERIDO: DECLARACIÓN";
    else if (!isPaid) nextStep = "REQUERIDO: COBRO HONORARIOS";
    else nextStep = "ESTADO: OPERATIVO";

    return (
        <div className="bg-slate-950/60 backdrop-blur-2xl rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.4)] hover:shadow-cyan-500/20 hover:border-cyan-500/30 transition-all group overflow-hidden relative aura-premium">
            {/* Visual Accent */}
            <div className={`absolute -right-12 -top-12 opacity-[0.08] group-hover:rotate-12 group-hover:scale-110 transition-all duration-1000 text-cyan-400`}>
                <ShieldCheck size={260} />
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mb-10 relative z-10">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.6rem] border flex items-center justify-center transition-all duration-500 ${isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-slate-900 border-white/10 text-slate-600 shadow-inner group-hover:text-cyan-400 group-hover:border-cyan-500/30'}`}>
                        <Calendar size={22} className={`sm:w-7 sm:h-7 ${isCompleted ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <h4 className="font-black text-white text-lg sm:text-xl tracking-tight leading-none group-hover:text-cyan-400 transition-colors uppercase">{title}</h4>
                        <div className="flex items-center gap-3 mt-3">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] bg-white/5 py-1.5 px-4 rounded-xl border border-white/5 shadow-inner">
                                {formatPeriodForDisplay(period)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] border self-start ${isCompleted ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : (isDeclared ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse')}`}>
                    {isCompleted ? 'ÉXITO' : (isDeclared ? 'FASE: COBRO' : 'FASE: TRÁMITE')}
                </div>
            </div>

            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] border flex items-center gap-3 shadow-inner ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-900/80 border-white/10 text-slate-300'}`}>
                    <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse'}`}></div>
                    {nextStep}
                </div>
            </div>

            <div className="space-y-5 relative z-10">
                {/* Tactical Step: Declaration */}
                <div className="flex items-center justify-between p-4 sm:p-6 rounded-2xl sm:rounded-[1.8rem] bg-slate-900/50 border border-white/5 hover:border-cyan-500/20 transition-all group/step shadow-inner">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-500 ${isDeclared ? 'bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)] scale-110' : 'bg-slate-800'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-200 uppercase tracking-[0.15em] sm:tracking-[0.2em]">SRI: DECLARACIÓN</span>
                            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">LOGÍSTICA FISCAL</span>
                        </div>
                    </div>
                    {isDeclared ? (
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-3 text-cyan-400 bg-cyan-500/10 px-4 py-1.5 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                <FileCheck size={18} />
                                <span className="text-[11px] font-black uppercase tracking-[0.25em]">SINCRONIZADO</span>
                            </div>
                            {declarationDate && (
                                <span className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-tight font-mono">TS: {declarationDate}</span>
                            )}
                        </div>
                    ) : (
                        <button onClick={onDeclare} className="px-5 py-2.5 bg-cyan-600/20 hover:bg-cyan-500 text-cyan-400 hover:text-white border border-cyan-500/30 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all transform hover:translate-x-1 group-hover/step:shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-3">
                            INICIAR <Send size={14} />
                        </button>
                    )}
                </div>

                {/* Tactical Step: Honorarios */}
                <div className="flex items-center justify-between p-4 sm:p-6 rounded-2xl sm:rounded-[1.8rem] bg-slate-900/50 border border-white/5 hover:border-emerald-500/20 transition-all group/step shadow-inner">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)] scale-110' : 'bg-slate-800'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-200 uppercase tracking-[0.15em] sm:tracking-[0.2em]">CONTABLE: HONORARIOS</span>
                            <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">LIQUIDACIÓN</span>
                        </div>
                    </div>
                    {isPaid ? (
                        <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 px-5 py-2 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative group/revert">
                            <DollarSign size={18} />
                            <span className="text-[12px] font-black uppercase tracking-[0.15em] font-mono">${amount.toFixed(2)} LIQUIDADO</span>
                            {onRevertPayment && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                    className="ml-2 p-1.5 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-500/20 text-rose-400 rounded-md transition-all active:scale-95 absolute -right-4 -top-4 sm:static" 
                                    title="Revertir Pago"
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            {isDeclared && onWhatsApp && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                    className="p-3.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/30 shadow-2xl hover:shadow-emerald-500/40"
                                    title="Notificar Cobro vía WA"
                                >
                                    <MessageCircle size={20} />
                                </button>
                            )}
                            <button onClick={onPay} className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all transform hover:translate-x-1 group-hover/step:shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-3">
                                REGISTRAR <DollarSign size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {!isPaid && (
                <div className="mt-10 flex gap-4 relative z-10">
                    <button onClick={onDeclare} className="flex-grow py-5 bg-white text-slate-950 hover:bg-cyan-500 hover:text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] transition-all transform hover:-translate-y-1 active:scale-95 shadow-[0_15px_40px_rgba(255,255,255,0.15)] hover:shadow-cyan-500/50">
                        GESTIONAR EXPEDIENTE
                    </button>
                    <button onClick={onUpload} className="p-5 bg-slate-900 border border-white/10 rounded-2xl text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800 transition-all shadow-2xl active:scale-95">
                        <UploadCloud size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};
