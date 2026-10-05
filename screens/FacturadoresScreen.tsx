import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    ShoppingBag, PhoneCall, AlertTriangle, CheckCircle2, ArrowRight,
    Search, FileText, Check, Copy, ExternalLink, Download, Eye, EyeOff,
    Globe, RefreshCw, UploadCloud, UserCheck, ShieldCheck, Laptop, Lock, Info,
    FolderDown, ClipboardCopy, Key, Shield, Plus, FileCode, Upload, User,
    Trash2, CheckSquare, Square, AlertOctagon, X, Sliders, Layers, BarChart3,
    TrendingUp, Mail, Send, Sparkles, Filter, ChevronLeft, ChevronRight,
    Calendar, DollarSign, Award, ArrowUpRight, Clock, HelpCircle, Briefcase,
    Landmark, BookOpen, Zap, PieChart, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';
import { Client, StoredFile, BillingPlan, MonthlyInvoicingRecord } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { downloadStoredFile } from '../services/fileService';
import { SalesComboModal } from '../components/features/SalesComboModal';
import { QuickPlanRegistrationModal } from '../components/features/QuickPlanRegistrationModal';
import { FacturadorEditModal } from '../components/features/FacturadorEditModal';
import { FacturaRegistroModal } from '../components/features/FacturaRegistroModal';
import { AddFacturadorClientModal } from '../components/features/AddFacturadorClientModal';
import { ResendNoticeModal } from '../components/features/ResendNoticeModal';
import { SupabaseService } from '../services/supabaseClientService';

interface FacturadoresScreenProps {
    navigate: (screen: any, options?: any) => void;
    initialSearchTerm?: string;
}

type ViewMode = 'filling_center' | 'software_admin' | 'kyc_renewals' | 'analytics';
type LayoutMode = 'cards' | 'table' | 'kanban';
type FilterStatus = 
    | 'todos' 
    | 'talonario' 
    | 'ecuafact' 
    | 'zifact' 
    | 'sri_gratuito' 
    | 'con_firma' 
    | 'sin_firma' 
    | 'planta' 
    | 'externos' 
    | 'por_vencer' 
    | 'agotados';

// ── HELPER: Detectar proveedor desde programName ──────────────────────────
const getProviderInfo = (programName?: string): { key: string; label: string; cssClass: string; glowClass: string; icon: React.ReactNode } => {
    const name = (programName || '').toLowerCase();
    if (name.includes('talonario')) return { key: 'talonario', label: 'Talonario Amigo', cssClass: 'provider-talonario', glowClass: 'provider-talonario-glow', icon: <BookOpen size={11} /> };
    if (name.includes('ecuafact'))  return { key: 'ecuafact',  label: 'Ecuafact',        cssClass: 'provider-ecuafact',  glowClass: 'provider-ecuafact-glow',  icon: <FileText size={11} /> };
    if (name.includes('zifac'))     return { key: 'zifact',    label: 'Zifact',          cssClass: 'provider-zifact',    glowClass: 'provider-zifact-glow',    icon: <Zap size={11} /> };
    if (name.includes('sri'))       return { key: 'sri',       label: 'SRI Gratuito',    cssClass: 'provider-sri',       glowClass: 'provider-sri-glow',       icon: <Landmark size={11} /> };
    return { key: 'default', label: programName || 'Facturador', cssClass: 'provider-default', glowClass: '', icon: <Globe size={11} /> };
};

// ── MINI-COMPONENTE: Provider Badge ───────────────────────────────────────
const ProviderBadge: React.FC<{ programName?: string; size?: 'sm' | 'md' }> = ({ programName, size = 'sm' }) => {
    const p = getProviderInfo(programName);
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${p.cssClass} ${size === 'md' ? 'px-3 py-1 text-[10px]' : ''}`}>
            {p.icon}
            {p.label}
        </span>
    );
};

// ── MINI-COMPONENTE: Doc Progress Bar ─────────────────────────────────────
const DocProgressBar: React.FC<{ used: number; total: number; isSriGratuito?: boolean }> = ({ used, total, isSriGratuito }) => {
    if (isSriGratuito) {
        return (
            <div className="flex items-center gap-2">
                <div className="doc-progress-track flex-1"><div className="doc-progress-fill doc-progress-ok" style={{ width: '100%' }} /></div>
                <span className="text-[9px] font-bold text-emerald-400 font-mono">∞ Ilimitado</span>
            </div>
        );
    }
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    const remaining = total - used;
    const fillClass = pct >= 95 ? 'doc-progress-danger' : pct >= 75 ? 'doc-progress-warning' : 'doc-progress-ok';
    const textClass = pct >= 95 ? 'text-rose-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400';
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Saldo Comprobantes</span>
                <span className={`text-[9px] font-mono font-bold ${textClass}`}>{remaining} / {total} restantes</span>
            </div>
            <div className="doc-progress-track"><div className={`doc-progress-fill ${fillClass}`} style={{ width: `${pct}%` }} /></div>
        </div>
    );
};

// ── MINI-COMPONENTE: KYC Completion Ring ──────────────────────────────────
const KycCompletionRing: React.FC<{ pct: number }> = ({ pct }) => {
    const r = 18;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const color = pct === 100 ? '#04B17B' : pct >= 60 ? '#F59E0B' : '#ef4444';
    return (
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="kyc-ring-svg -rotate-90" width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                />
            </svg>
            <span className="absolute text-[9px] font-black font-mono" style={{ color }}>{pct}%</span>
        </div>
    );
};

// ── MINI-COMPONENTE: FAB Contextual ───────────────────────────────────────
const ContextualFAB: React.FC<{
    view: ViewMode;
    onFillingCenter: () => void;
    onKyc: () => void;
    onSoftware: () => void;
    onAnalytics: () => void;
}> = ({ view, onFillingCenter, onKyc, onSoftware, onAnalytics }) => {
    const fabConfig: Record<ViewMode, { bg: string; icon: React.ReactNode; label: string; onClick: () => void }> = {
        filling_center: { bg: 'background: linear-gradient(135deg, #04B17B, #028090)', icon: <Plus size={22} />, label: '+1 Factura Rápida', onClick: onFillingCenter },
        software_admin: { bg: 'background: linear-gradient(135deg, #2B6AFF, #6366F1)', icon: <ShoppingBag size={22} />, label: 'Vender Plan / Combo', onClick: onSoftware },
        kyc_renewals:   { bg: 'background: linear-gradient(135deg, #F59E0B, #D97706)', icon: <UploadCloud size={22} />, label: 'Subir Documento', onClick: onKyc },
        analytics:      { bg: 'background: linear-gradient(135deg, #04B17B, #10B981)', icon: <Copy size={22} />, label: 'Copiar Informe', onClick: onAnalytics },
    };
    const cfg = fabConfig[view];
    return (
        <button
            className="contextual-fab text-white"
            style={{ [cfg.bg.startsWith('background') ? 'background' : 'background']: undefined, ...Object.fromEntries([cfg.bg.replace('background: ', '').split(':')]) }}
            onClick={cfg.onClick}
            title={cfg.label}
            aria-label={cfg.label}
        >
            <span className="contextual-fab-label">{cfg.label}</span>
            {cfg.icon}
        </button>
    );
};

export const FacturadoresScreen: React.FC<FacturadoresScreenProps> = ({ navigate, initialSearchTerm = '' }) => {
    const { clients: storeClients, updateClient, removeClient, bulkUpdateClients, systemSettings } = useAppStore();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
    const [viewMode, setViewMode] = useState<ViewMode>('filling_center');
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('cards');
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => format(new Date(), 'yyyy-MM'));
    const [periodType, setPeriodType] = useState<'month' | 'semester'>('month');
    
    // Modals state
    const [editingFacturadorClient, setEditingFacturadorClient] = useState<Client | null>(null);
    const [recordingInvoiceClient, setRecordingInvoiceClient] = useState<Client | null>(null);
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
    
    // Resend email modal state
    const [resendNoticeState, setResendNoticeState] = useState<{
        isOpen: boolean;
        client: Client | null;
        noticeType: 'renewal' | 'low_docs' | 'credentials' | 'filling_statement';
        additionalData?: any;
    }>({
        isOpen: false,
        client: null,
        noticeType: 'renewal'
    });

    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
    const [visibleSriPasswords, setVisibleSriPasswords] = useState<{ [id: string]: boolean }>({});
    const [visibleSigPasswords, setVisibleSigPasswords] = useState<{ [id: string]: boolean }>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
    const [selectedVaultClient, setSelectedVaultClient] = useState<Client | null>(null);
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
        return storeClients.filter(c => !c.isDeleted && c.isActive && (
            c.billingPlan || 
            c.facturadorConfig || 
            c.signatureFile || 
            c.signatureExpirationDate || 
            c.clientType === 'solo_plan' || 
            c.hasExternalAccountant ||
            c.requiresDeclarations === false
        ));
    }, [storeClients]);

    // RUC Certificate 3-month (90 days) expiration helper
    const getRucCertStatus = (client: Client) => {
        const file = client.rucCertificate || client.rucPdf;
        if (!file) return { hasFile: false, isExpired: false, daysAge: null, label: 'Falta Certificado RUC' };
        const uploadDate = file.lastModified ? new Date(file.lastModified) : (client.rucCertificateIssueDate ? new Date(client.rucCertificateIssueDate) : null);
        if (!uploadDate) return { hasFile: true, isExpired: false, daysAge: null, label: 'Certificado Subido' };
        const daysAge = Math.floor((Date.now() - uploadDate.getTime()) / (1000 * 3600 * 24));
        const isExpired = daysAge > 90;
        return {
            hasFile: true,
            isExpired,
            daysAge,
            label: isExpired ? `Caducado (${daysAge}d > 90d)` : `Vigente (${daysAge}d / 90d)`
        };
    };

    const kpis = useMemo(() => {
        const total = allFacturadorClients.length;
        const talonario = allFacturadorClients.filter(c => {
            const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
            return p.includes('talonario');
        }).length;
        const ecuafact = allFacturadorClients.filter(c => {
            const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
            return p.includes('ecuafact');
        }).length;
        const zifact = allFacturadorClients.filter(c => {
            const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
            return p.includes('zifac');
        }).length;
        const sriGratuito = allFacturadorClients.filter(c => {
            const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
            return p.includes('sri') || (c.signatureFile && !c.billingPlan && !c.facturadorConfig);
        }).length;

        const conFirma = allFacturadorClients.filter(c => !!c.signatureFile).length;
        const sinFirma = allFacturadorClients.filter(c => !c.signatureFile).length;
        const externos = allFacturadorClients.filter(c => c.hasExternalAccountant || c.clientType === 'solo_plan' || c.requiresDeclarations === false).length;
        const planta = allFacturadorClients.filter(c => !c.hasExternalAccountant && c.clientType !== 'solo_plan' && c.requiresDeclarations !== false).length;

        const porVencer = allFacturadorClients.filter(c => {
            const p = c.billingPlan || c.facturadorConfig;
            if (p?.expirationDate) {
                const days = Math.ceil((new Date(p.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                if (days <= 30 && days >= 0) return true;
            }
            if (c.signatureExpirationDate) {
                const days = Math.ceil((new Date(c.signatureExpirationDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                if (days <= 30 && days >= 0) return true;
            }
            return false;
        }).length;

        const agotados = allFacturadorClients.filter(c => {
            const p = c.billingPlan || c.facturadorConfig;
            if (!p || p.planType === 'sri_gratuito') return false;
            const remaining = (p.documentCount ?? 100) - (p.documentsUsed ?? 0);
            return remaining <= 5;
        }).length;

        // Financial calculations
        const revenue = allFacturadorClients.reduce((acc, c) => acc + (c.billingPlan?.price || c.facturadorConfig?.price || 0), 0);
        const cost = allFacturadorClients.reduce((acc, c) => acc + (c.billingPlan?.costPrice || c.facturadorConfig?.costPrice || 0), 0);
        const profitMargin = revenue - cost;

        return { total, talonario, ecuafact, zifact, sriGratuito, conFirma, sinFirma, externos, planta, porVencer, agotados, revenue, cost, profitMargin };
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

        if (filterStatus === 'talonario') {
            list = list.filter(c => {
                const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
                return p.includes('talonario');
            });
        } else if (filterStatus === 'ecuafact') {
            list = list.filter(c => {
                const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
                return p.includes('ecuafact');
            });
        } else if (filterStatus === 'zifact') {
            list = list.filter(c => {
                const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
                return p.includes('zifac');
            });
        } else if (filterStatus === 'sri_gratuito') {
            list = list.filter(c => {
                const p = c.billingPlan?.programName?.toLowerCase() || c.facturadorConfig?.programName?.toLowerCase() || '';
                return p.includes('sri') || (c.signatureFile && !c.billingPlan && !c.facturadorConfig);
            });
        } else if (filterStatus === 'con_firma') {
            list = list.filter(c => !!c.signatureFile);
        } else if (filterStatus === 'sin_firma') {
            // Requisito solicitado por el usuario: categorizar y buscar clientes SIN firma en sistema
            list = list.filter(c => !c.signatureFile);
        } else if (filterStatus === 'planta') {
            list = list.filter(c => !c.hasExternalAccountant && c.clientType !== 'solo_plan' && c.requiresDeclarations !== false);
        } else if (filterStatus === 'externos') {
            // Requisito solicitado: clientes externos como Armijos K o Naula que tienen otro contador
            list = list.filter(c => c.hasExternalAccountant || c.clientType === 'solo_plan' || c.requiresDeclarations === false);
        } else if (filterStatus === 'por_vencer') {
            list = list.filter(c => {
                const p = c.billingPlan || c.facturadorConfig;
                if (p?.expirationDate) {
                    const days = Math.ceil((new Date(p.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                    if (days <= 30 && days >= 0) return true;
                }
                if (c.signatureExpirationDate) {
                    const days = Math.ceil((new Date(c.signatureExpirationDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                    if (days <= 30 && days >= 0) return true;
                }
                return false;
            });
        } else if (filterStatus === 'agotados') {
            list = list.filter(c => {
                const p = c.billingPlan || c.facturadorConfig;
                if (!p || p.planType === 'sri_gratuito') return false;
                const remaining = (p.documentCount ?? 100) - (p.documentsUsed ?? 0);
                return remaining <= 5;
            });
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

    // Copiar Ficha de Acceso ("Nivel Contador"): Portal + User + Clave Facturador + Clave SRI
    const handleCopyDirectLogin = (client: Client) => {
        const plan = client.billingPlan || client.facturadorConfig || {};
        const url = plan.url || (
            plan.programName?.toLowerCase().includes('talonario') ? 'https://talonarioamigo.santiagocordova.com' :
            plan.programName?.toLowerCase().includes('zifac') ? 'https://sistema.zifac.com' :
            plan.programName?.toLowerCase().includes('sri') ? 'https://srienlinea.sri.gob.ec' :
            'https://app.ecuafact.com'
        );
        const user = plan.username || client.ruc;
        const pwd = plan.password || client.sriPassword;
        const text = `📌 ACCESOS OFICIALES FACTURADOR
Cliente: ${client.tradeName || client.name}
RUC: ${client.ruc}
🌐 Portal Web: ${url}
👤 Usuario: ${user}
🔑 Clave Facturador: ${pwd}
🏛️ Clave SRI: ${client.sriPassword}
🔐 Clave Firma .p12: ${client.electronicSignaturePassword || 'N/A'}`;

        navigator.clipboard.writeText(text);
        setCopiedId(client.id);
        toast.success(`Ficha de acceso de ${client.tradeName || client.name} copiada.`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleOpenResendModal = (client: Client, noticeType: 'renewal' | 'low_docs' | 'credentials' | 'filling_statement', additionalData?: any) => {
        setResendNoticeState({
            isOpen: true,
            client,
            noticeType,
            additionalData
        });
    };

    const handleDownloadAllResources = async (client: Client) => {
        const isEcuafact = client.facturadorConfig?.programName?.toLowerCase().includes('ecuafact') || client.billingPlan?.programName?.toLowerCase().includes('ecuafact');
        const filesToDownload = [
            { file: client.idCardFront, suffix: 'Cedula_Frente' },
            { file: client.idCardBack, suffix: 'Cedula_Reverso' },
            { file: client.idCardSelfie, suffix: 'Selfie_Cedula' },
            { file: client.rucPdf || client.rucCertificate, suffix: 'Certificado_RUC' },
            { file: client.signatureFile, suffix: 'Firma_Electronica' },
            ...(isEcuafact ? [{ file: client.ecuafactSignedRequest, suffix: 'Solicitud_Firmada' }] : [])
        ].filter(item => item.file && (item.file.content || item.file.url));

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
                else if (vaultUploadTarget === 'rucPdf') {
                    updates.rucPdf = storedFile;
                    updates.rucCertificate = storedFile;
                    updates.rucCertificateIssueDate = new Date().toISOString();
                }
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

    // ── MÉTODOS DE DEPURACIÓN SEGURA ──
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

    const formatPeriodMonth = (periodStr: string) => {
        try {
            if (periodStr.includes('-S')) {
                const [year, s] = periodStr.split('-');
                return `Semestre ${s.replace('S', '')} ${year}`;
            }
            const [year, monthNum] = periodStr.split('-');
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const mIdx = parseInt(monthNum, 10) - 1;
            return `${months[mIdx] || monthNum} ${year}`;
        } catch {
            return periodStr;
        }
    };

    const handlePrevPeriod = () => {
        if (periodType === 'semester') {
            const [y, s] = selectedPeriod.split('-');
            const yearNum = parseInt(y, 10);
            if (s === 'S2') setSelectedPeriod(`${yearNum}-S1`);
            else setSelectedPeriod(`${yearNum - 1}-S2`);
        } else {
            const current = parseISO(`${selectedPeriod}-01`);
            setSelectedPeriod(format(subMonths(current, 1), 'yyyy-MM'));
        }
    };

    const handleNextPeriod = () => {
        if (periodType === 'semester') {
            const [y, s] = selectedPeriod.split('-');
            const yearNum = parseInt(y, 10);
            if (s === 'S1') setSelectedPeriod(`${yearNum}-S2`);
            else setSelectedPeriod(`${yearNum + 1}-S1`);
        } else {
            const current = parseISO(`${selectedPeriod}-01`);
            setSelectedPeriod(format(addMonths(current, 1), 'yyyy-MM'));
        }
    };

    // Calculate invoice record total based on client billing rules (unit $2, pack $5, monthly combo $10)
    const calculateRecordTotal = (plan: BillingPlan, currentRec: MonthlyInvoicingRecord, newCount: number): number => {
        const mode = currentRec.billingMode || plan.defaultBillingMode || 'unit';
        const unitFee = currentRec.feePerInvoice ?? (systemSettings.defaultFillingUnitFee ?? 2.00);
        const pack5Fee = systemSettings.defaultFillingPack5Fee ?? 5.00;
        const comboFee = currentRec.declarationFeeLinked ? (currentRec.declarationFeeLinked + 5.00) : (systemSettings.defaultMonthlyComboFee ?? 10.00);

        if (mode === 'monthly_combo_10') {
            return comboFee; // $10 flat combo (Declaración $5 + Facturas $5 - ej: Camba Paola)
        } else if (mode === 'pack_5') {
            if (newCount <= 5) return pack5Fee; // $5 flat hasta 5 facturas
            return pack5Fee + (newCount - 5) * 1.00; // $1 extra por factura adicional
        } else if (mode === 'unit' || mode === 'semestral_batch') {
            return newCount * unitFee; // $2.00 unitario
        } else {
            return plan.planType === 'plan_mensual' ? (plan.monthlyFee ?? 20.00) : (newCount * unitFee);
        }
    };

    const getMonthlyRecord = (client: Client, period: string): MonthlyInvoicingRecord => {
        const plan = client.billingPlan || client.facturadorConfig || {};
        const records = plan.monthlyRecords || {};
        if (records[period]) return records[period];
        
        const mode = plan.defaultBillingMode || 'unit';
        const feePerInvoice = plan.feePerInvoice ?? (systemSettings.defaultFillingUnitFee ?? 2.00);
        const monthlyFee = plan.monthlyFee ?? 20.00;

        return {
            period,
            count: 0,
            feePerInvoice,
            monthlyPlanFee: monthlyFee,
            totalFee: mode === 'monthly_combo_10' ? (systemSettings.defaultMonthlyComboFee ?? 10.00) : 0,
            billingMode: mode,
            declarationFeeLinked: mode === 'monthly_combo_10' ? 5.00 : undefined,
            invoices: []
        };
    };

    const handleQuickIncrementInvoice = async (client: Client) => {
        const plan = client.billingPlan || client.facturadorConfig || {};
        const records = { ...(plan.monthlyRecords || {}) };
        const currentRec = records[selectedPeriod] || getMonthlyRecord(client, selectedPeriod);

        const newCount = (currentRec.count || 0) + 1;
        const newTotalFee = calculateRecordTotal(plan, currentRec, newCount);

        records[selectedPeriod] = {
            ...currentRec,
            count: newCount,
            totalFee: newTotalFee,
            invoices: [
                ...(currentRec.invoices || []),
                {
                    id: uuidv4(),
                    date: new Date().toISOString().split('T')[0],
                    secuencial: `FAC-${String(newCount).padStart(3, '0')}`,
                    amount: 0
                }
            ]
        };

        const updatedPlan: BillingPlan = {
            ...plan,
            monthlyRecords: records,
            documentsUsed: (plan.documentsUsed ?? 0) + 1,
            updatedAt: new Date().toISOString()
        };

        updateClient(client.id, {
            billingPlan: updatedPlan,
            facturadorConfig: updatedPlan
        });

        toast.success(`⚡ +1 Factura para ${client.tradeName || client.name}. Total: ${newCount} ($${newTotalFee.toFixed(2)})`);
    };

    const handleSaveDetailedInvoice = async (clientId: string, invoiceData: any) => {
        const client = storeClients.find(c => c.id === clientId);
        if (!client) return;

        const plan = client.billingPlan || client.facturadorConfig || {};
        const records = { ...(plan.monthlyRecords || {}) };
        const currentRec = records[invoiceData.period] || getMonthlyRecord(client, invoiceData.period);

        const newCount = (currentRec.count || 0) + 1;
        const newTotalFee = calculateRecordTotal(plan, currentRec, newCount);

        const newInvoice = {
            id: uuidv4(),
            date: invoiceData.date,
            secuencial: invoiceData.secuencial || `FAC-${String(newCount).padStart(3, '0')}`,
            amount: invoiceData.amount,
            clientRecipient: invoiceData.clientRecipient,
            file: invoiceData.file
        };

        records[invoiceData.period] = {
            ...currentRec,
            count: newCount,
            totalFee: newTotalFee,
            invoices: [...(currentRec.invoices || []), newInvoice]
        };

        const updatedPlan: BillingPlan = {
            ...plan,
            monthlyRecords: records,
            documentsUsed: (plan.documentsUsed ?? 0) + 1,
            updatedAt: new Date().toISOString()
        };

        updateClient(client.id, {
            billingPlan: updatedPlan,
            facturadorConfig: updatedPlan
        });
    };

    const handleSaveFacturadorConfig = async (clientId: string, updatedPlan: Partial<BillingPlan>, clientUpdates?: Partial<Client>) => {
        updateClient(clientId, {
            billingPlan: updatedPlan,
            facturadorConfig: updatedPlan,
            ...(clientUpdates || {})
        });
    };

    const handleSendWhatsAppBillingNotice = (client: Client, period: string) => {
        const plan = client.billingPlan || client.facturadorConfig || {};
        const record = getMonthlyRecord(client, period);
        const count = record.count || 0;
        const total = record.totalFee || 0;
        const portalUrl = `https://santiagocordova.com/portal?ruc=${client.ruc}`;

        const monthTitle = formatPeriodMonth(period);

        const message = `Estimado(a) *${client.tradeName || client.name}* 👋, le saludamos de Soluciones Contables Pro.\n\n` +
                        `Le presentamos el resumen de emisión de facturas electrónicas correspondiente al período *${monthTitle}*:\n\n` +
                        `📄 *Facturas Llenadas / Emitidas:* ${count} comprobante(s)\n` +
                        `💼 *Modalidad:* ${record.billingMode === 'monthly_combo_10' ? 'Combo Mensual (Declaración + Facturas)' : record.billingMode === 'pack_5' ? 'Paquete 5 Facturas' : 'Tarifa por Factura'}\n` +
                        `💰 *Total Honorarios:* $${total.toFixed(2)} USD\n\n` +
                        `🔗 Puede consultar el detalle en su Portal de Cliente:\n${portalUrl}\n\n` +
                        `Agradecemos coordinar la cancelación a nuestras cuentas registradas. Saludos cordiales, *Ing. Santiago Córdova*.`;

        const pObj = client.phones?.[0];
        const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
        setWhatsAppPrompt({ clientName: client.name, phone, message });
    };

    // Alerta colapsable
    const [alertsCollapsed, setAlertsCollapsed] = useState(false);

    return (
        <div className="space-y-6 pb-28 animate-in fade-in duration-300 relative font-sans min-h-screen">
            {/* ── TOP EXECUTIVE STRIPE ── */}
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-foreground/10 border-t-foreground/20 bg-surface-low shadow-2xl backdrop-blur-2xl p-6 sm:p-10 transition-all duration-500">
                    {/* Mesh Gradient */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-radial from-primary/15 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-radial from-tertiary/15 to-transparent blur-3xl" />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="w-full sm:w-auto font-mono">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/15 border border-tertiary/30 shadow-[0_0_10px_rgba(0,168,150,0.2)]">
                                    <div className="relative w-2 h-2 rounded-full bg-tertiary">
                                        <div className="absolute inset-0 rounded-full bg-tertiary animate-ping opacity-60" />
                                    </div>
                                    <span className="text-[10px] font-bold text-tertiary uppercase tracking-[0.25em]">SISTEMA DE FACTURACIÓN & LLENADO</span>
                                </div>
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hidden sm:inline">• Ecuafact · Zifact · Talonario Amigo · SRI</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-on-surface leading-none tracking-tight font-display">
                                FACTURADORES & <span className="bg-gradient-to-r from-tertiary via-tertiary to-primary bg-clip-text text-transparent">LLENADO</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-sm text-on-surface-variant font-sans font-medium max-w-2xl">
                                Control de facturadores, timbres y planes anuales. Llenado por cuenta de clientes (Pinea, Wilmer, Camba Paola), avisos automáticos por <strong>Resend</strong> y expedientes de renovación.
                            </p>
                        </div>

                        {/* ACCIONES DE REGISTRO RÁPIDO */}
                        <div className="flex items-center gap-2.5 flex-wrap shrink-0 font-mono">
                            <button
                                onClick={() => setIsAddClientModalOpen(true)}
                                className="px-5 py-3.5 bg-gradient-to-r from-tertiary to-teal-600 hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-tertiary/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border border-foreground/10"
                            >
                                <Plus size={16} />
                                <span>Vincular Cliente</span>
                            </button>
                            <button
                                onClick={() => setIsSalesModalOpen(true)}
                                className="px-5 py-3.5 bg-surface-lowest hover:bg-foreground/10 text-on-surface border border-foreground/10 font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <ShoppingBag size={16} className="text-amber-400" />
                                <span>Vender Plan / Combo</span>
                            </button>
                            <button
                                onClick={() => setIsQuickPlanModalOpen(true)}
                                className="px-4 py-3.5 bg-surface-lowest hover:bg-foreground/10 text-on-surface-variant border border-foreground/10 font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                                title="Autorización Ecuafact"
                            >
                                <FileText size={16} className="text-sky-400" />
                                <span className="hidden sm:inline">Ecuafact Docx</span>
                            </button>
                        </div>
                    </div>

                    {/* ── 4 TARJETAS EJECUTIVAS KPI ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-foreground/10 font-mono">
                        {/* Card 1: Total Facturadores */}
                        <div 
                            onClick={() => setFilterStatus('todos')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'todos' 
                                    ? 'bg-tertiary/15 border-tertiary/40 text-tertiary shadow-lg shadow-tertiary/10 scale-[1.02]' 
                                    : 'bg-surface-lowest border-foreground/10 text-on-surface-variant hover:border-foreground/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total Carteras</span>
                                <ShoppingBag size={16} className="text-tertiary" />
                            </div>
                            <div className="text-3xl font-black text-on-surface font-mono mt-2">{kpis.total}</div>
                            <div className="text-[10px] font-medium text-on-surface-variant mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                                <span>{kpis.talonario} Talonario · {kpis.ecuafact} Ecuafact</span>
                            </div>
                        </div>

                        {/* Card 2: Clientes Externos (Otro Contador) */}
                        <div 
                            onClick={() => setFilterStatus('externos')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'externos' 
                                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-400 shadow-lg shadow-sky-500/10 scale-[1.02]' 
                                    : 'bg-surface-lowest border-foreground/10 text-on-surface-variant hover:border-foreground/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Externos (Otro Contador)</span>
                                <User size={16} className="text-sky-400" />
                            </div>
                            <div className="text-3xl font-black text-sky-400 font-mono mt-2">{kpis.externos}</div>
                            <div className="text-[10px] font-medium text-on-surface-variant mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                <span>Armijos K, Naula, etc.</span>
                            </div>
                        </div>

                        {/* Card 3: Clientes Sin Firma Guardada */}
                        <div 
                            onClick={() => setFilterStatus('sin_firma')}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                filterStatus === 'sin_firma' 
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10 scale-[1.02]' 
                                    : 'bg-surface-lowest border-foreground/10 text-on-surface-variant hover:border-foreground/20'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Sin Firma en Sistema</span>
                                <AlertTriangle size={16} className="text-amber-400" />
                            </div>
                            <div className="text-3xl font-black text-amber-400 font-mono mt-2">{kpis.sinFirma}</div>
                            <div className="text-[10px] font-medium text-on-surface-variant mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span>Planes activos sin .p12</span>
                            </div>
                        </div>

                        {/* Card 4: Margen Financiero */}
                        <div 
                            onClick={() => setViewMode('analytics')}
                            className="p-5 rounded-2xl border bg-surface-lowest border-foreground/10 text-on-surface-variant hover:border-tertiary/40 transition-all cursor-pointer relative overflow-hidden group"
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary">Margen Neto Catálogo</span>
                                <DollarSign size={16} className="text-tertiary" />
                            </div>
                            <div className="text-3xl font-black text-tertiary font-mono mt-2">${kpis.profitMargin.toFixed(2)}</div>
                            <div className="text-[10px] font-medium text-on-surface-variant mt-1 flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                                <span>Rentabilidad de software</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ALERTAS DE VENCIMIENTO INMEDIATO (colapsable) ── */}
            {expiringAlerts.length > 0 && (
                <div className="px-4 sm:px-0">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-[2rem] backdrop-blur-2xl font-mono overflow-hidden">
                        {/* Header colapsable */}
                        <button
                            onClick={() => setAlertsCollapsed(c => !c)}
                            className="w-full flex items-center justify-between gap-3 p-5 cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="relative">
                                    <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full badge-urgent" />
                                </div>
                                <h3 className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                                    Alertas de Caducidad Inmediata — Próximos 15 días
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                                    {expiringAlerts.length} clientes
                                </span>
                                {alertsCollapsed ? <ChevronDown size={14} className="text-amber-400" /> : <ChevronUp size={14} className="text-amber-400" />}
                            </div>
                        </button>

                        {/* Panel expansible */}
                        {!alertsCollapsed && (
                            <div className="alert-panel-enter px-5 pb-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {expiringAlerts.map(client => {
                                        const expDate = new Date(client.signatureExpirationDate!);
                                        const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
                                        const isUrgent = diffDays <= 5;
                                        return (
                                            <div key={client.id} className={`bg-surface-lowest border rounded-2xl p-4 flex flex-col justify-between factcard-lift ${isUrgent ? 'border-rose-500/30' : 'border-amber-500/20'}`}>
                                                <div>
                                                    <div className="font-bold text-on-surface uppercase text-xs truncate">{client.tradeName || client.name}</div>
                                                    <div className="text-[10px] font-mono text-on-surface-variant mt-0.5">RUC: {client.ruc}</div>
                                                </div>
                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-foreground/5 font-mono">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isUrgent ? 'bg-rose-500/20 text-rose-400 badge-urgent' : 'bg-amber-500/20 text-amber-400 badge-warning'}`}>
                                                            {diffDays}d
                                                        </span>
                                                        <span className="text-[10px] text-on-surface-variant">{format(expDate, "dd/MM/yy")}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleOpenResendModal(client, 'renewal', { daysRemaining: diffDays })}
                                                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                                                    >
                                                        <Mail size={10} />
                                                        <span>Avisar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── SELECTOR PRINCIPAL DE LAS 4 VISTAS MAESTRAS ── */}
            <div className="px-4 sm:px-0">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-surface-low p-4 rounded-[2rem] border border-foreground/10 backdrop-blur-2xl shadow-xl font-mono">
                    <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                        {/* 1. Centro de Llenado */}
                        <button
                            onClick={() => setViewMode('filling_center')}
                            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                                viewMode === 'filling_center'
                                    ? 'bg-gradient-to-r from-tertiary to-teal-600 text-white shadow-lg shadow-tertiary/25 border border-foreground/20 scale-[1.02]'
                                    : 'bg-surface-lowest border border-foreground/10 text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <ShoppingBag size={15} />
                            <span>⚡ Centro de Llenado</span>
                        </button>

                        {/* 2. Directorio & Facturadores */}
                        <button
                            onClick={() => setViewMode('software_admin')}
                            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                                viewMode === 'software_admin'
                                    ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/25 border border-foreground/20 scale-[1.02]'
                                    : 'bg-surface-lowest border border-foreground/10 text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <Sliders size={15} />
                            <span>🏢 Facturadores & Timbres</span>
                        </button>

                        {/* 3. Expedientes & Renovaciones KYC */}
                        <button
                            onClick={() => setViewMode('kyc_renewals')}
                            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                                viewMode === 'kyc_renewals'
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-foreground/20 scale-[1.02]'
                                    : 'bg-surface-lowest border border-foreground/10 text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <ShieldCheck size={15} />
                            <span>📁 Expedientes KYC (3 Meses)</span>
                        </button>

                        {/* 4. Métricas & Rentabilidad */}
                        <button
                            onClick={() => setViewMode('analytics')}
                            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                                viewMode === 'analytics'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/25 border border-foreground/20 scale-[1.02]'
                                    : 'bg-surface-lowest border border-foreground/10 text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <BarChart3 size={15} />
                            <span>📊 Análisis Financiero</span>
                        </button>
                    </div>

                    {/* Period Navigator for Filling Center */}
                    {viewMode === 'filling_center' && (
                        <div className="flex items-center gap-2 bg-surface-lowest border border-foreground/10 rounded-2xl p-1.5 w-full lg:w-auto justify-between">
                            <div className="flex items-center gap-1 border-r border-foreground/10 pr-2">
                                <button
                                    onClick={() => setPeriodType('month')}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${periodType === 'month' ? 'bg-tertiary/20 text-tertiary' : 'text-on-surface-variant'}`}
                                >
                                    Mes
                                </button>
                                <button
                                    onClick={() => {
                                        setPeriodType('semester');
                                        setSelectedPeriod(`${new Date().getFullYear()}-S1`);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${periodType === 'semester' ? 'bg-tertiary/20 text-tertiary' : 'text-on-surface-variant'}`}
                                >
                                    Semestre
                                </button>
                            </div>
                            <button
                                onClick={handlePrevPeriod}
                                className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer font-bold"
                                title="Período Anterior"
                            >
                                ◀
                            </button>
                            <span className="text-xs font-bold text-tertiary uppercase tracking-widest px-3 font-mono">
                                📅 {formatPeriodMonth(selectedPeriod)}
                            </span>
                            <button
                                onClick={handleNextPeriod}
                                className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer font-bold"
                                title="Período Siguiente"
                            >
                                ▶
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA Y FILTRADO SEGMENTADO ── */}
            <div className="px-4 sm:px-0">
                <div className="flex flex-col lg:flex-row items-center gap-4 justify-between bg-surface-low p-4 rounded-[2rem] border border-foreground/10 backdrop-blur-2xl shadow-xl font-mono">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                            type="text"
                            placeholder="BUSCAR CLIENTE, RUC O SOFTWARE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-10 py-3 bg-surface-lowest rounded-2xl border border-foreground/10 text-xs font-mono uppercase text-on-surface placeholder-on-surface-variant outline-none focus:border-tertiary/50 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filtros de Categorización Inteligente */}
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                        {[
                            { id: 'todos', label: `Todos (${kpis.total})` },
                            { id: 'talonario', label: `💎 Talonario Amigo (${kpis.talonario})` },
                            { id: 'ecuafact', label: `📄 Ecuafact (${kpis.ecuafact})` },
                            { id: 'zifact', label: `⚡ Zifact (${kpis.zifact})` },
                            { id: 'sri_gratuito', label: `🏛️ SRI Gratuito (${kpis.sriGratuito})` },
                            { id: 'con_firma', label: `🔑 Con Firma (${kpis.conFirma})` },
                            { id: 'sin_firma', label: `⚠️ Sin Firma (${kpis.sinFirma})` },
                            { id: 'planta', label: `🏛️ Planta (${kpis.planta})` },
                            { id: 'externos', label: `👤 Externos (${kpis.externos})` },
                            { id: 'por_vencer', label: `⏰ Por Vencer (${kpis.porVencer})` },
                            { id: 'agotados', label: `🛑 Cupo Bajo (${kpis.agotados})` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id as any)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    filterStatus === tab.id
                                        ? 'bg-foreground/15 text-on-surface border-foreground/20 shadow-md scale-[1.02]'
                                        : 'bg-surface-lowest border-foreground/5 text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── VISTA 1: ⚡ CENTRO DE LLENADO DE FACTURAS ── */}
            {viewMode === 'filling_center' && (
                <div className="px-4 sm:px-0 space-y-4 view-transition-enter">
                    {displayClients.length === 0 ? (
                        <div className="p-12 text-center border border-dashed border-foreground/10 rounded-3xl text-on-surface-variant space-y-2 font-mono bg-surface-low">
                            <Sparkles className="mx-auto text-tertiary/40 mb-3" size={32} />
                            <div className="text-xs font-bold text-on-surface-variant uppercase">No se encontraron clientes para facturación</div>
                            <p className="text-xs text-on-surface-variant max-w-md mx-auto font-sans">
                                Ajusta los filtros de búsqueda o usa el botón "Vincular Cliente" para registrar a Pinea, Wilmer, Camba Paola u otros clientes.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {displayClients.map(client => {
                                const config = client.billingPlan || client.facturadorConfig || {
                                    programName: client.signatureFile ? 'Talonario Amigo' : 'Facturador Particular',
                                    documentStatus: 'Registrado',
                                    username: client.ruc,
                                    password: client.sriPassword,
                                    defaultBillingMode: 'unit'
                                };
                                const record = getMonthlyRecord(client, selectedPeriod);
                                const pwdVisible = visiblePasswords[client.id] || false;
                                const sriPwdVisible = visibleSriPasswords[client.id] || false;
                                const sigPwdVisible = visibleSigPasswords[client.id] || false;

                                const providerUrl = config.url || (
                                    config.programName?.toLowerCase().includes('talonario') ? 'https://talonarioamigo.santiagocordova.com' :
                                    config.programName?.toLowerCase().includes('zifac') ? 'https://sistema.zifac.com' :
                                    config.programName?.toLowerCase().includes('sri') ? 'https://srienlinea.sri.gob.ec' :
                                    'https://app.ecuafact.com'
                                );

                                const billingModeLabel = 
                                    record.billingMode === 'monthly_combo_10' ? 'Combo Mensual $10 (Decl. $5 + Fact. $5)' :
                                    record.billingMode === 'pack_5' ? 'Pack hasta 5 facturas ($5.00)' :
                                    record.billingMode === 'semestral_batch' ? 'Lote Semestral Acumulado' :
                                    `Tarifa Unitaria ($${(record.feePerInvoice ?? 2.00).toFixed(2)})`;

                                return (
                                    <div 
                                        key={client.id}
                                        className="fact-card-stagger bg-surface-low border border-foreground/10 rounded-[2rem] p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between factcard-lift font-mono"
                                    >
                                        <div className="space-y-4">
                                            {/* Header */}
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start gap-2 flex-wrap">
                                                            <ProviderBadge programName={config.programName} />
                                                            {client.signatureFile ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/12 border border-emerald-500/30 text-emerald-400 sig-ok-glow">
                                                                    <Key size={9} /> .p12 ✓
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/12 border border-amber-500/30 text-amber-400">
                                                                    <AlertTriangle size={9} /> Sin Firma
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-sm font-black text-on-surface uppercase truncate tracking-tight mt-1.5">
                                                            {client.tradeName || client.name}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            <span className="text-[10px] text-on-surface-variant font-mono">{client.ruc}</span>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                                client.hasExternalAccountant || client.clientType === 'solo_plan'
                                                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            }`}>
                                                                {client.hasExternalAccountant || client.clientType === 'solo_plan' ? '👤 Externo' : '🏛️ Planta'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => window.open(providerUrl, '_blank')}
                                                        className="px-3 py-1.5 bg-tertiary/15 hover:bg-tertiary text-tertiary hover:text-white border border-tertiary/30 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-tertiary/10"
                                                        title="Abrir facturador en nueva pestaña"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-foreground/5 text-[9px]">
                                                    <span className="text-on-surface-variant">{billingModeLabel}</span>
                                                </div>
                                            </div>

                                            {/* Credenciales de 1 toque */}
                                            <div className="p-3 bg-surface-lowest border border-foreground/10 rounded-2xl space-y-1.5 text-[10px]">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-on-surface-variant">👤 User:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-on-surface font-mono truncate max-w-[130px]">{config.username || client.ruc}</span>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(config.username || client.ruc);
                                                                toast.success("Usuario copiado");
                                                            }}
                                                            className="p-1 hover:text-tertiary text-on-surface-variant cursor-pointer"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-on-surface-variant">🔑 Clave Fact.:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-on-surface-variant font-mono">
                                                            {pwdVisible ? (config.password || client.sriPassword) : '••••••••'}
                                                        </span>
                                                        <button
                                                            onClick={() => togglePasswordVisibility(client.id)}
                                                            className="p-1 hover:text-on-surface text-on-surface-variant cursor-pointer"
                                                        >
                                                            {pwdVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCopyPassword(client.id, config.password || client.sriPassword)}
                                                            className="p-1 hover:text-tertiary text-on-surface-variant cursor-pointer"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Botón Nivel Contador: Copiar Ficha de Acceso */}
                                                <button
                                                    onClick={() => handleCopyDirectLogin(client)}
                                                    className="w-full mt-1 pt-1.5 border-t border-foreground/5 text-[9px] text-sky-400 hover:text-sky-300 font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                                                >
                                                    <ClipboardCopy size={11} />
                                                    <span>Copiar Ficha de Acceso Oficial</span>
                                                </button>
                                            </div>

                                            {/* Widget Métrico del Período */}
                                            <div className="p-4 bg-gradient-to-br from-surface-lowest to-surface-low border border-foreground/10 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                                                        Facturas en {formatPeriodMonth(selectedPeriod)}
                                                    </span>
                                                    <span className="text-xl font-black text-on-surface font-mono">
                                                        {record.count} <span className="text-xs text-on-surface-variant font-normal">emitidas</span>
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-foreground/5 text-xs">
                                                    <span className="text-on-surface-variant font-sans">Total Honorarios:</span>
                                                    <span className="text-base font-black text-tertiary font-mono">
                                                        ${record.totalFee.toFixed(2)} USD
                                                    </span>
                                                </div>

                                                {/* Resumen de Facturas con Secuencial y PDF */}
                                                {record.invoices && record.invoices.length > 0 && (
                                                    <div className="pt-2 border-t border-foreground/5 space-y-1">
                                                        <div className="text-[9px] text-on-surface-variant uppercase font-bold">Comprobantes Recientes:</div>
                                                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                                                            {record.invoices.slice(-4).reverse().map((inv, idx) => (
                                                                <div key={inv.id || idx} className="bg-foreground/5 border border-foreground/5 px-2 py-0.5 rounded text-[9px] text-on-surface-variant flex items-center gap-1.5">
                                                                    <span>#{inv.secuencial || `${record.count - idx}`}</span>
                                                                    {inv.amount ? <span className="text-tertiary font-bold">${inv.amount.toFixed(2)}</span> : null}
                                                                    {inv.file && (
                                                                        <button 
                                                                            onClick={() => downloadStoredFile(inv.file!)}
                                                                            className="text-tertiary hover:underline"
                                                                            title="Descargar PDF"
                                                                        >
                                                                            📄
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Botonera de Acciones Rápidas */}
                                        <div className="mt-5 pt-4 border-t border-foreground/10 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleQuickIncrementInvoice(client)}
                                                    className="px-3 py-2.5 bg-tertiary/20 hover:bg-tertiary text-tertiary hover:text-white border border-tertiary/40 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-tertiary/15 hover:scale-[1.02] active:scale-[0.98]"
                                                    title="Registrar +1 Factura Realizada"
                                                >
                                                    <Plus size={14} />
                                                    <span>+1 Factura</span>
                                                </button>

                                                <button
                                                    onClick={() => setRecordingInvoiceClient(client)}
                                                    className="px-3 py-2.5 bg-foreground/5 hover:bg-foreground/10 text-on-surface-variant border border-foreground/10 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02]"
                                                    title="Registrar con Secuencial, Fecha, Monto o PDF"
                                                >
                                                    <FileText size={14} className="text-tertiary" />
                                                    <span>Detalle / PDF</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1.5">
                                                <button
                                                    onClick={() => handleSendWhatsAppBillingNotice(client, selectedPeriod)}
                                                    className="px-2 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                                    title="Enviar liquidación por WhatsApp"
                                                >
                                                    <PhoneCall size={11} />
                                                    <span>WhatsApp</span>
                                                </button>

                                                <button
                                                    onClick={() => handleOpenResendModal(client, 'filling_statement', { monthlyRecord: record, periodTitle: formatPeriodMonth(selectedPeriod) })}
                                                    className="px-2 py-2 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                                    title="Enviar liquidación ejecutiva por Resend Email"
                                                >
                                                    <Mail size={11} />
                                                    <span>Resend</span>
                                                </button>

                                                <button
                                                    onClick={() => setEditingFacturadorClient(client)}
                                                    className="px-2 py-2 bg-foreground/5 hover:bg-foreground/10 text-on-surface-variant hover:text-on-surface border border-foreground/10 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                                    title="Configurar Facturador, Credenciales y Plan"
                                                >
                                                    <Sliders size={11} />
                                                    <span>Editar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── VISTA 2: 🏢 GESTIÓN DE SOFTWARE & FACTURADORES ── */}
            {viewMode === 'software_admin' && (
                <div className="px-4 sm:px-0">
                    <div className="bg-surface-low backdrop-blur-2xl rounded-[2.5rem] border border-foreground/10 border-t-foreground/20 shadow-2xl p-6 sm:p-8 space-y-6">
                        <div className="flex items-center justify-between font-mono flex-wrap gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                                    Catálogo de Software, Planes & Saldos de Emisión
                                </h3>
                                <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                                    Control de timbres disponibles, fechas de vigencia anual, credenciales de acceso directo y enlaces oficiales.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setLayoutMode('cards')}
                                    className={`p-2 rounded-xl border text-xs ${layoutMode === 'cards' ? 'bg-tertiary/20 text-tertiary border-tertiary/40' : 'bg-surface-lowest border-foreground/10 text-on-surface-variant'}`}
                                >
                                    Tarjetas
                                </button>
                                <button
                                    onClick={() => setLayoutMode('table')}
                                    className={`p-2 rounded-xl border text-xs ${layoutMode === 'table' ? 'bg-tertiary/20 text-tertiary border-tertiary/40' : 'bg-surface-lowest border-foreground/10 text-on-surface-variant'}`}
                                >
                                    Tabla
                                </button>
                            </div>
                        </div>

                        {displayClients.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-foreground/10 rounded-3xl text-on-surface-variant space-y-2 font-mono">
                                <div className="text-xs font-bold text-on-surface-variant uppercase">No se encontraron facturadores</div>
                                <p className="text-xs text-on-surface-variant max-w-md mx-auto font-sans">
                                    No hay clientes con facturador que coincidan con los filtros activos. Usa el botón "Vincular Cliente" para registrar uno nuevo.
                                </p>
                            </div>
                        ) : layoutMode === 'table' ? (
                            <div className="overflow-x-auto rounded-3xl border border-foreground/10 bg-surface-lowest">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-foreground/10 bg-surface-lowest text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                                            <th className="py-4 px-4 w-10 text-center">
                                                <button
                                                    onClick={handleToggleSelectAll}
                                                    className="p-1 hover:text-tertiary text-on-surface-variant cursor-pointer"
                                                >
                                                    {displayClients.length > 0 && selectedClientIds.length === displayClients.length ? (
                                                        <CheckSquare size={16} className="text-tertiary" />
                                                    ) : (
                                                        <Square size={16} />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="py-4 px-5">Cliente & RUC</th>
                                            <th className="py-4 px-5">Facturador & Vigencia</th>
                                            <th className="py-4 px-5">Saldo Comprobantes</th>
                                            <th className="py-4 px-5">Firma .p12</th>
                                            <th className="py-4 px-5">Credenciales Acceso</th>
                                            <th className="py-4 px-5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-foreground/5 font-mono">
                                        {displayClients.map(client => {
                                            const plan = client.billingPlan || client.facturadorConfig || {};
                                            const isSelected = selectedClientIds.includes(client.id);
                                            const totalDocs = plan.documentCount ?? 100;
                                            const usedDocs = plan.documentsUsed ?? 0;
                                            const remaining = plan.planType === 'sri_gratuito' ? 999999 : (totalDocs - usedDocs);

                                            return (
                                                <tr key={client.id} className={`hover:bg-foreground/[0.02] transition-colors ${isSelected ? 'bg-tertiary/10' : ''}`}>
                                                    <td className="py-4 px-4 text-center">
                                                        <button
                                                            onClick={() => handleToggleSelectClient(client.id)}
                                                            className="p-1 hover:text-tertiary text-on-surface-variant cursor-pointer"
                                                        >
                                                            {isSelected ? <CheckSquare size={16} className="text-tertiary" /> : <Square size={16} />}
                                                        </button>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="font-bold text-on-surface uppercase text-xs">{client.tradeName || client.name}</div>
                                                        <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                                            <span className="font-mono text-on-surface-variant">{client.ruc}</span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${
                                                                client.hasExternalAccountant ? 'bg-sky-500/15 text-sky-400' : 'bg-tertiary/15 text-tertiary'
                                                            }`}>
                                                                {client.hasExternalAccountant ? '👤 Externo' : '🏛️ Planta'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="font-bold text-on-surface text-xs">{plan.programName || 'SRI Gratuito'}</div>
                                                        <div className="text-[10px] text-on-surface-variant mt-0.5">
                                                            {plan.expirationDate ? `Vence: ${format(new Date(plan.expirationDate), 'dd/MM/yyyy')}` : 'Permanente'}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        {plan.planType === 'sri_gratuito' ? (
                                                            <span className="text-emerald-400 font-bold text-xs">🏛️ Ilimitado</span>
                                                        ) : (
                                                            <div>
                                                                <span className={`font-bold font-mono text-xs ${remaining <= 5 ? 'text-rose-400' : 'text-on-surface'}`}>
                                                                    {remaining} / {totalDocs} docs
                                                                </span>
                                                                {remaining <= 5 && (
                                                                    <span className="block text-[8px] text-rose-400 uppercase font-bold">¡Recarga Urgente!</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        {client.signatureFile ? (
                                                            <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                                                                <CheckCircle2 size={13} /> Subida
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
                                                                <AlertTriangle size={13} /> Sin Firma
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <button
                                                            onClick={() => handleCopyDirectLogin(client)}
                                                            className="px-2.5 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-on-surface rounded-xl text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer"
                                                        >
                                                            <Copy size={12} className="text-tertiary" />
                                                            <span>Copiar Accesos</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-4 px-5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenResendModal(client, 'credentials')}
                                                                className="p-2 text-sky-400 hover:bg-sky-500/10 rounded-xl transition-all cursor-pointer"
                                                                title="Enviar credenciales por Resend"
                                                            >
                                                                <Mail size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingFacturadorClient(client)}
                                                                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 rounded-xl transition-all cursor-pointer"
                                                                title="Editar configuración"
                                                            >
                                                                <Sliders size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Vista de Tarjetas Software — mejorada con DocProgressBar + ProviderBadge */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {displayClients.map(client => {
                                    const plan = client.billingPlan || client.facturadorConfig || {};
                                    const totalDocs = plan.documentCount ?? 100;
                                    const usedDocs = plan.documentsUsed ?? 0;
                                    const isSriGratuito = plan.planType === 'sri_gratuito';
                                    const remaining = isSriGratuito ? 999999 : (totalDocs - usedDocs);
                                    const pInfo = getProviderInfo(plan.programName);

                                    return (
                                        <div key={client.id} className={`fact-card-stagger p-5 rounded-2xl bg-surface-lowest border border-foreground/10 factcard-lift space-y-4 ${pInfo.glowClass}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <ProviderBadge programName={plan.programName} size="md" />
                                                    <div className="font-bold text-on-surface uppercase text-xs truncate mt-1.5">
                                                        {client.tradeName || client.name}
                                                    </div>
                                                    <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">{client.ruc}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                                        client.hasExternalAccountant ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-tertiary/15 text-tertiary border border-tertiary/30'
                                                    }`}>
                                                        {client.hasExternalAccountant ? '👤 Externo' : '🏛️ Planta'}
                                                    </span>
                                                    {client.signatureFile ? (
                                                        <span className="text-[8px] text-emerald-400 font-bold sig-ok-glow px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10">🔑 .p12 ✓</span>
                                                    ) : (
                                                        <span className="text-[8px] text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10">⚠ Sin .p12</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Barra de progreso de documentos */}
                                            <div className="p-3 bg-surface-low rounded-xl space-y-2.5">
                                                <DocProgressBar used={usedDocs} total={totalDocs} isSriGratuito={isSriGratuito} />
                                                {plan.expirationDate && (
                                                    <div className="flex items-center justify-between text-[9px]">
                                                        <span className="text-on-surface-variant">Vence:</span>
                                                        <span className="font-mono font-bold text-on-surface">{format(new Date(plan.expirationDate), 'dd/MM/yyyy')}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-foreground/5">
                                                <button
                                                    onClick={() => handleCopyDirectLogin(client)}
                                                    className="flex-1 py-2 bg-foreground/5 hover:bg-foreground/10 text-on-surface rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                >
                                                    <Copy size={12} className="text-tertiary" />
                                                    <span>Copiar Accesos</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenResendModal(client, 'credentials')}
                                                    className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl transition-all cursor-pointer"
                                                    title="Enviar credenciales por Resend"
                                                >
                                                    <Mail size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingFacturadorClient(client)}
                                                    className="p-2 bg-foreground/5 hover:bg-foreground/10 text-on-surface-variant rounded-xl transition-all cursor-pointer"
                                                    title="Configurar facturador"
                                                >
                                                    <Sliders size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── VISTA 3: 📁 EXPEDIENTES & RENOVACIONES KYC (CONTROL 3 MESES RUC) ── */}
            {viewMode === 'kyc_renewals' && (
                <div className="px-4 sm:px-0">
                    <div className="bg-surface-low backdrop-blur-2xl rounded-[2.5rem] border border-foreground/10 border-t-foreground/20 shadow-2xl p-6 sm:p-8 space-y-6 font-mono">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-amber-400" />
                                    <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                                        Expedientes de Trámite & Renovación KYC
                                    </h3>
                                </div>
                                <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                                    Control riguroso de cédula frontal, reverso, selfie y <strong>Certificado de RUC (caduca cada 3 meses / 90 días)</strong> para clientes de planta y externos (Armijos K, Naula).
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                                📋 Verificación Obligatoria SRI
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {displayClients.map(client => {
                                const rucStatus = getRucCertStatus(client);
                                const hasFront = !!client.idCardFront;
                                const hasBack = !!client.idCardBack;
                                const hasSelfie = !!client.idCardSelfie;
                                const hasSriKey = !!client.sriPassword;
                                const hasSignature = !!client.signatureFile;

                                const checks = [hasFront, hasBack, hasSelfie, rucStatus.hasFile && !rucStatus.isExpired, hasSignature];
                                const presentCount = checks.filter(Boolean).length;
                                const pct = Math.round((presentCount / 5) * 100);
                                const isFullyReady = presentCount === 5;

                                const checkItems = [
                                    { label: 'Cédula Frontal', ok: hasFront },
                                    { label: 'Cédula Reverso', ok: hasBack },
                                    { label: 'Selfie c/ Cédula', ok: hasSelfie },
                                    { label: 'Clave SRI Activa', ok: hasSriKey },
                                    { label: 'RUC (3 meses)', ok: rucStatus.hasFile && !rucStatus.isExpired, warn: rucStatus.hasFile && rucStatus.isExpired },
                                ];

                                return (
                                    <div key={client.id} className="fact-card-stagger p-5 rounded-2xl bg-surface-lowest border border-foreground/10 factcard-lift space-y-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-bold text-on-surface uppercase text-xs truncate">
                                                    {client.tradeName || client.name}
                                                </div>
                                                <div className="text-[10px] text-on-surface-variant mt-0.5 font-mono">{client.ruc}</div>
                                            </div>
                                            <KycCompletionRing pct={pct} />
                                        </div>

                                        {/* Checklist Documental Visual */}
                                        <div className="space-y-1.5 text-xs bg-surface-low p-3.5 rounded-xl border border-foreground/5">
                                            {checkItems.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between">
                                                    <span className="text-[10px] text-on-surface-variant">{item.label}:</span>
                                                    <span className={`flex items-center gap-1 text-[10px] font-bold ${
                                                        item.ok ? 'text-emerald-400' : (item as any).warn ? 'text-rose-400' : 'text-rose-400'
                                                    }`}>
                                                        {item.ok ? <CheckCircle2 size={11} /> : <X size={11} />}
                                                        {item.ok ? 'OK' : (item as any).warn ? 'Caducado' : 'Falta'}
                                                    </span>
                                                </div>
                                            ))}
                                            {rucStatus.daysAge !== null && (
                                                <div className="pt-1 border-t border-foreground/5">
                                                    <div className="doc-progress-track">
                                                        <div
                                                            className={`doc-progress-fill ${rucStatus.isExpired ? 'doc-progress-danger' : rucStatus.daysAge > 60 ? 'doc-progress-warning' : 'doc-progress-ok'}`}
                                                            style={{ width: `${Math.min((rucStatus.daysAge / 90) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-[9px] text-on-surface-variant mt-1 text-right">{rucStatus.label}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Acciones de Expediente */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-foreground/5">
                                            <button
                                                onClick={() => handleDownloadAllResources(client)}
                                                className="flex-1 py-2 bg-foreground/5 hover:bg-foreground/10 text-on-surface rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                title="Descargar paquete completo de recursos"
                                            >
                                                <Download size={12} className="text-tertiary" />
                                                <span>Bajar Expediente</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedVaultClient(client);
                                                    setVaultUploadTarget('vault');
                                                    directVaultUploadInputRef.current?.click();
                                                }}
                                                className="p-2 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary rounded-xl transition-all cursor-pointer"
                                                title="Subir archivo a la Bóveda de este cliente"
                                            >
                                                <UploadCloud size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── VISTA 4: 📊 ANÁLISIS FINANCIERO & RENTABILIDAD ── */}
            {viewMode === 'analytics' && (
                <div className="px-4 sm:px-0">
                    <div className="bg-surface-low backdrop-blur-2xl rounded-[2.5rem] border border-foreground/10 border-t-foreground/20 shadow-2xl p-6 sm:p-10 space-y-8 font-mono">
                        <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-foreground/10">
                            <div>
                                <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest bg-tertiary/10 px-2.5 py-0.5 rounded-full border border-tertiary/20">
                                    Reporte Ejecutivo de Gestión
                                </span>
                                <h3 className="text-xl sm:text-2xl font-black font-display text-on-surface uppercase tracking-tight mt-1">
                                    Informe Financiero & Rentabilidad de Software
                                </h3>
                                <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                                    Análisis del margen neto entre compras a proveedores y precios facturados a clientes.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const text = `📊 INFORME FINANCIERO FACTURADORES\nTotal Clientes: ${kpis.total}\nIngresos Brutos: $${kpis.revenue.toFixed(2)}\nCostos Despacho: $${kpis.cost.toFixed(2)}\nMargen Neto: $${kpis.profitMargin.toFixed(2)} USD`;
                                    navigator.clipboard.writeText(text);
                                    toast.success("Informe copiado al portapapeles.");
                                }}
                                className="px-5 py-2.5 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary border border-tertiary/30 rounded-xl text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-md"
                            >
                                <Copy size={14} />
                                <span>Copiar Resumen Financiero</span>
                            </button>
                        </div>

                        {/* Tarjetas de Métricas Financieras */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="p-6 rounded-2xl bg-surface-lowest border border-foreground/10">
                                <div className="text-xs font-bold text-on-surface-variant uppercase">Facturación Bruta (Clientes)</div>
                                <div className="text-3xl font-black text-on-surface font-mono mt-2">${kpis.revenue.toFixed(2)}</div>
                                <div className="text-[10px] text-on-surface-variant mt-1">Total cobrado por planes y timbres</div>
                            </div>
                            <div className="p-6 rounded-2xl bg-surface-lowest border border-foreground/10">
                                <div className="text-xs font-bold text-amber-400 uppercase">Costo de Adquisición (Santiago)</div>
                                <div className="text-3xl font-black text-amber-400 font-mono mt-2">${kpis.cost.toFixed(2)}</div>
                                <div className="text-[10px] text-on-surface-variant mt-1">Costo de compra a proveedores de software</div>
                            </div>
                            <div className="p-6 rounded-2xl bg-surface-lowest border border-tertiary/30 bg-tertiary/5">
                                <div className="text-xs font-bold text-tertiary uppercase">Margen Neto de Ganancia</div>
                                <div className="text-3xl font-black text-tertiary font-mono mt-2">${kpis.profitMargin.toFixed(2)}</div>
                                <div className="text-[10px] text-tertiary font-bold mt-1">
                                    {kpis.revenue > 0 ? `${Math.round((kpis.profitMargin / kpis.revenue) * 100)}% margen operativo` : '100%'}
                                </div>
                            </div>
                        </div>

                        {/* Desglose por Software — Mini Donut SVG + Cards */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                                <PieChart size={14} className="text-tertiary" />
                                Distribución de Clientes por Plataforma
                            </h4>
                            <div className="flex flex-col lg:flex-row items-center gap-6">
                                {/* Mini Donut SVG */}
                                {(() => {
                                    const data = [
                                        { label: 'Talonario', value: kpis.talonario, color: '#C9A96E' },
                                        { label: 'Ecuafact',  value: kpis.ecuafact,  color: '#5b8fff' },
                                        { label: 'Zifact',    value: kpis.zifact,    color: '#F59E0B' },
                                        { label: 'SRI',       value: kpis.sriGratuito, color: '#04B17B' },
                                    ].filter(d => d.value > 0);
                                    const total = data.reduce((s, d) => s + d.value, 0) || 1;
                                    const r = 40, cx = 60, cy = 60;
                                    const circ = 2 * Math.PI * r;
                                    let cumAngle = -Math.PI / 2;
                                    return (
                                        <div className="flex flex-col items-center gap-3 shrink-0">
                                            <svg width="120" height="120" viewBox="0 0 120 120">
                                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
                                                {data.map((d, i) => {
                                                    const angle = (d.value / total) * 2 * Math.PI;
                                                    const startAngle = cumAngle;
                                                    cumAngle += angle;
                                                    const x1 = cx + r * Math.cos(startAngle);
                                                    const y1 = cy + r * Math.sin(startAngle);
                                                    const x2 = cx + r * Math.cos(cumAngle);
                                                    const y2 = cy + r * Math.sin(cumAngle);
                                                    const largeArc = angle > Math.PI ? 1 : 0;
                                                    return (
                                                        <path
                                                            key={i}
                                                            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                            fill={d.color}
                                                            opacity="0.85"
                                                            style={{ filter: `drop-shadow(0 0 8px ${d.color}60)` }}
                                                        />
                                                    );
                                                })}
                                                <circle cx={cx} cy={cy} r={26} fill="hsl(var(--surface-lowest))" />
                                                <text x={cx} y={cy - 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="JetBrains Mono">{total}</text>
                                                <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="Inter">TOTAL</text>
                                            </svg>
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {data.map((d, i) => (
                                                    <span key={i} className="flex items-center gap-1 text-[9px] font-bold text-on-surface-variant">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                                        {d.label} ({d.value})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Cards de métricas por plataforma */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                                    {[
                                        { label: 'Talonario Amigo', count: kpis.talonario, color: 'text-yellow-500', badge: 'Propio', cls: 'provider-talonario', icon: <BookOpen size={16} className="text-yellow-500" /> },
                                        { label: 'Ecuafact', count: kpis.ecuafact, color: 'text-blue-400', badge: 'Anual', cls: 'provider-ecuafact', icon: <FileText size={16} className="text-blue-400" /> },
                                        { label: 'Zifact', count: kpis.zifact, color: 'text-amber-400', badge: 'Anual', cls: 'provider-zifact', icon: <Zap size={16} className="text-amber-400" /> },
                                        { label: 'SRI Gratuito', count: kpis.sriGratuito, color: 'text-emerald-400', badge: 'Por Ley', cls: 'provider-sri', icon: <Landmark size={16} className="text-emerald-400" /> },
                                    ].map((item, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border factcard-lift space-y-2 ${item.cls}`}>
                                            {item.icon}
                                            <div className={`text-2xl font-black font-mono ${item.color}`}>{item.count}</div>
                                            <div className="text-[10px] font-bold text-on-surface uppercase">{item.label}</div>
                                            <span className="text-[9px] text-on-surface-variant">{item.badge}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Input oculto para subidas directas a Bóveda */}
            <input
                type="file"
                ref={directVaultUploadInputRef}
                onChange={handleUploadFileToVault}
                className="hidden"
            />

            {/* ── FAB CONTEXTUAL FLOTANTE ── */}
            {viewMode === 'filling_center' && (
                <button
                    className="contextual-fab text-white"
                    style={{ background: 'linear-gradient(135deg, #04B17B, #028090)' }}
                    onClick={() => {
                        if (displayClients.length > 0) handleQuickIncrementInvoice(displayClients[0]);
                        else setIsAddClientModalOpen(true);
                    }}
                    title="+1 Factura Rápida (primer cliente visible)"
                    aria-label="Registrar factura rápida"
                >
                    <span className="contextual-fab-label">+1 Factura Rápida</span>
                    <Plus size={22} />
                </button>
            )}
            {viewMode === 'software_admin' && (
                <button
                    className="contextual-fab text-white"
                    style={{ background: 'linear-gradient(135deg, #2B6AFF, #6366F1)' }}
                    onClick={() => setIsSalesModalOpen(true)}
                    title="Vender Plan / Combo"
                    aria-label="Vender plan o combo"
                >
                    <span className="contextual-fab-label">Vender Plan</span>
                    <ShoppingBag size={22} />
                </button>
            )}
            {viewMode === 'kyc_renewals' && (
                <button
                    className="contextual-fab text-white"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                    onClick={() => {
                        if (displayClients.length > 0) {
                            setSelectedVaultClient(displayClients[0]);
                            setVaultUploadTarget('vault');
                            directVaultUploadInputRef.current?.click();
                        }
                    }}
                    title="Subir documento al expediente"
                    aria-label="Subir documento KYC"
                >
                    <span className="contextual-fab-label">Subir Documento</span>
                    <UploadCloud size={22} />
                </button>
            )}
            {viewMode === 'analytics' && (
                <button
                    className="contextual-fab text-white"
                    style={{ background: 'linear-gradient(135deg, #04B17B, #10B981)' }}
                    onClick={() => {
                        const text = `📊 INFORME FINANCIERO FACTURADORES\nTotal Clientes: ${kpis.total}\nIngresos Brutos: $${kpis.revenue.toFixed(2)}\nCostos Despacho: $${kpis.cost.toFixed(2)}\nMargen Neto: $${kpis.profitMargin.toFixed(2)} USD`;
                        navigator.clipboard.writeText(text);
                        toast.success('Informe copiado al portapapeles.');
                    }}
                    title="Copiar Informe Financiero"
                    aria-label="Copiar informe"
                >
                    <span className="contextual-fab-label">Copiar Informe</span>
                    <Copy size={22} />
                </button>
            )}

            {/* ── MODALES DEL SISTEMA ── */}
            {/* Modal: Vincular Cliente a Facturador */}
            <AddFacturadorClientModal
                isOpen={isAddClientModalOpen}
                onClose={() => setIsAddClientModalOpen(false)}
            />

            {/* Modal: Envíos Ejecutivos Resend Email */}
            {resendNoticeState.client && (
                <ResendNoticeModal
                    isOpen={resendNoticeState.isOpen}
                    onClose={() => setResendNoticeState(prev => ({ ...prev, isOpen: false }))}
                    client={resendNoticeState.client}
                    noticeType={resendNoticeState.noticeType}
                    additionalData={resendNoticeState.additionalData}
                />
            )}

            {/* Modal: Editar Facturador */}
            {editingFacturadorClient && (
                <FacturadorEditModal
                    isOpen={!!editingFacturadorClient}
                    onClose={() => setEditingFacturadorClient(null)}
                    client={editingFacturadorClient}
                    onSave={handleSaveFacturadorConfig}
                />
            )}

            {/* Modal: Registrar Factura Detallada */}
            {recordingInvoiceClient && (
                <FacturaRegistroModal
                    isOpen={!!recordingInvoiceClient}
                    onClose={() => setRecordingInvoiceClient(null)}
                    client={recordingInvoiceClient}
                    currentPeriod={selectedPeriod}
                    onSaveInvoice={handleSaveDetailedInvoice}
                />
            )}

            {/* Modal: Vender Plan / Combo */}
            <SalesComboModal
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
            />

            {/* Modal: Autorización Ecuafact */}
            <QuickPlanRegistrationModal
                isOpen={isQuickPlanModalOpen}
                onClose={() => setIsQuickPlanModalOpen(false)}
                onSuccess={(client) => {
                    setIsQuickPlanModalOpen(false);
                    toast.success(`Autorización generada para ${client.name}`);
                }}
            />

            {/* Prompt de WhatsApp */}
            {whatsAppPrompt && (
                <Modal isOpen={!!whatsAppPrompt} onClose={() => setWhatsAppPrompt(null)} title="Enviar Mensaje por WhatsApp">
                    <div className="space-y-4 font-mono text-xs">
                        <p className="text-on-surface-variant font-sans">
                            Se abrirá WhatsApp Web con la liquidación preparada para <strong>{whatsAppPrompt.clientName}</strong>:
                        </p>
                        <div className="p-4 bg-surface-lowest border border-foreground/10 rounded-2xl whitespace-pre-wrap text-on-surface">
                            {whatsAppPrompt.message}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-4 py-2 border border-foreground/10 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const cleanPhone = whatsAppPrompt.phone.replace(/\D/g, '');
                                    const fullPhone = cleanPhone.startsWith('593') ? cleanPhone : cleanPhone.startsWith('0') ? `593${cleanPhone.slice(1)}` : `593${cleanPhone}`;
                                    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsAppPrompt.message)}`;
                                    window.open(url, '_blank');
                                    setWhatsAppPrompt(null);
                                }}
                                className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl"
                            >
                                Abrir WhatsApp ➔
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
