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
        ? 'border-emerald-200 dark:border-emerald-500/30'
        : overdueStatus && !isDeclared
            ? 'border-rose-200 dark:border-rose-500/30'
            : 'border-slate-100 dark:border-white/10 hover:border-primary/20';

    const topBar = isCompleted
        ? 'bg-emerald-500'
        : overdueStatus && !isDeclared
            ? 'bg-rose-500 animate-pulse'
            : 'bg-slate-100 dark:bg-white/5 group-hover:bg-primary/60';

    // ── Badge de estado ────────────────────────────────────
    const StatusBadge = () => {
        let label = 'Pendiente';
        let cls = 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10';

        if (isCompleted) { label = '✓ Completo'; cls = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'; }
        else if (status === 'Solicitado') { label = 'En Trámite'; cls = 'bg-blue-50 text-blue-700 dark:bg-primary/10 dark:text-primary-low border-blue-100 dark:border-primary/20'; }
        else if (status === 'En Proceso') { label = 'Procesando'; cls = 'bg-blue-50 text-blue-700 dark:bg-primary/10 dark:text-primary-low border-blue-100 dark:border-primary/20'; }
        else if (status === DeclarationStatus.Cancelada || status === 'Cancelado') { label = '✖ Cancelado'; cls = 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'; }
        else if (isDeclared && !isPaid) { label = 'Cobro Pendiente'; cls = 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'; }
        else if (overdueStatus) { label = '⚠ Vencido'; cls = 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 animate-pulse'; }

        return (
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${cls}`}>
                {label}
            </span>
        );
    };

    // ── Pasos para IVA / Renta ─────────────────────────────
    const renderIvaRentaSteps = () => (
        <div className="space-y-3 relative z-10">
            {/* Paso 1: Declaración */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-500 ${
                isDeclared
                    ? 'bg-blue-50/60 dark:bg-primary/5 border-blue-100 dark:border-primary/20'
                    : overdueStatus
                        ? 'bg-rose-50/60 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20'
                        : 'bg-slate-50 dark:bg-surface-low/20 border-slate-100 dark:border-white/5 hover:border-primary/30'
            }`}>
                <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700 ${
                        isDeclared ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 dark:shadow-blue-500/20' 
                        : overdueStatus ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    }`}>
                        {isDeclared ? <LucideIcons.ShieldCheck size={16} strokeWidth={2.5} /> : <LucideIcons.Send size={14} strokeWidth={2} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Paso 1</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {type === 'iva' ? 'Declaración SRI (IVA)' : 'Declaración Impuesto a la Renta'}
                        </p>
                    </div>
                </div>

                {isDeclared ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-primary-low bg-blue-50 dark:bg-primary/5 px-4 py-2 rounded-xl border border-blue-100 dark:border-primary/20 text-xs font-bold">
                            <LucideIcons.CheckCircle2 size={14} strokeWidth={2.5} />
                            Declarado
                        </div>
                        {!hasProofFile && onUpload && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onUpload(); }}
                                title="Subir comprobante PDF"
                                className="p-2.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-600 transition-all active:scale-90"
                            >
                                <LucideIcons.UploadCloud size={16} strokeWidth={2} />
                            </button>
                        )}
                        {onRevertDeclaration && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRevertDeclaration(); }}
                                title="Revertir declaración"
                                className="p-2 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 transition-all active:scale-90"
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
                                className="p-2.5 bg-white dark:bg-surface-low/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-300 transition-all active:scale-90"
                            >
                                <LucideIcons.X size={16} strokeWidth={2} />
                            </button>
                        )}
                        {onUpload ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpload(); }}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                                        overdueStatus
                                            ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-rose-500/20'
                                            : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400 shadow-md'
                                    }`}
                                >
                                    <LucideIcons.UploadCloud size={14} strokeWidth={2.5} />
                                    {overdueStatus ? 'Subir Comprobante (Vencido)' : 'Subir Comprobante'}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeclare(); }}
                                    title="Registrar declaración manualmente sin PDF (emergencia)"
                                    className="p-2.5 bg-white dark:bg-surface-low/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-90 flex-shrink-0"
                                >
                                    <LucideIcons.Check size={16} strokeWidth={2.5} />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeclare(); }}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                                    overdueStatus
                                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-rose-500/20'
                                        : 'bg-slate-900 dark:bg-primary text-white hover:bg-slate-800 dark:hover:bg-primary-low shadow-md'
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
                    ? 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20'
                    : 'bg-slate-50 dark:bg-surface-low/20 border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30'
            }`}>
                <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700 ${
                        isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-500/20'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    }`}>
                        <LucideIcons.HandCoins size={16} strokeWidth={2} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Paso 2</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Honorarios del Servicio</p>
                    </div>
                </div>

                {isPaid ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20 text-sm font-bold">
                            <LucideIcons.Check size={14} strokeWidth={3} />
                            Pagado — ${amount.toFixed(2)}
                        </div>
                        {onRevertPayment && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRevertPayment(); }}
                                title="Revertir pago"
                                className="p-2 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 transition-all active:scale-90"
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
                                className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-200 dark:shadow-emerald-500/20 transition-all"
                            >
                                <LucideIcons.MessageCircle size={16} strokeWidth={2.5} />
                            </button>
                        )}
                        {!isPaid && onCancel && status !== DeclarationStatus.Cancelada && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                                title="Cancelar pago/servicio"
                                className="p-2.5 bg-white dark:bg-surface-low/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-300 transition-all active:scale-90"
                            >
                                <LucideIcons.X size={16} strokeWidth={2} />
                            </button>
                        )}
                        <button
                            onClick={onPay}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md ${
                                isDeclared
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 dark:shadow-emerald-500/20'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-default'
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
        <div className="space-y-4 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 dark:bg-surface-low/20 rounded-2xl border border-slate-100 dark:border-white/5 gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-700 ${
                        isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                            : 'bg-blue-50 dark:bg-primary/10 text-blue-600 dark:text-primary-low border-blue-100 dark:border-primary/20'
                    }`}>
                        {isCompleted ? <LucideIcons.CheckCircle2 size={22} strokeWidth={2.5} /> : <LucideIcons.AlertCircle size={22} strokeWidth={2.5} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado del Trámite</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{status || 'Pendiente de inicio'}</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {status === 'Pendiente' && (
                        <button onClick={() => onAction?.('start')} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 dark:bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary dark:hover:bg-primary-low active:scale-95 transition-all">
                            Iniciar Trámite
                        </button>
                    )}
                    {status === 'Solicitado' && (
                        <button onClick={() => onAction?.('message_received')} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary active:scale-95 transition-all">
                            Mensaje Recibido
                        </button>
                    )}
                    {(status === 'Esperando Confirmación' || status === 'En Proceso') && (
                        <button onClick={() => onAction?.('confirm')} className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary active:scale-95 transition-all">
                            Confirmar Fase
                        </button>
                    )}
                </div>
            </div>

            {resolutionFile && (
                <div className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/40 cursor-pointer group transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <LucideIcons.FileText size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Resolución Adjunta</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{resolutionFile.name}</p>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                        <LucideIcons.Download size={16} strokeWidth={2} />
                    </div>
                </div>
            )}

            {!resolutionFile && !isCompleted && onUpload && (
                <button onClick={onUpload} className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-400 hover:border-primary/40 dark:hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-2xl transition-all group">
                    <LucideIcons.UploadCloud size={20} strokeWidth={2} className="group-hover:-translate-y-0.5 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Subir Resolución PDF</span>
                </button>
            )}
        </div>
    );

    return (
        <div className={`rounded-3xl shadow-sm hover:shadow-md transition-all duration-700 group overflow-hidden relative border bg-white dark:bg-surface/40 backdrop-blur-3xl ${cardBorder}`}>
            {/* Barra de estado superior */}
            <div className={`h-1 w-full transition-all duration-700 ${topBar}`} />

            <div className="p-6 sm:p-8">
                {/* Encabezado de la tarjeta */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all duration-700 ${
                            isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-white/5 group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/20'
                        }`}>
                            {type === 'iva'
                                ? <LucideIcons.BadgePercent size={22} strokeWidth={1.5} />
                                : type === 'renta'
                                    ? <LucideIcons.CalendarDays size={22} strokeWidth={1.5} />
                                    : <LucideIcons.HandCoins size={22} strokeWidth={1.5} />
                            }
                        </div>
                        <div className="min-w-0">
                            {period && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    {formatPeriodForDisplay(period)}
                                </p>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-tight truncate">
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
