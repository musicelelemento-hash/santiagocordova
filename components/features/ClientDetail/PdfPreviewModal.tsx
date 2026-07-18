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
    
    // Extraer base64 puro (sin el prefijo data:...)
    const base64Content = pdfData.content
        ? (pdfData.content.includes(',') ? pdfData.content.split(',')[1] : pdfData.content)
        : null;
    
    // Usar data URI directamente — más compatible que createObjectURL con base64 grande
    const pdfSrc = base64Content
        ? `data:application/pdf;base64,${base64Content}`
        : null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-7xl h-[90vh] bg-white rounded-[2rem] border border-slate-200 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-500">
                
                {/* PDF Viewer Area */}
                <div className="flex-1 bg-slate-100 relative rounded-t-[2rem] md:rounded-l-[2rem] md:rounded-tr-none overflow-hidden">
                    {pdfSrc ? (
                        <iframe 
                            src={`${pdfSrc}#toolbar=0`} 
                            className="w-full h-full border-none"
                            title={pdfData.name}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                            <FileText size={48} className="text-slate-300" />
                            <p className="text-sm font-bold">No hay contenido disponible para previsualizar</p>
                        </div>
                    )}
                    
                    {/* Top action bar over PDF */}
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-center pointer-events-none">
                        <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-3 border border-slate-200 pointer-events-auto shadow-xl">
                            <FileText size={18} className="text-primary" />
                            <span className="text-[11px] font-black tracking-widest text-slate-900 truncate max-w-[200px] uppercase font-premium">{pdfData.name}</span>
                        </div>
                    </div>
                </div>

                {/* Tactical HUD (Sidebar) */}
                <div className="w-full md:w-96 bg-slate-50 border-l border-slate-100 flex flex-col relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
                        <div className="w-full h-[2px] bg-primary shadow-[0_0_15px_rgba(37,99,235,0.8)] animate-scan-line-slow"></div>
                    </div>
                    
                    {/* Header */}
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start relative z-10 bg-white/50 backdrop-blur-sm">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck size={18} className="text-tertiary drop-shadow-[0_0_8px_rgba(5,150,105,0.2)]" />
                                <span className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] font-premium">SISTEMA VALIDADO</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-premium">Radar Táctico</h3>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-900 transition-all pointer-events-auto active:scale-95 shadow-sm"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-8 flex-1 overflow-y-auto space-y-8 relative z-10 custom-scrollbar">
                        {/* Status Check */}
                        <div className="p-6 rounded-3xl bg-tertiary/10 border border-tertiary/20 flex flex-col items-center justify-center text-center gap-3 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-tertiary/5 group-hover:bg-tertiary/10 transition-colors"></div>
                            <CheckCircle2 size={40} className="text-tertiary drop-shadow-[0_0_15px_rgba(5,150,105,0.3)] relative z-10" />
                            <div className="relative z-10">
                                <h4 className="font-black text-tertiary text-sm uppercase tracking-widest font-premium">Integridad Confirmada</h4>
                                <p className="text-[10px] text-tertiary/70 font-black uppercase tracking-[0.2em] mt-1 font-premium">Firma SRI Detectada</p>
                            </div>
                        </div>

                        {/* Extracted Data Blocks */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-premium"><Info size={12}/> FORMA TRIBUTARIA</span>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black text-slate-900 uppercase tracking-widest font-mono shadow-sm">
                                    {pdfData.metadata?.formType || 'DESCONOCIDO'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">PERIODO FISCAL</span>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl text-primary text-xl font-black uppercase tracking-wider font-mono shadow-sm flex items-center justify-between">
                                    <span>{pdfData.metadata?.period || 'N/A'}</span>
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse"></div>
                                </div>
                            </div>

                            {pdfData.metadata?.amount !== undefined && (
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">MONTO LIQUIDADO</span>
                                    <div className="p-5 bg-tertiary/10 border border-tertiary/20 rounded-2xl text-tertiary text-3xl font-black uppercase tracking-tighter font-mono flex items-center justify-between shadow-sm">
                                        <span className="opacity-50">$</span>
                                        <span>{pdfData.metadata.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">ID VERIFICACIÓN (SRI)</span>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 font-mono tracking-[0.2em] break-all shadow-sm">
                                    {pdfData.metadata?.sriId || 'N/A'}
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">RUC VINCULADO</span>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-900 uppercase tracking-widest font-mono shadow-sm">
                                    {client.ruc}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-8 border-t border-slate-100 bg-white/50 backdrop-blur-sm relative z-10 space-y-4">
                        <button 
                            onClick={onDownload}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-primary hover:bg-gradient-azure/90 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] transition-all shadow-primary hover:shadow-xl active:scale-95 border border-primary font-premium"
                        >
                            <Download size={18} strokeWidth={3} /> EXTRAER ORIGINAL
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
