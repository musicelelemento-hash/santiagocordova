import React from 'react';
import { FileText, Download, Eye, Calendar, Clock, MessageCircle } from 'lucide-react';
import { Declaration, Client, DeclarationStatus } from '../../../types';
import { formatPeriodForDisplay, safeFormat } from '../../../services/sri';

interface DocumentTimelineProps {
    client: Client;
    onViewPreview: (decl: Declaration) => void;
    onDownload: (decl: Declaration) => void;
    onWhatsApp?: (period: string) => void;
}

export const DocumentTimeline: React.FC<DocumentTimelineProps> = ({ client, onViewPreview, onDownload, onWhatsApp }) => {
    const documents = [...(client.declarations || [])]
        .filter(d => d.proof_file || d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada)
        .sort((a, b) => b.period.localeCompare(a.period));

    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">No hay comprobantes cargados en la línea de tiempo.</p>
            </div>
        );
    }

    return (
        <div className="relative pl-8 sm:pl-12 space-y-12 sm:space-y-16 before:absolute before:left-[15px] sm:before:left-[11px] before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-cyan-500/40 before:via-white/10 before:to-transparent">
            {documents.map((doc, idx) => (
                <div key={doc.period + idx} className="relative group">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[22px] sm:-left-[45px] top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-950 border-4 ${!doc.proof_file ? 'border-rose-500' : 'border-cyan-500'} z-10 shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:scale-125 transition-all duration-500`}>
                        <div className={`absolute inset-0 ${!doc.proof_file ? 'bg-rose-400' : 'bg-cyan-400'} blur-[4px] opacity-20 animate-pulse`}></div>
                    </div>

                    <div className="bg-slate-950/60 backdrop-blur-2xl rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] hover:shadow-cyan-500/20 hover:border-cyan-500/30 transition-all duration-700 relative overflow-hidden aura-premium">
                        {/* Status Glow */}
                        <div className="absolute -right-20 -top-20 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-1000"></div>

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8 relative z-10">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.4rem] bg-slate-950 border border-white/10 flex items-center justify-center text-cyan-400 shadow-inner group-hover:border-cyan-500/40 transition-colors">
                                    <FileText size={24} className="sm:w-8 sm:h-8" />
                                </div>
                                <div>
                                    <h4 className="font-black text-white text-sm sm:text-base uppercase tracking-tight">
                                        {doc.proof_file?.metadata?.formType || 'DECLARACIÓN'} {formatPeriodForDisplay(doc.period)}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                                            📎 {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'EEE/MMM/yy').toUpperCase()}
                                        </div>
                                        {doc.declaredAt && (
                                            <>
                                                <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                                                    SRI: {safeFormat(doc.declaredAt, 'dd/MMM/yy').toUpperCase()}
                                                </div>
                                            </>
                                        )}
                                        <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                            <Clock size={12} />
                                            Hora: {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {onWhatsApp && (
                                    <button
                                        onClick={() => onWhatsApp(doc.period)}
                                        className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm"
                                        title="Solicitar Pago WhatsApp"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => onViewPreview(doc)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-brand-teal hover:text-white text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Eye size={14} /> Vista Previa
                                </button>
                                <button
                                    onClick={() => onDownload(doc)}
                                    className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-brand-teal rounded-xl transition-all"
                                >
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>

                        {doc.proof_file?.metadata?.previewText && (
                            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 italic text-[10px] text-slate-500 line-clamp-2">
                                "{doc.proof_file.metadata.previewText.substring(0, 200)}..."
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
