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
        <div className="w-full bg-[#051424]/90 backdrop-blur-2xl rounded-3xl border border-white/10 border-t-white/20 overflow-hidden shadow-2xl animate-in fade-in duration-300">
            {/* Encabezado del Panel de Control */}
            <div className="p-5 sm:px-6 bg-[#0b1326]/80 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 flex items-center justify-center font-bold shadow-md shadow-[#00A896]/10">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white tracking-tight font-display">
                            Mesa de Control Tributario y Honorarios
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono font-medium">
                            Gestión ejecutiva en 1-clic por período activo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 font-mono">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                        {client.taxProfile?.ivaFrequency || 'Mensual'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        (ivaPaid && (!rentaData?.needed || rentaPaid))
                            ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                        {(ivaPaid && (!rentaData?.needed || rentaPaid)) ? '✓ Honorarios al Día' : '⚠ Cobro Pendiente'}
                    </span>
                </div>
            </div>

            {/* Tabla de Obligaciones */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono">
                    <thead>
                        <tr className="border-b border-white/10 bg-[#020b14]/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <th className="py-4 px-6">Obligación / Período</th>
                            <th className="py-4 px-4">Estado SRI</th>
                            <th className="py-4 px-4">Comprobante PDF</th>
                            <th className="py-4 px-4">Honorarios</th>
                            <th className="py-4 px-6 text-right">Acciones Directas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs font-medium">
                        {/* FILA 1: IVA */}
                        {ivaPeriod && (
                            <tr className="hover:bg-white/5 transition-all">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#2B6AFF]/15 text-[#2B6AFF] border border-[#2B6AFF]/30 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white font-display">
                                                Declaración IVA ({client.taxProfile?.ivaFrequency || 'Mensual'})
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                Período: {formatPeriodForDisplay(ivaPeriod)}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                <td className="py-4 px-4">
                                    {ivaDeclared ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-full text-[10px] font-bold shadow-[0_0_8px_rgba(0,168,150,0.2)]">
                                            <ShieldCheck size={12} /> Declarado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-bold">
                                            <Clock size={12} /> Pendiente
                                        </span>
                                    )}
                                </td>

                                <td className="py-4 px-4">
                                    {ivaDeclItem?.proof_file ? (
                                        <button
                                            onClick={() => setPreviewItem && setPreviewItem(ivaDeclItem)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2B6AFF]/15 text-[#2B6AFF] hover:bg-[#2B6AFF]/25 border border-[#2B6AFF]/30 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <Eye size={12} /> Ver Respaldo PDF
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => triggerUpload('iva', ivaPeriod)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <UploadCloud size={12} /> Subir PDF
                                        </button>
                                    )}
                                </td>

                                <td className="py-4 px-4 font-mono font-bold">
                                    <div className="flex items-center gap-2">
                                        <span className={ivaPaid ? 'text-[#00A896]' : 'text-white'}>
                                            ${ivaFee.toFixed(2)}
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase border ${
                                            ivaPaid
                                                ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        }`}>
                                            {ivaPaid ? 'Pagado' : 'Pendiente'}
                                        </span>
                                    </div>
                                </td>

                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2 font-mono">
                                        {!ivaDeclared && (
                                            <button
                                                onClick={() => onDeclare(ivaPeriod)}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-[#2B6AFF] to-blue-600 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md shadow-[#2B6AFF]/20 transition-all active:scale-95 border border-white/10"
                                            >
                                                Declarar
                                            </button>
                                        )}

                                        {!ivaPaid && (
                                            <button
                                                onClick={() => onQuickPay(ivaPeriod)}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md shadow-[#00A896]/20 transition-all active:scale-95 flex items-center gap-1 border border-white/10"
                                            >
                                                <DollarSign size={12} /> Cobrar ${ivaFee.toFixed(2)}
                                            </button>
                                        )}

                                        {onWhatsAppPaymentRequest && client.phones?.length && (
                                            <button
                                                onClick={() => onWhatsAppPaymentRequest(ivaPeriod, 'IVA')}
                                                className="p-2 text-[#00A896] hover:bg-[#00A896]/15 rounded-xl border border-[#00A896]/30 transition-all"
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
                            <tr className="hover:bg-white/5 transition-all">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white font-display">
                                                Impuesto a la Renta Anual
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                Período: {rentaPeriod}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                <td className="py-4 px-4">
                                    {rentaDeclared ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 rounded-full text-[10px] font-bold shadow-[0_0_8px_rgba(0,168,150,0.2)]">
                                            <ShieldCheck size={12} /> Declarado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-bold">
                                            <Clock size={12} /> Pendiente
                                        </span>
                                    )}
                                </td>

                                <td className="py-4 px-4">
                                    {rentaDeclItem?.proof_file ? (
                                        <button
                                            onClick={() => setPreviewItem && setPreviewItem(rentaDeclItem)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2B6AFF]/15 text-[#2B6AFF] hover:bg-[#2B6AFF]/25 border border-[#2B6AFF]/30 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <Eye size={12} /> Ver Respaldo PDF
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => triggerUpload('renta', rentaPeriod)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl text-[10px] font-bold transition-all"
                                        >
                                            <UploadCloud size={12} /> Subir PDF
                                        </button>
                                    )}
                                </td>

                                <td className="py-4 px-4 font-mono font-bold">
                                    <div className="flex items-center gap-2">
                                        <span className={rentaPaid ? 'text-[#00A896]' : 'text-white'}>
                                            ${rentaFee.toFixed(2)}
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase border ${
                                            rentaPaid
                                                ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        }`}>
                                            {rentaPaid ? 'Pagado' : 'Pendiente'}
                                        </span>
                                    </div>
                                </td>

                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2 font-mono">
                                        {!rentaDeclared && (
                                            <button
                                                onClick={() => onDeclare(rentaPeriod)}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md shadow-purple-600/20 transition-all active:scale-95 border border-white/10"
                                            >
                                                Declarar Renta
                                            </button>
                                        )}

                                        {!rentaPaid && (
                                            <button
                                                onClick={() => onQuickPay(rentaPeriod)}
                                                className="px-3.5 py-1.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md shadow-[#00A896]/20 transition-all active:scale-95 flex items-center gap-1 border border-white/10"
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
