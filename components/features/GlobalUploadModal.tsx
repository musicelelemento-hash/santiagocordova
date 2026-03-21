import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, Search, User, Calendar, DollarSign, ExternalLink, Plus, Eye, Download } from 'lucide-react';
import { extractDataFromDeclarationPdf, fileToBase64 } from '../../services/pdfExtraction';
import { useAppStore } from '../../store/useAppStore';
import { Client, DeclarationStatus, StoredFile } from '../../types';
import { useToast } from '../../context/ToastContext';
import { formatPeriodForDisplay } from '../../services/sri';

interface ProcessingResult {
    fileName: string;
    status: 'success' | 'error' | 'not_found' | 'warning';
    message: string;
    clientName?: string;
    ruc?: string;
    amount?: number;
    period?: string;
    formType?: string;
}

interface GlobalUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalUploadModal: React.FC<GlobalUploadModalProps> = ({ isOpen, onClose }) => {
    const { clients, setClients } = useAppStore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<ProcessingResult[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (files: FileList | File[]) => {
        setIsProcessing(true);
        const newResults: ProcessingResult[] = [];
        let updatedClients = [...clients];
        let anyChanges = false;

        for (const file of Array.from(files)) {
            if (file.type !== 'application/pdf') {
                newResults.push({ fileName: file.name, status: 'error', message: 'No es un archivo PDF válido.' });
                continue;
            }

            try {
                const data = await extractDataFromDeclarationPdf(file);
                if (!data.ruc) {
                    newResults.push({ fileName: file.name, status: 'error', message: 'No se pudo extraer el RUC o el documento no es una declaración válida.' });
                    continue;
                }

                const clientIndex = updatedClients.findIndex(c => c.ruc.trim() === data.ruc.trim());

                if (clientIndex === -1) {
                    newResults.push({
                        fileName: file.name,
                        status: 'not_found',
                        message: 'RUC no encontrado en la base de datos.',
                        ruc: data.ruc,
                        amount: data.amount,
                        period: data.period,
                        formType: data.formType
                    });
                    continue;
                }

                const client = updatedClients[clientIndex];
                const base64 = await fileToBase64(file);
                const storedFile: StoredFile = {
                    name: file.name,
                    type: 'pdf',
                    size: file.size,
                    lastModified: Date.now(),
                    content: base64,
                    metadata: {
                        amount: data.amount,
                        period: data.period,
                        formType: data.formType,
                        sriId: data.id
                    }
                };

                // Update Client Data
                if (data.formType === 'IVA') {
                    const history = [...client.declarationHistory];
                    const eraPeriod = data.period;
                    const idx = history.findIndex(d => d.period === eraPeriod);

                    if (idx !== -1) {
                        history[idx] = {
                            ...history[idx],
                            status: DeclarationStatus.Pagada,
                            isPaid: true,
                            paidAt: new Date().toISOString(),
                            amount: data.amount,
                            proofFile: storedFile,
                            updatedAt: new Date().toISOString()
                        };
                    } else {
                        history.push({
                            period: eraPeriod,
                            status: DeclarationStatus.Pagada,
                            isPaid: true,
                            paidAt: new Date().toISOString(),
                            amount: data.amount,
                            proofFile: storedFile,
                            updatedAt: new Date().toISOString()
                        });
                    }
                    updatedClients[clientIndex] = { ...client, declarationHistory: history };
                } else if (data.formType.includes('RENTA')) {
                    updatedClients[clientIndex] = {
                        ...client,
                        annualRentaStatus: DeclarationStatus.Pagada,
                        annualRentaPaid: true,
                        annualRentaProof: storedFile
                    };
                }

                anyChanges = true;
                newResults.push({
                    fileName: file.name,
                    status: 'success',
                    message: `Validado y asignado correctamente.`,
                    clientName: client.name,
                    ruc: data.ruc,
                    amount: data.amount,
                    period: data.period,
                    formType: data.formType
                });

            } catch (err: any) {
                newResults.push({ fileName: file.name, status: 'error', message: err.message || 'Error procesando PDF.' });
            }
        }

        if (anyChanges) {
            setClients(updatedClients);
            toast.success("Varios archivos procesados y sincronizados");
        }

        setResults(prev => [...newResults, ...prev]);
        setIsProcessing(false);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Buzón de Comprobantes">
            <div className="p-1 space-y-6">
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-[2rem] p-10 transition-all flex flex-col items-center justify-center text-center
                        ${dragActive ? 'border-brand-teal bg-brand-teal/5 scale-[0.99]' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30'}`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {isProcessing ? <Loader2 className="text-brand-teal animate-spin" size={28} /> : <UploadCloud className="text-brand-teal" size={28} />}
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Carga Masiva de Comprobantes</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm">Suelta aquí tus PDFs. El sistema los leerá, validará el RUC y marcará la obligación como pagada.</p>

                    <button
                        onClick={() => inputRef.current?.click()}
                        className="mt-6 px-6 py-2.5 bg-brand-navy dark:bg-brand-teal text-white font-black rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                    >
                        Seleccionar PDFs
                    </button>
                </div>

                {results.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad Reciente</h4>
                            <button onClick={() => setResults([])} className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-tighter">Limpiar Log</button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2 thin-scrollbar">
                            {results.map((res, i) => (
                                <div key={i} className={`p-3 rounded-2xl border flex items-center gap-3 transition-all
                                    ${res.status === 'success' ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20' :
                                        res.status === 'not_found' ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/20' :
                                            'bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/20'}`}>

                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                        ${res.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                            res.status === 'not_found' ? 'bg-amber-100 text-amber-600' :
                                                'bg-red-100 text-red-600'}`}>
                                        {res.status === 'success' ? <CheckCircle2 size={16} /> :
                                            res.status === 'not_found' ? <User size={16} /> : <AlertCircle size={16} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] font-black text-slate-900 dark:text-white truncate uppercase">{res.fileName}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                            <p className="text-[9px] font-bold text-slate-500">
                                                {res.status === 'success' ? <span className="text-emerald-600 uppercase">ASIGNADO A {res.clientName}</span> : res.message}
                                            </p>
                                            {res.amount !== undefined && (
                                                <span className="text-[9px] font-black text-brand-navy dark:text-brand-teal px-1.5 py-0.5 rounded-md bg-white dark:bg-white/5 shadow-sm">
                                                    ${res.amount.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {res.status === 'success' && (
                                        <div className="shrink-0">
                                            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <CheckCircle2 size={12} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
