import React from 'react';
import {
    ShieldCheck, AlertTriangle, Send, DollarSign, MessageCircle, FileText,
    UploadCloud, Eye, RotateCcw, XCircle, CheckCircle2, Clock, Activity, Zap
} from 'lucide-react';
import { Client, DeclarationStatus, TaxObligationType, Declaration } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';
import { getClientServiceFee } from '../../../services/clientService';
import { useToast } from '../../../context/ToastContext';

interface ExecutiveObligationsTableProps {
    client: Client;
    complianceStats: any;
    serviceFees: any;
    onDeclare: (period: string) => void;
    onQuickPay: (period: string) => void;
    onUploadTarget: (target: { type: string; period?: string }) => void;
    proofInputRef: React.RefObject<HTMLInputElement>;
    onWhatsAppPaymentRequest?: (period: string, type: string) => void;
    onRevertDeclaration?: (period: string) => void;
    onCancelDeclaration?: (period: string) => void;
    setPreviewItem?: (item: Declaration | null) => void;
}

export const ExecutiveObligationsTable: React.FC<ExecutiveObligationsTableProps> = ({
    client,
    complianceStats,
    serviceFees,
    onDeclare,
    onQuickPay,
    onUploadTarget,
    proofInputRef,
    onWhatsAppPaymentRequest,
    onRevertDeclaration,
    onCancelDeclaration,
    setPreviewItem
}) => {
    const { toast } = useToast();

    // Extracción de obligaciones activas de complianceStats o del cliente
    const ivaData = complianceStats?.iva;
    const rentaData = complianceStats?.renta;

    const ivaPeriod = ivaData?.period || '';
    const ivaDeclared = ivaData?.isDeclared || false;
    const ivaPaid = ivaData?.is_paid || false;
    const ivaDeclItem = (client.declarations || []).find(d => d.period === ivaPeriod);

    const rentaPeriod = rentaData?.period || '';
    const rentaDeclared = rentaData?.isDeclared || false;
    const rentaPaid = rentaData?.is_paid || false;
    const rentaDeclItem = (client.declarations || []).find(d => d.period === rentaPeriod);

    const ivaFee = ivaPeriod ? getClientServiceFee(client, serviceFees, ivaPeriod) : 0;
    const rentaFee = client.fee_structure?.annual ?? 10;

    const triggerUpload = (type: string, period?: string) => {
        onUploadTarget({ type, period });
        setTimeout(() => {
            if (proofInputRef.current) proofInputRef.current.click();
        }, 50);
    };

    return (
        <div className="w-full bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200/60 dark:border-white/5 overflow-hidden shadow-sm animate-in fade-in duration-300">
            {/* Encabezado del Panel de Control */}
            <div className="p-5 sm:px-6 bg-slate-50/70 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                            Panel de Control Tributario y Honorarios
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Gestión ejecutiva en 1-clic por período activo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-slate-200/50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                        {client.taxProfile?.ivaFrequency || 'Mensual'}
                    </span>
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                        (ivaPaid && (!rentaData?.needed || rentaPaid))
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}>
                        {(ivaPaid && (!rentaData?.needed || rentaPaid)) ? '✓ Honorarios al Día' : '⚠ Cobro Pendiente'}
                    </span>
                </div>
            </div>

            {/* Tabla de Obligaciones */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200/40 dark:border-white/5 bg-slate-50/40 dark:bg-slate-950/20 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <th className="py-3.5 px-6">Obligación / Período</th>
                            <th className="py-3.5 px-4">Estado SRI</th>
                            <th className="py-3.5 px-4">Comprobante PDF</th>
                            <th className="py-3.5 px-4">Honorarios</th>
                            <th className="py-3.5 px-6 text-right">Acciones Directas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-medium">
                        {/* FILA 1: IVA */}
                        {ivaPeriod && (
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 font-bold">
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                                Declaración IVA ({client.taxProfile?.ivaFrequency || 'Mensual'})
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-mono">
                                                Período: {formatPeriodForDisplay(ivaPeriod)}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                <td className="py-4 px-4">
                                    {ivaDeclared ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 rounded-xl text-[10px] font-bold">
                                            <ShieldCheck size={12} /> Declarado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 rounded-xl text-[10px] font-bold">
                                            <Clock size={12} /> Pendiente
                                        </span>
                                    )}
                                </td>

                                <td className="py-4 px-4">
                                    {ivaDeclItem?.proof_file ? (
                                        <button
                                            onClick={() => setPreviewItem && setPreviewItem(ivaDeclItem)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <Eye size={12} /> Ver Respaldo PDF
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => triggerUpload('iva', ivaPeriod)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <UploadCloud size={12} /> Subir PDF
                                        </button>
                                    )}
                                </td>

                                <td className="py-4 px-4 font-mono font-bold">
                                    <div className="flex items-center gap-2">
                                        <span className={ivaPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}>
                                            ${ivaFee.toFixed(2)}
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase font-sans ${
                                            ivaPaid
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                        }`}>
                                            {ivaPaid ? 'Pagado' : 'Pendiente'}
                                        </span>
                                    </div>
                                </td>

                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {!ivaDeclared && (
                                            <button
                                                onClick={() => onDeclare(ivaPeriod)}
                                                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95"
                                            >
                                                Declarar
                                            </button>
                                        )}

                                        {!ivaPaid && (
                                            <button
                                                onClick={() => onQuickPay(ivaPeriod)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <DollarSign size={12} /> Cobrar ${ivaFee.toFixed(2)}
                                            </button>
                                        )}

                                        {onWhatsAppPaymentRequest && client.phones?.length && (
                                            <button
                                                onClick={() => onWhatsAppPaymentRequest(ivaPeriod, 'IVA')}
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl border border-emerald-200/40"
                                                title="Cobrar por WhatsApp"
                                            >
                                                <MessageCircle size={15} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* FILA 2: IMPUESTO A LA RENTA (Si aplica) */}
                        {rentaData?.needed && (
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 font-bold">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                                Impuesto a la Renta Anual
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-mono">
                                                Período: {rentaPeriod}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                <td className="py-4 px-4">
                                    {rentaDeclared ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 rounded-xl text-[10px] font-bold">
                                            <ShieldCheck size={12} /> Declarado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 rounded-xl text-[10px] font-bold">
                                            <Clock size={12} /> Pendiente
                                        </span>
                                    )}
                                </td>

                                <td className="py-4 px-4">
                                    {rentaDeclItem?.proof_file ? (
                                        <button
                                            onClick={() => setPreviewItem && setPreviewItem(rentaDeclItem)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <Eye size={12} /> Ver Respaldo PDF
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => triggerUpload('renta', rentaPeriod)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <UploadCloud size={12} /> Subir PDF
                                        </button>
                                    )}
                                </td>

                                <td className="py-4 px-4 font-mono font-bold">
                                    <div className="flex items-center gap-2">
                                        <span className={rentaPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}>
                                            ${rentaFee.toFixed(2)}
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase font-sans ${
                                            rentaPaid
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                        }`}>
                                            {rentaPaid ? 'Pagado' : 'Pendiente'}
                                        </span>
                                    </div>
                                </td>

                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {!rentaDeclared && (
                                            <button
                                                onClick={() => onDeclare(rentaPeriod)}
                                                className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95"
                                            >
                                                Declarar Renta
                                            </button>
                                        )}

                                        {!rentaPaid && (
                                            <button
                                                onClick={() => onQuickPay(rentaPeriod)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <DollarSign size={12} /> Cobrar ${rentaFee.toFixed(2)}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
