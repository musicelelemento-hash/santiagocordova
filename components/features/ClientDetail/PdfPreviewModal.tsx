import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, CheckCircle2, Download, ShieldCheck, FileText, Info, Loader2, 
    ExternalLink, Printer, Share2, Sparkles, AlertCircle, Copy, Check
} from 'lucide-react';
import { Declaration, Client, StoredFile } from '../../../types';
import { resolveStoredFile, signPublicStorageUrl, openStoredFileInNewTab } from '../../../services/fileService';
import { useToast } from '../../../context/ToastContext';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    declaration: Declaration | null;
    client: Client;
    onDownload: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ isOpen, onClose, declaration, client, onDownload }) => {
    const { toast } = useToast();
    const [resolvedFile, setResolvedFile] = useState<StoredFile | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [pdfSrc, setPdfSrc] = useState<string | null>(null);
    const [copiedRuc, setCopiedRuc] = useState<boolean>(false);

    // Escape listener and body scroll lock
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    // Resolve file and generate valid PDF preview URL (Cloud URL or Blob URL)
    useEffect(() => {
        let isMounted = true;
        let createdBlobUrl: string | null = null;

        const file = declaration?.proof_file;
        if (!file || !isOpen) {
            setResolvedFile(null);
            setPdfSrc(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const setupBlobFromBase64 = (base64Raw: string) => {
            try {
                let cleanB64 = base64Raw;
                if (cleanB64.includes(',')) cleanB64 = cleanB64.split(',')[1];
                cleanB64 = cleanB64.replace(/\s/g, '');
                const byteChars = atob(cleanB64);
                const byteNumbers = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                }
                const blob = new Blob([byteNumbers], { type: 'application/pdf' });
                createdBlobUrl = URL.createObjectURL(blob);
                if (isMounted) {
                    setPdfSrc(createdBlobUrl);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error creating Blob from base64:", err);
                if (isMounted) {
                    setPdfSrc(null);
                    setIsLoading(false);
                }
            }
        };

        const processFile = async () => {
            let activeFile = file;

            // Resolve split files if necessary
            if (file.content && (file.content.startsWith('__SPLIT__:') || file.content.startsWith('__SPLIT__Solid'))) {
                try {
                    const resolved = await resolveStoredFile(file);
                    if (resolved) activeFile = resolved;
                } catch (e) {
                    console.warn("Could not resolve split file:", e);
                }
            }

            if (isMounted) setResolvedFile(activeFile);

            // Handle Cloud Storage URL
            if (activeFile.url) {
                try {
                    const signedUrl = await signPublicStorageUrl(activeFile.url);
                    if (isMounted) {
                        setPdfSrc(signedUrl || activeFile.url);
                        setIsLoading(false);
                    }
                } catch (err) {
                    console.error("Error signing storage URL:", err);
                    if (isMounted) {
                        setPdfSrc(activeFile.url);
                        setIsLoading(false);
                    }
                }
            } 
            // Handle Base64 Local Content
            else if (activeFile.content) {
                setupBlobFromBase64(activeFile.content);
            } else {
                if (isMounted) {
                    setPdfSrc(null);
                    setIsLoading(false);
                }
            }
        };

        processFile();

        return () => {
            isMounted = false;
            if (createdBlobUrl) {
                URL.revokeObjectURL(createdBlobUrl);
            }
        };
    }, [declaration?.proof_file, isOpen]);

    if (!isOpen || !declaration || !declaration.proof_file) return null;

    const pdfData = resolvedFile || declaration.proof_file;
    const metadata = pdfData.metadata || {};
    const amountVal = metadata.amount !== undefined ? metadata.amount : declaration.amount;

    const handleCopyRuc = () => {
        if (!client.ruc) return;
        navigator.clipboard.writeText(client.ruc);
        setCopiedRuc(true);
        toast.success("RUC copiado al portapapeles");
        setTimeout(() => setCopiedRuc(false), 2000);
    };

    const handleOpenExternal = async () => {
        if (pdfSrc) {
            window.open(pdfSrc, '_blank');
        } else if (pdfData) {
            await openStoredFileInNewTab(pdfData);
        }
    };

    const handlePrint = () => {
        if (!pdfSrc) return;
        const printWindow = window.open(pdfSrc, '_blank');
        if (printWindow) {
            printWindow.focus();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-300 font-sans">
            {/* Ambient Backdrop */}
            <div 
                className="absolute inset-0 bg-[#020b14]/90 backdrop-blur-2xl transition-opacity"
                onClick={onClose}
            />

            {/* Glowing ambient ring */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[85vw] h-[75vh] bg-[#00A896]/10 rounded-full blur-[140px] opacity-40 animate-pulse" />
            </div>

            {/* Modal Container */}
            <div className="relative w-full max-w-7xl h-[94vh] max-h-[94vh] bg-[#051424]/95 border border-white/15 border-t-white/30 rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.8),0_0_35px_rgba(0,168,150,0.25)] flex flex-col lg:flex-row overflow-hidden backdrop-blur-2xl text-white animate-in zoom-in-95 duration-300">
                
                {/* ── LEFT PANE: HIGH FIDELITY PDF VIEWER ── */}
                <div className="flex-1 bg-[#020b14] relative rounded-t-[2.5rem] lg:rounded-l-[2.5rem] lg:rounded-tr-none overflow-hidden flex flex-col border-b lg:border-b-0 lg:border-r border-white/10">
                    
                    {/* Top Action Bar */}
                    <div className="p-3 sm:p-4 bg-[#051424]/90 border-b border-white/10 backdrop-blur-md flex items-center justify-between gap-3 z-10 shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 shrink-0">
                                <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate font-display">
                                    {pdfData.name || `Comprobante_${declaration.period}.pdf`}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                    <span className="text-[#00A896] font-bold">Oficial SRI</span>
                                    <span>•</span>
                                    <span>{pdfData.size ? `${(pdfData.size / 1024).toFixed(1)} KB` : 'PDF'}</span>
                                    {pdfData.url && (
                                        <>
                                            <span>•</span>
                                            <span className="text-sky-400">Cloud Storage</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Top quick buttons */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {pdfSrc && (
                                <>
                                    <button
                                        onClick={handleOpenExternal}
                                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                        title="Abrir en pestaña nueva"
                                    >
                                        <ExternalLink size={14} />
                                        <span className="hidden sm:inline">Pestaña</span>
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                        title="Imprimir Comprobante"
                                    >
                                        <Printer size={14} />
                                        <span className="hidden sm:inline">Imprimir</span>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={onDownload}
                                className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-[#00A896]/20 border border-white/10 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                title="Descargar archivo PDF"
                            >
                                <Download size={14} />
                                <span className="hidden sm:inline">Descargar</span>
                            </button>
                        </div>
                    </div>

                    {/* PDF Viewer Canvas */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#020b14]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-[#00A896]">
                                <Loader2 size={44} className="animate-spin text-[#00A896]" />
                                <div className="text-center font-mono">
                                    <p className="text-sm font-bold text-white tracking-wide">Cargando comprobante oficial...</p>
                                    <p className="text-xs text-slate-400 mt-1">Verificando firma criptográfica y acceso seguro</p>
                                </div>
                            </div>
                        ) : pdfSrc ? (
                            <iframe 
                                src={`${pdfSrc}#toolbar=1&navpanes=0`} 
                                className="w-full h-full border-none bg-white/5"
                                title={pdfData.name || "Comprobante de Declaración"}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md gap-4">
                                <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                    <AlertCircle size={40} />
                                </div>
                                <div className="space-y-1 font-mono">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">No se pudo cargar la vista previa directa</h4>
                                    <p className="text-xs text-slate-400">El archivo existe pero el visor integrado del navegador no pudo renderizarlo. Puedes descargarlo directamente o abrirlo en una nueva pestaña.</p>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <button
                                        onClick={onDownload}
                                        className="px-5 py-2.5 rounded-xl bg-[#00A896] hover:bg-teal-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
                                    >
                                        <Download size={14} />
                                        Descargar Archivo
                                    </button>
                                    {pdfData.url && (
                                        <button
                                            onClick={handleOpenExternal}
                                            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                                        >
                                            <ExternalLink size={14} />
                                            Abrir URL
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANE: TACTICAL SRI HUD & METRICS RADAR ── */}
                <div className="w-full lg:w-96 bg-[#051424] flex flex-col relative overflow-hidden shrink-0 border-t lg:border-t-0 font-sans">
                    
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between relative z-10 bg-[#051424]/90 backdrop-blur-md">
                        <div>
                            <div className="flex items-center gap-2 mb-1 font-mono">
                                <ShieldCheck size={16} className="text-[#00A896]" />
                                <span className="text-[10px] font-black text-[#00A896] uppercase tracking-[0.25em]">COMPROBANTE VÁLIDO</span>
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight uppercase font-display">
                                Radar Tributario
                            </h3>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
                            title="Cerrar (Esc)"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Metadata Content Body */}
                    <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5 relative z-10 custom-scrollbar font-mono">
                        
                        {/* Contribuyente Card */}
                        <div className="p-4 rounded-2xl bg-[#020b14] border border-white/10 space-y-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Contribuyente</span>
                            <div className="text-sm font-black text-white uppercase tracking-tight truncate font-display">
                                {client.name}
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                                <span className="text-slate-400">RUC:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white font-bold">{client.ruc}</span>
                                    <button 
                                        onClick={handleCopyRuc}
                                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        title="Copiar RUC"
                                    >
                                        {copiedRuc ? <Check size={12} className="text-[#00A896]" /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Status Integrity Badge */}
                        <div className="p-4 rounded-2xl bg-[#00A896]/10 border border-[#00A896]/25 flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-[#00A896]/20 text-[#00A896] shrink-0">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#00A896] text-xs uppercase tracking-wider">Declaración Registrada</h4>
                                <p className="text-[10px] text-slate-300 mt-0.5">Comprobante y archivo de respaldo sincronizados</p>
                            </div>
                        </div>

                        {/* Key Tax Metrics */}
                        <div className="space-y-3">
                            {/* Period & Form */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-[#020b14] border border-white/10 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Período</span>
                                    <span className="text-sm font-black text-[#00A896] uppercase">{declaration.period}</span>
                                </div>
                                <div className="p-3 bg-[#020b14] border border-white/10 rounded-2xl">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Formulario</span>
                                    <span className="text-xs font-black text-slate-200 uppercase truncate block">
                                        {metadata.formType || declaration.type || (declaration.period?.length === 4 ? 'RENTA 102' : 'IVA 104')}
                                    </span>
                                </div>
                            </div>

                            {/* Monto Liquidado / Impuesto a Pagar */}
                            <div className="p-4 bg-gradient-to-br from-[#00A896]/15 via-[#020b14] to-[#051424] border border-[#00A896]/30 rounded-2xl flex items-center justify-between shadow-sm">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Impuesto Liquidado</span>
                                    <span className="text-2xl font-black text-[#00A896] tracking-tight">
                                        ${Number(amountVal || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Estado Pago</span>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                        declaration.status === 'Pagada' || declaration.is_paid || client.isCourtesy
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                        {declaration.status === 'Pagada' || declaration.is_paid || client.isCourtesy ? 'PAGADO' : 'PENDIENTE'}
                                    </span>
                                </div>
                            </div>

                            {/* Casilleros Extraídos (si existen en metadata) */}
                            {(metadata.ventas15 !== undefined || metadata.ventas0 !== undefined || metadata.compras15 !== undefined || metadata.retIva !== undefined || metadata.saldoFavor !== undefined) && (
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Sparkles size={11} className="text-[#00A896]" /> Casilleros SRI Extraídos
                                    </span>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {metadata.ventas15 !== undefined && (
                                            <div className="p-2.5 bg-[#020b14] rounded-xl border border-white/5">
                                                <div className="text-[9px] text-slate-400 uppercase">Ventas 15%:</div>
                                                <div className="text-[#00A896] font-bold">${Number(metadata.ventas15).toFixed(2)}</div>
                                            </div>
                                        )}
                                        {metadata.ventas0 !== undefined && (
                                            <div className="p-2.5 bg-[#020b14] rounded-xl border border-white/5">
                                                <div className="text-[9px] text-slate-400 uppercase">Ventas 0%:</div>
                                                <div className="text-slate-200 font-bold">${Number(metadata.ventas0).toFixed(2)}</div>
                                            </div>
                                        )}
                                        {metadata.compras15 !== undefined && (
                                            <div className="p-2.5 bg-[#020b14] rounded-xl border border-white/5">
                                                <div className="text-[9px] text-slate-400 uppercase">Compras 15%:</div>
                                                <div className="text-sky-400 font-bold">${Number(metadata.compras15).toFixed(2)}</div>
                                            </div>
                                        )}
                                        {metadata.retIva !== undefined && (
                                            <div className="p-2.5 bg-[#020b14] rounded-xl border border-white/5">
                                                <div className="text-[9px] text-slate-400 uppercase">Retenciones:</div>
                                                <div className="text-indigo-400 font-bold">${Number(metadata.retIva).toFixed(2)}</div>
                                            </div>
                                        )}
                                        {metadata.saldoFavor !== undefined && (
                                            <div className="col-span-2 p-2.5 bg-[#020b14] rounded-xl border border-white/5 flex items-center justify-between">
                                                <span className="text-[9px] text-slate-400 uppercase">Saldo a Favor:</span>
                                                <span className="text-emerald-400 font-bold">${Number(metadata.saldoFavor).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ID Secuencial SRI */}
                            {metadata.sriId && (
                                <div className="p-3 bg-[#020b14] rounded-xl border border-white/5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">ID Verificación SRI</span>
                                    <span className="text-[10px] text-slate-300 break-all select-all font-mono">{metadata.sriId}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-5 border-t border-white/10 bg-[#051424]/90 backdrop-blur-md relative z-10 flex flex-col gap-2 font-mono">
                        <button 
                            onClick={onDownload}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/25 active:scale-95 border border-white/10 cursor-pointer"
                        >
                            <Download size={16} /> Descargar PDF Original
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
                        >
                            Volver a la Matriz
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
