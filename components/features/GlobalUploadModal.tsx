import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { 
    UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, Search, User, Calendar, 
    DollarSign, ExternalLink, Plus, Eye, Download, Copy, Shield, ShieldCheck, Sparkles, 
    FileWarning, HelpCircle, MessageCircle, ArrowRight, UserPlus, Check, Trash2, Edit3, 
    TrendingUp, RefreshCw, Zap, PhoneCall
} from 'lucide-react';
import { extractDataFromDeclarationPdf, extractDataFromSriPdf } from '../../services/pdfExtraction';
import { UnifiedStorageService } from '../../services/unifiedStorageService';
import { useAppStore } from '../../store/useAppStore';
import { Client, DeclarationStatus, StoredFile, TaxObligationType, TaxRegime, Declaration } from '../../types';
import { useToast } from '../../context/ToastContext';
import { arePeriodsEqual } from './TaxComplianceMatrix';
import { formatPeriodForDisplay } from '../../services/sri';
import { signPublicStorageUrl } from '../../services/fileService';
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

export interface PendingRucClient {
    tempId: string;
    file: File;
    name: string;
    ruc: string;
    regime: TaxRegime;
    phone: string;
    email: string;
    address: string;
    ivaFrequency: 'Mensual' | 'Semestral' | 'Ninguno';
    requiresAnnualRenta: boolean;
    rawExtraction: any;
    isSubmitting?: boolean;
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
    const [pendingRucClients, setPendingRucClients] = useState<PendingRucClient[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'declaracion' | 'ruc' | 'duplicate' | 'pending_ruc' | 'other'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; currentFileName?: string } | null>(null);
    const [complianceGained, setComplianceGained] = useState<number>(0);

    // KPI Counters
    const declCount = results.filter(r => r.category === 'declaracion').length;
    const rucCount = results.filter(r => r.category === 'ruc').length;
    const dupCount = results.filter(r => r.category === 'duplicate').length;
    const otherCount = results.filter(r => r.category === 'other').length;
    const pendingCount = pendingRucClients.length;

    // Cálculo dinámico de progreso en %
    const progressPercent = useMemo(() => {
        if (!processingProgress || processingProgress.total === 0) return 0;
        return Math.round((processingProgress.current / processingProgress.total) * 100);
    }, [processingProgress]);

    const handleFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        setIsProcessing(true);
        setProcessingProgress({ current: 0, total: fileList.length });
        const newResults: UploadItemResult[] = [];
        const newPendingRucs: PendingRucClient[] = [];
        let currentClientsList = [...clients];
        let processedDeclarationsCount = 0;

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            setProcessingProgress({ current: i + 1, total: fileList.length, currentFileName: file.name });

            // Liberar el hilo de UI para animaciones fluidas
            await new Promise(r => setTimeout(r, 20));

            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                newResults.push({
                    fileName: file.name,
                    category: 'other',
                    status: 'other',
                    message: 'Formato no PDF. Archivo clasificado como adjunto general (0 Bytes consumidos).',
                    rawFile: file
                });
                continue;
            }

            try {
                // 💡 PASO 1: ANÁLISIS EN MEMORIA LOCAL (Cero llamadas a la red hasta confirmar tipo)
                let declData: any = null;
                let isDecl = false;
                try {
                    declData = await extractDataFromDeclarationPdf(file);
                    if (declData && declData.ruc && (declData.formType !== 'DESCONOCIDO' || declData.period)) {
                        isDecl = true;
                    }
                } catch {
                    isDecl = false;
                }

                let rucData: any = null;
                let isRucCert = false;
                if (!isDecl) {
                    try {
                        rucData = await extractDataFromSriPdf(file);
                        if (rucData && rucData.ruc && rucData.ruc.length === 13) {
                            isRucCert = true;
                        }
                    } catch {
                        isRucCert = false;
                    }
                }

                // 🛑 SI NO ES DECLARACIÓN NI CERTIFICADO DE RUC -> DESCARTAR EN MEMORIA (0 Tokens / 0 Bytes)
                if (!isDecl && !isRucCert) {
                    newResults.push({
                        fileName: file.name,
                        category: 'other',
                        status: 'other',
                        message: 'Documento no tributario o formato desconocido del SRI. Omitido para proteger ancho de banda.',
                        rawFile: file
                    });
                    continue;
                }

                // ── MANEJO INTELIGENTE DE CERTIFICADOS DE RUC ──
                if (isRucCert && rucData) {
                    const cleanRuc = rucData.ruc.trim();
                    let targetClient = currentClientsList.find(c => c.ruc.trim() === cleanRuc);

                    if (!targetClient) {
                        // 🌟 CLIENTE NUEVO: MODO CONFIRMACIÓN INTERACTIVO (No guardar a ciegas)
                        newPendingRucs.push({
                            tempId: uuidv4(),
                            file: file,
                            name: rucData.apellidos_nombres || 'CONTRIBUYENTE SRI',
                            ruc: cleanRuc,
                            regime: rucData.regimen || TaxRegime.General,
                            phone: rucData.contacto?.celular || '',
                            email: rucData.contacto?.email || '',
                            address: rucData.direccion || '',
                            ivaFrequency: rucData.regimen === TaxRegime.RimpeEmprendedor ? 'Semestral' : (rucData.regimen === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'),
                            requiresAnnualRenta: true,
                            rawExtraction: rucData
                        });

                        newResults.push({
                            fileName: file.name,
                            category: 'ruc',
                            status: 'ruc_new_client',
                            message: `Nuevo RUC detectado: ${cleanRuc} (${rucData.apellidos_nombres}). Esperando confirmación para registrar.`,
                            clientName: rucData.apellidos_nombres,
                            ruc: cleanRuc,
                            phones: rucData.contacto?.celular ? [rucData.contacto.celular] : []
                        });
                    } else {
                        // CLIENTE EXISTENTE: Actualizar datos frescos y subir PDF a su bóveda
                        const uploadedRucPdf = await UnifiedStorageService.uploadFile(
                            file,
                            `RUC_${cleanRuc}.pdf`,
                            'documentos',
                            { ruc: cleanRuc, tipo: 'CERTIFICADO_RUC', uploadedAt: new Date().toISOString() }
                        );

                        const sanitizedRucFile: StoredFile = { ...uploadedRucPdf, content: null };

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
                            message: `Expediente actualizado y certificado RUC archivado para ${targetClient.name}`,
                            clientName: targetClient.name,
                            ruc: cleanRuc,
                            phones: targetClient.phones,
                            proof_file: sanitizedRucFile
                        });
                    }
                    continue;
                }

                // ── MANEJO INTELIGENTE DE COMPROBANTES DE DECLARACIÓN ──
                if (isDecl && declData && declData.ruc) {
                    const cleanRuc = declData.ruc.trim();
                    let targetClient = currentClientsList.find(c => c.ruc.trim() === cleanRuc);

                    if (!targetClient) {
                        // Cliente no existe en BD: crearlo con su RUC
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

                    // 💡 PRE-DEDUPLICACIÓN LOCAL (0 Bytes / 0 Tokens)
                    const existingDecl = history.find(d => 
                        arePeriodsEqual(d.period, period) && 
                        (d.proof_file?.metadata?.sriId === declData.id || (d.proof_file && (d.proof_file.url || d.proof_file.name)))
                    );

                    if (existingDecl && existingDecl.proof_file) {
                        newResults.push({
                            fileName: file.name,
                            category: 'duplicate',
                            status: 'duplicate',
                            message: `Duplicado omitido: ya existe comprobante oficial para ${period}. (0 Bytes consumidos)`,
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

                    // Subida segura únicamente para comprobantes válidos y no duplicados
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
                        content: uploadedStoredFile.url ? null : uploadedStoredFile.content
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
                    processedDeclarationsCount++;

                    newResults.push({
                        fileName: file.name,
                        category: 'declaracion',
                        status: 'success',
                        message: `Declaración ${declData.formType || 'IVA'} liquidada y archivada en la nube`,
                        clientName: targetClient.name,
                        ruc: cleanRuc,
                        period: formatPeriodForDisplay(period),
                        formType: declData.formType,
                        amount: declData.amount,
                        phones: targetClient.phones,
                        proof_file: proofFileObj
                    });
                }
            } catch (err: any) {
                console.error("Error procesando PDF:", err);
                newResults.push({
                    fileName: file.name,
                    category: 'other',
                    status: 'error',
                    message: 'Error al interpretar el contenido del PDF.',
                    rawFile: file
                });
            }
        }

        setResults(prev => [...newResults, ...prev]);
        if (newPendingRucs.length > 0) {
            setPendingRucClients(prev => [...prev, ...newPendingRucs]);
            setActiveTab('pending_ruc');
        }
        if (processedDeclarationsCount > 0) {
            setComplianceGained(prev => prev + processedDeclarationsCount * 4.5);
        }
        setIsProcessing(false);
        setProcessingProgress(null);
        toast.success(`Escaneo completado: ${newResults.length} archivos clasificados con éxito.`);
    };

    // Confirmación individual de Nuevo Cliente RUC
    const handleConfirmNewRucClient = async (pending: PendingRucClient) => {
        try {
            setPendingRucClients(prev => prev.map(p => p.tempId === pending.tempId ? { ...p, isSubmitting: true } : p));

            const uploadedRucPdf = await UnifiedStorageService.uploadFile(
                pending.file,
                `RUC_${pending.ruc}.pdf`,
                'documentos',
                { ruc: pending.ruc, tipo: 'CERTIFICADO_RUC', uploadedAt: new Date().toISOString() }
            );

            const sanitizedRucFile: StoredFile = { ...uploadedRucPdf, content: null };

            const newClient: Client = {
                id: uuidv4(),
                name: pending.name.trim(),
                ruc: pending.ruc.trim(),
                sriPassword: '',
                regime: pending.regime,
                isActive: true,
                isDeleted: false,
                clientType: 'completo',
                requiresDeclarations: pending.ivaFrequency !== 'Ninguno' || pending.requiresAnnualRenta,
                phones: pending.phone ? [pending.phone] : [''],
                email: pending.email || '',
                address: pending.address || '',
                notes: 'Cliente registrado y confirmado desde Certificado de RUC',
                rucPdf: sanitizedRucFile,
                rucCertificate: sanitizedRucFile,
                taxProfile: {
                    ivaFrequency: pending.ivaFrequency,
                    requiresAnnualRenta: pending.requiresAnnualRenta,
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
            setPendingRucClients(prev => prev.filter(p => p.tempId !== pending.tempId));
            toast.success(`Cliente ${newClient.name} añadido al directorio.`);
        } catch (error) {
            console.error("Error al registrar cliente:", error);
            toast.error("Error al guardar cliente en la base de datos.");
            setPendingRucClients(prev => prev.map(p => p.tempId === pending.tempId ? { ...p, isSubmitting: false } : p));
        }
    };

    // Descartar RUC
    const handleDiscardPendingRuc = (tempId: string) => {
        setPendingRucClients(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("RUC descartado.");
    };

    // Confirmar Todos los RUCs
    const handleConfirmAllRucs = async () => {
        for (const p of pendingRucClients) {
            await handleConfirmNewRucClient(p);
        }
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
        if (activeTab === 'pending_ruc') return false;
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
        const msg = `${greeting} Estimado/a ${res.clientName}, le confirmamos que su declaración de ${res.formType || 'Impuestos'} correspondiente al período ${res.period || ''} ha sido registrada y respaldada exitosamente en el sistema. Saludos, Soluciones Contables Pro.`;

        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestión Inmediata · Clasificador Inteligente de Archivos" size="4xl">
            <div className="space-y-6 font-sans">
                {/* ── TOP TACTICAL KPI TELEMETRY & COMPLIANCE GAUGE ── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                    <button 
                        onClick={() => setActiveTab('declaracion')}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                            activeTab === 'declaracion' 
                                ? 'bg-[#00A896]/20 border-[#00A896]/50 text-[#00A896] shadow-lg shadow-[#00A896]/10 scale-[1.02]' 
                                : 'bg-[#051424]/90 border-white/10 text-slate-400 hover:border-[#00A896]/30'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Declaraciones</span>
                            <CheckCircle2 size={14} className="text-[#00A896]" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{declCount}</div>
                        <span className="text-[9px] font-bold text-[#00A896]">Liquidadas en Nube</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('ruc')}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                            activeTab === 'ruc' 
                                ? 'bg-[#2B6AFF]/20 border-[#2B6AFF]/50 text-[#2B6AFF] shadow-lg shadow-[#2B6AFF]/10 scale-[1.02]' 
                                : 'bg-[#051424]/90 border-white/10 text-slate-400 hover:border-[#2B6AFF]/30'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">RUCs Existentes</span>
                            <ShieldCheck size={14} className="text-[#2B6AFF]" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{rucCount}</div>
                        <span className="text-[9px] font-bold text-[#2B6AFF]">Fichas Actualizadas</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('pending_ruc')}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                            activeTab === 'pending_ruc' 
                                ? 'bg-amber-500/25 border-amber-500/60 text-amber-400 shadow-lg shadow-amber-500/10 scale-[1.02]' 
                                : pendingCount > 0 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' 
                                : 'bg-[#051424]/90 border-white/10 text-slate-400 hover:border-amber-500/30'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Por Confirmar</span>
                            <UserPlus size={14} className="text-amber-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{pendingCount}</div>
                        <span className="text-[9px] font-bold text-amber-400">{pendingCount > 0 ? '¡Revisar RUCs!' : 'Al día'}</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('duplicate')}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                            activeTab === 'duplicate' 
                                ? 'bg-[#C9A96E]/20 border-[#C9A96E]/50 text-[#C9A96E] shadow-lg shadow-[#C9A96E]/10 scale-[1.02]' 
                                : 'bg-[#051424]/90 border-white/10 text-slate-400 hover:border-[#C9A96E]/30'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Duplicados</span>
                            <Copy size={14} className="text-[#C9A96E]" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{dupCount}</div>
                        <span className="text-[9px] font-bold text-[#C9A96E]">0 Bytes consumidos</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('other')}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                            activeTab === 'other' 
                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-lg shadow-purple-500/10 scale-[1.02]' 
                                : 'bg-[#051424]/90 border-white/10 text-slate-400 hover:border-purple-500/30'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">No Tributarios</span>
                            <HelpCircle size={14} className="text-purple-400" />
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{otherCount}</div>
                        <span className="text-[9px] font-bold text-purple-400">Omitidos / Otros</span>
                    </button>
                </div>

                {/* ── CUMPLIMIENTO TRIBUTARIO IMPACT BADGE ── */}
                {complianceGained > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-[#00A896]/20 via-[#2B6AFF]/15 to-[#00A896]/20 border border-[#00A896]/30 flex items-center justify-between flex-wrap gap-3 animate-in fade-in zoom-in-95 font-mono">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#00A896]/20 text-[#00A896] flex items-center justify-center border border-[#00A896]/30">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    Impacto en Cumplimiento Tributario
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00A896] text-slate-950 font-bold">EN VIVO</span>
                                </h4>
                                <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                                    Se actualizaron las casillas de la matriz y el porcentaje global de clientes al día.
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black text-[#00A896] font-mono">+{complianceGained.toFixed(1)}%</span>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Cumplimiento Mes</p>
                        </div>
                    </div>
                )}

                {/* ── DRAG AND DROP ZONE & LASER SCANNER ── */}
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-[2.5rem] p-8 sm:p-10 transition-all flex flex-col items-center justify-center text-center overflow-hidden bg-[#051424]/90 backdrop-blur-2xl
                        ${dragActive ? 'border-[#00A896] bg-[#00A896]/10 scale-[0.99]' : 'border-white/10 hover:border-[#00A896]/40'}`}
                >
                    {/* Laser scanning line animation when processing */}
                    {isProcessing && (
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#00A896] to-transparent animate-pulse shadow-[0_0_15px_#00A896]" />
                    )}

                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-[#020b14] border border-white/10 shadow-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        {isProcessing ? (
                            <Loader2 className="text-[#00A896] animate-spin" size={30} />
                        ) : (
                            <UploadCloud className="text-[#00A896]" size={30} />
                        )}
                    </div>

                    <h3 className="text-lg font-black text-white uppercase tracking-tight font-display">
                        Escaneo & Clasificación Inteligente de PDFs
                    </h3>
                    <p className="text-xs text-slate-300 font-medium mt-1.5 max-w-lg leading-relaxed">
                        Arrastra un lote o carpeta de archivos PDF. El motor inteligente leerá las declaraciones, certificados de RUC, omitirá duplicados sin costo de almacenamiento y te permitirá confirmar nuevos clientes antes de guardarlos.
                    </p>

                    {/* Progress Bar */}
                    {processingProgress && (
                        <div className="w-full max-w-md mt-5 space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-300 uppercase">
                                <span className="flex items-center gap-1.5 text-[#00A896]">
                                    <Loader2 size={12} className="animate-spin" />
                                    Analizando: {processingProgress.currentFileName || ''}
                                </span>
                                <span>{processingProgress.current} / {processingProgress.total} ({progressPercent}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
                                <div 
                                    className="h-full bg-gradient-to-r from-[#00A896] via-teal-400 to-[#2B6AFF] rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,168,150,0.5)]"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={isProcessing}
                        className="mt-6 px-8 py-3 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold rounded-2xl shadow-xl shadow-[#00A896]/20 hover:scale-105 active:scale-95 transition-all text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer border border-white/10"
                    >
                        {isProcessing ? 'Analizando en Memoria Local...' : 'Seleccionar PDFs o Carpeta'}
                    </button>
                </div>

                {/* ── SECCIÓN DE CONFIRMACIÓN: NUEVOS CLIENTES RUC POR CONFIRMAR ── */}
                {pendingRucClients.length > 0 && (
                    <div className="p-6 rounded-[2.5rem] bg-[#051424]/90 border border-amber-500/30 shadow-2xl backdrop-blur-2xl space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                                        Nuevos Clientes Detectados por Confirmar ({pendingRucClients.length})
                                    </h4>
                                    <p className="text-xs text-slate-300">
                                        Revisa los datos extraídos del RUC antes de añadirlos formalmente al directorio tributario.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleConfirmAllRucs}
                                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <Check size={14} /> Confirmar Todos ({pendingRucClients.length})
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                            {pendingRucClients.map((pending) => (
                                <div key={pending.tempId} className="p-4 rounded-2xl bg-[#020b14] border border-white/10 space-y-3 relative group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <input
                                                type="text"
                                                value={pending.name}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPendingRucClients(prev => prev.map(p => p.tempId === pending.tempId ? { ...p, name: val } : p));
                                                }}
                                                className="w-full bg-transparent border-b border-white/10 focus:border-[#00A896] text-xs font-bold text-white outline-none"
                                            />
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[11px] font-mono text-[#00A896] font-bold">{pending.ruc}</span>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-[10px] font-mono text-purple-400">{pending.regime}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                        <div>
                                            <span className="text-slate-500 block">Celular:</span>
                                            <input
                                                type="text"
                                                value={pending.phone}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPendingRucClients(prev => prev.map(p => p.tempId === pending.tempId ? { ...p, phone: val } : p));
                                                }}
                                                placeholder="099..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white outline-none focus:border-[#00A896]"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">IVA:</span>
                                            <select
                                                value={pending.ivaFrequency}
                                                onChange={(e) => {
                                                    const val = e.target.value as any;
                                                    setPendingRucClients(prev => prev.map(p => p.tempId === pending.tempId ? { ...p, ivaFrequency: val } : p));
                                                }}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                                            >
                                                <option value="Mensual">Mensual</option>
                                                <option value="Semestral">Semestral</option>
                                                <option value="Ninguno">Ninguno (NP)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
                                        <button
                                            onClick={() => handleDiscardPendingRuc(pending.tempId)}
                                            className="px-3 py-1.5 bg-white/5 hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer"
                                        >
                                            Descartar
                                        </button>
                                        <button
                                            onClick={() => handleConfirmNewRucClient(pending)}
                                            disabled={pending.isSubmitting}
                                            className="px-4 py-1.5 bg-[#00A896] hover:bg-[#00A896]/90 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                                        >
                                            {pending.isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Confirmar & Añadir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TACTICAL RESULTS FEED ── */}
                {results.length > 0 && (
                    <div className="space-y-4 pt-2">
                        {/* Tab Filter Bar & Search */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-1 bg-[#020b14] p-1 rounded-2xl border border-white/10 flex-wrap">
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
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                            activeTab === tab.id 
                                                ? 'bg-[#00A896] text-white shadow-md shadow-[#00A896]/20' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-56">
                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar resultados..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00A896]"
                                    />
                                </div>
                                <button 
                                    onClick={() => setResults([])} 
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>

                        {/* Filtered Results List */}
                        <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                            {filteredResults.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs font-semibold bg-[#020b14] rounded-2xl border border-white/10">
                                    No se encontraron archivos en la categoría seleccionada.
                                </div>
                            ) : (
                                filteredResults.map((res, i) => (
                                    <div 
                                        key={i} 
                                        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                                            res.category === 'declaracion'
                                                ? 'bg-[#00A896]/10 border-[#00A896]/30'
                                                : res.category === 'ruc'
                                                ? 'bg-[#2B6AFF]/10 border-[#2B6AFF]/30'
                                                : res.category === 'duplicate'
                                                ? 'bg-[#C9A96E]/10 border-[#C9A96E]/30'
                                                : 'bg-white/5 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                res.category === 'declaracion' ? 'bg-[#00A896]/20 text-[#00A896]' :
                                                res.category === 'ruc' ? 'bg-[#2B6AFF]/20 text-[#2B6AFF]' :
                                                res.category === 'duplicate' ? 'bg-[#C9A96E]/20 text-[#C9A96E]' :
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
                                                        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-white/10 text-slate-200">
                                                            {res.formType}
                                                        </span>
                                                    )}
                                                    {res.period && (
                                                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#00A896]/20 text-[#00A896]">
                                                            {res.period}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                                                    {res.clientName ? (
                                                        <span className="text-white font-bold">{res.clientName} {res.ruc ? `(${res.ruc})` : ''} · </span>
                                                    ) : null}
                                                    <span className="text-slate-400">{res.message}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons on the right */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {res.amount !== undefined && (
                                                <span className="text-xs font-mono font-bold text-[#00A896] bg-[#00A896]/15 px-2.5 py-1 rounded-xl border border-[#00A896]/30">
                                                    ${res.amount.toFixed(2)}
                                                </span>
                                            )}

                                            {res.proof_file?.url && (
                                                <a
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        signPublicStorageUrl(res.proof_file!.url!).then((u) => {
                                                            window.open(u, '_blank', 'noopener');
                                                        });
                                                    }}
                                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
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
                                                    className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                                                    title="Notificar Comprobante por WhatsApp"
                                                >
                                                    <PhoneCall size={14} />
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

export default GlobalUploadModal;
