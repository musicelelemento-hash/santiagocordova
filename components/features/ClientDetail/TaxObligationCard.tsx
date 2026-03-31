import React from 'react';
import { Calendar, ShieldCheck, Send, UploadCloud, MessageCircle, RotateCcw, CheckCircle2, AlertCircle, FileText, Download, BadgePercent, HandCoins } from 'lucide-react';
import { DeclarationStatus, StoredFile } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';

interface TaxObligationCardProps {
    type: 'iva' | 'renta' | 'refund' | 'renta_refund';
    title: string;
    period?: string;
    status?: string | DeclarationStatus;
    isPaid?: boolean;
    isDeclared?: boolean;
    amount?: number;
    description?: string;
    onDeclare?: () => void;
    onPay?: () => void;
    onUpload?: () => void;
    onWhatsApp?: () => void;
    onAction?: (action: any) => void;
    resolutionFile?: StoredFile;
    declarationDate?: string;
    onRevertPayment?: () => void;
    dueDate?: Date;
    isOverdue?: boolean;
}

export const TaxObligationCard: React.FC<TaxObligationCardProps> = ({
    type,
    title,
    period,
    status,
    isPaid,
    isDeclared: initialIsDeclared,
    amount = 0,
    onDeclare,
    onPay,
    onUpload,
    onWhatsApp,
    onAction,
    resolutionFile,
    onRevertPayment,
    dueDate,
    isOverdue
}) => {
    const isIvaOrRenta = type === 'iva' || type === 'renta';
    const isDeclared = initialIsDeclared ?? (status === DeclarationStatus.Enviada || status === DeclarationStatus.Pagada);
    const isCompleted = isIvaOrRenta ? (isDeclared && isPaid) : (status === 'Completado');
    const overdueStatus = isOverdue ?? (dueDate ? (new Date() > dueDate) : false);

    const getStatusColors = () => {
        if (isCompleted) return 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.05)]';
        if (isDeclared || status === 'En Proceso' || status === 'Solicitado') return 'bg-blue-50 text-blue-700 border-blue-100 shadow-[0_2px_10px_rgba(59,130,246,0.05)]';
        if (overdueStatus) return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse-subtle shadow-[0_2px_10px_rgba(244,63,94,0.05)]';
        return 'bg-slate-50 text-slate-500 border-slate-200 shadow-sm';
    };

    const StatusBadge = () => (
        <div className={`px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] transition-all duration-700 border font-premium ${getStatusColors()}`}>
            {isCompleted ? 'VERIFICADO' : (status === 'Solicitado' ? 'EN TRÁMITE' : (status === 'En Proceso' ? 'PROCESANDO' : (isDeclared ? 'PAGO PENDIENTE' : (overdueStatus ? 'VENCIDO' : 'ESTADO: GESTIÓN'))))}
        </div>
    );

    const renderIvaRentaSteps = () => (
        <div className="space-y-4 relative z-10">
            {/* Step: Declaration */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] bg-white border border-slate-100 transition-all duration-700 group/step ${overdueStatus && !isDeclared ? 'border-rose-200 bg-rose-50/30' : 'hover:border-primary/30 shadow-sm hover:shadow-md'}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-3 h-3 rounded-full transition-all duration-1000 flex-shrink-0 ${isDeclared ? 'bg-blue-500 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : (overdueStatus ? 'bg-rose-500 animate-pulse' : 'bg-slate-200')}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium leading-none">FASE 01</span>
                        <span className="text-[11px] font-black text-slate-900 uppercase mt-1.5 font-premium tracking-tight">DECLARACIÓN SRI</span>
                    </div>
                </div>
                {isDeclared ? (
                    <div className="flex items-center gap-3 text-blue-600 bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-100 transition-all font-premium shadow-sm">
                        <ShieldCheck size={16} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-widest">PROCESADO</span>
                    </div>
                ) : (
                    <button onClick={onDeclare} className={`flex w-full md:w-auto items-center justify-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 font-premium active:scale-95 shadow-sm hover:shadow-md ${overdueStatus ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-slate-900 text-white hover:bg-primary'}`}>
                        {overdueStatus ? 'ACCIÓN INMEDIATA' : 'EJECUTAR'}
                        <Send size={14} strokeWidth={3} />
                    </button>
                )}
            </div>

            {/* Step: Fees */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] bg-white border border-slate-100 transition-all duration-700 group/step hover:border-emerald-200 shadow-sm hover:shadow-md ${isPaid ? 'bg-emerald-50/30 border-emerald-100' : ''}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-3 h-3 rounded-full transition-all duration-1000 flex-shrink-0 ${isPaid ? 'bg-emerald-500 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-200'}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium leading-none">FASE 02</span>
                        <span className="text-[11px] font-black text-slate-900 uppercase mt-1.5 font-premium tracking-tight">LIQUIDACIÓN</span>
                    </div>
                </div>
                {isPaid ? (
                    <div className="flex items-center justify-between w-full md:w-auto gap-6 text-emerald-700 bg-emerald-50 px-6 py-2.5 rounded-2xl border border-emerald-100 group/revert font-premium shadow-sm">
                        <span className="text-sm font-black tracking-tight">${amount.toFixed(2)}</span>
                        {onRevertPayment && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                className="p-2 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-100 text-rose-500 rounded-xl transition-all active:scale-90 shadow-sm" 
                            >
                                <RotateCcw size={14} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex w-full md:w-auto items-center gap-3">
                        {isDeclared && onWhatsApp && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                className="p-3 bg-emerald-500 text-white rounded-2xl transition-all hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-100 hover:shadow-lg border border-emerald-400/20"
                            >
                                <MessageCircle size={20} strokeWidth={2.5} />
                            </button>
                        )}
                        <button onClick={onPay} className="flex-1 md:flex-initial text-center justify-center px-8 py-3.5 bg-slate-900 text-white border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-primary font-premium active:scale-95 shadow-sm hover:shadow-md">
                            COBRAR ${amount.toFixed(2)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRefundSteps = () => (
        <div className="space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-white rounded-[2.5rem] border border-slate-100 gap-8 shadow-sm hover:shadow-md transition-all duration-700">
                <div className="flex items-center gap-6 w-full">
                    <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 transition-all duration-700 shadow-sm ${isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                        {isCompleted ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <AlertCircle size={24} strokeWidth={2.5} />}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">ESTADO TÉCNICO</div>
                        <div className="text-[13px] font-black text-slate-900 tracking-tight uppercase font-premium truncate mt-1.5">{status}</div>
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary shadow-sm hover:shadow-md active:scale-95 transition-all font-premium">INICIAR PROCESO</button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary shadow-sm hover:shadow-md active:scale-95 transition-all font-premium">RECIBIR MENSAJE</button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary shadow-sm hover:shadow-md active:scale-95 transition-all font-premium">CONFIRMAR FASE</button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform duration-500">
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">ORDEN DE RESOLUCIÓN</div>
                            <div className="text-[11px] font-black text-slate-900 tracking-tight truncate max-w-[200px] font-premium mt-1">{resolutionFile.name}</div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                        <Download size={18} strokeWidth={2.5} />
                    </div>
                </div>
            )}
            
            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400/40 hover:bg-blue-50/30 hover:text-blue-600 rounded-[3rem] transition-all group font-premium shadow-sm hover:shadow-inner">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-700 shadow-sm">
                        <UploadCloud size={28} className="group-hover:translate-y-[-2px] transition-transform" strokeWidth={2} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.25em]">CARGAR DOCUMENTO FINAL</span>
                        <span className="text-[9px] font-bold text-slate-300 tracking-widest uppercase">SOLO PDF AUTORIZADO</span>
                    </div>
                </button>
            )}
        </div>
    );

    return (
        <div className={`p-8 sm:p-14 rounded-[3rem] shadow-sm hover:shadow-lg transition-all duration-1000 group overflow-hidden relative border ${isCompleted ? 'bg-white border-emerald-200 shadow-emerald-50' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
            {/* Mission Status Indicator Bar */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] transition-all duration-1000 ${isCompleted ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : (overdueStatus ? 'bg-rose-500 animate-pulse' : 'bg-slate-50 group-hover:bg-blue-500 shadow-sm group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]')}`}></div>

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-10 mb-14 relative z-10">
                <div className="flex items-start sm:items-center gap-8 min-w-0 flex-1">
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center flex-shrink-0 transition-all duration-1000 shadow-sm ${isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 border border-slate-100'}`}>
                        {type === 'iva' ? <BadgePercent size={32} strokeWidth={1.2} /> : type === 'renta' ? <Calendar size={32} strokeWidth={1.2} /> : <HandCoins size={32} strokeWidth={1.2} />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-premium mb-2.5">{period ? formatPeriodForDisplay(period) : 'PROTOCOLOS ESPECIALES'}</p>
                        <h4 className="font-premium font-black text-slate-950 text-2xl sm:text-5xl tracking-tight leading-none uppercase truncate">{title}</h4>
                    </div>
                </div>
                <div className="flex justify-start lg:justify-end">
                    <StatusBadge />
                </div>
            </div>

            <div className="relative">
                {isIvaOrRenta ? renderIvaRentaSteps() : renderRefundSteps()}
            </div>

            {/* Bottom Strategic Controls */}
            {isIvaOrRenta && !isPaid && (
                <div className="mt-14 pt-12 border-t border-slate-100 flex gap-4 relative z-10">
                    <button onClick={onDeclare} className="flex-grow py-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-xl shadow-slate-100 hover:bg-primary active:scale-95 text-center font-premium hover:shadow-blue-100">
                        EJECUTAR EXPEDIENTE
                    </button>
                    <button onClick={onUpload} className="p-6 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all duration-700 active:scale-95 flex-shrink-0 shadow-sm hover:shadow-md">
                        <UploadCloud size={24} strokeWidth={2.5} />
                    </button>
                </div>
            )}
        </div>
    );
};
