import React from 'react';
import { X, Download, FileText, ShieldCheck, Printer, Copy } from 'lucide-react';
import { Declaration, Client } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';
import { Modal } from '../../ui/Modal';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    declaration: Declaration | null;
    client: Client;
    onDownload: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    isOpen,
    onClose,
    declaration,
    client,
    onDownload
}) => {
    if (!declaration || !declaration.proofFile) return null;

    const data = declaration.proofFile.metadata;
    const text = data?.previewText || '';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Vista Previa: ${declaration.proofFile.name}`}>
            <div className="flex flex-col h-[80vh] bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden relative">
                {/* PDF Header Simulator */}
                <div className="p-8 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-brand-teal mb-2">
                                <ShieldCheck size={20} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Servicio de Rentas Internas</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {data?.formType === 'IVA' ? 'DECLARACIÓN DE IVA' : 'DECLARACIÓN DE RENTA'}
                            </h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{formatPeriodForDisplay(declaration.period)}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Número de Adhesivo</p>
                            <p className="font-mono font-bold text-slate-900 dark:text-white">{data?.sriId || '0000000000'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 py-6 border-t border-slate-50 dark:border-slate-700/50">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">RUC Emisor</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{client.ruc}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Razón Social</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{client.name}</p>
                        </div>
                    </div>
                </div>

                {/* Content Simulator */}
                <div className="flex-1 overflow-y-auto p-8 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800">
                        {text ? (
                            <div className="whitespace-pre-wrap divide-y divide-slate-100 dark:divide-slate-700/30">
                                {text.split('\n').filter(line => line.trim().length > 0).map((line, i) => (
                                    <div key={i} className="py-2 border-b border-slate-50 dark:border-slate-700/20 last:border-0 flex justify-between items-center gap-4">
                                        <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">[{i + 1}]</span>
                                        <span className="flex-1 text-slate-700 dark:text-slate-300 font-medium">{line.trim()}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                <FileText size={40} className="mb-2" />
                                <p>Cargando previsualización de datos...</p>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 italic">Resumen de liquidación</span>
                            <span className="text-lg font-black text-emerald-500">${(data?.amount || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex gap-2">
                        <button className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-brand-teal rounded-xl transition-all border border-slate-100 dark:border-slate-800">
                            <Printer size={18} />
                        </button>
                        <button className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-brand-teal rounded-xl transition-all border border-slate-100 dark:border-slate-800">
                            <Copy size={18} />
                        </button>
                    </div>
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-3 px-8 py-3 bg-brand-navy dark:bg-brand-teal text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                    >
                        <Download size={18} /> Descargar Original
                    </button>
                </div>
            </div>
        </Modal>
    );
};
