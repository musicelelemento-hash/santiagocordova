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
    hasProofFile?: boolean;
    description?: string;
    onDeclare?: () => void;
    onPay?: () => void;
    onUpload?: () => void;
    onWhatsApp?: () => void;
    onAction?: (action: any) => void;
    resolutionFile?: StoredFile;
    declarationDate?: string;
    onRevertPayment?: () => void;
    onRevertDeclaration?: () => void;
    onCancel?: () => void;
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
    hasProofFile,
    onDeclare,
    onPay,
    onUpload,
    onWhatsApp,
    onAction,
    resolutionFile,
    onRevertPayment,
    onRevertDeclaration,
    onCancel,
    dueDate,
    isOverdue
}) => {
    const isIvaOrRenta = type === 'iva' || type === 'renta';
    const isDeclared = initialIsDeclared ?? (status === DeclarationStatus.Enviada || status === DeclarationStatus.Pagada);
    const isCompleted = isIvaOrRenta ? (isDeclared && isPaid) : (status === 'Completado');
    const overdueStatus = isOverdue ?? (dueDate ? (new Date() > dueDate) : false);

    // ── Colores de estado ──────────────────────────────────
    const cardBorder = isCompleted
        ? 'border-[#00A896]/40 dark:border-[#00A896]/40 shadow-emerald-500/5'
        : overdueStatus && !isDeclared
            ? 'border-rose-500/40 dark:border-rose-500/40 shadow-rose-500/5'
            : 'border-slate-200/80 dark:border-white/10 hover:border-[#2B6AFF]/30';

    const topBar = isCompleted
        ? 'bg-gradient-to-r from-[#00A896] to-teal-400 shadow-[0_0_8px_#00A896]'
        : overdueStatus && !isDeclared
            ? 'bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse shadow-[0_0_8px_#f43f5e]'
            : 'bg-slate-200 dark:bg-white/10 group-hover:bg-[#2B6AFF]';

    // ── Badge de estado ────────────────────────────────────
    const StatusBadge = () => {
        let label = 'Pendiente';
        let cls = 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10';

        if (isCompleted) { label = '✓ Completo'; cls = 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'; }
        else if (status === 'Solicitado') { label = 'En Trámite'; cls = 'bg-[#2B6AFF]/15 text-[#2B6AFF] dark:text-[#bfc6e0] border-[#2B6AFF]/30'; }
        else if (status === 'En Proceso') { label = 'Procesando'; cls = 'bg-[#2B6AFF]/15 text-[#2B6AFF] dark:text-[#bfc6e0] border-[#2B6AFF]/30'; }
        else if (status === DeclarationStatus.Cancelada || status === 'Cancelado') { label = '✖ Cancelado'; cls = 'bg-rose-500/10 text-rose-500 border-rose-500/20'; }
        else if (isDeclared && !isPaid) { label = 'Cobro Pendiente'; cls = 'bg-[#C9A96E]/15 text-[#C9A96E] border-[#C9A96E]/30'; }
        else if (overdueStatus) { label = '⚠ Vencido'; cls = 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.2)]'; }

        return (
            <span className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${cls}`}>
                {label}
            </span>
        );
    };

    // ── Pasos para IVA / Renta ─────────────────────────────
    const renderIvaRentaSteps = () => (
        <div className="space-y-3 relative z-10 font-mono">
            {/* Paso 1: Declaración */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-500 ${
                isDeclared
                    ? 'bg-[#2B6AFF]/5 dark:bg-[#2B6AFF]/10 border-[#2B6AFF]/20'
                    : overdueStatus
                        ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20'
                        : 'bg-slate-50 dark:bg-[#0b1326]/60 border-slate-200/60 dark:border-white/10 hover:border-[#2B6AFF]/30'
            }`}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700 ${
                        isDeclared ? 'bg-[#2B6AFF] text-white shadow-lg shadow-[#2B6AFF]/20' 
                        : overdueStatus ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/20'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                    }`}>
                        {isDeclared ? <LucideIcons.ShieldCheck size={18} strokeWidth={2.5} /> : <LucideIcons.Send size={16} strokeWidth={2} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Paso 1</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-display">
                            {type === 'iva' ? 'Declaración SRI (IVA)' : 'Declaración Impuesto a la Renta'}
                        </p>
                    </div>
                </div>

                {isDeclared ? (
                    <div className="flex items-center gap-2">
                        {hasProofFile ? (
                            <div className="flex items-center gap-2 text-[#00A896] bg-[#00A896]/15 px-4 py-2 rounded-xl border border-[#00A896]/30 text-xs font-bold shadow-sm">
                                <LucideIcons.ShieldCheck size={14} strokeWidth={2.5} />
                                Respaldado
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-amber-500 bg-amber-500/15 px-4 py-2 rounded-xl border border-amber-500/30 text-xs font-bold animate-pulse">
                                <LucideIcons.AlertTriangle size={14} strokeWidth={2.5} />
                                Sin Comprobante
                            </div>
                        )}
                        {!hasProofFile && onUpload && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onUpload(); }}
                                title="Subir comprobante PDF"
                                className="p-2.5 bg-[#2B6AFF]/10 border border-[#2B6AFF]/30 rounded-xl text-[#2B6AFF] hover:text-white hover:bg-[#2B6AFF] transition-all active:scale-90"
                            >
                                <LucideIcons.UploadCloud size={16} strokeWidth={2} />
                            </button>
                        )}
                        {onRevertDeclaration && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRevertDeclaration(); }}
                                title="Revertir declaración"
                                className="p-2 rounded-xl hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-all active:scale-90"
                            >
                                <LucideIcons.RotateCcw size={14} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {onCancel && status !== DeclarationStatus.Cancelada && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                                title="Cancelar declaración"
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 transition-all active:scale-90"
                            >
                                <LucideIcons.X size={16} strokeWidth={2} />
                            </button>
                        )}
                        {onUpload ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpload(); }}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 border border-white/10 ${
                                        overdueStatus
                                            ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20'
                                            : 'bg-gradient-to-r from-[#2B6AFF] to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-[#2B6AFF]/20'
                                    }`}
                                >
                                    <LucideIcons.UploadCloud size={14} strokeWidth={2.5} />
                                    {overdueStatus ? 'Subir Comprobante (Vencido)' : 'Subir Comprobante'}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeclare?.(); }}
                                    title="Registrar declaración manualmente sin PDF (emergencia)"
                                    className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-[#00A896] hover:border-[#00A896]/30 transition-all active:scale-90 flex-shrink-0"
                                >
                                    <LucideIcons.Check size={16} strokeWidth={2.5} />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeclare?.(); }}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 border border-white/10 ${
                                    overdueStatus
                                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20'
                                        : 'bg-[#2B6AFF] text-white hover:bg-blue-600 shadow-md shadow-[#2B6AFF]/20'
                                }`}
                            >
                                <LucideIcons.Send size={13} strokeWidth={2.5} />
                                {overdueStatus ? 'Declarar (Vencido)' : 'Registrar Declaración'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Paso 2: Honorarios / Pago */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-500 ${
                isPaid
                    ? 'bg-[#00A896]/5 dark:bg-[#00A896]/10 border-[#00A896]/20'
                    : 'bg-slate-50 dark:bg-[#0b1326]/60 border-slate-200/60 dark:border-white/10 hover:border-[#00A896]/30'
            }`}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700 ${
                        isPaid ? 'bg-[#00A896] text-white shadow-lg shadow-[#00A896]/20'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                    }`}>
                        <LucideIcons.HandCoins size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Paso 2</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-display">Honorarios del Servicio</p>
                    </div>
                </div>

                {isPaid ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[#00A896] bg-[#00A896]/15 px-4 py-2 rounded-xl border border-[#00A896]/30 text-sm font-bold shadow-sm">
                            <LucideIcons.Check size={14} strokeWidth={3} />
                            Pagado — ${amount.toFixed(2)}
                        </div>
                        {onRevertPayment && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRevertPayment(); }}
                                title="Revertir pago"
                                className="p-2 rounded-xl hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-all active:scale-90"
                            >
                                <LucideIcons.RotateCcw size={14} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {isDeclared && onWhatsApp && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                                title="Cobrar por WhatsApp"
                                className="p-2.5 bg-[#00A896] text-white rounded-xl hover:bg-teal-600 active:scale-95 shadow-md shadow-[#00A896]/20 transition-all border border-white/10"
                            >
                                <LucideIcons.MessageCircle size={16} strokeWidth={2.5} />
                            </button>
                        )}
                        {!isPaid && onCancel && status !== DeclarationStatus.Cancelada && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                                title="Cancelar pago/servicio"
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 transition-all active:scale-90"
                            >
                                <LucideIcons.X size={16} strokeWidth={2} />
                            </button>
                        )}
                        <button
                            onClick={onPay}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md border border-white/10 ${
                                isDeclared
                                    ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white hover:from-teal-600 hover:to-emerald-600 shadow-[#00A896]/20'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-default'
                            }`}
                            disabled={!isDeclared}
                            title={!isDeclared ? 'Primero registre la declaración' : undefined}
                        >
                            <LucideIcons.DollarSign size={14} strokeWidth={2.5} />
                            Marcar como Pagado — ${amount.toFixed(2)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Pasos para Devoluciones / Trámites ─────────────────
    const renderRefundSteps = () => (
        <div className="space-y-4 relative z-10 font-mono">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 dark:bg-[#0b1326]/60 rounded-2xl border border-slate-200/60 dark:border-white/10 gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-700 ${
                        isCompleted
                            ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-md shadow-[#00A896]/10'
                            : 'bg-[#2B6AFF]/15 text-[#2B6AFF] border-[#2B6AFF]/30 shadow-md shadow-[#2B6AFF]/10'
                    }`}>
                        {isCompleted ? <LucideIcons.CheckCircle2 size={22} strokeWidth={2.5} /> : <LucideIcons.AlertCircle size={22} strokeWidth={2.5} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado del Trámite</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-display">{status || 'Pendiente de inicio'}</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="flex-1 sm:flex-none px-6 py-2.5 bg-[#2B6AFF] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-[#2B6AFF]/20 border border-white/10">
                            Iniciar Trámite
                        </button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="flex-1 sm:flex-none px-6 py-2.5 bg-[#C9A96E] text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-amber-500 active:scale-95 transition-all shadow-md shadow-amber-500/20">
                            Mensaje Recibido
                        </button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="flex-1 sm:flex-none px-6 py-2.5 bg-[#00A896] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-600 active:scale-95 transition-all shadow-md shadow-[#00A896]/20 border border-white/10">
                            Confirmar Fase
                        </button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-4 bg-[#00A896]/5 rounded-2xl border border-[#00A896]/20 hover:border-[#00A896]/40 cursor-pointer group transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#00A896]/15 rounded-xl text-[#00A896]">
                            <LucideIcons.FileText size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Resolución Adjunta</p>
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{resolutionFile.name}</p>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center text-slate-400 group-hover:bg-[#00A896] group-hover:text-white transition-all">
                        <LucideIcons.Download size={16} strokeWidth={2} />
                    </div>
                </div>
            )}

            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 hover:border-[#00A896]/40 dark:hover:border-[#00A896]/40 hover:bg-[#00A896]/5 hover:text-[#00A896] rounded-2xl transition-all group font-mono">
                    <LucideIcons.UploadCloud size={20} strokeWidth={2} className="group-hover:-translate-y-0.5 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Subir Resolución PDF</span>
                </button>
            )}
        </div>
    );

    return (
        <div className={`rounded-3xl shadow-lg transition-all duration-700 group overflow-hidden relative border bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl dark:border-t-white/20 ${cardBorder}`}>
            {/* Barra de estado superior */}
            <div className={`h-1 w-full transition-all duration-700 ${topBar}`} />

            <div className="p-6 sm:p-8">
                {/* Encabezado de la tarjeta */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-700 ${
                            isCompleted
                                ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-md shadow-[#00A896]/10'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 group-hover:text-[#2B6AFF] group-hover:bg-[#2B6AFF]/10 group-hover:border-[#2B6AFF]/30'
                        }`}>
                            {type === 'iva'
                                ? <LucideIcons.BadgePercent size={22} strokeWidth={1.5} />
                                : type === 'renta'
                                    ? <LucideIcons.CalendarDays size={22} strokeWidth={1.5} />
                                    : <LucideIcons.HandCoins size={22} strokeWidth={1.5} />
                            }
                        </div>
                        <div className="min-w-0 font-mono">
                            {period && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    {formatPeriodForDisplay(period)}
                                </p>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate font-display">
                                {title}
                            </h4>
                        </div>
                    </div>
                    <StatusBadge />
                </div>

                {/* Contenido según tipo */}
                {isIvaOrRenta ? renderIvaRentaSteps() : renderRefundSteps()}
            </div>
        </div>
    );
};
