import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    ShoppingBag, PhoneCall, AlertTriangle, CheckCircle2, ArrowRight,
    Search, FileText, Check, Copy, ExternalLink, Download, Eye, EyeOff,
    Globe, RefreshCw, UploadCloud, UserCheck, ShieldCheck, Laptop, Lock, Info,
    FolderDown, ClipboardCopy, Key, Shield, Plus, FileCode, Upload, User,
    Trash2, CheckSquare, Square, AlertOctagon, X, Sliders
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { Client, StoredFile } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { downloadStoredFile } from '../services/fileService';
import { SalesComboModal } from '../components/features/SalesComboModal';
import { QuickPlanRegistrationModal } from '../components/features/QuickPlanRegistrationModal';
import { SupabaseService } from '../services/supabaseClientService';

interface FacturadoresScreenProps {
    navigate: (screen: any, options?: any) => void;
    initialSearchTerm?: string;
}

export const FacturadoresScreen: React.FC<FacturadoresScreenProps> = ({ navigate, initialSearchTerm = '' }) => {
    const { clients: storeClients, updateClient, removeClient, bulkUpdateClients } = useAppStore();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'todos' | 'recursos_listos' | 'subido_plataforma' | 'activado' | 'sin_firma' | 'particulares' | 'clientes'>('todos');
    const [selectedVaultClient, setSelectedVaultClient] = useState<Client | null>(null);
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
    const directVaultUploadInputRef = useRef<HTMLInputElement>(null);
    const [vaultUploadTarget, setVaultUploadTarget] = useState<'idCardFront' | 'idCardBack' | 'idCardSelfie' | 'rucPdf' | 'signatureFile' | 'ecuafactSignedRequest' | 'vault'>('vault');

    // ── Estados de Depuración & Selección Múltiple ──
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [depurationTargetClient, setDepurationTargetClient] = useState<Client | null>(null);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [bulkConfirmText, setBulkConfirmText] = useState('');

    const [facturadorClients, setFacturadorClients] = useState<Client[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // KPI Counters from local store for ultra-fast instant UI responsiveness
    const allFacturadorClients = useMemo(() => {
        return storeClients.filter(c => !c.isDeleted && c.isActive && (c.billingPlan || c.facturadorConfig || c.clientType === 'solo_plan' || c.requiresDeclarations === false));
    }, [storeClients]);

    const kpis = useMemo(() => {
        const total = allFacturadorClients.length;
        const particulares = allFacturadorClients.filter(c => c.clientType === 'solo_plan' || c.requiresDeclarations === false).length;
        const contables = allFacturadorClients.filter(c => c.clientType !== 'solo_plan' && c.requiresDeclarations !== false).length;
        const recursos = allFacturadorClients.filter(c => !c.facturadorActivationStatus || c.facturadorActivationStatus === 'recursos_listos').length;
        const activado = allFacturadorClients.filter(c => c.facturadorActivationStatus === 'activado').length;
        const sinFirma = allFacturadorClients.filter(c => !c.signatureFile).length;
        return { total, particulares, contables, recursos, activado, sinFirma };
    }, [allFacturadorClients]);

    // Combinar búsqueda y filtros locales de alta velocidad respaldados con Supabase
    const displayClients = useMemo(() => {
        let list = allFacturadorClients;

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            list = list.filter(c => 
                c.name.toLowerCase().includes(q) || 
                (c.tradeName && c.tradeName.toLowerCase().includes(q)) || 
                c.ruc.includes(q) ||
                c.billingPlan?.programName?.toLowerCase().includes(q) ||
                c.facturadorConfig?.programName?.toLowerCase().includes(q)
            );
        }

        if (filterStatus === 'particulares') {
            list = list.filter(c => c.clientType === 'solo_plan' || c.requiresDeclarations === false);
        } else if (filterStatus === 'clientes') {
            list = list.filter(c => c.clientType !== 'solo_plan' && c.requiresDeclarations !== false);
        } else if (filterStatus === 'recursos_listos') {
            list = list.filter(c => !c.facturadorActivationStatus || c.facturadorActivationStatus === 'recursos_listos');
        } else if (filterStatus === 'subido_plataforma') {
            list = list.filter(c => c.facturadorActivationStatus === 'subido_plataforma');
        } else if (filterStatus === 'activado') {
            list = list.filter(c => c.facturadorActivationStatus === 'activado');
        } else if (filterStatus === 'sin_firma') {
            list = list.filter(c => !c.signatureFile);
        }

        return list;
    }, [allFacturadorClients, searchTerm, filterStatus]);

    const expiringAlerts = useMemo(() => {
        return allFacturadorClients.filter(c => {
            if (!c.signatureExpirationDate) return false;
            const expDate = new Date(c.signatureExpirationDate);
            const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
            return diffDays <= 15 && diffDays >= 0;
        });
    }, [allFacturadorClients]);

    useEffect(() => {
        let isMounted = true;
        const fetchFacturadores = async () => {
            setIsLoading(true);
            try {
                const { clients: data, count } = await SupabaseService.getFacturadoresPaginated(page, 100, searchTerm, filterStatus);
                if (isMounted) {
                    setFacturadorClients(data);
                    setTotalCount(count);
                }
            } catch (err) {
                console.error("Error fetching facturadores paginated:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const debounce = setTimeout(() => fetchFacturadores(), 300);
        return () => { isMounted = false; clearTimeout(debounce); };
    }, [page, searchTerm, filterStatus]);

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopyPassword = (id: string, passwordText?: string) => {
        if (!passwordText) return;
        navigator.clipboard.writeText(passwordText);
        setCopiedId(id);
        toast.success("Contraseña copiada al portapapeles");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownloadAllResources = async (client: Client) => {
        const isEcuafact = client.facturadorConfig?.programName?.toLowerCase().includes('ecuafact');
        const filesToDownload = [
            { file: client.idCardFront, suffix: 'Cedula_Frente' },
            { file: client.idCardBack, suffix: 'Cedula_Reverso' },
            { file: client.idCardSelfie, suffix: 'Selfie_Cedula' },
            { file: client.rucPdf, suffix: 'RUC_PDF' },
            { file: client.signatureFile, suffix: 'Firma_Electronica' },
            ...(isEcuafact ? [{ file: client.ecuafactSignedRequest, suffix: 'Solicitud_Firmada' }] : [])
        ].filter(item => item.file && item.file.content);

        if (filesToDownload.length === 0) {
            toast.error("No hay archivos subidos en el expediente de este cliente.");
            return;
        }

        toast.info(`Iniciando descarga de ${filesToDownload.length} archivos para ${client.name}...`);
        for (let i = 0; i < filesToDownload.length; i++) {
            const item = filesToDownload[i];
            const isP12 = item.file!.name?.endsWith('.p12') || item.file!.type === 'p12';
            const isPdf = item.file!.type === 'pdf' || item.file!.name?.endsWith('.pdf');
            const ext = isP12 ? 'p12' : isPdf ? 'pdf' : 'jpg';
            const fileWithCustomName = {
                ...item.file!,
                name: `${client.ruc}_${item.suffix}.${ext}`
            };
            await downloadStoredFile(fileWithCustomName);
            await new Promise(r => setTimeout(r, 500));
        }
        toast.success(`🎉 Expediente completo descargado (${filesToDownload.length} archivos).`);
    };

    const handleCopyClientSummary = (client: Client) => {
        const pObj = client.phones?.[0];
        const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
        const sigStatus = client.signatureFile ? '✅ Firma Subida en Bóveda' : '⚠️ Falta Firma Electrónica .p12';
        
        const summary = `📌 EXPEDIENTE PARA TRÁMITE DE FACTURADOR Y BÓVEDA
RUC: ${client.ruc}
Cliente: ${client.name}
Actividad: ${client.tradeName || client.economicActivity || 'General'}
Teléfono: ${phone || '—'}
Email: ${client.email || '—'}
Dirección: ${client.address || 'Pasaje, El Oro'}

--- PLAN DE FACTURACIÓN ---
Plan: ${client.facturadorConfig?.programName || '—'}
Usuario Facturador: ${client.facturadorConfig?.username || client.ruc}
Clave SRI: ${client.sriPassword}
Clave Facturador: ${client.facturadorConfig?.password || client.sriPassword}

--- FIRMA ELECTRÓNICA Y BÓVEDA ---
Estado Firma .p12: ${sigStatus}
Clave Firma .p12: ${client.electronicSignaturePassword || '—'}
Proveedor Firma: ${client.signatureProvider || '—'}
Expiración Firma: ${client.signatureExpirationDate || '—'}`;

        navigator.clipboard.writeText(summary);
        toast.success(`Expediente completo de ${client.name} copiado al portapapeles.`);
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file || !selectedVaultClient) return;

        toast.info(`Subiendo ${file.name} a la Nube...`);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            
            try {
                const extension = file.name.split('.').pop();
                const path = `${selectedVaultClient.id}/${vaultUploadTarget}_${Date.now()}.${extension}`;
                const { url, path: storagePath } = await SupabaseService.uploadFileToStorage('clients-vault', path, content);

                const storedFile: any = {
                    id: uuidv4(),
                    name: file.name,
                    size: file.size,
                    type: file.name.endsWith('.p12') ? 'p12' : file.type.includes('pdf') ? 'pdf' : 'image',
                    url: url,
                    bucketPath: storagePath,
                    uploadedAt: new Date().toISOString()
                };

                const updates: Partial<Client> = {};
                if (vaultUploadTarget === 'idCardFront') updates.idCardFront = storedFile;
                else if (vaultUploadTarget === 'idCardBack') updates.idCardBack = storedFile;
                else if (vaultUploadTarget === 'idCardSelfie') updates.idCardSelfie = storedFile;
                else if (vaultUploadTarget === 'rucPdf') updates.rucPdf = storedFile;
                else if (vaultUploadTarget === 'signatureFile') updates.signatureFile = storedFile;
                else if (vaultUploadTarget === 'ecuafactSignedRequest') updates.ecuafactSignedRequest = storedFile;
                else {
                    updates.vault = [...(selectedVaultClient.vault || []), storedFile];
                }

                updateClient(selectedVaultClient.id, updates);
                toast.success(`✅ ${file.name} guardado en la nube (Storage).`);
                setSelectedVaultClient(prev => prev ? { ...prev, ...updates } : null);
            } catch (err) {
                toast.error("Error subiendo el archivo a la nube.");
            }
        };
        reader.readAsDataURL(file);
    }, [selectedVaultClient, vaultUploadTarget, updateClient, toast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1 });

    const handleUploadFileToVault = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        onDrop([file]);
    };

    // ── MÉTODOS DE DEPURACIÓN SEGURA (Stitch Obsidian Luxury) ──
    const handleToggleSelectAll = () => {
        if (selectedClientIds.length === displayClients.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(displayClients.map(c => c.id));
        }
    };

    const handleToggleSelectClient = (clientId: string) => {
        setSelectedClientIds(prev => 
            prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
        );
    };

    const handleUnlinkPlan = async (client: Client) => {
        await updateClient(client.id, {
            billingPlan: undefined,
            facturadorConfig: undefined,
            clientType: undefined,
            requiresDeclarations: true
        });
        toast.success(`Plan desvinculado de ${client.name}. El cliente permanece en tu Directorio Contable.`);
        setDepurationTargetClient(null);
    };

    const handleDeleteClient = async (client: Client) => {
        removeClient(client.id);
        toast.success(`Cliente ${client.name} movido a la Papelera de reciclaje.`);
        setDepurationTargetClient(null);
    };

    const handleBulkUnlinkPlans = async () => {
        if (selectedClientIds.length === 0) return;
        bulkUpdateClients(selectedClientIds, {
            billingPlan: undefined,
            facturadorConfig: undefined,
            clientType: undefined,
            requiresDeclarations: true
        });
        toast.success(`Se desvinculó el plan de ${selectedClientIds.length} clientes.`);
        setSelectedClientIds([]);
    };

    const handleBulkDeleteClients = async () => {
        for (const id of selectedClientIds) {
            removeClient(id);
        }
        toast.success(`Se eliminaron ${selectedClientIds.length} clientes del sistema.`);
        setSelectedClientIds([]);
        setIsBulkDeleteModalOpen(false);
        setBulkConfirmText('');
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-300 relative font-sans min-h-screen">
            {/* ── TOP EXECUTIVE STRIPE ── */}
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 border-t-white/20 bg-[#051424]/90 shadow-2xl backdrop-blur-2xl p-6 sm:p-10 transition-all duration-500">
                    {/* Mesh Gradient */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-radial from-[#2B6AFF]/15 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-radial from-[#00A896]/15 to-transparent blur-3xl" />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="w-full sm:w-auto font-mono">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-[0_0_10px_rgba(0,168,150,0.2)]">
                                    <div className="relative w-2 h-2 rounded-full bg-[#00A896]">
                                        <div className="absolute inset-0 rounded-full bg-[#00A896] animate-ping opacity-60" />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.25em]">CONTROL DE EMISIÓN & PLANES SRI</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">• Plataformas SRI 2026</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-white leading-none tracking-tight font-display">
                                FACTURACIÓN & <span className="bg-gradient-to-r from-[#00A896] via-teal-400 to-[#2B6AFF] bg-clip-text text-transparent">PLANES</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-sm text-slate-300 font-sans font-medium max-w-2xl">
                                Gestión de software de emisión (Ecuafact, Zifact, etc.), expedientes de firma .p12 y separación estricta de particulares vs contables.
                            </p>
                        </div>

                        {/* ACCIONES DE REGISTRO RÁPIDO */}
                        <div className="flex items-center gap-3 flex-wrap shrink-0 font-mono">
                            <button
                                onClick={() => setIsSalesModalOpen(true)}
                                className="px-6 py-3.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00A896]/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border border-white/10"
                            >
                                <Plus size={16} />
                                <span>Vender Plan / Combo</span>
                            </button>
                            <button
                                onClick={() => setIsQuickPlanModalOpen(true)}
                                className="px-5 py-3.5 bg-[#0b1326] hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <FileText size={16} className="text-[#00A896]" />
                                <span>Autorización Ecuafact</span>
                            </button>
                        </div>
                    </div>

                    {/* ── 4 TARJETAS EJECUTIVAS KPI ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10 font-mono">
                        {/* Card 1: Total Planes */}
                        <div 
                            onClick={() => setFilterStatus('todos')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'todos' 
                                    ? 'bg-[#00A896]/15 border-[#00A896]/40 text-[#00A896] shadow-lg shadow-[#00A896]/10 scale-[1.02]' 
                                    : 'bg-[#020b14] border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Planes</span>
                                <ShoppingBag size={16} className="text-[#00A896]" />
                            </div>
                            <div className="text-3xl font-black text-white font-mono mt-2">{kpis.total}</div>
                            <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00A896]" />
                                <span>Emisión Digital</span>
                            </div>
                        </div>

                        {/* Card 2: Particulares (Solo Plan) */}
                        <div 
                            onClick={() => setFilterStatus('particulares')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'particulares' 
                                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-lg shadow-sky-500/10 scale-[1.02]' 
                                    : 'bg-[#020b14] border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Solo Plan (Sin IVA)</span>
                                <User size={16} className="text-sky-400" />
                            </div>
                            <div className="text-3xl font-black text-sky-400 font-mono mt-2">{kpis.particulares}</div>
                            <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                <span>Aislados de Matriz IVA</span>
                            </div>
                        </div>

                        {/* Card 3: Clientes Contables */}
                        <div 
                            onClick={() => setFilterStatus('clientes')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'clientes' 
                                    ? 'bg-[#C9A96E]/15 border-[#C9A96E]/40 text-[#C9A96E] shadow-lg shadow-[#C9A96E]/10 scale-[1.02]' 
                                    : 'bg-[#020b14] border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A96E]">Clientes Contables</span>
                                <UserCheck size={16} className="text-[#C9A96E]" />
                            </div>
                            <div className="text-3xl font-black text-[#C9A96E] font-mono mt-2">{kpis.contables}</div>
                            <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]" />
                                <span>Servicio Integral + Plan</span>
                            </div>
                        </div>

                        {/* Card 4: Estado Activados */}
                        <div 
                            onClick={() => setFilterStatus('activado')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'activado' 
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10 scale-[1.02]' 
                                    : 'bg-[#020b14] border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Activados & Listos</span>
                                <CheckCircle2 size={16} className="text-emerald-400" />
                            </div>
                            <div className="text-3xl font-black text-emerald-400 font-mono mt-2">{kpis.activado}</div>
                            <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>{kpis.total > 0 ? Math.round((kpis.activado / kpis.total) * 100) : 100}% Operativos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ALERTAS DE VENCIMIENTO DE FIRMA ── */}
            {expiringAlerts.length > 0 && (
                <div className="px-4 sm:px-0">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-[2rem] p-6 backdrop-blur-2xl font-mono">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="text-amber-400" size={20} />
                            <h3 className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                                Firmas Electrónicas por Vencer (Próximos 15 días)
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {expiringAlerts.map(client => {
                                const expDate = new Date(client.signatureExpirationDate!);
                                const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
                                return (
                                    <div key={client.id} className="bg-[#020b14] border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-between">
                                        <div>
                                            <div className="font-bold text-white uppercase text-xs truncate">{client.tradeName || client.name}</div>
                                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">RUC: {client.ruc}</div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 font-mono">
                                            <span className="text-xs font-bold text-amber-400">{format(expDate, "dd/MM/yyyy")}</span>
                                            <span className="text-[9px] uppercase font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                                                {diffDays} días rest.
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── BARRA DE BÚSQUEDA Y FILTRADO SEGMENTADO ── */}
            <div className="px-4 sm:px-0">
                <div className="flex flex-col lg:flex-row items-center gap-4 justify-between bg-[#051424]/90 p-4 rounded-[2rem] border border-white/10 backdrop-blur-2xl shadow-xl font-mono">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="BUSCAR POR CLIENTE, RUC O SOFTWARE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-10 py-3 bg-[#020b14] rounded-2xl border border-white/10 text-xs font-mono uppercase text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                        {[
                            { id: 'todos', label: `Todos (${kpis.total})` },
                            { id: 'particulares', label: `Solo Plan / Sin IVA (${kpis.particulares})`, icon: User },
                            { id: 'clientes', label: `Clientes Contables (${kpis.contables})`, icon: UserCheck },
                            { id: 'recursos_listos', label: `Por Subir (${kpis.recursos})` },
                            { id: 'activado', label: `Activados (${kpis.activado})` },
                            { id: 'sin_firma', label: `Sin Firma (${kpis.sinFirma})` }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id as any)}
                                className={`px-3.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    filterStatus === tab.id
                                        ? 'bg-white/15 text-white border-white/20 shadow-md scale-[1.02]'
                                        : 'bg-[#020b14] border-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab.icon && <tab.icon size={12} />}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── TABLA DE FACTURADORES ── */}
            <div className="px-4 sm:px-0">
                <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between font-mono">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Registro de Trámites y Activaciones de Facturadores
                            </h3>
                            <p className="text-xs text-slate-400 font-sans mt-0.5">
                                Descarga los recursos recopilados en 1-clic o inspecciona y sube directamente a la Bóveda del Cliente.
                            </p>
                        </div>
                    </div>

                    {displayClients.length === 0 ? (
                        <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl text-slate-400 space-y-2 font-mono">
                            <div className="text-xs font-bold text-slate-300 uppercase">No se encontraron registros de planes</div>
                            <p className="text-xs text-slate-500 max-w-md mx-auto font-sans">
                                No hay clientes con planes de facturación que coincidan con los filtros activos. Usa el botón "Vender Plan / Combo" para registrar uno nuevo.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#020b14]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-white/10 bg-[#0b1326] text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                                        <th className="py-4 px-4 w-10 text-center">
                                            <button
                                                onClick={handleToggleSelectAll}
                                                className="p-1 hover:text-[#00A896] text-slate-400 transition-colors cursor-pointer"
                                                title={selectedClientIds.length === displayClients.length ? "Deseleccionar todos" : "Seleccionar todos"}
                                            >
                                                {displayClients.length > 0 && selectedClientIds.length === displayClients.length ? (
                                                    <CheckSquare size={16} className="text-[#00A896]" />
                                                ) : (
                                                    <Square size={16} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="py-4 px-5">Cliente</th>
                                        <th className="py-4 px-5">Plan Vendido</th>
                                        <th className="py-4 px-5">Expediente & Firma en Bóveda</th>
                                        <th className="py-4 px-5">Estado de Trámite</th>
                                        <th className="py-4 px-5">Credenciales Facturador</th>
                                        <th className="py-4 px-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-mono">
                                    {displayClients.map((client) => {
                                        if (!client) return null;
                                        const config = client.billingPlan || client.facturadorConfig || {
                                            programName: 'Plan Particular',
                                            documentStatus: 'Registrado',
                                            username: client.ruc,
                                            password: client.sriPassword
                                        };
                                        const pwdVisible = visiblePasswords[client.id] || false;
                                        const isCopied = copiedId === client.id;
                                        const isSelected = selectedClientIds.includes(client.id);
                                        const providerUrl = config.url || (config.programName?.toLowerCase().includes('zifac') ? 'https://sistema.zifac.com' : 'https://app.ecuafact.com');

                                        // Contar archivos presentes vs totales
                                        const isEcuafact = config.programName?.toLowerCase().includes('ecuafact');
                                        const totalRequired = isEcuafact ? 6 : 5;
                                        const presentCount = [
                                            client.idCardFront, client.idCardBack, client.idCardSelfie, client.rucPdf, client.signatureFile,
                                            ...(isEcuafact ? [client.ecuafactSignedRequest] : [])
                                        ].filter(Boolean).length;
                                        const isComplete = presentCount === totalRequired;
                                        const totalVaultFiles = (client.vault?.length || 0) + presentCount;

                                        return (
                                            <tr key={client.id} className={`hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-[#00A896]/10' : ''}`}>
                                                <td className="py-4 px-4 text-center">
                                                    <button
                                                        onClick={() => handleToggleSelectClient(client.id)}
                                                        className="p-1 hover:text-[#00A896] text-slate-400 transition-colors cursor-pointer"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={16} className="text-[#00A896]" />
                                                        ) : (
                                                            <Square size={16} />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <p className="font-bold text-white uppercase text-xs">{client.tradeName || client.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{client.ruc}</p>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <p className="font-bold text-[#00A896] text-xs">{config.programName}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                        {config.documentStatus || 'Plan Registrado'} {config.price ? `— $${config.price}` : ''}
                                                    </p>
                                                </td>
                                                <td className="py-4 px-5 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                            isComplete ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                        }`}>
                                                            {presentCount}/{totalRequired} Recursos
                                                        </span>
                                                        {presentCount > 0 && (
                                                            <button
                                                                onClick={() => handleDownloadAllResources(client)}
                                                                className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold border border-indigo-500/30 flex items-center gap-1 text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                                                                title="Descargar todos los archivos del expediente en 1 clic"
                                                            >
                                                                <FolderDown size={11} /> Paquete Trámite
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5">
                                                        {/* Firma Electrónica .p12 */}
                                                        {client.signatureFile ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.signatureFile)}
                                                                className="px-2 py-0.5 rounded-lg bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] font-bold border border-[#00A896]/30 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                title={`Descargar Firma .p12 (${client.signatureProvider || 'SRI'}) - Vence: ${client.signatureExpirationDate || 'Sin fecha'}`}
                                                            >
                                                                <Download size={9} /> 🔑 Firma .p12
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[9px]" title="Falta Firma Electrónica .p12 en Bóveda">⚠️ Sin Firma .p12</span>
                                                        )}

                                                        {client.idCardFront ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.idCardFront)}
                                                                className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                title="Descargar Cédula Frontal"
                                                            >
                                                                <Download size={9} /> 🪪 Frente
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 text-[9px]" title="Falta Cédula Frontal">⚠️ Frente</span>
                                                        )}

                                                        {client.idCardBack ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.idCardBack)}
                                                                className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                title="Descargar Cédula Reverso"
                                                            >
                                                                <Download size={9} /> 🪪 Reverso
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 text-[9px]" title="Falta Cédula Reverso">⚠️ Reverso</span>
                                                        )}

                                                        {client.idCardSelfie ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.idCardSelfie)}
                                                                className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                title="Descargar Foto Selfie"
                                                            >
                                                                <Download size={9} /> 📸 Selfie
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 text-[9px]" title="Falta Selfie">⚠️ Selfie</span>
                                                        )}

                                                        {client.rucPdf ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.rucPdf)}
                                                                className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                title="Descargar RUC Actualizado"
                                                            >
                                                                <Download size={9} /> 📄 RUC
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 text-[9px]" title="Falta RUC Actualizado">⚠️ RUC</span>
                                                        )}

                                                        {isEcuafact && (
                                                            client.ecuafactSignedRequest ? (
                                                                <button
                                                                    onClick={() => downloadStoredFile(client.ecuafactSignedRequest)}
                                                                    className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 text-[9px] cursor-pointer"
                                                                    title="Descargar Solicitud de Terceros Firmada"
                                                                >
                                                                    <Download size={9} /> ✍️ Solicitud
                                                                </button>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 text-[9px]" title="Falta Solicitud Firmada">⚠️ Solicitud</span>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={client.facturadorActivationStatus || 'recursos_listos'}
                                                        onChange={(e) => {
                                                         const newStatus = e.target.value as any;
                                                         updateClient(client.id, { facturadorActivationStatus: newStatus });
                                                         toast.success(`Trámite de ${client.name} marcado como: ${
                                                             newStatus === 'recursos_listos' ? 'Recursos Listos' :
                                                             newStatus === 'subido_plataforma' ? 'Subido a Plataforma' : 'Activado y Listo'
                                                         }`);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold outline-none cursor-pointer bg-[#020b14] ${
                                                            (client.facturadorActivationStatus === 'activado') ? 'border-emerald-500/30 text-emerald-400' :
                                                            (client.facturadorActivationStatus === 'subido_plataforma') ? 'border-amber-500/30 text-amber-400' :
                                                            'border-rose-500/30 text-rose-400'
                                                        }`}
                                                    >
                                                        <option value="recursos_listos">🔴 Recursos Listos</option>
                                                        <option value="subido_plataforma">🟡 Subido a Plataforma</option>
                                                        <option value="activado">🟢 Activado y Listo</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                                                            <span className="text-slate-500">U:</span> {config.username || client.ruc}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-slate-500 font-mono text-[11px]">C:</span>
                                                            <div className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                                                                <span className="font-bold text-slate-300 min-w-[60px] text-[10px] font-mono">
                                                                    {pwdVisible ? (config.password || client.sriPassword) : '••••••••'}
                                                                </span>
                                                                <button
                                                                    onClick={() => togglePasswordVisibility(client.id)}
                                                                    className="p-0.5 hover:text-white text-slate-400 transition-colors cursor-pointer"
                                                                    title="Ver / Ocultar"
                                                                >
                                                                    {pwdVisible ? <EyeOff size={10} /> : <Eye size={10} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCopyPassword(client.id, config.password || client.sriPassword)}
                                                                    className="p-0.5 hover:text-[#00A896] text-slate-400 transition-colors cursor-pointer"
                                                                    title="Copiar clave"
                                                                >
                                                                    {isCopied ? <Check size={10} className="text-[#00A896]" /> : <Copy size={10} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5 text-right space-x-1.5 whitespace-nowrap">
                                                    <button
                                                        onClick={() => setSelectedVaultClient(client)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold uppercase transition-all inline-flex items-center gap-1 border border-indigo-500/30 text-[10px] cursor-pointer"
                                                        title="Inspeccionar o subir archivos a la Bóveda del Cliente"
                                                    >
                                                        <Lock size={11} /> Bóveda ({totalVaultFiles})
                                                    </button>

                                                    <button
                                                        onClick={() => handleCopyClientSummary(client)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase transition-all inline-flex items-center gap-1 border border-white/10 text-[10px] cursor-pointer"
                                                        title="Copiar texto con datos de cliente para registro en plataforma"
                                                    >
                                                        <ClipboardCopy size={11} /> Ficha
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            const message = `Estimado(a) *${client.name}*, le saludamos de SantiagoCórdova.com. Le informamos que su facturador electrónico *${config.programName}* ha sido activado con éxito.\n\n*Plataforma:* ${providerUrl}\n*Usuario:* ${config.username || client.ruc}\n*Clave:* ${config.password || client.sriPassword}\n\nYa puede emitir sus facturas electrónicas normalmente.`;
                                                            const pObj = client.phones?.[0];
                                                            const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
                                                            setWhatsAppPrompt({ clientName: client.name, phone, message });
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold uppercase transition-all inline-flex items-center gap-1 border border-emerald-500/20 text-[10px] cursor-pointer"
                                                        title="Enviar credenciales de facturación por WhatsApp"
                                                    >
                                                        <PhoneCall size={11} /> WhatsApp
                                                    </button>

                                                    <button
                                                        onClick={() => window.open(providerUrl, '_blank')}
                                                        className="px-2.5 py-1.5 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] font-bold uppercase transition-all inline-flex items-center gap-1 border border-[#00A896]/20 text-[10px] cursor-pointer"
                                                        title="Visitar plataforma del Facturador"
                                                    >
                                                        <Globe size={11} /> Abrir
                                                    </button>
                                                    
                                                    {/* 🛡️ Botón Táctico de Depuración / Eliminación */}
                                                    <button
                                                        onClick={() => setDepurationTargetClient(client)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold uppercase transition-all inline-flex items-center gap-1 border border-rose-500/20 text-[10px] cursor-pointer"
                                                        title="Depurar / Desvincular Plan o Eliminar Cliente"
                                                    >
                                                        <Trash2 size={11} /> Depurar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRA FLOTANTE DE ACCIONES EN LOTE (BATCH DEPURATION) ── */}
            {selectedClientIds.length > 0 && (
                <div className="fixed bottom-6 inset-x-0 mx-auto max-w-2xl z-50 px-4 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="p-4 rounded-3xl bg-[#051424]/95 border border-white/20 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-4 font-mono flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-[#00A896]/20 text-[#00A896] font-bold text-xs flex items-center justify-center border border-[#00A896]/30">
                                {selectedClientIds.length}
                            </span>
                            <span className="text-xs font-bold text-white uppercase">
                                {selectedClientIds.length === 1 ? '1 seleccionado' : `${selectedClientIds.length} seleccionados`}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <button
                                onClick={handleBulkUnlinkPlans}
                                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase transition-all cursor-pointer"
                            >
                                Desvincular Planes ({selectedClientIds.length})
                            </button>
                            <button
                                onClick={() => {
                                    setBulkConfirmText('');
                                    setIsBulkDeleteModalOpen(true);
                                }}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold uppercase transition-all shadow-lg cursor-pointer flex items-center gap-1.5"
                            >
                                <Trash2 size={13} /> Eliminar ({selectedClientIds.length})
                            </button>
                            <button
                                onClick={() => setSelectedClientIds([])}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                                title="Cancelar selección"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL BÓVEDA DEL CLIENTE DIRECTA ── */}
            {selectedVaultClient && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedVaultClient(null)}
                    title={`🔐 Bóveda de Recursos — ${selectedVaultClient.name}`}
                    size="lg"
                >
                    <div className="space-y-6 p-2 text-white font-mono">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#020b14] border border-white/10">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase">{selectedVaultClient.name}</h3>
                                <p className="text-[10px] text-slate-400 font-mono">RUC: {selectedVaultClient.ruc} • {selectedVaultClient.regime || 'Régimen General'}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedVaultClient(null);
                                    navigate('clients', { clientIdToView: selectedVaultClient.id, initialTab: 'vault' });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                            >
                                <ExternalLink size={14} /> Abrir Ficha Completa
                            </button>
                        </div>

                        {/* Credenciales Básicas de la Bóveda */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-2xl bg-[#020b14] border border-white/10 space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Clave SRI</span>
                                <div className="flex items-center justify-between font-mono text-xs text-[#00A896]">
                                    <span>{selectedVaultClient.sriPassword || '—'}</span>
                                    <button onClick={() => handleCopyPassword('sri', selectedVaultClient.sriPassword)} className="p-1 hover:text-white text-slate-400 cursor-pointer">
                                        <Copy size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-[#020b14] border border-white/10 space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Clave Firma .p12</span>
                                <div className="flex items-center justify-between font-mono text-xs text-[#2B6AFF]">
                                    <span>{selectedVaultClient.electronicSignaturePassword || '—'}</span>
                                    <button onClick={() => handleCopyPassword('firma', selectedVaultClient.electronicSignaturePassword)} className="p-1 hover:text-white text-slate-400 cursor-pointer">
                                        <Copy size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-[#020b14] border border-white/10 space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vigencia Firma</span>
                                <div className="font-mono text-xs text-amber-400 truncate">
                                    {selectedVaultClient.signatureExpirationDate || 'Sin Registrar'}
                                </div>
                            </div>
                        </div>

                        {/* Subida Rápida a la Bóveda */}
                        <div className="p-4 rounded-2xl bg-[#051424]/60 border border-white/10 space-y-3">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <UploadCloud size={14} className="text-[#00A896]" />
                                Subir Documento a la Bóveda
                            </h4>

                            <div className="flex items-center gap-2 flex-wrap">
                                <select
                                    value={vaultUploadTarget}
                                    onChange={(e) => setVaultUploadTarget(e.target.value as any)}
                                    className="px-3 py-2 rounded-xl bg-[#020b14] border border-white/10 text-xs text-white outline-none cursor-pointer"
                                >
                                    <option value="vault">📁 Archivo General a Bóveda</option>
                                    <option value="signatureFile">🔑 Firma Electrónica (.p12)</option>
                                    <option value="idCardFront">🪪 Cédula Frente</option>
                                    <option value="idCardBack">🪪 Cédula Reverso</option>
                                    <option value="idCardSelfie">📸 Foto Selfie</option>
                                    <option value="rucPdf">📄 RUC Actualizado</option>
                                    <option value="ecuafactSignedRequest">✍️ Solicitud Terceros</option>
                                </select>

                                <input
                                    type="file"
                                    ref={directVaultUploadInputRef}
                                    onChange={handleUploadFileToVault}
                                    className="hidden"
                                />

                                <button
                                    onClick={() => directVaultUploadInputRef.current?.click()}
                                    className="px-4 py-2 bg-[#00A896] hover:bg-[#00A896]/90 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                                >
                                    <Upload size={14} /> Seleccionar y Subir
                                </button>
                            </div>
                        </div>

                        {/* Lista de Documentos en la Bóveda */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Documentos Disponibles en Bóveda
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                                {[
                                    { file: selectedVaultClient.signatureFile, name: 'Firma Electrónica .p12', type: 'p12' },
                                    { file: selectedVaultClient.idCardFront, name: 'Cédula Frente', type: 'image' },
                                    { file: selectedVaultClient.idCardBack, name: 'Cédula Reverso', type: 'image' },
                                    { file: selectedVaultClient.idCardSelfie, name: 'Foto Selfie', type: 'image' },
                                    { file: selectedVaultClient.rucPdf, name: 'Certificado RUC PDF', type: 'pdf' },
                                    { file: selectedVaultClient.ecuafactSignedRequest, name: 'Solicitud Ecuafact Firmada', type: 'pdf' },
                                    ...(selectedVaultClient.vault || []).map(f => ({ file: f, name: f.name, type: f.type }))
                                ].filter(item => item.file && item.file.content).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#020b14] border border-white/10 text-xs">
                                        <div className="flex items-center gap-2.5 truncate">
                                            <FileCode size={14} className="text-[#00A896] shrink-0" />
                                            <span className="font-bold text-white truncate text-[11px]">{item.name}</span>
                                        </div>
                                        <button
                                            onClick={() => downloadStoredFile(item.file!)}
                                            className="p-1.5 bg-white/5 hover:bg-white/10 text-[#00A896] rounded-lg transition-all shrink-0 cursor-pointer"
                                            title="Descargar Archivo"
                                        >
                                            <Download size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedVaultClient(null)}
                                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                            >
                                Cerrar Bóveda
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL DEPURACIÓN INDIVIDUAL (Stitch Obsidian Luxury) ── */}
            {depurationTargetClient && (
                <Modal
                    isOpen={true}
                    onClose={() => setDepurationTargetClient(null)}
                    title="🛡️ Depuración & Gestión de Registro"
                    size="md"
                >
                    <div className="space-y-5 p-2 text-white font-sans">
                        <div className="p-4 rounded-2xl bg-[#020b14] border border-white/10 space-y-1">
                            <h4 className="text-xs font-bold text-white uppercase">{depurationTargetClient.name}</h4>
                            <p className="text-[11px] font-mono text-[#00A896]">RUC: {depurationTargetClient.ruc}</p>
                            <p className="text-[10px] text-slate-400">
                                Plan actual: {depurationTargetClient.billingPlan?.programName || depurationTargetClient.facturadorConfig?.programName || 'Plan Particular'}
                            </p>
                        </div>

                        <p className="text-xs text-slate-300">
                            Selecciona la acción adecuada para este registro:
                        </p>

                        <div className="space-y-3">
                            {/* Opción 1: Desvincular Plan */}
                            <button
                                onClick={() => handleUnlinkPlan(depurationTargetClient)}
                                className="w-full p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                                        1. Solo Desvincular Plan
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                                        Conserva Contabilidad
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-1">
                                    El cliente seguirá existiendo en tu Directorio Contable y Matriz de Declaraciones, pero se quitará de este menú de Facturadores.
                                </p>
                            </button>

                            {/* Opción 2: Eliminar / Papelera */}
                            <button
                                onClick={() => handleDeleteClient(depurationTargetClient)}
                                className="w-full p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all group cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">
                                        2. Eliminar Cliente por Completo
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md">
                                        Mover a Papelera
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-1">
                                    Usa esta opción si el cliente se creó por error (ej: al subir firmas antiguas). Se moverá a la Papelera de reciclaje.
                                </p>
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setDepurationTargetClient(null)}
                                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL CONFIRMACIÓN ELIMINACIÓN EN LOTE ── */}
            {isBulkDeleteModalOpen && (
                <Modal
                    isOpen={true}
                    onClose={() => setIsBulkDeleteModalOpen(false)}
                    title="⚠️ Confirmación de Eliminación Masiva"
                    size="md"
                >
                    <div className="space-y-4 p-2 text-white font-sans">
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                            <AlertOctagon size={24} className="text-rose-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-rose-400 uppercase">
                                    ¿Estás seguro de eliminar {selectedClientIds.length} clientes?
                                </h4>
                                <p className="text-[11px] text-slate-300 mt-1">
                                    Los clientes seleccionados se moverán a la Papelera de reciclaje del sistema. Esta acción limpiará los registros no deseados.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5 font-mono">
                            <label className="text-[10px] text-slate-400 uppercase block font-bold">
                                Escribe <span className="text-rose-400 font-bold">CONFIRMAR</span> para proceder:
                            </label>
                            <input
                                type="text"
                                value={bulkConfirmText}
                                onChange={(e) => setBulkConfirmText(e.target.value)}
                                placeholder="CONFIRMAR"
                                className="w-full px-3.5 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white uppercase outline-none focus:border-rose-500"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                onClick={() => setIsBulkDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkDeleteClients}
                                disabled={bulkConfirmText.trim().toLowerCase() !== 'confirmar'}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold uppercase transition-all shadow-lg flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <Trash2 size={13} /> Eliminar {selectedClientIds.length} Registros
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL WHATSAPP NOTIFICACIÓN ── */}
            {whatsAppPrompt && (
                <Modal isOpen={true} onClose={() => setWhatsAppPrompt(null)} title="💬 Enviar Credenciales de Facturación" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <p className="text-xs text-slate-300">
                            Enviarás el siguiente mensaje con los datos de acceso del facturador al cliente <strong>{whatsAppPrompt.clientName}</strong>:
                        </p>

                        <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-emerald-300 whitespace-pre-wrap">
                            {whatsAppPrompt.message}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <a
                                href={`https://wa.me/${whatsAppPrompt.phone ? whatsAppPrompt.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(whatsAppPrompt.message)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                                <PhoneCall size={14} /> Abrir WhatsApp Web
                            </a>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL VENDER PLAN & FIRMA (CON SELECCIÓN PARTICULAR VS CLIENTE) ── */}
            <SalesComboModal
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
            />

            <QuickPlanRegistrationModal
                isOpen={isQuickPlanModalOpen}
                onClose={() => setIsQuickPlanModalOpen(false)}
                onSuccess={(client) => {
                    updateClient(client.id, client);
                    setIsQuickPlanModalOpen(false);
                    toast.success("Expediente Express completado.");
                }}
            />
        </div>
    );
};
