import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { 
    UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, Search, User, Calendar, 
    DollarSign, ExternalLink, Plus, Eye, Download, Copy, Shield, ShieldCheck, Sparkles, 
    FileWarning, HelpCircle, MessageCircle, ArrowRight
} from 'lucide-react';
import { extractDataFromDeclarationPdf, extractDataFromSriPdf } from '../../services/pdfExtraction';
import { UnifiedStorageService } from '../../services/unifiedStorageService';
import { useAppStore } from '../../store/useAppStore';
import { Client, DeclarationStatus, StoredFile, TaxObligationType, TaxRegime, Declaration } from '../../types';
import { useToast } from '../../context/ToastContext';
import { arePeriodsEqual } from './TaxComplianceMatrix';
import { formatPeriodForDisplay } from '../../services/sri';
import { v4 as uuidv4 } from 'uuid';

export interface UploadItemResult {
    fileName: string;
    category: 'declaracion' | 'ruc' | 'duplicate' | 'other';
    status: 'success' | 'duplicate' | 'ruc_updated' | 'ruc_new_client' | 'error' | 'other';
    message: string;
    clientName?: string;
    ruc?: string;
    amount?: number;
    period?: string;
    formType?: string;
    phones?: string[];
    proof_file?: StoredFile | null;
    rawFile?: File;
    details?: any;
}

interface GlobalUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalUploadModal: React.FC<GlobalUploadModalProps> = ({ isOpen, onClose }) => {
    const { clients, setClients, updateClient, addClient } = useAppStore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<UploadItemResult[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'declaracion' | 'ruc' | 'duplicate' | 'other'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; currentFileName?: string } | null>(null);

    // KPI Counters
    const declCount = results.filter(r => r.category === 'declaracion').length;
    const rucCount = results.filter(r => r.category === 'ruc').length;
    const dupCount = results.filter(r => r.category === 'duplicate').length;
    const otherCount = results.filter(r => r.category === 'other').length;

    const handleFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        setIsProcessing(true);
        setProcessingProgress({ current: 0, total: fileList.length });
        const newResults: UploadItemResult[] = [];
        let currentClientsList = [...clients];
        const modifiedClientsMap = new Map<string, Partial<Client>>();

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            setProcessingProgress({ current: i + 1, total: fileList.length, currentFileName: file.name });

            // Liberar el hilo de UI para mantener animaciones fluidas
            await new Promise(r => setTimeout(r, 15));

            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                newResults.push({
                    fileName: file.name,
                    category: 'other',
                    status: 'other',
                    message: 'Formato no PDF. Archivo clasificado como adjunto general.',
                    rawFile: file
                });
                continue;
            }

            try {
                // Paso 1: Intentar leer como Declaración SRI
                let declData: any = null;
                let isDecl = false;
                try {
                    declData = await extractDataFromDeclarationPdf(file);
                    if (declData && declData.ruc && (declData.formType !== 'DESCONOCIDO' || declData.period)) {
                        isDecl = true;
                    }
                } catch (e) {
                    isDecl = false;
                }

                // Paso 2: Si no es declaración, intentar leer como Certificado de RUC
                let rucData: any = null;
                let isRucCert = false;
                if (!isDecl) {
                    try {
                        rucData = await extractDataFromSriPdf(file);
                        if (rucData && rucData.ruc && rucData.ruc.length === 13) {
                            isRucCert = true;
                        }
                    } catch (e) {
                        isRucCert = false;
                    }
                }

                // --- MANEJO DE CERTIFICADOS DE RUC ---
                if (isRucCert && rucData) {
                    const cleanRuc = rucData.ruc.trim();
                    let targetClient = currentClientsList.find(c => c.ruc.trim() === cleanRuc);

                    // Subir PDF del RUC a Cloudflare R2
                    const uploadedRucPdf = await UnifiedStorageService.uploadFile(
                        file,
                        `RUC_${cleanRuc}.pdf`,
                        'documentos',
                        { ruc: cleanRuc, tipo: 'CERTIFICADO_RUC', uploadedAt: new Date().toISOString() }
                    );

                    const sanitizedRucFile: StoredFile = {
                        ...uploadedRucPdf,
                        content: null
                    };

                    if (!targetClient) {
                        // Crear nuevo cliente automáticamente desde el RUC
                        const newClient: Client = {
                            id: uuidv4(),
                            name: rucData.apellidos_nombres || 'CONTRIBUYENTE SRI',
                            ruc: cleanRuc,
                            sriPassword: '',
                            regime: rucData.regimen || TaxRegime.General,
                            isActive: true,
                            phones: rucData.contacto?.celular ? [rucData.contacto.celular] : [''],
                            email: rucData.contacto?.email || '',
                            address: rucData.direccion || '',
                            notes: 'Cliente auto-registrado desde Certificado de RUC',
                            rucPdf: sanitizedRucFile,
                            rucCertificate: sanitizedRucFile,
                            taxProfile: {
                                ivaFrequency: rucData.regimen === TaxRegime.RimpeEmprendedor ? 'Semestral' : (rucData.regimen === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'),
                                requiresAnnualRenta: true,
                                requiresAnexosGastos: false,
                                hasActiveDevolucionIva: false,
                                hasActiveElderlyDevolucionIva: false,
                                requiresIce: false,
                                requiresAnexoPvp: false
                            },
                            declarations: [],
                            vault: [sanitizedRucFile]
                        };

                        await addClient(newClient);
                        currentClientsList.push(newClient);

                        newResults.push({
                            fileName: file.name,
                            category: 'ruc',
                            status: 'ruc_new_client',
                            message: `Nuevo cliente auto-creado desde RUC: ${newClient.name}`,
                            clientName: newClient.name,
                            ruc: cleanRuc,
                            phones: newClient.phones,
                            proof_file: sanitizedRucFile
                        });
                    } else {
                        // Actualizar cliente existente con datos frescos
                        const updates: Partial<Client> = {
                            name: rucData.apellidos_nombres && rucData.apellidos_nombres !== 'CONTRIBUYENTE' ? rucData.apellidos_nombres : targetClient.name,
                            regime: rucData.regimen || targetClient.regime,
                            phones: targetClient.phones && targetClient.phones.length > 0 && targetClient.phones[0] ? targetClient.phones : [rucData.contacto?.celular].filter(Boolean),
                            email: targetClient.email || rucData.contacto?.email || '',
                            address: targetClient.address || rucData.direccion || '',
                            rucPdf: sanitizedRucFile,
                            rucCertificate: sanitizedRucFile,
                            vault: [...(targetClient.vault || []), sanitizedRucFile]
                        };

                        await updateClient(targetClient.id, updates);
                        targetClient = { ...targetClient, ...updates };

                        newResults.push({
                            fileName: file.name,
                            category: 'ruc',
                            status: 'ruc_updated',
                            message: `Ficha actualizada desde RUC para ${targetClient.name}`,
                            clientName: targetClient.name,
                            ruc: cleanRuc,
                            phones: targetClient.phones,
                            proof_file: sanitizedRucFile
                        });
                    }
                    continue;
                }

                // --- MANEJO DE COMPROBANTES DE DECLARACIÓN ---
                if (isDecl && declData && declData.ruc) {
                    const cleanRuc = declData.ruc.trim();
                    let targetClient = currentClientsList.find(c => c.ruc.trim() === cleanRuc);

                    if (!targetClient) {
                        // Cliente no encontrado en BD: crear ficha base
                        const newClient: Client = {
                            id: uuidv4(),
                            name: declData.clientName || 'NUEVO CLIENTE (SRI)',
                            ruc: cleanRuc,
                            sriPassword: '',
                            regime: TaxRegime.General,
                            isActive: true,
                            phones: [''],
                            email: '',
                            address: '',
                            notes: `Registrado automáticamente desde Comprobante Serie: ${declData.id || ''}`,
                            taxProfile: {
                                ivaFrequency: declData.frequency || 'Mensual',
                                requiresAnnualRenta: true,
                                requiresAnexosGastos: false,
                                hasActiveDevolucionIva: false,
                                hasActiveElderlyDevolucionIva: false,
                                requiresIce: false,
                                requiresAnexoPvp: false
                            },
                            declarations: [],
                            vault: []
                        };
                        await addClient(newClient);
                        currentClientsList.push(newClient);
                        targetClient = newClient;
                    }

                    const period = declData.period || '2026-01';
                    const history = [...(targetClient.declarations || [])];

                    // 💡 DETECCIÓN PREVIA DE DUPLICADOS (Pre-Upload Deduplication)
                    const existingDecl = history.find(d => 
                        arePeriodsEqual(d.period, period) && 
                        (d.proof_file?.metadata?.sriId === declData.id || (d.proof_file && (d.proof_file.url || d.proof_file.name)))
                    );

                    if (existingDecl && existingDecl.proof_file) {
                        // 🚀 DUPLICADO DETECTADO: 0 bytes subidos a la nube, 0 tokens gastados
                        newResults.push({
                            fileName: file.name,
                            category: 'duplicate',
                            status: 'duplicate',
                            message: `Duplicado omitido: ya existe comprobante en la nube para ${period}. (0 Bytes subidos)`,
                            clientName: targetClient.name,
                            ruc: cleanRuc,
                            period: formatPeriodForDisplay(period),
                            formType: declData.formType,
                            amount: declData.amount,
                            phones: targetClient.phones,
                            proof_file: existingDecl.proof_file
                        });
                        continue;
                    }

                    // Subir únicamente si NO es duplicado
                    const uploadedStoredFile = await UnifiedStorageService.uploadFile(
                        file,
                        file.name,
                        'declaraciones',
                        {
                            amount: declData.amount,
                            period: period,
                            formType: declData.formType,
                            sriId: declData.id,
                            uploadedAt: new Date().toISOString(),
                            previewText: declData.previewText
                        }
                    );

                    const proofFileObj: StoredFile = {
                        ...uploadedStoredFile,
                        content: null // Cero base64
                    };

                    const type: TaxObligationType = (
                        declData.formType === 'IVA' ? 'IVA' :
                        declData.formType === 'RENTA' ? 'RENTA' :
                        (declData.formType?.includes('ANEXO') ? 'ANEXO' :
                        (period.includes('-') ? 'IVA' : 'RENTA'))
                    ) as TaxObligationType;

                    const idx = history.findIndex(d => arePeriodsEqual(d.period, period) && (d.type === type || !d.type));
                    const entry: Declaration = {
                        period,
                        type,
                        status: DeclarationStatus.Pagada,
                        updatedAt: new Date().toISOString(),
                        declaredAt: declData.declarationDate || new Date().toISOString(),
                        is_paid: true,
                        paidAt: new Date().toISOString(),
                        amount: declData.amount || 0,
                        transactionId: declData.id || `PDF-${Date.now().toString().slice(-4)}`,
                        proof_file: proofFileObj
                    };

                    if (idx > -1) {
                        history[idx] = { ...history[idx], ...entry };
                    } else {
                        history.push(entry);
                    }

                    const updates: Partial<Client> = {
                        declarations: history,
                        vault: [...(targetClient.vault || []), proofFileObj]
                    };

                    await updateClient(targetClient.id, updates);
                    targetClient = { ...targetClient, ...updates };

                    newResults.push({
                        fileName: file.name,
                        category: 'declaracion',
                        status: 'success',
                        message: `Comprobante de ${declData.formType} (${formatPeriodForDisplay(period)}) asignado a ${targetClient.name}`,
                        clientName: targetClient.name,
                        ruc: cleanRuc,
                        amount: declData.amount,
                        period: formatPeriodForDisplay(period),
                        formType: declData.formType,
                        phones: targetClient.phones,
                        proof_file: proofFileObj
                    });
                    continue;
                }

                // --- MANEJO DE OTROS DOCUMENTOS (Facturas RIDE, Notas de Crédito, etc.) ---
                newResults.push({
                    fileName: file.name,
                    category: 'other',
                    status: 'other',
                    message: 'Documento no reconocido como declaración ni RUC (Posible Factura RIDE o Estado de Cuenta).',
                    rawFile: file
                });

            } catch (err: any) {
                newResults.push({
                    fileName: file.name,
                    category: 'other',
                    status: 'error',
                    message: `Error al procesar: ${err.message || 'Estructura ilegible'}`
                });
            }
        }

        setResults(prev => [...newResults, ...prev]);
        setIsProcessing(false);
        setProcessingProgress(null);
        toast.success(`Procesamiento finalizado: ${newResults.length} archivos clasificados.`);
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

    const filteredResults = results.filter(r => {
        if (activeTab !== 'all' && r.category !== activeTab) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            const matchName = r.clientName?.toLowerCase().includes(q);
            const matchRuc = r.ruc?.includes(q);
            const matchFile = r.fileName.toLowerCase().includes(q);
            return matchName || matchRuc || matchFile;
        }
        return true;
    });

    const getWhatsAppLink = (res: UploadItemResult) => {
        if (!res.phones || res.phones.length === 0 || !res.phones[0]) return null;
        let phone = res.phones[0].replace(/\D/g, '');
        if (phone.startsWith('09')) phone = '593' + phone.substring(1);
        if (!phone.startsWith('593') && phone.length === 9) phone = '593' + phone;

        const greeting = new Date().getHours() < 12 ? 'Buen día' : 'Buenas tardes';
        const msg = `${greeting} Estimado/a ${res.clientName}, le confirmo que su declaración de ${res.formType || 'Impuestos'} correspondiente al período ${res.period || ''} ha sido registrada y respaldada exitosamente en el sistema. Saludos, Soluciones Contables Pro.`;

        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestión Inmediata · Clasificador Inteligente de Archivos" size="3xl">
            <div className="p-1 space-y-5">
                {/* Executive Tactical KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button 
                        onClick={() => setActiveTab('declaracion')}
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                            activeTab === 'declaracion' 
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/10 scale-[1.02]' 
                                : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-emerald-500/20'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider font-mono">Declaraciones</span>
                            <CheckCircle2 size={14} className="text-emerald-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{declCount}</div>
                        <span className="text-[9px] font-semibold text-emerald-400/80">Respaldadas en R2</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('ruc')}
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                            activeTab === 'ruc' 
                                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 shadow-md shadow-sky-500/10 scale-[1.02]' 
                                : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-sky-500/20'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider font-mono">RUCs / Acuerdos</span>
                            <ShieldCheck size={14} className="text-sky-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{rucCount}</div>
                        <span className="text-[9px] font-semibold text-sky-400/80">Fichas creadas/act.</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('duplicate')}
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                            activeTab === 'duplicate' 
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/10 scale-[1.02]' 
                                : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-amber-500/20'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider font-mono">Duplicados</span>
                            <Copy size={14} className="text-amber-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{dupCount}</div>
                        <span className="text-[9px] font-semibold text-amber-400/80">0 Bytes consumidos</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('other')}
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                            activeTab === 'other' 
                                ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-md shadow-purple-500/10 scale-[1.02]' 
                                : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-purple-500/20'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider font-mono">Otros / Facturas</span>
                            <HelpCircle size={14} className="text-purple-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{otherCount}</div>
                        <span className="text-[9px] font-semibold text-purple-400/80">Adjuntos generales</span>
                    </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-[2rem] p-8 transition-all flex flex-col items-center justify-center text-center
                        ${dragActive ? 'border-primary bg-primary/10 scale-[0.99]' : 'border-white/10 bg-slate-900/30 hover:border-white/20'}`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/10 shadow-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        {isProcessing ? <Loader2 className="text-primary animate-spin" size={26} /> : <UploadCloud className="text-primary" size={26} />}
                    </div>

                    <h3 className="text-base font-black text-white uppercase tracking-tight">Carga Inmediata y Clasificación Inteligente</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 max-w-md">
                        Suelta una carpeta o lote de PDFs. El sistema clasificará automáticamente declaraciones, certificados de RUC y omitirá duplicados sin costo de almacenamiento.
                    </p>

                    {processingProgress && (
                        <div className="mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 animate-pulse">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Procesando {processingProgress.current} de {processingProgress.total} · {processingProgress.currentFileName || ''}</span>
                        </div>
                    )}

                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={isProcessing}
                        className="mt-5 px-6 py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                    >
                        {isProcessing ? 'Analizando Archivos...' : 'Seleccionar Archivos o Carpeta'}
                    </button>
                </div>

                {/* Tactical Results Section */}
                {results.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {/* Tab Filter Bar & Search */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                                {[
                                    { id: 'all', label: `Todos (${results.length})` },
                                    { id: 'declaracion', label: `Declaraciones (${declCount})` },
                                    { id: 'ruc', label: `RUCs (${rucCount})` },
                                    { id: 'duplicate', label: `Duplicados (${dupCount})` },
                                    { id: 'other', label: `Otros (${otherCount})` }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            activeTab === tab.id 
                                                ? 'bg-primary text-white shadow-sm' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-48">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar resultados..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-7 pr-3 py-1 bg-slate-900/40 border border-white/5 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <button 
                                    onClick={() => setResults([])} 
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider px-2 py-1"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>

                        {/* Filtered Results List */}
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 thin-scrollbar">
                            {filteredResults.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                                    No se encontraron archivos en la categoría seleccionada.
                                </div>
                            ) : (
                                filteredResults.map((res, i) => (
                                    <div 
                                        key={i} 
                                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                                            res.category === 'declaracion'
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : res.category === 'ruc'
                                                ? 'bg-sky-500/5 border-sky-500/20'
                                                : res.category === 'duplicate'
                                                ? 'bg-amber-500/5 border-amber-500/20'
                                                : 'bg-slate-800/40 border-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                res.category === 'declaracion' ? 'bg-emerald-500/10 text-emerald-400' :
                                                res.category === 'ruc' ? 'bg-sky-500/10 text-sky-400' :
                                                res.category === 'duplicate' ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-slate-700 text-slate-300'
                                            }`}>
                                                {res.category === 'declaracion' ? <CheckCircle2 size={18} /> :
                                                 res.category === 'ruc' ? <ShieldCheck size={18} /> :
                                                 res.category === 'duplicate' ? <Copy size={18} /> :
                                                 <FileText size={18} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">{res.fileName}</span>
                                                    {res.formType && (
                                                        <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                                                            {res.formType}
                                                        </span>
                                                    )}
                                                    {res.period && (
                                                        <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                            {res.period}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                                                    {res.clientName ? (
                                                        <span className="text-slate-300 font-semibold">{res.clientName} {res.ruc ? `(${res.ruc})` : ''} · </span>
                                                    ) : null}
                                                    <span>{res.message}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons on the right */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {res.amount !== undefined && (
                                                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                    ${res.amount.toFixed(2)}
                                                </span>
                                            )}

                                            {res.proof_file?.url && (
                                                <a
                                                    href={res.proof_file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                                                    title="Abrir PDF en la nube"
                                                >
                                                    <Eye size={14} />
                                                </a>
                                            )}

                                            {res.category === 'declaracion' && getWhatsAppLink(res) && (
                                                <a
                                                    href={getWhatsAppLink(res)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                                    title="Notificar por WhatsApp"
                                                >
                                                    <MessageCircle size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
