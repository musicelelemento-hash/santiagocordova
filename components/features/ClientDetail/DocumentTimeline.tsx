import React from 'react';
import * as LucideIcons from 'lucide-react';
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
            <div className="flex flex-col items-center justify-center py-20 text-slate-500/50">
                <LucideIcons.FileText size={48} className="mb-4 opacity-10" />
                <p className="text-xs font-mono uppercase tracking-[0.2em]">NO_RECORDS_FOUND</p>
            </div>
        );
    }

    return (
        <div className="relative pl-8 sm:pl-12 space-y-10 sm:space-y-12 before:absolute before:left-[15px] sm:before:left-[11px] before:top-4 before:bottom-4 before:w-[1px] before:bg-gradient-to-b before:from-blue-500/30 before:via-slate-200/50 before:to-transparent">
            {documents.map((doc, idx) => (
                <div key={doc.period + idx} className="relative group animate-in fade-in slide-in-from-left-4 duration-700 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
                    {/* Timeline Trace Dot */}
                    <div className={`absolute -left-[22px] sm:-left-[45px] top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-white/10 z-10 shadow-[0_0_15px_rgba(0,0,0,0.1)] group-hover:scale-110 transition-all duration-500 flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${!doc.proof_file ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'} animate-pulse`} />
                    </div>

                    <div className="bg-white/70 backdrop-blur-3xl rounded-2xl p-5 sm:p-6 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.08)] hover:border-blue-500/20 transition-all duration-700 relative overflow-hidden group/card">
                        {/* Background Technical Noise/Glow */}
                        <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-500/5 blur-[80px] rounded-full group-hover/card:bg-blue-500/10 transition-all duration-1000"></div>

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-blue-400 group-hover/card:scale-105 transition-transform shadow-lg shadow-blue-500/10">
                                    <LucideIcons.FileText size={20} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h4 className="font-mono text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <span className="text-blue-500 opacity-50">TRACE::</span>
                                        {doc.proof_file?.metadata?.formType || 'DECLARATION'} 
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 ml-1">
                                            {formatPeriodForDisplay(doc.period)}
                                        </span>
                                    </h4>
                                    
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider">
                                            <LucideIcons.Calendar size={12} className="text-blue-500" />
                                            {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'yyyy-MM-dd')}
                                        </div>
                                        
                                        {doc.declaredAt && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                                                <LucideIcons.CheckCircle2 size={12} />
                                                SRI_SYNC: {safeFormat(doc.declaredAt, 'yyyy-MM-dd')}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                                            <LucideIcons.Clock size={12} />
                                            T_{safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'HH:mm:ss')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end lg:self-center">
                                {onWhatsApp && (
                                    <button
                                        onClick={() => onWhatsApp(doc.period)}
                                        className="p-2.5 bg-slate-100 text-slate-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 border border-slate-200/50 group/wa"
                                        title="Send via WhatsApp"
                                    >
                                        <LucideIcons.MessageCircle size={18} className="group-hover/wa:scale-110 transition-transform" />
                                    </button>
                                )}
                                <button
                                    onClick={() => onViewPreview(doc)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                                >
                                    <LucideIcons.Eye size={14} strokeWidth={2.5} /> PREVIEW_LOG
                                </button>
                                <button
                                    onClick={() => onDownload(doc)}
                                    className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-500/30 rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    <LucideIcons.Download size={18} strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        {doc.proof_file?.metadata?.previewText && (
                            <div className="mt-5 p-4 bg-slate-50/80 rounded-xl border border-slate-200/50 relative group/preview">
                                <div className="absolute top-2 right-3 text-[8px] font-mono text-slate-300 tracking-widest opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                    OCR_EXTRACT_V3
                                </div>
                                <p className="italic text-[11px] font-mono leading-relaxed text-slate-500/80 line-clamp-2">
                                    "{doc.proof_file.metadata.previewText.substring(0, 200)}..."
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
