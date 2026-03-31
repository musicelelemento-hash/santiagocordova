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
        if (isCompleted) return 'bg-tertiary/10 text-tertiary border-tertiary/20 glow-emerald';
        if (isDeclared || status === 'En Proceso' || status === 'Solicitado') return 'bg-primary/10 text-primary border-primary/20 glow-azure';
        if (overdueStatus) return 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse';
        return 'bg-white/5 text-on-surface-variant border-white/5 shadow-architect';
    };

    const StatusBadge = () => (
        <div className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] transition-all duration-700 border backdrop-blur-3xl ${getStatusColors()}`}>
            {isCompleted ? 'VERIFICADO' : (status === 'Solicitado' ? 'EN TRÁMITE' : (status === 'En Proceso' ? 'PROCESANDO' : (isDeclared ? 'PAGO PENDIENTE' : (overdueStatus ? 'VENCIDO' : 'ESTADO: GESTIÓN'))))}
        </div>
    );

    const renderIvaRentaSteps = () => (
        <div className="space-y-4 relative z-10">
            {/* Step: Declaration */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-surface-low/30 border border-white/5 transition-all duration-700 group/step ${overdueStatus && !isDeclared ? 'border-rose-500/20' : 'hover:border-primary/20 shadow-architect'}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isDeclared ? 'bg-primary glow-azure scale-110 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : (overdueStatus ? 'bg-rose-500 animate-ping' : 'bg-white/5')}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium leading-none">FASE 01</span>
                        <span className="text-[11px] font-bold text-on-surface/80 uppercase mt-1">DECLARACIÓN SRI</span>
                    </div>
                </div>
                {isDeclared ? (
                    <div className="flex items-center gap-3 text-primary bg-primary/5 px-5 py-2.5 rounded-xl border border-primary/10 transition-all font-premium">
                        <ShieldCheck size={16} strokeWidth={2} />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">PROCESADO</span>
                    </div>
                ) : (
                    <button onClick={onDeclare} className={`flex w-full md:w-auto items-center justify-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 font-premium active:scale-95 ${overdueStatus ? 'bg-rose-500 text-white shadow-lg' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white glow-azure'}`}>
                        {overdueStatus ? 'ACCIÓN INMEDIATA' : 'EJECUTAR'}
                        <Send size={14} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* Step: Fees */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-surface-low/30 border border-white/5 transition-all duration-700 group/step hover:border-tertiary/20 shadow-architect ${isPaid ? 'bg-tertiary/5 border-tertiary/10' : ''}`}>
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-700 flex-shrink-0 ${isPaid ? 'bg-tertiary glow-emerald scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-white/5'}`}></div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] font-premium leading-none">FASE 02</span>
                        <span className="text-[11px] font-bold text-on-surface/80 uppercase mt-1">LIQUIDACIÓN</span>
                    </div>
                </div>
                {isPaid ? (
                    <div className="flex items-center justify-between w-full md:w-auto gap-6 text-tertiary bg-tertiary/5 px-6 py-2.5 rounded-2xl border border-tertiary/10 group/revert font-premium">
                        <span className="text-sm font-black tracking-tight">${amount.toFixed(2)}</span>
                        {onRevertPayment && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRevertPayment(); }} 
                                className="p-2 opacity-0 group-hover/revert:opacity-100 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all active:scale-90" 
                            >
                                <RotateCcw size={14} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex w-full md:w-auto items-center gap-3">
                        {isDeclared && onWhatsApp && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                className="p-3 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-2xl transition-all hover:bg-tertiary hover:text-white active:scale-95 shadow-lg glow-emerald"
                            >
                                <MessageCircle size={20} strokeWidth={2} />
                            </button>
                        )}
                        <button onClick={onPay} className="flex-1 md:flex-initial text-center justify-center px-8 py-3.5 bg-surface-low border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white hover:text-surface-lowest font-premium active:scale-95">
                            COBRAR ${amount.toFixed(2)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRefundSteps = () => (
        <div className="space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-surface-low rounded-[2rem] border border-white/5 gap-8 shadow-architect">
                <div className="flex items-center gap-6 w-full">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${isCompleted ? 'bg-tertiary/10 text-tertiary glow-emerald' : 'bg-primary/10 text-primary glow-azure'}`}>
                        {isCompleted ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <AlertCircle size={24} strokeWidth={2.5} />}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest font-premium">SITUACIÓN TÁCTICA</div>
                        <div className="text-sm font-black text-on-surface tracking-tight uppercase font-premium truncate mt-1">{status}</div>
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="w-full md:w-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest glow-azure hover:scale-[1.02] active:scale-95 transition-all">INICIAR PROCESO</button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="w-full md:w-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest glow-azure hover:scale-[1.02] active:scale-95 transition-all font-premium">RECIBIR MENSAJE</button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="w-full md:w-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest glow-azure hover:scale-[1.02] active:scale-95 transition-all font-premium">CONFIRMAR FASE</button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-6 bg-tertiary/5 rounded-[2rem] border border-tertiary/20 hover:bg-tertiary/10 transition-all cursor-pointer group shadow-architect">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-tertiary/20 rounded-xl text-tertiary glow-emerald-low">
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] font-premium">ORDEN DE RESOLUCIÓN</div>
                            <div className="text-[11px] font-black text-on-surface tracking-tight truncate max-w-[200px] font-premium mt-0.5">{resolutionFile.name}</div>
                        </div>
                    </div>
                    <Download size={18} strokeWidth={2.5} className="text-tertiary opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
            
            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex items-center justify-center gap-4 p-8 border-2 border-dashed border-white/5 text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-[2.5rem] transition-all group font-premium">
                    <UploadCloud size={20} className="group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">CARGAR DOCUMENTO FINAL</span>
                </button>
            )}
        </div>
    );

    return (
        <div className={`p-8 sm:p-12 rounded-[3.5rem] shadow-2xl transition-all duration-700 group overflow-hidden relative border ${isCompleted ? 'bg-tertiary/5 border-tertiary/10 border-holographic' : 'bg-surface-lowest border-white/5 hover:border-white/10'}`}>
            {/* Mission Status Indicator Bar */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] transition-all duration-1000 ${isCompleted ? 'bg-tertiary glow-emerald' : (overdueStatus ? 'bg-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-primary/20 group-hover:bg-primary group-hover:glow-azure')}`}></div>

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-8 mb-12 relative z-10">
                <div className="flex items-center gap-6 min-w-0 flex-1">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-1000 ${isCompleted ? 'bg-tertiary/10 text-tertiary shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]' : 'bg-surface text-on-surface-variant/40 group-hover:text-primary group-hover:bg-primary/5 border border-white/5 shadow-architect'}`}>
                        {type === 'iva' ? <BadgePercent size={28} strokeWidth={1.5} /> : type === 'renta' ? <Calendar size={28} strokeWidth={1.5} /> : <HandCoins size={28} strokeWidth={1.5} />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-[0.3em] font-premium mb-1.5">{period ? formatPeriodForDisplay(period) : 'PROTOCOLOS ESPECIALES'}</p>
                        <h4 className="font-premium font-black text-on-surface/90 text-2xl sm:text-4xl tracking-tight leading-tight uppercase truncate">{title}</h4>
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
                <div className="mt-12 pt-10 border-t border-white/5 flex gap-4 relative z-10">
                    <button onClick={onDeclare} className="flex-grow py-5 bg-primary/10 text-primary border border-primary/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl hover:bg-primary hover:text-white active:scale-95 text-center font-premium">
                        EJECUTAR EXPEDIENTE
                    </button>
                    <button onClick={onUpload} className="p-5 bg-surface-low border border-white/5 rounded-2xl text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all duration-700 active:scale-95 flex-shrink-0 shadow-architect">
                        <UploadCloud size={24} strokeWidth={2} />
                    </button>
                </div>
            )}
        </div>
    );
};
