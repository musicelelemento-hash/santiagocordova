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
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl mb-6 border border-slate-100 dark:border-white/5">
                    <LucideIcons.FileSearch size={40} strokeWidth={1.5} className="opacity-40" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Sin registros encontrados</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 dark:text-slate-700 mt-1">El historial operativo está vacío</p>
            </div>
        );
    }

    return (
        <div className="relative pl-10 sm:pl-14 space-y-8 before:absolute before:left-[15px] sm:before:left-[19px] before:top-6 before:bottom-6 before:w-px before:bg-gradient-to-b before:from-primary/40 before:via-slate-200/50 dark:before:via-white/10 before:to-transparent">
            {documents.map((doc, idx) => (
                <div
                    key={doc.period + idx}
                    className="relative group animate-in fade-in slide-in-from-left-4 duration-700 fill-mode-both"
                    style={{ animationDelay: `${idx * 80}ms` }}
                >
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[39px] sm:-left-[47px] top-5 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all duration-500 group-hover:scale-125 shadow-lg ${
                        doc.proof_file
                            ? 'bg-primary shadow-primary/30'
                            : 'bg-amber-500 shadow-amber-500/30'
                    }`}>
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </div>

                    <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-slate-100/80 dark:border-white/8 hover:border-primary/30 dark:hover:border-primary/30 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-primary/5 transition-all duration-500 group/card relative overflow-hidden">
                        {/* Hover glow */}
                        <div className="absolute -right-16 -top-16 w-32 h-32 bg-primary/5 blur-[60px] rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none" />

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                            <div className="flex items-center gap-5">
                                {/* Icon */}
                                <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white/10 flex items-center justify-center text-primary group-hover/card:bg-primary group-hover/card:text-white transition-all duration-500 shadow-lg shrink-0">
                                    <LucideIcons.FileText size={20} strokeWidth={1.5} />
                                </div>

                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2.5 flex-wrap">
                                        <span className="text-primary/40 text-[10px] font-mono">TRACE::</span>
                                        {doc.proof_file?.metadata?.formType || 'DECLARACIÓN'}
                                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            {formatPeriodForDisplay(doc.period)}
                                        </span>
                                        {!doc.proof_file && (doc.status === DeclarationStatus.Enviada || doc.status === DeclarationStatus.Pagada) && (
                                            <span className="px-2.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-rose-100 dark:border-rose-500/20">
                                                Sin PDF
                                            </span>
                                        )}
                                    </h4>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <LucideIcons.Calendar size={11} className="text-primary" />
                                            {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'yyyy-MM-dd')}
                                        </div>

                                        {doc.declaredAt && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                                                <LucideIcons.CheckCircle2 size={11} />
                                                SRI: {safeFormat(doc.declaredAt, 'yyyy-MM-dd')}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">
                                            <LucideIcons.Clock size={11} />
                                            {safeFormat(doc.proof_file?.metadata?.uploadedAt || doc.updatedAt, 'HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                                {onWhatsApp && (
                                    <button
                                        onClick={() => onWhatsApp(doc.period)}
                                        className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm border border-slate-100 dark:border-white/5 hover:border-transparent active:scale-95"
                                        title="Enviar por WhatsApp"
                                    >
                                        <LucideIcons.MessageCircle size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => onDownload(doc)}
                                    className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all shadow-sm border border-slate-100 dark:border-white/5 active:scale-95"
                                    title="Descargar"
                                >
                                    <LucideIcons.Download size={16} />
                                </button>
                                <button
                                    onClick={() => onViewPreview(doc)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-primary hover:bg-gradient-azure dark:hover:bg-primary/80 text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95"
                                >
                                    <LucideIcons.Eye size={14} strokeWidth={2} />
                                    Ver
                                </button>
                            </div>
                        </div>

                        {doc.proof_file?.metadata?.previewText && (
                            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 relative">
                                <span className="absolute -top-2.5 left-4 text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900 px-2">
                                    OCR Extract
                                </span>
                                <p className="italic text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 line-clamp-2 font-mono">
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
