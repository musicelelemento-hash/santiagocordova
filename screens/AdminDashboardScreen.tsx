
import React, { useMemo, useState } from 'react';
import {
    AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock, Command, Copy,
    Database, ExternalLink, Eye, EyeOff, FileText, HandCoins, Loader2,
    MessageCircle, ShieldAlert, Sparkles, TrendingUp, UploadCloud, Users,
    Vault, Wallet, X, Zap, KeyRound, ShieldOff, ShieldCheck, PhoneCall
} from 'lucide-react';
import { Screen, Client, DeclarationStatus, TaxRegime, Declaration } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay, getDaysUntilDue } from '../services/sri';
import { isPast, isToday, isTomorrow, format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClientCard } from '../components/features/ClientCard';
import { useToast } from '../context/ToastContext';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { downloadStoredFile } from '../services/fileService';
import { processBulkPdfs, BulkProcessResult } from '../services/bulkOperations';
import { BulkUploadReportModal } from '../components/features/BulkUploadReportModal';
import { ChatBot } from '../components/features/ChatBot';
import { VirtualClientList } from '../components/features/VirtualClientList';
import { TaxComplianceMatrix } from '../components/features/TaxComplianceMatrix';
import { ComplianceReportExport } from '../components/features/ComplianceReportExport';
import { IvaFrequency } from '../types';
import { getComplianceSummary, getClientCompliance, ComplianceColor, getClientDebtSummary, getClientUndeclaredSummary, isPeriodBeforeClientStart } from '../services/complianceEngine';
import { PortfolioSemaphore } from '../components/ui/PortfolioSemaphore';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCampaignContext } from '../hooks/useCampaignContext';
import { useDebounce } from '../hooks/useDebounce';
import { CampaignBanner, CampaignProgress } from '../components/ui/CampaignBanner';
import { Modal } from '../components/ui/Modal';
import { fileToBase64 } from '../services/pdfExtraction';
import { getClientServiceFee } from '../services/clientService';
import { generateDeclarationWhatsAppMessage } from '../services/sri';


interface AdminDashboardScreenProps {
    navigate: (screen: Screen, options?: any) => void;
    theme?: 'light' | 'dark';
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate, theme = 'dark' }) => {
    const { clients, setClients, serviceFees, updateClient, removeClient, restoreClient, purgeTrash } = useAppStore();
    const { toast } = useToast();

    const [expandAnalytics, setExpandAnalytics] = useState(false);
    const [expandSegmentation, setExpandSegmentation] = useState(false);
    const [showIntelligencePanels, setShowIntelligencePanels] = useState(() => {
        return sessionStorage.getItem('dashboard_show_intelligence_panels') !== 'false';
    });

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_show_intelligence_panels', showIntelligencePanels.toString());
    }, [showIntelligencePanels]);

    // Auto-detección de Campaña Mensual
    const [filter, setFilter] = useState<'all' | 'mensual' | 'semestral' | 'vip' | 'urgent' | 'rimpe' | 'popular' | 'renta' | 'overdue' | 'prepaid' | 'no-iva' | 'no-renta' | 'boveda' | 'digital-mando' | 'trash' | ComplianceColor>(() => {
        return (sessionStorage.getItem('dashboard_filter') as any) || 'mensual';
    });
    const [inboxTab, setInboxTab] = useState<'pendientes' | 'cobros' | 'completados'>(() => {
        return (sessionStorage.getItem('dashboard_inbox_tab') as any) || 'pendientes';
    });
    const [subMandoFreq, setSubMandoFreq] = useState<'Mensual' | 'Semestral' | 'Anual'>(() => {
        return (sessionStorage.getItem('dashboard_sub_mando_freq') as any) || 'Mensual';
    });

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_inbox_tab', inboxTab);
    }, [inboxTab]);

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_sub_mando_freq', subMandoFreq);
    }, [subMandoFreq]);

    React.useEffect(() => {
        const handleOpenVault = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.clientId) {
                // Navegamos a Clientes pasándole el ID para abrir y un parámetro 'openVault'
                navigate('clients', { clientIdToView: customEvent.detail.clientId, initialTab: 'vault' });
            }
        };
        window.addEventListener('open-client-vault', handleOpenVault);
        return () => window.removeEventListener('open-client-vault', handleOpenVault);
    }, [navigate]);
    const [searchTerm, setSearchTerm] = useState(() => {
        return sessionStorage.getItem('dashboard_search') || '';
    });
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedRegime, setSelectedRegime] = useState<'all' | 'Régimen General' | 'Rimpe Emprendedor' | 'Rimpe Negocio Popular'>('all');
    const [selectedObligation, setSelectedObligation] = useState<'all' | 'IVA' | 'RENTA'>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    const [previewState, setPreviewState] = useState<{ isOpen: boolean, client: Client | null, declaration: any | null }>({
        isOpen: false,
        client: null,
        declaration: null
    });
    const [bulkResults, setBulkResults] = useState<BulkProcessResult[]>([]);
    const [recentUploads, setRecentUploads] = useState<BulkProcessResult[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [showUploader, setShowUploader] = useState(false);
    const [isTacticalVisible, setIsTacticalVisible] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [workspaceClient, setWorkspaceClient] = useState<{ client: Client, period?: string } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const mesaFileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (workspaceClient?.client) {
            navigate('clients', { clientIdToView: workspaceClient.client.id });
            setWorkspaceClient(null);
        }
    }, [workspaceClient, navigate]);

    // Mesa de Trabajo Táctica — estados faltantes
    const [hubTab, setHubTab] = useState<'operativa' | 'cargas' | 'alertas' | 'firmas'>('operativa');
    const [firmasSubTab, setFirmasSubTab] = useState<'vigentes' | 'sin-firma'>('vigentes');
    const [mesaTrabajoTab, setMesaTrabajoTab] = useState<'mensual' | 'semestral'>('mensual');
    const [mesaUploadingTarget, setMesaUploadingTarget] = useState<{ client: Client; period: string } | null>(null);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string; fileUrl?: string } | null>(null);
    const [isBulkMarking, setIsBulkMarking] = useState(false);
    const [markAllMode, setMarkAllMode] = useState<'declared' | 'paid' | 'both'>('declared');
    const [showMarkAllModal, setShowMarkAllModal] = useState(false);

    // Persistence Effect
    React.useEffect(() => {
        sessionStorage.setItem('dashboard_filter', filter);
    }, [filter]);

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_search', searchTerm);
    }, [searchTerm]);

    // Scroll Persistence
    React.useEffect(() => {
        const savedScroll = sessionStorage.getItem('dashboard_scroll');
        if (savedScroll) {
            // Give a small timeout for the list to render
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }, 100);
        }

        const handleScroll = () => {
            sessionStorage.setItem('dashboard_scroll', window.scrollY.toString());
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- SINGLE PASS PERFORMANCE ENGINE (Upgraded to Zen v3.2 with multi-period) ---
    const { 
        urgentPriorities, pendientes, cobros, completados, allResults, 
        kpis, expiringSignatures, activeRentaRefunds, complianceSummary
    } = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const rentaPeriod = (currentYear - 1).toString();
        const next15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);

        const currentFreq: 'Mensual' | 'Semestral' | 'Anual' | 'all' = 
            filter === 'mensual' ? 'Mensual' :
            filter === 'semestral' ? 'Semestral' :
            filter === 'renta' ? 'Anual' : 
            filter === 'digital-mando' ? 'all' : 'all';

        const summary = getComplianceSummary(clients, today, currentFreq);

        const urgents: Client[] = [];
        const peds: Client[] = [];
        const cobs: Client[] = [];
        const comps: Client[] = [];
        const filtered: Client[] = [];
        const signExp: Client[] = [];
        const refunds: Client[] = [];
        
        let overdueCount = 0;
        let prepaidCount = 0;
        let totalIncome = 0;
        let activeCount = 0;
        
        // Financial Debt KPI
        let totalDebtSum = 0;
        let debtClientsCount = 0;

        for (const c of clients) {
            // Apply selectedRegime and selectedObligation filters
            if (selectedRegime !== 'all' && c.regime !== selectedRegime) continue;
            
            if (selectedObligation === 'IVA') {
                const ivaFreq = c.taxProfile?.ivaFrequency || (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
                if (ivaFreq === 'Ninguno') continue;
            } else if (selectedObligation === 'RENTA') {
                const reqRenta = c.taxProfile?.requiresAnnualRenta ?? (c.regime === TaxRegime.RimpeEmprendedor || c.regime === TaxRegime.RimpeNegocioPopular || c.regime === TaxRegime.General);
                if (!reqRenta) continue;
            }

            const currentP = getPeriod(c, today);
            const declarations = c.declarations || [];
            const ivaDecl = declarations.find(dh => dh.period === currentP);
            const compliance = getClientCompliance(c, today, currentFreq);
            const debtSummary = getClientDebtSummary(c, serviceFees, today);
            const undeclaredSummary = getClientUndeclaredSummary(c, today);

            // 1. KPI & Special Lists Calculations (ONLY FOR ACTIVE, NON-DELETED CLIENTS)
            if (!c.isDeleted && c.isActive) {
                activeCount++;
                if (compliance.overdueCount > 0) overdueCount++;
                if (ivaDecl?.is_paid && ivaDecl?.status === DeclarationStatus.Pendiente) prepaidCount++;
                totalIncome += (c.fee_structure?.monthly ?? c.customServiceFee ?? 0);

                if (debtSummary.hasPendingPayment) {
                    totalDebtSum += debtSummary.totalDebt;
                    debtClientsCount++;
                }

                if (c.signatureExpirationDate) {
                    const expDate = new Date(c.signatureExpirationDate);
                    if (!isNaN(expDate.getTime()) && expDate <= next15Days) signExp.push(c);
                }
                if (c.hasRentaRefund && (c.rentaRefundStatus === 'Solicitado' || c.rentaRefundStatus === 'Pendiente')) {
                    refunds.push(c);
                }
            }

            // 2. Filter logic for "allResults" (workspaceData)
            // Lógica de Papelera: Si estamos en la pestaña trash, solo mostrar isDeleted.
            // Si NO estamos en trash, ocultar isDeleted (y también !c.isActive).
            if (filter === 'trash') {
                if (!c.isDeleted) continue;
            } else {
                if (c.isDeleted || !c.isActive) continue;
            }

            const searchMatch = !debouncedSearchTerm || 
                c.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                c.ruc.includes(debouncedSearchTerm) || 
                (c.tradeName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

            if (!searchMatch) continue;

            let filterMatch = true;
            if (filter === 'urgent') {
                filterMatch = compliance.urgentCount > 0;
            } else if (filter === 'overdue') {
                filterMatch = compliance.overdueCount > 0;
            } else if (filter === 'red' || filter === 'orange' || filter === 'yellow' || filter === 'green' || filter === 'gray') {
                filterMatch = compliance.overallColor === filter;
            } else if (filter === 'prepaid') {
                filterMatch = !!(ivaDecl?.is_paid && ivaDecl?.status === DeclarationStatus.Pendiente);
            } else if (filter === 'no-iva') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Ninguno';
            } else if (filter === 'mensual') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Mensual';
            } else if (filter === 'semestral') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Semestral';
            } else if (filter === 'popular') {
                filterMatch = c.regime === TaxRegime.RimpeNegocioPopular;
            } else if (filter === 'no-renta') {
                filterMatch = c.taxProfile?.requiresAnnualRenta === false;
            } else if (filter === 'boveda') {
                filterMatch = !!(ivaDecl && !ivaDecl.proof_file && (ivaDecl.status === DeclarationStatus.Enviada || ivaDecl.status === DeclarationStatus.Pagada));
            } else if (filter === 'digital-mando') {
                filterMatch = true;
            } else if (filter === 'trash') {
                filterMatch = true;
            }

            if (filterMatch) {
                filtered.push(c);
                
                // 3. Categorization (Inbox) - ONLY FOR ACTIVE (NON-DELETED) CLIENTS
                // CORRECCIÓN: Usamos el periodo actual (campaña) para determinar si está "Al Día"
                // en lugar del historial global, evitando que periodos viejos bloqueen el progreso.
                if (!c.isDeleted) {
                    const isBeforeStart = isPeriodBeforeClientStart(c, currentP);
                    const currentPeriodIsDeclared = ivaDecl?.status === DeclarationStatus.Enviada
                        || ivaDecl?.status === DeclarationStatus.Pagada
                        || !!ivaDecl?.proof_file;
                    const currentPeriodIsPaid = !!ivaDecl?.is_paid;

                    // "Completado" = el periodo actual está declarado o el cliente no tiene obligación aún (empieza en períodos futuros)
                    const isCurrentPeriodDone = currentPeriodIsDeclared || isBeforeStart;
                    const isCobroPending = currentPeriodIsDeclared && !currentPeriodIsPaid;

                    if (isCurrentPeriodDone && !isCobroPending) {
                        comps.push(c);
                    } else if (isCobroPending) {
                        cobs.push(c);
                    } else {
                        if (compliance.urgentCount > 0 || compliance.overdueCount > 0) urgents.push(c);
                        else peds.push(c);
                    }
                }
            }
        }

        // Final Sort for filtered results
        const sortClients = (arr: Client[]) => {
            return [...arr].sort((a, b) => {
                const digitA = parseInt(a.ruc[8], 10);
                const digitB = parseInt(b.ruc[8], 10);
                const sortA = digitA === 0 ? 10 : digitA;
                const sortB = digitB === 0 ? 10 : digitB;
                if (sortA !== sortB) return sortA - sortB;
                return a.name.localeCompare(b.name);
            });
        };

        return { 
            urgentPriorities: sortClients(urgents), 
            pendientes: sortClients(peds), 
            cobros: sortClients(cobs),
            completados: sortClients(comps), 
            allResults: sortClients(filtered),
            kpis: { 
                total: activeCount, 
                overdue: overdueCount, 
                prepaid: prepaidCount, 
                projectedIncome: totalIncome,
                pendingCollectionsAmount: totalDebtSum,
                pendingCollectionsCount: debtClientsCount
            },
            expiringSignatures: signExp,
            activeRentaRefunds: refunds,
            complianceSummary: summary
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clients, debouncedSearchTerm, filter, selectedRegime, selectedObligation, selectedPeriod, serviceFees]);

    // ── SIGNATURE MANAGEMENT DATA ──────────────────────────────
    const signatureData = useMemo(() => {
        const today = new Date();
        const active = clients.filter(c => !c.isDeleted && c.isActive);

        // All clients with signature file, sorted by expiration date ascending
        const withSignature = active
            .filter(c => c.signatureFile)
            .sort((a, b) => {
                const dateA = a.signatureExpirationDate ? new Date(a.signatureExpirationDate).getTime() : Infinity;
                const dateB = b.signatureExpirationDate ? new Date(b.signatureExpirationDate).getTime() : Infinity;
                return dateA - dateB;
            });

        // Clients WITHOUT signature file
        const withoutSignature = active
            .filter(c => !c.signatureFile)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Expiry status helpers
        const getDaysLeft = (c: Client): number | null => {
            if (!c.signatureExpirationDate) return null;
            const exp = new Date(c.signatureExpirationDate);
            exp.setHours(0,0,0,0);
            const now = new Date();
            now.setHours(0,0,0,0);
            return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        };

        return { withSignature, withoutSignature, getDaysLeft };
    }, [clients]);


    // Data for Matrix Mode
    const matrixPeriods = useMemo(() => {
        const today = new Date();
        const result = [];
        const isSemestral = filter === 'semestral';
        
        if (!isSemestral) { // Monthly (Default or Mensual filter)
            for (let i = 0; i < 6; i++) {
                const date = subMonths(today, i + 1);
                const p = format(date, 'yyyy-MM');
                if (p >= '2026-01') result.push(p);
            }
        } else { // Semestral
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            if (currentMonth >= 6) {
                const p1 = `${currentYear}-S1`;
                const p2 = `${currentYear - 1}-S2`;
                if (p1 >= '2026-S1') result.push(p1);
                if (p2 >= '2026-S1') result.push(p2);
            } else {
                const p1 = `${currentYear - 1}-S2`;
                const p2 = `${currentYear - 1}-S1`;
                if (p1 >= '2026-S1') result.push(p1);
                if (p2 >= '2026-S1') result.push(p2);
            }
        }
        return result;
    }, [filter]);

    const matrixClients = useMemo(() => {
        const freq = filter === 'semestral' ? 'Semestral' : 'Mensual';
        const filtered = clients.filter(c => !c.isDeleted && c.isActive && c.taxProfile?.ivaFrequency === freq);
        
        return filtered.sort((a, b) => {
            const digitA = parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10);
            const sortA = digitA === 0 ? 10 : digitA;
            const sortB = digitB === 0 ? 10 : digitB;
            if (sortA !== sortB) return sortA - sortB;
            return a.name.localeCompare(b.name);
        });
    }, [clients, filter]);


    const activeList = useMemo(() => {
        return (debouncedSearchTerm || filter === 'trash') 
            ? allResults 
            : (inboxTab === 'pendientes' 
                ? [...urgentPriorities, ...pendientes] 
                : inboxTab === 'cobros' ? cobros : completados);
    }, [debouncedSearchTerm, filter, inboxTab, allResults, urgentPriorities, pendientes, cobros, completados]);

    const rentaPeriod = useMemo(() => (new Date().getFullYear() - 1).toString(), []);

    const mensualClients = useMemo(() => 
        filter === 'digital-mando' ? activeList.filter(c => (c.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual') : []
    , [activeList, filter]);

    const semestralClients = useMemo(() => 
        filter === 'digital-mando' ? activeList.filter(c => c.taxProfile?.ivaFrequency === 'Semestral') : []
    , [activeList, filter]);

    const anualClients = useMemo(() => 
        filter === 'digital-mando' ? activeList.filter(c => c.taxProfile?.ivaFrequency === 'Ninguno' || (!c.taxProfile?.ivaFrequency && c.regime === TaxRegime.RimpeNegocioPopular)) : []
    , [activeList, filter]);

    const monthlyPeriodStr = useMemo(() => {
        const lastMonthDate = subMonths(new Date(), 1);
        return format(lastMonthDate, 'yyyy-MM'); // e.g. "2026-06"
    }, []);

    const semestralPeriodStr = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-S1`; // e.g. "2026-S1"
    }, []);

    const mesaTrabajoList = useMemo(() => {
        const targetPeriod = mesaTrabajoTab === 'mensual' ? monthlyPeriodStr : semestralPeriodStr;
        const targetFreq = mesaTrabajoTab === 'mensual' ? 'Mensual' : 'Semestral';

        return clients.filter(c => {
            if (c.isDeleted || !c.isActive) return false;
            
            const freq = c.taxProfile?.ivaFrequency || (c.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (c.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
            if (freq !== targetFreq) return false;

            // Si el período de la campaña es anterior al inicio de obligaciones del cliente, no tiene pendiente
            if (isPeriodBeforeClientStart(c, targetPeriod)) return false;

            const dec = (c.declarations || []).find(d => d.period === targetPeriod);
            const isDone = dec?.status === DeclarationStatus.Enviada || dec?.status === DeclarationStatus.Pagada || !!dec?.proof_file;
            
            return !isDone;
        }).sort((a, b) => {
            // Orden por 9no dígito del RUC = orden de vencimiento SRI
            const digitA = parseInt(a.ruc[8], 10) === 0 ? 10 : parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10) === 0 ? 10 : parseInt(b.ruc[8], 10);
            return digitA - digitB || a.name.localeCompare(b.name);
        });
    }, [clients, mesaTrabajoTab, monthlyPeriodStr, semestralPeriodStr]);

    const handleCopyRuc = (ruc: string, name: string) => {
        navigator.clipboard.writeText(ruc);
        toast.success(`📋 RUC de ${name} copiado al portapapeles`);
    };

    const handleMesaUploadClick = (client: Client, period: string) => {
        setMesaUploadingTarget({ client, period });
        mesaFileInputRef.current?.click();
    };

    const handleMesaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !mesaUploadingTarget) return;

        toast.info("Procesando comprobante de declaración...");
        try {
            const base64 = await fileToBase64(file);
            const storedFile = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: Date.now(),
                content: base64
            };

            const client = mesaUploadingTarget.client;
            const targetPeriod = mesaUploadingTarget.period;

            const updatedHistory = [...(client.declarations || [])];
            const idx = updatedHistory.findIndex(d => d.period === targetPeriod);
            
            if (idx !== -1) {
                updatedHistory[idx] = {
                    ...updatedHistory[idx],
                    proof_file: storedFile,
                    status: DeclarationStatus.Enviada,
                    updatedAt: new Date().toISOString()
                };
            } else {
                updatedHistory.push({
                    period: targetPeriod,
                    status: DeclarationStatus.Enviada,
                    is_paid: false,
                    updatedAt: new Date().toISOString(),
                    proof_file: storedFile
                });
            }

            updateClient(client.id, { declarations: updatedHistory });
            toast.success(`✅ Comprobante de ${client.name} registrado con éxito.`);

            // Generar y activar el modal de WhatsApp
            const feeNum = getClientServiceFee(client, serviceFees, targetPeriod);
            const generatedMsg = generateDeclarationWhatsAppMessage(
                client.name,
                mesaTrabajoTab === 'mensual' ? 'IVA' : 'Impuesto a la Renta',
                targetPeriod,
                feeNum,
                false
            );

            if (client.phones?.length) {
                setWhatsAppPrompt({
                    clientName: client.name,
                    phone: client.phones[0].replace(/\D/g, ''),
                    message: generatedMsg
                });
            }
        } catch (err) {
            toast.error("Error al procesar el archivo.");
        } finally {
            setMesaUploadingTarget(null);
            if (mesaFileInputRef.current) mesaFileInputRef.current.value = '';
        }
    };


    // ... (handleAction remains same) ...
    const handleAction = (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge', customPeriod?: string) => {
        const today = new Date();
        const period = customPeriod || getPeriod(client, today);
        const nowIso = today.toISOString();

        if (action === 'deactivate') {
            updateClient(client.id, { isActive: false });
            toast.success(`${client.name} desactivado`);
            return;
        }
        if (action === 'restore') {
            restoreClient(client.id);
            toast.success(`${client.name} restaurado correctamente`);
            return;
        }
        if (action === 'purge') {
            if (window.confirm(`¿Está seguro de eliminar permanentemente a ${client.name}? Esta acción no se puede deshacer.`)) {
                removeClient(client.id, true);
                toast.success(`${client.name} eliminado permanentemente`);
            }
            return;
        }

        const updatedHistory = [...client.declarations];
        const idx = updatedHistory.findIndex(d => d.period === period);
        
        let newStatus: DeclarationStatus;
        let updates: Partial<Declaration> = { updatedAt: nowIso };

        switch (action) {
            case 'declare':
                newStatus = DeclarationStatus.Enviada;
                updates.declaredAt = nowIso;
                break;
            case 'pay':
                newStatus = DeclarationStatus.Pagada;
                updates.paidAt = nowIso;
                updates.is_paid = true;
                updates.transactionId = `Q-${Date.now().toString().slice(-4)}`;
                break;
            case 'cancel':
                newStatus = DeclarationStatus.Cancelada;
                break;
            case 'revert':
                newStatus = DeclarationStatus.Pendiente;
                updates.is_paid = false;
                updates.paidAt = undefined;
                updates.declaredAt = undefined;
                updates.transactionId = undefined;
                break;
            default:
                newStatus = DeclarationStatus.Pendiente;
        }

        const newEntry = {
            period,
            status: newStatus,
            ...updates
        };

        if (idx > -1) {
            updatedHistory[idx] = { ...updatedHistory[idx], ...newEntry };
        } else {
            updatedHistory.push(newEntry as Declaration);
        }

        updateClient(client.id, { declarations: updatedHistory });

        const actionLabels: Record<string, string> = {
            declare: 'Declaración registrada',
            pay: 'Pago registrado',
            cancel: 'Declaración cancelada',
            revert: 'Acción revertida'
        };
        
        if (actionLabels[action]) {
            toast.success(actionLabels[action]);
        }
    };

    // ── BULK MARK ALL AS DECLARED & PAID ──────────────────────────────
    const handleMarkAllDeclaredAndPaid = async () => {
        const today = new Date();
        const nowIso = today.toISOString();
        setIsBulkMarking(true);

        let count = 0;
        for (const client of activeList) {
            const period = getPeriod(client, today);
            const history = [...(client.declarations || [])];
            const idx = history.findIndex(d => d.period === period);

            const updates: Partial<Declaration> = { updatedAt: nowIso };
            let newStatus = history[idx]?.status || DeclarationStatus.Pendiente;

            if (markAllMode === 'declared' || markAllMode === 'both') {
                newStatus = DeclarationStatus.Enviada;
                updates.declaredAt = updates.declaredAt || history[idx]?.declaredAt || nowIso;
            }
            if (markAllMode === 'paid' || markAllMode === 'both') {
                newStatus = DeclarationStatus.Pagada;
                updates.is_paid = true;
                updates.paidAt = nowIso;
                updates.transactionId = updates.transactionId || `BLK-${Date.now().toString().slice(-4)}`;
                // Si marcamos como pagado, también debe estar declarado
                updates.declaredAt = updates.declaredAt || history[idx]?.declaredAt || nowIso;
                if (markAllMode === 'both') newStatus = DeclarationStatus.Pagada;
            }

            const newEntry: Partial<Declaration> = {
                period,
                status: newStatus,
                ...updates
            };

            if (idx > -1) {
                history[idx] = { ...history[idx], ...newEntry };
            } else {
                history.push(newEntry as Declaration);
            }

            updateClient(client.id, { declarations: history });
            count++;
        }

        // Small delay for UX feedback
        await new Promise(r => setTimeout(r, 300));
        setIsBulkMarking(false);
        setShowMarkAllModal(false);

        const modeLabel = markAllMode === 'declared' ? 'declarados' : markAllMode === 'paid' ? 'con pago al día' : 'declarados y con pago al día';
        toast.success(`✅ ${count} clientes marcados como ${modeLabel}`);
    };

    const processFiles = async (files: File[]) => {
        if (files.length === 0) return;

        setIsProcessing(true);
        toast.info(`Iniciando procesamiento de ${files.length} archivo(s)...`);

        try {
            const results = await processBulkPdfs(files, (curr, total) => {
                // Progress tracking
            });
            setBulkResults(results as any);
            setIsBulkModalOpen(true);
            setRecentUploads(prev => [...(results as any), ...prev].slice(0, 20));
            toast.success("Procesamiento completado");
        } catch (error) {
            toast.error("Error en el procesamiento");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const files = Array.from(e.dataTransfer.files);
            await processFiles(files);
        }
    };

    const openPreview = (client: Client, declaration: any) => {
        setPreviewState({
            isOpen: true,
            client,
            declaration
        });
    };


    const tacticalInfo = useMemo(() => {
        const day = new Date().getDate();
        const schedule: Record<number, number> = { 10: 1, 12: 2, 14: 3, 16: 4, 18: 5, 20: 6, 22: 7, 24: 8, 26: 9, 28: 0 };
        const todayDigit = schedule[day] ?? null;
        const tomorrowDigit = schedule[day + 1] ?? schedule[day + 2] ?? null;

        return { todayDigit, tomorrowDigit };
    }, []);

    // ── CAMPAÑA INTELIGENTE (reemplaza campaignInfo estático) ──
    const campaign = useCampaignContext();

    const stitchSuggestions = useMemo(() => {
        const suggestions: { title: string, desc: string, priority: 'high' | 'medium' | 'low', action: () => void }[] = [];

        if (tacticalInfo.todayDigit !== null && urgentPriorities.length > 0) {
            suggestions.push({
                title: `Vencimiento Crítico: Dígito ${tacticalInfo.todayDigit}`,
                desc: `Hay ${urgentPriorities.length} clientes que vencen hoy según el SRI. Prioridad inmediata.`,
                priority: 'high',
                action: () => navigate('clients', { initialFilter: { activeGroupTab: 'vencidos' } })
            });
        }

        if (expiringSignatures.length > 0) {
            suggestions.push({
                title: 'Renovación de Firmas',
                desc: `${expiringSignatures.length} firmas están por caducar. Gestionar renovaciones para evitar bloqueos.`,
                priority: 'medium',
                action: () => navigate('clients', { initialFilter: { activeGroupTab: 'all' } })
            });
        }

        if (activeRentaRefunds.length > 0) {
            suggestions.push({
                title: 'Seguimiento de Devoluciones',
                desc: `Tienes ${activeRentaRefunds.length} trámites de renta en curso. Revisa el estatus para asegurar el depósito.`,
                priority: 'low',
                action: () => navigate('clients', { initialFilter: { activeGroupTab: 'all' } })
            });
        }

        return suggestions.slice(0, 3);
    }, [tacticalInfo, urgentPriorities, expiringSignatures, activeRentaRefunds, navigate]);

    return (
        <div className="space-y-6 animate-fade-in pb-20 relative aurora-zen min-h-screen">
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-[hsl(222,47%,4%)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">

                    {/* Mesh gradient background */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-blue-500/5 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-emerald-500/5 to-transparent blur-3xl" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23000%22%20fill-opacity%3D%220.015%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40 dark:opacity-20" />
                    </div>

                    {/* ── TOP STRIPE ── */}
                    <div className="px-6 sm:px-10 pt-8 pb-6 sm:pt-10 relative z-10">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">

                            {/* ── BRAND BLOCK ── */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                                        <div className="relative w-2 h-2 rounded-full bg-emerald-500">
                                            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.3em]">Sistema Activo</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <Database size={10} className="text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 tech-font">Firebase Live</span>
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-[-0.04em] leading-none">
                                        Panel
                                        <span className="ml-3 relative inline-block">
                                            <span className="relative z-10 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">Tributario</span>
                                            <span className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 blur-xl rounded-lg" />
                                        </span>
                                    </h1>
                                    <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 font-medium">
                                        Gestión interna · <span className="text-slate-600 dark:text-slate-400 font-semibold">{kpis.total} clientes activos</span>
                                    </p>
                                </div>
                            </div>

                            {/* ── ACTIONS ── */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="file" multiple accept=".pdf" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />
                                    <button
                                        onClick={() => setShowIntelligencePanels(p => !p)}
                                        className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-center shadow-sm shrink-0 ${
                                            showIntelligencePanels 
                                                ? 'bg-blue-600/10 border-blue-500/20 text-blue-600 dark:text-blue-400' 
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white'
                                        }`}
                                        title={showIntelligencePanels ? "Modo minimalista (ocultar paneles)" : "Mostrar paneles de control e inteligencia"}
                                    >
                                        {showIntelligencePanels ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                        onClick={() => setShowUploader(p => !p)}
                                        disabled={isProcessing}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all duration-300 shadow-lg disabled:opacity-50 group font-premium ${
                                            showUploader 
                                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-emerald-500/25' 
                                                : 'bg-blue-600 dark:bg-blue-500 text-white shadow-blue-500/25'
                                        }`}
                                    >
                                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} className="group-hover:-translate-y-0.5 transition-transform" />}
                                        <span className="hidden sm:inline">SUBIR PDFs / RUCs</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── COMPLIANCE SEMAPHORE ── */}
                    <div className="px-6 sm:px-10 pb-6 relative z-10">
                        <PortfolioSemaphore
                            summary={complianceSummary}
                            onFilterChange={(newFilter) => setFilter(newFilter as any)}
                            activeFilter={filter as any}
                        />
                    </div>

                    {/* ── KPI STRIP ── */}
                    <div className="px-6 sm:px-10 pb-6 relative z-10">
                        <div className="glass-card-premium p-0 relative overflow-hidden flex sm:grid sm:grid-cols-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                            {/* KPI 1: Clientes */}
                            <button
                                onClick={() => navigate('clients', { initialFilter: { activeGroupTab: 'all' } })}
                                className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                    <Users size={20} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Total Clientes</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{kpis.total}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">ir a expedientes</p>
                                </div>
                            </button>

                            {/* KPI 2: Facturación */}
                            <button
                                onClick={() => navigate('clients', { initialFilter: { activeGroupTab: 'all' } })}
                                className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                    <TrendingUp size={20} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Facturación Est.</p>
                                    <p className="text-3xl font-black tracking-tighter leading-none text-emerald-600 dark:text-emerald-400">${Math.round(kpis.projectedIncome)}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">ingreso mensual</p>
                                </div>
                            </button>

                            {/* KPI 3: Bóveda */}
                            {(() => {
                                const missingPdfCount = clients.filter(c =>
                                    c.declarations?.some(d =>
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
                                    )
                                ).length;
                                const hasMissing = missingPdfCount > 0;
                                return (
                                    <button
                                        onClick={() => navigate('clients', { initialFilter: { hasMissingPdf: true } })}
                                        className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                                    >
                                        <div className={`p-3 rounded-2xl text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                                            hasMissing
                                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-400/25'
                                                : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/25'
                                        }`}>
                                            <Vault size={20} strokeWidth={2} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Archivo Digital</p>
                                            <p className={`text-3xl font-black tracking-tighter leading-none ${
                                                hasMissing ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
                                            }`}>{missingPdfCount}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{hasMissing ? 'sin comprobante' : 'bóveda completa ✓'}</p>
                                        </div>
                                    </button>
                                );
                            })()}

                            {/* KPI 4: Cartera por Cobrar */}
                            <button
                                onClick={() => navigate('clients', { initialFilter: { activeGroupTab: 'cobros' } })}
                                className="group flex-none w-[60vw] sm:w-auto snap-center flex flex-col justify-center p-6 sm:p-7 relative overflow-hidden hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                                            <Wallet size={14} />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Por Cobrar</p>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-3">
                                        <span className={`text-3xl font-black tracking-tighter leading-none ${
                                            kpis.pendingCollectionsAmount > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
                                        }`}>${Math.round(kpis.pendingCollectionsAmount)}</span>
                                        <span className="text-xs text-slate-400 font-medium">{kpis.pendingCollectionsCount} c. activos</span>
                                    </div>
                                    {(() => {
                                        const collectedPercent = kpis.projectedIncome > 0
                                            ? Math.max(0, Math.round(((kpis.projectedIncome - kpis.pendingCollectionsAmount) / kpis.projectedIncome) * 100))
                                            : 100;
                                        return (
                                            <>
                                                <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                                            collectedPercent >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                                                            collectedPercent >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                                                            'bg-gradient-to-r from-rose-500 to-red-400'
                                                        }`}
                                                        style={{ width: `${collectedPercent}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <p className="text-[10px] text-slate-400">{collectedPercent}% cobrado</p>
                                                    <ArrowRight size={12} className="text-rose-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showIntelligencePanels ? (
                <>
                    {/* ── SUGGESTION HUB ELITE ── */}
                    {stitchSuggestions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in relative z-30 px-4 sm:px-0">
                            {stitchSuggestions.map((s, idx) => (
                                <div
                                    key={idx}
                                    onClick={s.action}
                                    className="group relative overflow-hidden rounded-2xl cursor-pointer border transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl"
                                    style={{
                                        background: s.priority === 'high'
                                            ? 'linear-gradient(135deg, rgba(244,63,94,0.08) 0%, rgba(244,63,94,0.02) 100%)'
                                            : s.priority === 'medium'
                                            ? 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 100%)'
                                            : 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
                                        borderColor: s.priority === 'high' ? 'rgba(244,63,94,0.2)' : s.priority === 'medium' ? 'rgba(251,191,36,0.2)' : 'rgba(59,130,246,0.2)'
                                    }}
                                >
                                    <div className={`absolute top-0 left-0 w-full h-0.5 ${
                                        s.priority === 'high' ? 'bg-gradient-to-r from-rose-500 to-rose-400' :
                                        s.priority === 'medium' ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                        'bg-gradient-to-r from-blue-500 to-blue-400'
                                    }`} />
                                    <div className="p-5 relative z-10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                                                s.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                s.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                                <div className={`w-1 h-1 rounded-full animate-pulse ${
                                                    s.priority === 'high' ? 'bg-rose-400' : s.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                                                }`} />
                                                {s.priority === 'high' ? 'Crítico' : s.priority === 'medium' ? 'Aviso' : 'Sugerencia'}
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5 leading-tight">{s.title}</h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                                        <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 text-emerald-400">
                                            <span>Ver más</span>
                                            <ArrowRight size={12} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── TACTICAL ALERT BANNER ELITE ── */}
                    {isTacticalVisible && tacticalInfo.todayDigit !== null && (
                        <div className="relative z-30 animate-fade-in-down px-4 sm:px-0 group/tactical">
                            <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/[0.06] via-rose-500/[0.03] to-transparent backdrop-blur-xl">
                                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-rose-500 via-rose-400/50 to-transparent" />
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 via-rose-500 to-rose-400/0 rounded-l-2xl" />
                                <div className="pl-6 pr-4 py-4 sm:py-5 flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="relative shrink-0">
                                            <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-3 rounded-xl text-white shadow-lg shadow-rose-500/30 relative z-10">
                                                <ShieldAlert size={20} strokeWidth={2.5} />
                                            </div>
                                            <div className="absolute inset-0 bg-rose-400 rounded-xl animate-ping opacity-20" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em] mb-1">⚡ Alerta Tributaria Activa</span>
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Dígito vence hoy:</span>
                                                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none" style={{fontVariantNumeric: 'tabular-nums'}}>{tacticalInfo.todayDigit}</span>
                                                {tacticalInfo.tomorrowDigit !== null && (
                                                    <div className="flex flex-col hidden sm:flex">
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Mañana</span>
                                                        <span className="text-xl font-black text-slate-400 dark:text-slate-500 tracking-tight">{tacticalInfo.tomorrowDigit}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {urgentPriorities.length > 0 && (
                                            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                                <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                                <span className="text-xs font-black text-rose-400 uppercase tracking-widest">{urgentPriorities.length} urgentes</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setIsTacticalVisible(false)}
                                            className="p-2 hover:bg-rose-400/10 rounded-lg transition-colors text-slate-400 hover:text-rose-400 opacity-40 group-hover/tactical:opacity-100"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SMART CAMPAIGN BANNER (inteligente, basado en fechas reales) ── */}
                    <div className="relative z-30 animate-fade-in px-4 sm:px-0">
                        <CampaignBanner campaign={campaign} />
                        <div className="mt-2 px-1">
                            <CampaignProgress
                                campaign={campaign}
                                total={allResults.length > 0 ? allResults.length : kpis.total}
                                completed={completados.length}
                            />
                        </div>
                    </div>

                </>
            ) : (
                /* ── MINI SUMMARY RIBBON (Minimalist Mode) ── */
                <div className="relative z-30 px-4 sm:px-0 no-print">
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl transition-all duration-300">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={12} className="text-blue-500 animate-pulse" />
                                Resumen Operativo
                            </span>
                            
                            {tacticalInfo.todayDigit !== null && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    Vence Hoy: Dígito {tacticalInfo.todayDigit}
                                </span>
                            )}
                            
                            {stitchSuggestions.length > 0 && (
                                <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">
                                    💡 {stitchSuggestions.length} sugerencias
                                </span>
                            )}
                            
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold">
                                📊 Avance Campaña: {completados.length}/{allResults.length > 0 ? allResults.length : kpis.total}
                            </span>
                        </div>
                        
                        <button
                            onClick={() => setShowIntelligencePanels(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                        >
                            <Eye size={12} />
                            Mostrar Paneles
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                CENTRO OPERATIVO Y MESA DE TRABAJO TÁCTICA v4.0
            ══════════════════════════════════════════════════════ */}
            <div className="relative z-30 px-4 sm:px-0 mt-6">
                <div className="bg-white dark:bg-[hsl(222,47%,4%)] rounded-[2.5rem] border border-slate-200/60 dark:border-white/[0.06] p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none backdrop-blur-xl">
                    
                    {/* HUB NAVIGATION TABS */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-white/[0.05]">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                                <Command size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.15em] font-premium">Centro Operativo Táctico</h3>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Gestión Inmediata & Herramientas Rápidas</p>
                            </div>
                        </div>

                        {/* TAB PILLS */}
                        <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-200/50 dark:border-white/5 overflow-x-auto hide-scrollbar">
                            <button
                                onClick={() => setHubTab('operativa')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                    hubTab === 'operativa'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                            >
                                <Zap size={14} />
                                <span>Mesa Operativa</span>
                                {mesaTrabajoList.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                        hubTab === 'operativa' ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    }`}>
                                        {mesaTrabajoList.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setHubTab('cargas')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                    hubTab === 'cargas'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                            >
                                <UploadCloud size={14} />
                                <span>Cargas & Bóveda</span>
                                {recentUploads.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                        hubTab === 'cargas' ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        {recentUploads.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setHubTab('alertas')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                    hubTab === 'alertas'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                            >
                                <AlertTriangle size={14} />
                                <span>Alertas Especiales</span>
                                {(activeRentaRefunds.length + expiringSignatures.length) > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                        hubTab === 'alertas' ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-500'
                                    }`}>
                                        {activeRentaRefunds.length + expiringSignatures.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setHubTab('firmas')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                    hubTab === 'firmas'
                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                            >
                                <KeyRound size={14} />
                                <span>Firmas</span>
                                {signatureData.withoutSignature.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                        hubTab === 'firmas' ? 'bg-white/20 text-white' : 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                                    }`}>
                                        {signatureData.withoutSignature.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* TAB CONTENT 1: MESA OPERATIVA */}
                    {hubTab === 'operativa' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Campaña Actual:</span>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                                        {mesaTrabajoTab === 'mensual' ? `Junio (${monthlyPeriodStr})` : `1er Semestre (${semestralPeriodStr})`}
                                    </span>
                                </div>

                                <div className="flex bg-slate-100/70 dark:bg-white/5 p-1 rounded-xl border border-slate-200/40 dark:border-white/5">
                                    <button
                                        onClick={() => setMesaTrabajoTab('mensual')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                            mesaTrabajoTab === 'mensual'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Mensuales
                                    </button>
                                    <button
                                        onClick={() => setMesaTrabajoTab('semestral')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                            mesaTrabajoTab === 'semestral'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Semestrales
                                    </button>
                                </div>
                            </div>

                            {mesaTrabajoList.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed border-slate-200/70 dark:border-white/5 rounded-3xl bg-slate-50/30 dark:bg-white/[0.01]">
                                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-500 mb-3 border border-emerald-200/30 dark:border-emerald-500/20">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">¡Todo al Día!</h4>
                                    <p className="text-xs text-slate-400 mt-1">No quedan clientes pendientes en esta campaña.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {mesaTrabajoList.map(c => {
                                        const targetPeriod = mesaTrabajoTab === 'mensual' ? monthlyPeriodStr : semestralPeriodStr;
                                        const ninthDigit = c.ruc[8] || '0';
                                        const dueDate = getDueDateForPeriod(c, targetPeriod);
                                        const daysLeft = getDaysUntilDue(dueDate);

                                        return (
                                            <div 
                                                key={c.id} 
                                                className="group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.05] p-5 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between gap-4"
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="w-5 h-5 rounded-md bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center justify-center font-mono flex-shrink-0">
                                                                    {ninthDigit}
                                                                </span>
                                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight truncate font-premium">
                                                                    {c.name}
                                                                </h4>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[9px] font-bold font-mono rounded">
                                                                    {c.ruc}
                                                                </span>
                                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase rounded">
                                                                    {c.regime.replace('Rimpe ', '')}
                                                                </span>
                                                            </div>

                                                            {dueDate && daysLeft !== null && (
                                                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all ${
                                                                    daysLeft < 0
                                                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                                                                        : daysLeft === 0
                                                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse shadow-sm shadow-amber-500/20'
                                                                        : daysLeft <= 3
                                                                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                                                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                                                }`}>
                                                                    <Clock size={11} className="flex-shrink-0" />
                                                                    <span>
                                                                        {daysLeft < 0
                                                                            ? `Vencido (${Math.abs(daysLeft)}d)`
                                                                            : daysLeft === 0
                                                                            ? '¡Vence Hoy!'
                                                                            : daysLeft === 1
                                                                            ? 'Falta 1 día'
                                                                            : `Faltan ${daysLeft} días`}
                                                                    </span>
                                                                    <span className="opacity-60 text-[8px] font-mono font-medium ml-0.5">
                                                                        ({format(dueDate, 'dd/MM')})
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ACTIONS GRID */}
                                                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-200/50 dark:border-white/5">
                                                    <button
                                                        onClick={() => handleCopyRuc(c.ruc, c.name)}
                                                        className="py-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
                                                        title="Copiar RUC al Portapapeles"
                                                    >
                                                        <Copy size={13} className="text-slate-400 group-hover:text-blue-500" />
                                                        <span>RUC</span>
                                                    </button>

                                                    <button
                                                        onClick={() => window.open("https://srienlinea.sri.gob.ec", "_blank")}
                                                        className="py-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
                                                        title="Abrir SRI en línea"
                                                    >
                                                        <ExternalLink size={13} className="text-slate-400 group-hover:text-sky-500" />
                                                        <span>Portal</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleMesaUploadClick(c, targetPeriod)}
                                                        className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md shadow-blue-500/20"
                                                        title="Subir Comprobante PDF de Declaración"
                                                    >
                                                        <UploadCloud size={13} />
                                                        <span>Subir</span>
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            if (c.phones?.length) {
                                                                const feeNum = getClientServiceFee(c, serviceFees, targetPeriod);
                                                                const generatedMsg = generateDeclarationWhatsAppMessage(
                                                                    c.name,
                                                                    mesaTrabajoTab === 'mensual' ? 'IVA' : 'Impuesto a la Renta',
                                                                    targetPeriod,
                                                                    feeNum,
                                                                    false
                                                                );
                                                                setWhatsAppPrompt({
                                                                    clientName: c.name,
                                                                    phone: c.phones[0].replace(/\D/g, ''),
                                                                    message: generatedMsg
                                                                });
                                                            } else {
                                                                toast.error("El cliente no tiene teléfono registrado");
                                                            }
                                                        }}
                                                        className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
                                                        title="Notificar por WhatsApp"
                                                    >
                                                        <MessageCircle size={13} />
                                                        <span>WApp</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB CONTENT 2: CARGAS & BÓVEDA */}
                    {hubTab === 'cargas' && (
                        <div className="space-y-6 animate-fade-in">
                            <div 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                className={`relative overflow-hidden rounded-2xl border transition-all duration-500 p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px] ${
                                    dragActive 
                                        ? 'bg-blue-600/10 border-blue-500 scale-[1.01] shadow-lg shadow-blue-500/20' 
                                        : 'bg-slate-50/40 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/[0.06] hover:border-blue-400 hover:shadow-md'
                                }`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input type="file" multiple accept=".pdf" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />

                                {isProcessing ? (
                                    <div className="flex flex-col items-center gap-3 py-4">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                        <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Procesando Inteligencia de Documentos...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/30 dark:border-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                                            <UploadCloud size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Arrastra aquí tus PDFs SRI o RUCs</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">El sistema asociará el documento al cliente automáticamente</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* RECENT UPLOADS */}
                            {recentUploads.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargas de la Sesión ({recentUploads.length})</span>
                                        <button onClick={() => setRecentUploads([])} className="text-[9px] font-bold text-rose-500 uppercase tracking-wider hover:underline">Limpiar</button>
                                    </div>
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                        {recentUploads.map((res, i) => {
                                            const matchedClient = clients.find(c => c.ruc === res.ruc);
                                            return (
                                                <div key={i} className="flex items-center justify-between gap-3 p-3 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 rounded-xl text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText size={14} className="text-blue-500 shrink-0" />
                                                        <span className="font-bold truncate text-slate-800 dark:text-slate-200 uppercase">{res.clientName || res.fileName}</span>
                                                        <span className="text-[9px] font-mono text-slate-400">{res.ruc}</span>
                                                    </div>
                                                    {matchedClient && (
                                                        <button onClick={() => setWorkspaceClient({ client: matchedClient, period: res.period })} className="px-2.5 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-bold uppercase">
                                                            Expediente
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB CONTENT 3: ALERTAS ESPECIALES */}
                    {hubTab === 'alertas' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            {/* REFUNDS */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                    <div className="flex items-center gap-2">
                                        <HandCoins size={16} className="text-amber-500" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Devoluciones de Renta ({activeRentaRefunds.length})</span>
                                    </div>
                                </div>

                                {activeRentaRefunds.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic p-4 text-center">No hay trámites de devolución pendientes.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {activeRentaRefunds.map(c => (
                                            <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 rounded-xl">
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">{c.name}</h5>
                                                    <p className="text-[10px] text-amber-500 font-bold uppercase mt-0.5">Estado: {c.rentaRefundStatus || 'Solicitado'}</p>
                                                </div>
                                                <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-3 py-1.5 bg-slate-200/60 dark:bg-white/10 text-slate-800 dark:text-white rounded-lg text-[9px] font-bold uppercase">
                                                    Ver
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* FIRMAS POR CADUCAR */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-rose-500" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Firmas por Caducar ({expiringSignatures.length})</span>
                                    </div>
                                </div>

                                {expiringSignatures.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic p-4 text-center">Todas las firmas electrónicas están al día.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {expiringSignatures.map(c => (
                                            <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 rounded-xl">
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">{c.name}</h5>
                                                    <p className="text-[10px] text-rose-500 font-bold uppercase mt-0.5">Vence: {c.signatureExpirationDate}</p>
                                                </div>
                                                <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-bold uppercase shadow-sm">
                                                    Renovar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT 4: FIRMAS ELECTRÓNICAS */}
                    {hubTab === 'firmas' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* HEADER + STATS ROW */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/25">
                                        <KeyRound size={16} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Control de Firmas Electrónicas</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            <span className="text-teal-500 font-bold">{signatureData.withSignature.length}</span> con firma ·{' '}
                                            <span className="text-rose-400 font-bold">{signatureData.withoutSignature.length}</span> sin firma
                                        </p>
                                    </div>
                                </div>

                                {/* SUB-TABS */}
                                <div className="flex bg-slate-100/70 dark:bg-white/5 p-1 rounded-xl border border-slate-200/40 dark:border-white/5">
                                    <button
                                        onClick={() => setFirmasSubTab('vigentes')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                            firmasSubTab === 'vigentes'
                                                ? 'bg-teal-600 text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <ShieldCheck size={11} />
                                        Por Caducidad ({signatureData.withSignature.length})
                                    </button>
                                    <button
                                        onClick={() => setFirmasSubTab('sin-firma')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                            firmasSubTab === 'sin-firma'
                                                ? 'bg-rose-600 text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <ShieldOff size={11} />
                                        Sin Firma ({signatureData.withoutSignature.length})
                                    </button>
                                </div>
                            </div>

                            {/* SUB-TAB: FIRMAS ORDENADAS POR CADUCIDAD */}
                            {firmasSubTab === 'vigentes' && (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {signatureData.withSignature.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5">
                                                <KeyRound size={24} className="text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-400 font-medium">Ningún cliente tiene firma cargada aún.</p>
                                            <p className="text-[11px] text-slate-500">Sube el archivo .p12 en la bóveda de cada cliente.</p>
                                        </div>
                                    ) : (
                                        signatureData.withSignature.map((c, idx) => {
                                            const daysLeft = signatureData.getDaysLeft(c);
                                            const isExpired = daysLeft !== null && daysLeft < 0;
                                            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                                            const noDate = daysLeft === null;

                                            const statusColor = isExpired
                                                ? 'text-rose-500'
                                                : isExpiringSoon
                                                ? 'text-amber-500'
                                                : 'text-teal-500';

                                            const dotColor = isExpired
                                                ? 'bg-rose-500'
                                                : isExpiringSoon
                                                ? 'bg-amber-400 animate-pulse'
                                                : 'bg-teal-500';

                                            const statusLabel = isExpired
                                                ? `Caducada hace ${Math.abs(daysLeft!)} días`
                                                : isExpiringSoon
                                                ? `Caduca en ${daysLeft} días`
                                                : noDate
                                                ? 'Fecha desconocida'
                                                : `Vigente · ${daysLeft} días restantes`;

                                            const expiryFormatted = c.signatureExpirationDate
                                                ? (() => {
                                                    const d = new Date(c.signatureExpirationDate);
                                                    return isNaN(d.getTime()) ? c.signatureExpirationDate : format(d, "d MMM yyyy", { locale: es });
                                                })()
                                                : '—';

                                            return (
                                                <div
                                                    key={c.id}
                                                    className={`group relative overflow-hidden flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all duration-300 hover:shadow-md ${
                                                        isExpired
                                                            ? 'bg-rose-500/[0.03] border-rose-500/20 hover:border-rose-500/40'
                                                            : isExpiringSoon
                                                            ? 'bg-amber-400/[0.03] border-amber-400/20 hover:border-amber-400/40'
                                                            : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/50 dark:border-white/[0.05] hover:border-teal-400/30'
                                                    }`}
                                                >
                                                    {/* ROW NUMBER + STATUS DOT */}
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 w-5 text-center shrink-0 tabular-nums">
                                                            {idx + 1}
                                                        </span>
                                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate leading-tight">
                                                                {c.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.ruc}</p>
                                                        </div>
                                                    </div>

                                                    {/* EXPIRY INFO */}
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="text-right hidden sm:block">
                                                            <p className={`text-[10px] font-black uppercase tracking-wide ${statusColor}`}>
                                                                {statusLabel}
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                                Vence: {expiryFormatted}
                                                            </p>
                                                        </div>

                                                        {/* ACTION BUTTONS */}
                                                        <div className="flex items-center gap-1.5">
                                                            {c.phones?.length ? (
                                                                <button
                                                                    onClick={() => {
                                                                        const msg = `Hola ${c.name.split(' ')[0]}, le informamos que su firma electrónica ${isExpired ? 'ha caducado' : `vence el ${expiryFormatted}`}. Contáctenos para gestionar la renovación.`;
                                                                        setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g,''), message: msg });
                                                                    }}
                                                                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all active:scale-95"
                                                                    title="Notificar por WhatsApp"
                                                                >
                                                                    <PhoneCall size={13} />
                                                                </button>
                                                            ) : null}
                                                            <button
                                                                onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                                                className="px-3 py-1.5 bg-slate-200/60 dark:bg-white/10 hover:bg-teal-600 hover:text-white text-slate-800 dark:text-white rounded-xl text-[9px] font-black uppercase transition-all active:scale-95"
                                                            >
                                                                Bóveda
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* SUB-TAB: SIN FIRMA */}
                            {firmasSubTab === 'sin-firma' && (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {signatureData.withoutSignature.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-500/10">
                                                <ShieldCheck size={24} className="text-teal-500" />
                                            </div>
                                            <p className="text-sm font-bold text-teal-600 dark:text-teal-400">¡Todos los clientes activos tienen firma cargada!</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-500/[0.05] border border-rose-500/20 mb-3">
                                                <ShieldOff size={16} className="text-rose-400 shrink-0" />
                                                <p className="text-[11px] text-rose-400 font-bold">
                                                    {signatureData.withoutSignature.length} clientes sin firma electrónica — posible oportunidad de venta o ingreso pendiente.
                                                </p>
                                            </div>
                                            {signatureData.withoutSignature.map((c, idx) => (
                                                <div
                                                    key={c.id}
                                                    className="group flex items-center justify-between gap-3 p-3.5 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] rounded-2xl transition-all duration-200 hover:border-rose-400/30 hover:bg-rose-500/[0.02]"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 w-5 text-center shrink-0 tabular-nums">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate">{c.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <p className="text-[10px] text-slate-400 font-mono">{c.ruc}</p>
                                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md uppercase">
                                                                    {c.regime === TaxRegime.General ? 'General' : c.regime === TaxRegime.RimpeEmprendedor ? 'Emprendedor' : 'Popular'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {c.phones?.length ? (
                                                            <button
                                                                onClick={() => {
                                                                    const msg = `Hola ${c.name.split(' ')[0]}, le recordamos que para emitir facturas electrónicas necesita una firma digital vigente. Podemos ayudarle a obtenerla. ¿Le interesa?`;
                                                                    setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g,''), message: msg });
                                                                }}
                                                                className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all active:scale-95"
                                                                title="Enviar propuesta por WhatsApp"
                                                            >
                                                                <PhoneCall size={13} />
                                                            </button>
                                                        ) : null}
                                                        <button
                                                            onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                                            className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 shadow-sm shadow-rose-500/20"
                                                        >
                                                            + Subir Firma
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {previewState.client && previewState.declaration && (
                <PdfPreviewModal
                    isOpen={previewState.isOpen}
                    onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
                    client={previewState.client}
                    declaration={previewState.declaration}
                    onDownload={() => {
                        if (previewState.declaration?.proof_file) {
                            downloadStoredFile(previewState.declaration.proof_file);
                        }
                    }}
                />
            )}
            <BulkUploadReportModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                results={bulkResults as any}
            />

            <Modal isOpen={!!whatsAppPrompt} onClose={() => setWhatsAppPrompt(null)} title="🚀 Notificar por WhatsApp" size="2xl">
                {whatsAppPrompt && (
                    <div className="space-y-6 p-4">
                        <div className="p-4 bg-slate-50 dark:bg-surface-low rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                <span>Destinatario</span>
                                <span className="text-emerald-500 font-black">Cliente Activo</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {whatsAppPrompt.clientName} ({whatsAppPrompt.phone})
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">
                                Mensaje Personalizable
                            </label>
                            <textarea
                                value={whatsAppPrompt.message}
                                onChange={(e) => setWhatsAppPrompt({ ...whatsAppPrompt, message: e.target.value })}
                                className="w-full h-40 px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100 text-sm font-medium leading-relaxed resize-none shadow-inner"
                                placeholder="Escribe el mensaje aquí..."
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95"
                            >
                                Omitir
                            </button>
                            <button
                                onClick={() => {
                                    window.open(`https://wa.me/${whatsAppPrompt.phone}?text=${encodeURIComponent(whatsAppPrompt.message)}`, "_blank");
                                    setWhatsAppPrompt(null);
                                }}
                                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                <MessageCircle size={14} strokeWidth={2.5} />
                                Enviar WhatsApp
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
            <input type="file" ref={mesaFileInputRef} onChange={handleMesaFileChange} className="hidden" accept=".pdf,image/*" />

            {/* Renta Refund Floating Orb */}
            {activeRentaRefunds.length > 0 && (
                <div className="fixed bottom-24 right-6 z-50 animate-bounce-slow">
                    <button
                        onClick={() => navigate('clients', { initialFilter: { activeGroupTab: 'all' } })}
                        className="group relative flex items-center gap-3 p-4 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-[2rem] shadow-[0_20px_40px_rgba(245,158,11,0.4)] border border-amber-300/30 transition-all hover:scale-110 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <HandCoins size={24} className="relative z-10" />
                        <span className="font-semibold text-xs tracking-widest uppercase relative z-10 pr-2">
                            {activeRentaRefunds.length} Refund{activeRentaRefunds.length > 1 ? 's' : ''}
                        </span>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center">
                            <AlertCircle size={8} strokeWidth={4} />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
