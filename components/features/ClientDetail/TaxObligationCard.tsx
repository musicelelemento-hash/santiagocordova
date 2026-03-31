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
        if (isCompleted) return 'bg-tertiary/10 text-tertiary border-tertiary/20';
        if (isDeclared || status === 'En Proceso' || status === 'Solicitado') return 'bg-primary/10 text-primary border-primary/20';
        if (overdueStatus) return 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse';
        return 'bg-secondary/10 text-secondary border-secondary/20 shadow-sm';
    };

    const StatusBadge = () => (
        <div className={`px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border ${getStatusColors()}`}>
            {isCompleted ? 'Validado' : (status === 'Solicitado' ? 'En Trámite' : (status === 'En Proceso' ? 'Procesando' : (isDeclared ? 'Pendiente Pago' : (overdueStatus ? 'Vencida' : 'Fase: Trámite'))))}
        </div>
    );

    const renderIvaRentaSteps = () => (
        <div className="space-y-4 sm:space-y-5 relative z-10">
            {/* Step: Declaration */}
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface-low border border-transparent transition-all duration-500 group/step ${overdueStatus && !isDeclared ? 'hover:border-rose-500/30' : 'hover:border-primary/20 shadow-sm'}`}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
                    <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isDeclared ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] scale-110' : (overdueStatus ? 'bg-rose-500 animate-ping' : 'bg-on-surface/10')}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] sm:text-[11px] font-black text-on-surface uppercase tracking-widest leading-normal font-premium truncate">LOGÍSTICA DE DECLARACIÓN</span>
                    </div>
                </div>
                {isDeclared ? (
                    <div className="flex items-center gap-2.5 text-primary bg-primary/5 px-4 py-2 rounded-xl">
                        <ShieldCheck size={14} className="sm:w-[16px] sm:h-[16px]" />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">ENVIADA</span>
                    </div>
                ) : (
                    <button onClick={onDeclare} className={`flex w-full justify-center md:w-auto items-center gap-2.5 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 font-premium ${overdueStatus ? 'bg-rose-500 text-white shadow-lg active:scale-95' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'}`}>
                        {overdueStatus ? 'URGENTE' : 'EJECUTAR'}
                        <Send size={12} className="sm:w-[14px] sm:h-[14px] opacity-80" />
                    </button>
                )}
            </div>

            {/* Step: Fees */}
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface-low border border-transparent hover:border-tertiary/20 transition-all duration-500 group/step shadow-sm ${isPaid ? 'bg-tertiary/5' : ''}`}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
                    <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isPaid ? 'bg-tertiary shadow-[0_0_10px_rgba(var(--tertiary-rgb),0.5)] scale-110' : 'bg-on-surface/10'}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] sm:text-[11px] font-black text-on-surface uppercase tracking-widest leading-normal font-premium truncate">LIQUIDACIÓN HONORARIOS</span>
                    </div>
                </div>
                {isPaid ? (
                    <div className="flex items-center justify-end w-full md:w-auto gap-4 text-tertiary bg-tertiary/5 px-4 py-2 rounded-xl group/revert">
                        <span className="text-sm font-black font-premium tracking-tight">${amount.toFixed(2)}</span>
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
                    <div className="flex w-full md:w-auto items-center gap-3">
                        {isDeclared && onWhatsApp && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                className="p-3 bg-tertiary text-on-tertiary rounded-xl sm:rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-tertiary/20"
                            >
                                <MessageCircle size={18} />
                            </button>
                        )}
                        <button onClick={onPay} className="flex-1 md:flex-initial text-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 bg-surface-variant text-on-surface-variant border border-on-surface/5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:bg-on-surface hover:text-surface-lowest font-premium">
                            COBRAR ${amount.toFixed(2)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRefundSteps = () => (
        <div className="space-y-4 sm:space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between p-6 sm:p-8 bg-surface-low rounded-2xl sm:rounded-[2.5rem] border border-surface-low gap-6">
                <div className="flex items-center gap-4 sm:gap-5 w-full">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                        {isCompleted ? <CheckCircle2 size={20} className="sm:w-[24px] sm:h-[24px]" /> : <AlertCircle size={20} className="sm:w-[24px] sm:h-[24px]" />}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest font-premium">ESTADO ACTUAL</div>
                        <div className="text-xs sm:text-sm font-black text-on-surface tracking-tight uppercase font-premium truncate">{status}</div>
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">INICIAR</button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all font-premium">MENSAJE</button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all font-premium">CONFIRMAR</button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-5 sm:p-6 bg-tertiary/5 rounded-2xl sm:rounded-[2rem] border border-tertiary/10 hover:bg-tertiary/10 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <FileText size={20} className="sm:w-[24px] sm:h-[24px] text-tertiary" />
                        <div>
                            <div className="text-[8px] sm:text-[9px] font-black text-on-surface-variant uppercase tracking-widest font-premium">RESOLUCIÓN FINAL</div>
                            <div className="text-[10px] sm:text-[11px] font-black text-on-surface tracking-tight truncate max-w-[150px] sm:max-w-[200px] font-premium">{resolutionFile.name}</div>
                        </div>
                    </div>
                    <Download size={16} className="sm:w-[18px] sm:h-[18px] text-tertiary opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
            
            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex items-center justify-center gap-3 p-5 sm:p-6 border-2 border-dashed border-surface-low text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-2xl sm:rounded-3xl transition-all group font-premium">
                    <UploadCloud size={18} className="sm:w-[20px] sm:h-[20px] group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">SUBIR RESOLUCIÓN</span>
                </button>
            )}
        </div>
    );

    return (
        <div className="bg-surface-lowest p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-architect transition-all duration-500 group overflow-hidden relative border border-surface-low hover:border-primary/10">
            {/* Tonal Accent - Bottom Glow */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] sm:h-[3px] opacity-30 transition-all duration-700 ${isCompleted ? 'bg-tertiary shadow-[0_0_20px_rgba(var(--tertiary-rgb),0.5)]' : (overdueStatus ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]')}`}></div>

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 sm:gap-8 mb-8 sm:mb-10 relative z-10">
                <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center flex-shrink-0 transition-all duration-700 ${isCompleted ? 'bg-tertiary/10 text-tertiary shadow-architect-low' : 'bg-surface-low text-secondary group-hover:text-primary group-hover:bg-primary/5 p-3 sm:p-4 shadow-architect-low'}`}>
                        {type === 'iva' ? <BadgePercent size={20} className="sm:w-[28px] sm:h-[28px]" /> : type === 'renta' ? <Calendar size={20} className="sm:w-[28px] sm:h-[28px]" /> : <HandCoins size={20} className="sm:w-[28px] sm:h-[28px]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[8px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] sm:tracking-[0.3em] font-premium mb-1 sm:mb-2">{period ? formatPeriodForDisplay(period) : 'GESTORÍA ESPECIAL'}</p>
                        <h4 className="font-black text-on-surface text-lg sm:text-2xl tracking-tighter leading-tight transition-colors font-premium uppercase truncate">{title}</h4>
                    </div>
                </div>
                <div className="flex justify-start lg:justify-end">
                    <StatusBadge />
                </div>
            </div>

            {isIvaOrRenta ? renderIvaRentaSteps() : renderRefundSteps()}

            {isIvaOrRenta && !isPaid && (
                <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-surface-low flex gap-3 sm:gap-4 relative z-10 transition-all duration-700">
                    <button onClick={onDeclare} className="flex-grow py-4 sm:py-5 bg-on-surface text-surface-lowest rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all shadow-xl hover:scale-[1.02] active:scale-95 text-center font-premium">
                        PROCESAR EXPEDIENTE
                    </button>
                    <button onClick={onUpload} className="p-4 sm:p-5 bg-surface-low border border-on-surface/5 rounded-xl sm:rounded-2xl text-secondary hover:text-primary hover:border-primary/30 transition-all duration-500 active:scale-95 flex-shrink-0 shadow-sm">
                        <UploadCloud size={20} className="sm:w-[24px] sm:h-[24px]" />
                    </button>
                </div>
            )}
        </div>
    );
};
