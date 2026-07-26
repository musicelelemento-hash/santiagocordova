import { arePeriodsEqual } from './TaxComplianceMatrix';
import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, Search, User, Calendar, DollarSign, ExternalLink, Plus, Eye, Download } from 'lucide-react';
import { extractDataFromDeclarationPdf, fileToBase64 } from '../../services/pdfExtraction';
import { useAppStore } from '../../store/useAppStore';
import { Client, DeclarationStatus, StoredFile, TaxObligationType, TaxRegime } from '../../types';
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
    const { clients, setClients, updateClient } = useAppStore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<ProcessingResult[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);

    const handleFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        setIsProcessing(true);
        setProcessingProgress({ current: 0, total: fileList.length });
        const newResults: ProcessingResult[] = [];
        let updatedClients = [...clients];
        let anyChanges = false;
        const modifiedClientRucs = new Set<string>();

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            setProcessingProgress({ current: i + 1, total: fileList.length });

            // Liberar el hilo de UI para mantener la interfaz a 60fps
            await new Promise(r => setTimeout(r, 10));

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
                const history = [...(client.declarations || [])];
                let eraPeriod = data.period;

                // Si el cliente es semestral y el periodo extraído viene como 2025-12 o 2025-06, normalizar a semestral
                const isClientSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor || data.frequency === 'Semestral';
                if (isClientSemestral && eraPeriod.includes('-') && !eraPeriod.includes('-S')) {
                    const [yrStr, moStr] = eraPeriod.split('-');
                    if (moStr === '12' || moStr === '07') {
                        eraPeriod = `${yrStr}-S2`;
                    } else if (moStr === '06' || moStr === '01') {
                        eraPeriod = `${yrStr}-S1`;
                    }
                }

                let type: TaxObligationType = (data.formType === 'IVA' ? 'IVA' : (data.formType === 'RENTA' ? 'RENTA' : (eraPeriod.includes('-') ? 'IVA' : 'RENTA'))) as TaxObligationType;

                if (data.formType === 'ICE') {
                    if (!eraPeriod.includes(':ICE')) {
                        eraPeriod = `${eraPeriod.split(':')[0]}:ICE`;
                    }
                    type = 'ICE';
                } else if (data.formType === 'ANEXO_ICE') {
                    if (!eraPeriod.includes(':ANEXO_ICE')) {
                        eraPeriod = `${eraPeriod.split(':')[0]}:ANEXO_ICE`;
                    }
                    type = 'ANEXO';
                } else if (data.formType === 'PVP') {
                    if (!eraPeriod.includes(':PVP')) {
                        eraPeriod = `${eraPeriod.split(':')[0]}:PVP`;
                    }
                    type = 'PVP';
                }

                const idx = history.findIndex(d => arePeriodsEqual(d.period, eraPeriod));

                if (idx !== -1) {
                    history[idx] = {
                        ...history[idx],
                        period: eraPeriod,
                        type,
                        status: DeclarationStatus.Pagada,
                        is_paid: true,
                        paidAt: history[idx].paidAt || new Date().toISOString(),
                        amount: data.amount,
                        proof_file: storedFile,
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    history.push({
                        period: eraPeriod,
                        type,
                        status: DeclarationStatus.Pagada,
                        is_paid: true,
                        paidAt: new Date().toISOString(),
                        amount: data.amount,
                        proof_file: storedFile,
                        updatedAt: new Date().toISOString()
                    });
                }
                updatedClients[clientIndex] = { ...client, declarations: history };
                modifiedClientRucs.add(data.ruc.trim());
                anyChanges = true;

                newResults.push({
                    fileName: file.name,
                    status: 'success',
                    message: `Validado y asignado a ${client.name.split(' ')[0]}.`,
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
            
            // Sincronización en paralelo sin bloquear la interfaz
            const syncPromises = Array.from(modifiedClientRucs).map(ruc => {
                const client = updatedClients.find(c => c.ruc.trim() === ruc);
                if (client) {
                    return updateClient(client.id, { declarations: client.declarations }).catch(e => {
                        console.error(`Error syncing client ${client.name} in bulk upload:`, e);
                    });
                }
                return Promise.resolve();
            });

            Promise.all(syncPromises).then(() => {
                toast.success(`${modifiedClientRucs.size} cliente(s) actualizados y guardados`);
            });
        }

        setResults(prev => [...newResults, ...prev]);
        setIsProcessing(false);
        setProcessingProgress(null);
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

                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-tight">Carga Masiva de Comprobantes</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm">Suelta aquí tus PDFs. El sistema los leerá, validará el RUC y marcará la obligación como pagada.</p>

                    {processingProgress && (
                        <div className="mt-3 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Procesando archivo {processingProgress.current} de {processingProgress.total}</span>
                        </div>
                    )}

                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={isProcessing}
                        className="mt-6 px-6 py-2.5 bg-brand-navy dark:bg-brand-teal text-white font-semibold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                        {isProcessing ? 'Procesando PDFs...' : 'Seleccionar PDFs'}
                    </button>
                </div>

                {results.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Actividad Reciente</h4>
                            <button onClick={() => setResults([])} className="text-[11px] font-semibold text-rose-400 hover:text-rose-400 uppercase tracking-tighter">Limpiar Log</button>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2 thin-scrollbar">
                            {results.map((res, i) => (
                                <div key={i} className={`p-3 rounded-2xl border flex items-center gap-3 transition-all
                                    ${res.status === 'success' ? 'bg-emerald-50/50 dark:bg-emerald-400/5 border-emerald-100 dark:border-emerald-400/20' :
                                        res.status === 'not_found' ? 'bg-amber-50/50 dark:bg-amber-400/5 border-amber-100 dark:border-amber-400/20' :
                                            'bg-red-50/50 dark:bg-rose-400/5 border-red-100 dark:border-rose-400/20'}`}>

                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                        ${res.status === 'success' ? 'bg-emerald-100 text-emerald-500' :
                                            res.status === 'not_found' ? 'bg-amber-100 text-amber-500' :
                                                'bg-red-100 text-rose-400'}`}>
                                        {res.status === 'success' ? <CheckCircle2 size={16} /> :
                                            res.status === 'not_found' ? <User size={16} /> : <AlertCircle size={16} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate uppercase">{res.fileName}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                            <p className="text-[11px] font-medium text-slate-500">
                                                {res.status === 'success' ? <span className="text-emerald-500 uppercase">ASIGNADO A {res.clientName}</span> : res.message}
                                            </p>
                                            {res.amount !== undefined && (
                                                <span className="text-[11px] font-semibold text-brand-navy dark:text-brand-teal px-1.5 py-0.5 rounded-md bg-white dark:bg-white/5 shadow-sm">
                                                    ${res.amount.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {res.status === 'success' && (
                                        <div className="shrink-0">
                                            <div className="w-6 h-6 rounded-md bg-emerald-400/10 flex items-center justify-center text-emerald-400">
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
