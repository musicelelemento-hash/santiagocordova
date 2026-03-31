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
        <div className="relative pl-8 sm:pl-12 space-y-12 sm:space-y-16 before:absolute before:left-[15px] sm:before:left-[11px] before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-blue-200 before:via-slate-100 before:to-transparent">
            {documents.map((doc, idx) => (
                <div key={doc.period + idx} className="relative group">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[22px] sm:-left-[45px] top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-4 ${!doc.proof_file ? 'border-rose-400' : 'border-blue-600'} z-10 shadow-sm group-hover:scale-125 transition-all duration-500`}>
                        <div className={`absolute inset-0 ${!doc.proof_file ? 'bg-rose-400' : 'bg-blue-600'} blur-[4px] opacity-20 animate-pulse`}></div>
                    </div>

                    <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:border-blue-500/20 transition-all duration-700 relative overflow-hidden">
                        {/* Status Glow */}
                        <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-50/50 blur-[60px] rounded-full group-hover:bg-blue-100/50 transition-all duration-1000"></div>

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8 relative z-10">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.4rem] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-sm">
                                    <FileText size={24} className="sm:w-8 sm:h-8" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base uppercase tracking-tight font-premium">
                                        {doc.proof_file?.metadata?.formType || 'DECLARACIÓN'} {formatPeriodForDisplay(doc.period)}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest font-premium">
                                            📎 {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'EEE/MMM/yy').toUpperCase()}
                                        </div>
                                        {doc.declaredAt && (
                                            <>
                                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest font-premium">
                                                    SRI: {safeFormat(doc.declaredAt, 'dd/MMM/yy').toUpperCase()}
                                                </div>
                                            </>
                                        )}
                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">
                                            <Clock size={12} strokeWidth={3} />
                                            Hora: {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {onWhatsApp && (
                                    <button
                                        onClick={() => onWhatsApp(doc.period)}
                                        className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 border border-emerald-100"
                                        title="Solicitar Pago WhatsApp"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => onViewPreview(doc)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-100 shadow-sm active:scale-95 font-premium"
                                >
                                    <Eye size={14} strokeWidth={3} /> VISTA PREVIA
                                </button>
                                <button
                                    onClick={() => onDownload(doc)}
                                    className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-500/30 rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    <Download size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {doc.proof_file?.metadata?.previewText && (
                            <div className="mt-6 p-5 bg-slate-50/50 rounded-2xl border border-dotted border-slate-200 italic text-[11px] font-medium text-slate-500 line-clamp-2 leading-relaxed shadow-inner">
                                "{doc.proof_file.metadata.previewText.substring(0, 200)}..."
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
