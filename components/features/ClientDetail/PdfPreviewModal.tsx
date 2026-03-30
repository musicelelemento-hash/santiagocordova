import React from 'react';
import { X, CheckCircle2, Download, ShieldCheck, FileText, Info } from 'lucide-react';
import { Declaration, Client } from '../../../types';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    declaration: Declaration | null;
    client: Client;
    onDownload: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ isOpen, onClose, declaration, client, onDownload }) => {
    if (!isOpen || !declaration || !declaration.proof_file) return null;

    const pdfData = declaration.proof_file;
    const base64Content = pdfData.content.includes(',') ? pdfData.content.split(',')[1] : pdfData.content;
    const blob = new Blob([Uint8Array.from(atob(base64Content), c => c.charCodeAt(0))], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(blob);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-7xl h-[90vh] glass-elite rounded-[2rem] border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-500">
                
                {/* PDF Viewer Area */}
                <div className="flex-1 bg-black/40 relative rounded-t-[2rem] md:rounded-l-[2rem] md:rounded-tr-none overflow-hidden">
                    <iframe 
                        src={`${pdfUrl}#toolbar=0`} 
                        className="w-full h-full border-none"
                        title={pdfData.name}
                    ></iframe>
                    
                    {/* Top action bar over PDF */}
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-center pointer-events-none">
                        <div className="glass-tactical px-5 py-3 rounded-2xl flex items-center gap-3 border border-white/10 pointer-events-auto shadow-2xl backdrop-blur-md">
                            <FileText size={18} className="text-cyan-400" />
                            <span className="text-[11px] font-semibold tracking-widest text-white truncate max-w-[200px] uppercase">{pdfData.name}</span>
                        </div>
                    </div>
                </div>

                {/* Tactical HUD (Sidebar) */}
                <div className="w-full md:w-96 bg-slate-900/80 border-l border-white/5 flex flex-col relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none"></div>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                        <div className="w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-scan-line-slow"></div>
                    </div>
                    
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex justify-between items-start relative z-10 bg-black/20">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck size={18} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.3em]">VALIDADO POR ESCUADRÓN</span>
                            </div>
                            <h3 className="text-2xl font-semibold text-white tracking-tight uppercase">Radar Táctico</h3>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-slate-400 hover:text-white transition-all pointer-events-auto active:scale-95"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-8 flex-1 overflow-y-auto space-y-8 relative z-10 custom-scrollbar">
                        {/* Status Check */}
                        <div className="p-6 rounded-3xl bg-emerald-400/10 border border-emerald-400/20 flex flex-col items-center justify-center text-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-emerald-400/5 group-hover:bg-emerald-400/10 transition-colors"></div>
                            <CheckCircle2 size={40} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] relative z-10" />
                            <div className="relative z-10">
                                <h4 className="font-semibold text-emerald-400 text-base uppercase tracking-wider">Integridad Confirmada</h4>
                                <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-[0.2em] mt-1">Firma SRI Detectada</p>
                            </div>
                        </div>

                        {/* Extracted Data Blocks */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Info size={12}/> FORMA TRIBUTARIA</span>
                                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-sm font-semibold text-white uppercase tracking-widest font-mono shadow-inner">
                                    {pdfData.metadata?.formType || 'DESCONOCIDO'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">PERIODO FISCAL</span>
                                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-cyan-400 text-xl font-semibold uppercase tracking-wider font-mono shadow-inner flex items-center justify-between">
                                    <span>{pdfData.metadata?.period || 'N/A'}</span>
                                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse"></div>
                                </div>
                            </div>

                            {pdfData.metadata?.amount !== undefined && (
                                <div className="space-y-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">MONTO LIQUIDADO</span>
                                    <div className="p-5 bg-emerald-400/10 border border-emerald-400/20 rounded-2xl text-emerald-400 text-3xl font-semibold uppercase tracking-tighter font-mono flex items-center justify-between shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]">
                                        <span className="opacity-50">$</span>
                                        <span>{pdfData.metadata.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">ID VERIFICACIÓN (SRI)</span>
                                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-xs font-semibold text-slate-400 font-mono tracking-[0.2em] break-all shadow-inner">
                                    {pdfData.metadata?.sriId || 'N/A'}
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-white/5">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">RUC VINCULADO</span>
                                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-sm font-semibold text-white uppercase tracking-widest font-mono shadow-inner">
                                    {client.ruc}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-8 border-t border-white/5 bg-black/20 relative z-10 space-y-4">
                        <button 
                            onClick={onDownload}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-cyan-500/50 active:scale-95 border border-cyan-400/50"
                        >
                            <Download size={18} strokeWidth={2.5} /> Extraer Original
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
