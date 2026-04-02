import React from 'react';
import * as LucideIcons from 'lucide-react';
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
        if (isCompleted) return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20 shadow-[0_2px_10px_rgba(16,185,129,0.05)] dark:shadow-emerald-500/10';
        if (isDeclared || status === 'En Proceso' || status === 'Solicitado') return 'bg-blue-50 dark:bg-primary/10 text-blue-700 dark:text-primary-low border-blue-100 dark:border-primary/20 shadow-[0_2px_10px_rgba(59,130,246,0.05)] dark:shadow-primary/10';
        if (overdueStatus) return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 animate-pulse-subtle shadow-[0_2px_10px_rgba(244,63,94,0.05)] dark:shadow-rose-500/10';
        return 'bg-slate-50 dark:bg-surface-low/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 shadow-sm';
    };

    const StatusBadge = () => {
        const getStatusLabel = () => {
            if (isCompleted) return 'VERIFICADO';
            if (status === 'Solicitado') return 'EN TRÁMITE';
            if (status === 'En Proceso') return 'PROCESANDO';
            if (isDeclared) return 'PAGO PENDIENTE';
            if (overdueStatus) return 'VENCIDO';
            return 'G_STATUS: NORMAL';
        };

        return (
            <div className={`px-4 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-[0.2em] transition-all duration-700 border flex items-center gap-2.5 ${getStatusColors()}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : (overdueStatus ? 'bg-rose-500 animate-pulse' : 'bg-current opacity-50')}`} />
                {getStatusLabel()}
            </div>
        );
    };

    const renderIvaRentaSteps = () => (
        <div className="space-y-4 relative z-10">
            {/* Step: Declaration */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] bg-slate-50/50 dark:bg-surface-low/20 border border-slate-100 dark:border-white/5 transition-all duration-700 group/step ${overdueStatus && !isDeclared ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/5' : 'hover:border-primary/30 dark:hover:border-primary/40 shadow-sm'}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-1000 ${isDeclared ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : (overdueStatus ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400')}`}>
                        {isDeclared ? <LucideIcons.ShieldCheck size={16} /> : <LucideIcons.Send size={14} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">PHASE_01</span>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 uppercase mt-1.5 font-premium tracking-tight">DECLARACIÓN SRI</span>
                    </div>
                </div>
                {isDeclared ? (
                    <div className="flex items-center gap-3 text-blue-600 dark:text-primary-low bg-blue-50/50 dark:bg-primary/10 px-5 py-2.5 rounded-xl border border-blue-100 dark:border-primary/20 transition-all font-mono shadow-sm">
                        <span className="text-[9px] font-bold uppercase tracking-widest">SUCCESS_OK</span>
                    </div>
                ) : (
                    <button onClick={onDeclare} className={`flex w-full md:w-auto items-center justify-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 font-premium active:scale-95 shadow-sm hover:shadow-md ${overdueStatus ? 'bg-rose-600 dark:bg-rose-500 text-white shadow-rose-200 dark:shadow-rose-500/20' : 'bg-slate-900 dark:bg-primary text-white hover:bg-primary dark:hover:bg-primary-low'}`}>
                        {overdueStatus ? 'CRITICAL_ACTION' : 'RUN_MISSION'}
                        <LucideIcons.Send size={14} strokeWidth={3} />
                    </button>
                )}
            </div>

            {/* Step: Fees */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] bg-slate-50/50 dark:bg-surface-low/20 border border-slate-100 dark:border-white/5 transition-all duration-700 group/step hover:border-emerald-200 dark:hover:border-emerald-500/40 shadow-sm ${isPaid ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100/50 dark:border-emerald-500/20' : ''}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-1000 ${isPaid ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        <LucideIcons.HandCoins size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">PHASE_02</span>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 uppercase mt-1.5 font-premium tracking-tight">LIQUIDACIÓN FEES</span>
                    </div>
                </div>
                {isPaid ? (
                    <div className="flex items-center justify-between w-full md:w-auto gap-6 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 px-6 py-2.5 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/20 group/revert font-mono shadow-sm">
                        <span className="text-sm font-bold tracking-tighter">${amount.toFixed(2)}</span>
                        {onRevertPayment && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                className="p-2 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all active:scale-90" 
                            >
                                <LucideIcons.RotateCcw size={14} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex w-full md:w-auto items-center gap-3">
                        {isDeclared && onWhatsApp && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                className="p-3 bg-emerald-500 text-white rounded-2xl transition-all hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-200 dark:shadow-emerald-500/20 border border-emerald-400/20"
                            >
                                <LucideIcons.MessageCircle size={20} strokeWidth={2.5} />
                            </button>
                        )}
                        <button onClick={onPay} className="flex-1 md:flex-initial text-center justify-center px-8 py-3.5 bg-slate-900 dark:bg-emerald-500/20 dark:text-emerald-400 border border-slate-800 dark:border-emerald-500/30 rounded-2xl text-[10px] font-mono font-bold uppercase tracking-[0.1em] transition-all hover:bg-slate-800 dark:hover:bg-emerald-500/30 active:scale-95 shadow-sm">
                            COLECT: ${amount.toFixed(2)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRefundSteps = () => (
        <div className="space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-slate-50/50 dark:bg-surface-low/20 rounded-[2.5rem] border border-slate-100 dark:border-white/5 gap-8 shadow-sm transition-all duration-700">
                <div className="flex items-center gap-6 w-full">
                    <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 transition-all duration-700 shadow-sm ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-blue-50 dark:bg-primary/20 text-blue-600 dark:text-primary-low border border-blue-100 dark:border-primary/30'}`}>
                        {isCompleted ? <LucideIcons.CheckCircle2 size={24} strokeWidth={2.5} /> : <LucideIcons.AlertCircle size={24} strokeWidth={2.5} />}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">T_STATUS_MONITOR</div>
                        <div className="text-[13px] font-black text-slate-900 dark:text-slate-200 tracking-tight uppercase font-premium truncate mt-1.5">{status}</div>
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="w-full md:w-auto px-10 py-4 bg-slate-900 dark:bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary dark:hover:bg-primary-low active:scale-95 transition-all font-premium">INICIAR PROCESO</button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary active:scale-95 transition-all font-premium">RECIBIR MENSAJE</button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary active:scale-95 transition-all font-premium">CONFIRMAR FASE</button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-6 bg-slate-50/50 dark:bg-surface-low/20 rounded-[2rem] border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/40 hover:bg-emerald-50/20 dark:hover:bg-emerald-500/5 transition-all cursor-pointer group shadow-sm">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                            <LucideIcons.FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">DOC_RESOLUTION</div>
                            <div className="text-[11px] font-black text-slate-900 dark:text-slate-200 tracking-tight truncate max-w-[200px] font-premium mt-1">{resolutionFile.name}</div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-emerald-500 dark:group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                        <LucideIcons.Download size={18} strokeWidth={2.5} />
                    </div>
                </div>
            )}
            
            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:border-blue-400/40 dark:hover:border-primary/40 hover:bg-blue-50/30 dark:hover:bg-primary/5 hover:text-blue-600 dark:hover:text-primary-low rounded-[3rem] transition-all group font-premium shadow-sm">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-700 shadow-sm">
                        <LucideIcons.UploadCloud size={28} className="group-hover:translate-y-[-2px] transition-transform" strokeWidth={2} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em]">CLOUD_UPLOAD: PDF</span>
                        <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 tracking-widest uppercase">ENCRIPTACIÓN MILITAR</span>
                    </div>
                </button>
            )}
        </div>
    );

    return (
        <div className={`p-8 sm:p-14 rounded-[3rem] shadow-architect hover:shadow-2xl transition-all duration-1000 group overflow-hidden relative border ${isCompleted ? 'bg-white dark:bg-surface/40 backdrop-blur-3xl border-emerald-200 dark:border-emerald-500/30 shadow-emerald-50 dark:shadow-emerald-500/10' : 'bg-white dark:bg-surface/40 backdrop-blur-3xl border-slate-100 dark:border-white/10 hover:border-blue-200 dark:hover:border-primary/30'}`}>
            {/* Mission Status Indicator Bar */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] transition-all duration-1000 ${isCompleted ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : (overdueStatus ? 'bg-rose-500 animate-pulse' : 'bg-slate-50 dark:bg-white/5 group-hover:bg-blue-500 shadow-sm group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]')}`}></div>

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-10 mb-14 relative z-10">
                <div className="flex items-start sm:items-center gap-8 min-w-0 flex-1">
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center flex-shrink-0 transition-all duration-1000 shadow-sm ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-primary group-hover:bg-blue-50 dark:group-hover:bg-primary/10 border border-slate-100 dark:border-white/5'}`}>
                        {type === 'iva' ? <LucideIcons.BadgePercent size={32} strokeWidth={1} /> : type === 'renta' ? <LucideIcons.Calendar size={32} strokeWidth={1} /> : <LucideIcons.HandCoins size={32} strokeWidth={1} />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-2.5">{period ? formatPeriodForDisplay(period) : 'SPECIAL_PROTOCOL'}</p>
                        <h4 className="font-premium font-black text-slate-950 dark:text-slate-50 text-2xl sm:text-4xl tracking-tighter leading-none uppercase truncate">{title}</h4>
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
                <div className="mt-14 pt-12 border-t border-slate-100 dark:border-white/5 flex gap-4 relative z-10">
                    <button onClick={onDeclare} className="flex-grow py-6 bg-slate-900 dark:bg-primary text-white rounded-2xl text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-all shadow-xl shadow-slate-200 dark:shadow-primary/20 hover:bg-slate-800 dark:hover:bg-primary-low active:scale-95 text-center">
                        EXECUTE_MISSION_LOG
                    </button>
                    <button onClick={onUpload} className="p-6 bg-white dark:bg-surface-low/50 border border-slate-100 dark:border-white/5 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-primary hover:border-blue-200 dark:hover:border-primary/30 transition-all duration-700 active:scale-95 flex-shrink-0 shadow-sm">
                        <LucideIcons.UploadCloud size={24} strokeWidth={2.5} />
                    </button>
                </div>
            )}
        </div>
    );
};
