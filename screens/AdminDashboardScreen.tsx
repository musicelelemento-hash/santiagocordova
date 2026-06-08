
import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Screen, Client, DeclarationStatus, TaxRegime, Declaration } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { isPast, isToday, isTomorrow, format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClientCard } from '../components/features/ClientCard';
import { useToast } from '../context/ToastContext';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { processBulkPdfs, BulkProcessResult } from '../services/bulkOperations';
import { BulkUploadReportModal } from '../components/features/BulkUploadReportModal';
import { ChatBot } from '../components/features/ChatBot';
import { VirtualClientList } from '../components/features/VirtualClientList';
import { TaxComplianceMatrix } from '../components/features/TaxComplianceMatrix';
import { ComplianceReportExport } from '../components/features/ComplianceReportExport';
import { ClientWorkspaceModal } from '../components/features/ClientWorkspaceModal';
import { IvaFrequency } from '../types';
import { getComplianceSummary, getClientCompliance, ComplianceColor, getClientDebtSummary, getClientUndeclaredSummary } from '../services/complianceEngine';
import { PortfolioSemaphore } from '../components/ui/PortfolioSemaphore';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCampaignContext } from '../hooks/useCampaignContext';
import { CampaignBanner, CampaignProgress } from '../components/ui/CampaignBanner';


interface AdminDashboardScreenProps {
    navigate: (screen: Screen, options?: any) => void;
    theme?: 'light' | 'dark';
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate, theme = 'dark' }) => {
    const { clients, setClients, serviceFees, updateClient, removeClient, restoreClient, purgeTrash } = useAppStore();
    const { toast } = useToast();

    const [expandAnalytics, setExpandAnalytics] = useState(false);
    const [expandSegmentation, setExpandSegmentation] = useState(false);

    // Auto-detección de Campaña Mensual
    const [filter, setFilter] = useState<'all' | 'mensual' | 'semestral' | 'vip' | 'urgent' | 'rimpe' | 'popular' | 'renta' | 'overdue' | 'prepaid' | 'no-iva' | 'no-renta' | 'boveda' | 'digital-mando' | 'trash' | ComplianceColor>(() => {
        return (sessionStorage.getItem('dashboard_filter') as any) || 'mensual';
    });
    const [inboxTab, setInboxTab] = useState<'pendientes' | 'cobros' | 'completados'>(() => {
        return (sessionStorage.getItem('dashboard_inbox_tab') as any) || 'pendientes';
    });

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_inbox_tab', inboxTab);
    }, [inboxTab]);

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
    const [isTacticalVisible, setIsTacticalVisible] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [matrixUploadSelection, setMatrixUploadSelection] = useState<{ client: Client, period: string } | null>(null);
    const [workspaceClient, setWorkspaceClient] = useState<{ client: Client, period?: string } | null>(null);
    const [showMarkAllModal, setShowMarkAllModal] = useState(false);
    const [markAllMode, setMarkAllMode] = useState<'declared' | 'paid' | 'both'>('both');
    const [isBulkMarking, setIsBulkMarking] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const matrixFileInputRef = React.useRef<HTMLInputElement>(null);

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
            filter === 'digital-mando' ? 'Mensual' : 'all';

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

            const searchMatch = !searchTerm || 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.ruc.includes(searchTerm) || 
                (c.tradeName?.toLowerCase().includes(searchTerm.toLowerCase()));

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
                filterMatch = c.taxProfile?.ivaFrequency !== 'Ninguno';
            } else if (filter === 'trash') {
                filterMatch = true;
            }

            if (filterMatch) {
                filtered.push(c);
                
                // 3. Categorization (Inbox) - ONLY FOR ACTIVE (NON-DELETED) CLIENTS
                // CORRECCIÓN: Usamos el periodo actual (campaña) para determinar si está "Al Día"
                // en lugar del historial global, evitando que periodos viejos bloqueen el progreso.
                if (!c.isDeleted) {
                    const currentPeriodIsDeclared = ivaDecl?.status === DeclarationStatus.Enviada
                        || ivaDecl?.status === DeclarationStatus.Pagada
                        || !!ivaDecl?.proof_file;
                    const currentPeriodIsPaid = !!ivaDecl?.is_paid;

                    // "Completado" = el periodo actual está declarado (independientemente del historial)
                    const isCurrentPeriodDone = currentPeriodIsDeclared;
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
    }, [clients, searchTerm, filter, selectedRegime, selectedObligation, selectedPeriod, serviceFees]);

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


    const activeList = (searchTerm || filter === 'trash') 
        ? allResults 
        : (inboxTab === 'pendientes' 
            ? [...urgentPriorities, ...pendientes] 
            : inboxTab === 'cobros' ? cobros : completados);


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

    const handleUploadFromMatrix = (client: Client, period: string) => {
        setMatrixUploadSelection({ client, period });
        matrixFileInputRef.current?.click();
    };

    const onMatrixFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !matrixUploadSelection) return;

        setIsProcessing(true);
        try {
            const results = await processBulkPdfs([file], () => {});
            setBulkResults(results as any);
            setIsBulkModalOpen(true);
            setRecentUploads(prev => [...(results as any), ...prev].slice(0, 20));
            toast.success("Documento procesado");
        } catch (error) {
            toast.error("Error al procesar el documento");
        } finally {
            setIsProcessing(false);
            setMatrixUploadSelection(null);
            if (matrixFileInputRef.current) matrixFileInputRef.current.value = '';
        }
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
                action: () => setFilter('urgent')
            });
        }

        if (expiringSignatures.length > 0) {
            suggestions.push({
                title: 'Renovación de Firmas',
                desc: `${expiringSignatures.length} firmas están por caducar. Gestionar renovaciones para evitar bloqueos.`,
                priority: 'medium',
                action: () => setFilter('all')
            });
        }

        if (activeRentaRefunds.length > 0) {
            suggestions.push({
                title: 'Seguimiento de Devoluciones',
                desc: `Tienes ${activeRentaRefunds.length} trámites de renta en curso. Revisa el estatus para asegurar el depósito.`,
                priority: 'low',
                action: () => setFilter('renta')
            });
        }

        return suggestions.slice(0, 3);
    }, [tacticalInfo, urgentPriorities, expiringSignatures, activeRentaRefunds]);

    return (
        <div className="space-y-6 animate-fade-in pb-20 relative aurora-zen min-h-screen">
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
                                    <LucideIcons.ArrowRight size={12} />
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
                        {/* Top glow line */}
                        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-rose-500 via-rose-400/50 to-transparent" />
                        {/* Left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 via-rose-500 to-rose-400/0 rounded-l-2xl" />
                        <div className="pl-6 pr-4 py-4 sm:py-5 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="relative shrink-0">
                                    <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-3 rounded-xl text-white shadow-lg shadow-rose-500/30 relative z-10">
                                        <LucideIcons.ShieldAlert size={20} strokeWidth={2.5} />
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
                                    <LucideIcons.X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SMART CAMPAIGN BANNER (inteligente, basado en fechas reales) ── */}
            <div className="relative z-30 animate-fade-in px-4 sm:px-0">
                <CampaignBanner campaign={campaign} />
                {/* Progress bar de avance de la campaña */}
                <div className="mt-2 px-1">
                    <CampaignProgress
                        campaign={campaign}
                        total={allResults.length > 0 ? allResults.length : kpis.total}
                        completed={completados.length}
                    />
                </div>
            </div>

            {/* ── UNIDAD DE PROCESAMIENTO DIGITAL (DRAG & DROP ZONE) ── */}
            <div className="relative z-30 px-4 sm:px-0 no-print">
                <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative overflow-hidden rounded-2xl border transition-all duration-500 p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px] ${
                        dragActive 
                            ? 'bg-blue-600/10 border-blue-500 scale-[1.01] shadow-lg shadow-blue-500/20' 
                            : 'bg-white/80 dark:bg-[hsl(222,47%,4%)] border-slate-200/60 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10 hover:shadow-md'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {/* Background glows */}
                    <div className="absolute inset-0 pointer-events-none opacity-30">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                    </div>

                    <input type="file" multiple accept=".pdf" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />

                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-3 relative z-10 py-4">
                            <LucideIcons.Loader2 className="animate-spin text-blue-500" size={36} />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Procesando Inteligencia de Documentos...</p>
                                <p className="text-xs text-slate-400 animate-pulse">Analizando estructura PDF SRI & extracción de metadatos</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 relative z-10 py-2">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/30 dark:border-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                                <LucideIcons.UploadCloud size={24} className="animate-pulse" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Unidad de Procesamiento Digital</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                                    Arrastre y suelte sus PDFs aquí (RUCs o Comprobantes), o haga clic para buscar.
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/20 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md">
                                        📄 Certificados RUC (Registro)
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/20 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md">
                                        🧾 Comprobantes SRI (Declaración)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* HISTORIAL RECIENTE DENTRO DEL WIDGET */}
                {recentUploads.length > 0 && (
                    <div className="mt-4 bg-white/70 dark:bg-[hsl(222,47%,3%)] rounded-2xl border border-slate-200/60 dark:border-white/[0.05] p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-white/[0.04]">
                            <div className="flex items-center gap-2">
                                <LucideIcons.History size={14} className="text-slate-400" />
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Cargas Recientes de la Sesión</h4>
                            </div>
                            <button 
                                onClick={() => setRecentUploads([])}
                                className="text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
                            >
                                Limpiar Historial
                            </button>
                        </div>
                        
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                            {recentUploads.map((res, i) => {
                                const matchedClient = clients.find(c => c.ruc === res.ruc);
                                const isNew = res.status === 'new_client';
                                const isDup = res.status === 'duplicate';
                                const isErr = res.status === 'error';
                                
                                return (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl hover:border-slate-200 dark:hover:border-white/10 transition-all">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                isErr ? 'bg-rose-500/10 text-rose-500' :
                                                isDup ? 'bg-amber-500/10 text-amber-500' :
                                                isNew ? 'bg-sky-500/10 text-sky-500' : 'bg-emerald-500/10 text-emerald-500'
                                            }`}>
                                                {isErr ? <LucideIcons.FileWarning size={14} /> :
                                                 isDup ? <LucideIcons.Copy size={14} /> :
                                                 isNew ? <LucideIcons.UserPlus size={14} /> : <LucideIcons.CheckCircle2 size={14} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate uppercase">
                                                        {res.clientName || res.fileName}
                                                    </span>
                                                    <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase ${
                                                        isErr ? 'bg-rose-500/15 text-rose-500' :
                                                        isDup ? 'bg-amber-500/15 text-amber-500' :
                                                        isNew ? 'bg-sky-500/15 text-sky-500' : 'bg-emerald-500/15 text-emerald-500'
                                                    }`}>
                                                        {isErr ? 'Error' : isDup ? 'Duplicado' : isNew ? 'Nuevo Cliente' : 'Exitoso'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                                                    <span>{res.ruc || 'S/RUC'}</span>
                                                    {res.period && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-blue-500 dark:text-blue-400 uppercase font-bold">{res.period}</span>
                                                        </>
                                                    )}
                                                    {res.amount !== undefined && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-emerald-500 font-bold">${res.amount.toFixed(2)}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {res.error && (
                                                    <p className="text-[10px] text-rose-500 italic mt-1">{res.error}</p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                            {/* WhatsApp Notification Button */}
                                            {!isErr && matchedClient && matchedClient.phones && matchedClient.phones[0] && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const greeting = new Date().getHours() >= 12 ? (new Date().getHours() >= 19 ? "Buenas noches" : "Buenas tardes") : "Buen día";
                                                        const statusMsg = res.isPaid 
                                                            ? "Le informo que los honorarios por este trámite ya se encuentran cancelados. ¡Muchas gracias!"
                                                            : "Le informo que el pago de honorarios por este trámite se encuentra pendiente de registro.";
                                                        const message = `¡Hola ${res.clientName}! 👋 ${greeting}. Le informo que su declaración de ${res.type || 'Impuestos'} del periodo ${res.period || ''} fue procesada con éxito. Adjunto el comprobante de la declaración.\n\n${statusMsg}\n\n¡Gracias por su confianza!`;
                                                        const phone = matchedClient.phones![0].replace(/\D/g, '');
                                                        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
                                                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
                                                    }}
                                                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-lg border border-emerald-500/20 transition-all text-xs"
                                                    title="Notificar por WhatsApp"
                                                >
                                                    <LucideIcons.MessageCircle size={14} />
                                                </button>
                                            )}
                                            {/* Client Detail Workspace Button */}
                                            {matchedClient && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setWorkspaceClient({ client: matchedClient, period: res.period }); }}
                                                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-500 rounded-lg border border-blue-500/20 transition-all text-[9px] font-black uppercase tracking-wider"
                                                >
                                                    Expediente
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── BACKGROUND ORBS ── */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-400/3 dark:bg-blue-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-emerald-400/3 dark:bg-emerald-500/5 blur-[130px] rounded-full pointer-events-none" />

            {/* ══════════════════════════════════════════════════════
                MANDO CENTRAL — HERO PREMIUM
            ══════════════════════════════════════════════════════ */}
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
                                        <LucideIcons.Database size={10} className="text-slate-400" />
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

                            {/* ── SEARCH & ACTIONS ── */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:max-w-xl">
                                <div className="relative group flex-1 sm:min-w-[280px]">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <LucideIcons.Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors duration-300" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente, RUC..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-black/25 border border-slate-200 dark:border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-black/30 transition-all outline-none"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                        >
                                            <LucideIcons.X size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="file" multiple accept=".pdf" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-blue-700 dark:hover:bg-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/25 font-premium disabled:opacity-50 group"
                                    >
                                        {isProcessing ? <LucideIcons.Loader2 size={16} className="animate-spin" /> : <LucideIcons.UploadCloud size={16} className="group-hover:-translate-y-0.5 transition-transform" />}
                                        <span className="hidden sm:inline">SUBIR PDFs / RUCs</span>
                                    </button>
                                    <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
                                        <button onClick={() => setViewMode('list')} title="Vista Lista" className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 opacity-50 hover:opacity-80'}`}>
                                            <LucideIcons.List size={16} />
                                        </button>
                                        <button onClick={() => setViewMode('matrix')} title="Vista Matriz" className={`p-2.5 rounded-xl transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 opacity-50 hover:opacity-80'}`}>
                                            <LucideIcons.LayoutGrid size={16} />
                                        </button>
                                    </div>
                                    {viewMode === 'matrix' && (
                                        <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                                            <LucideIcons.Printer size={14} />
                                            <span className="hidden sm:inline">PDF</span>
                                        </button>
                                    )}
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
                    <div className="border-t border-slate-100 dark:border-white/[0.05] relative z-10">
                        <div className="flex sm:grid sm:grid-cols-4 overflow-x-auto no-scrollbar snap-x snap-mandatory">

                            {/* KPI 1: Clientes */}
                            <button
                                onClick={() => setFilter('all')}
                                className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                    <LucideIcons.Users size={20} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Total Clientes</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{kpis.total}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">activos en cartera</p>
                                </div>
                            </button>

                            {/* KPI 2: Facturación */}
                            <button
                                onClick={() => setFilter('all')}
                                className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                    <LucideIcons.TrendingUp size={20} strokeWidth={2} />
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
                                        onClick={() => navigate('clients', { initialFilter: { hasMissingPdf: true, title: 'Auditoría de Bóveda' } })}
                                        className="group flex-none w-[55vw] sm:w-auto snap-center flex items-center gap-4 p-6 sm:p-7 border-r border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                                    >
                                        <div className={`p-3 rounded-2xl text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                                            hasMissing
                                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-400/25'
                                                : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/25'
                                        }`}>
                                            <LucideIcons.Vault size={20} strokeWidth={2} />
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
                                onClick={() => navigate('cobranza')}
                                className="group flex-none w-[60vw] sm:w-auto snap-center flex flex-col justify-center p-6 sm:p-7 relative overflow-hidden hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                                            <LucideIcons.Wallet size={14} />
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
                                                    <p className="text-[10px] text-slate-400">{collectedPercent}% cobrado de facturación</p>
                                                    <LucideIcons.ArrowRight size={12} className="text-rose-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
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

            {/* ── ZEN ANALYTICS PANEL ── */}
            <div className="relative z-20 px-4 sm:px-0 no-print">
                <div className="bg-white dark:bg-[hsl(222,47%,4%)] rounded-2xl border border-slate-200/70 dark:border-white/[0.06] shadow-sm overflow-hidden">
                    <button 
                        onClick={() => setExpandAnalytics(!expandAnalytics)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                <LucideIcons.BarChart2 size={16} />
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Inteligencia de Negocio</span>
                        </div>
                        <LucideIcons.ChevronDown size={18} className={`text-slate-400 transition-transform duration-500 ${expandAnalytics ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${expandAnalytics ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-6 border-t border-slate-100 dark:border-white/[0.05]">
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart
                                        data={[
                                            { name: 'Activos', value: kpis.total, color: '#3b82f6' },
                                            { name: 'Al Día', value: completados.length, color: '#10b981' },
                                            { name: 'Pendientes', value: pendientes.length, color: '#f59e0b' },
                                            { name: 'Urgentes', value: urgentPriorities.length, color: '#f43f5e' }
                                        ]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                        />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                            {
                                                [
                                                    { name: 'Activos', value: kpis.total, color: '#3b82f6' },
                                                    { name: 'Al Día', value: completados.length, color: '#10b981' },
                                                    { name: 'Pendientes', value: pendientes.length, color: '#f59e0b' },
                                                    { name: 'Urgentes', value: urgentPriorities.length, color: '#f43f5e' }
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))
                                            }
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PANEL DE CONTROL: Segmentación de Cartera ── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-[hsl(222,47%,4%)] shadow-sm z-20 no-print">
                <button 
                    onClick={() => setExpandSegmentation(!expandSegmentation)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors relative"
                >
                    {/* Subtle accent line top */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-left">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/15">
                                <LucideIcons.SlidersHorizontal size={16} className="text-blue-500 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Segmentación de Cartera</h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Filtra por régimen, obligación y período fiscal</p>
                            </div>
                        </div>
                    </div>
                    <LucideIcons.ChevronDown size={18} className={`text-slate-400 transition-transform duration-500 ${expandSegmentation ? 'rotate-180' : ''}`} />
                </button>

                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${expandSegmentation ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 sm:p-8 space-y-6 border-t border-slate-100 dark:border-white/[0.05]">
                        <div className="flex justify-end mb-2">
                            {(selectedRegime !== 'all' || selectedObligation !== 'all' || selectedPeriod !== 'all') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRegime('all');
                                        setSelectedObligation('all');
                                        setSelectedPeriod('all');
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-500/20 text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                >
                                    <LucideIcons.FilterX size={12} />
                                    Limpiar filtros
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. REGÍMENES */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] font-premium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            1. Seleccionar Régimen
                        </label>
                        <div className="flex flex-col gap-2">
                            {[
                                { id: 'all', label: 'Todos los Regímenes', icon: LucideIcons.Layers },
                                { id: 'Régimen General', label: 'Régimen General', icon: LucideIcons.Building2 },
                                { id: 'Rimpe Emprendedor', label: 'RIMPE Emprendedor', icon: LucideIcons.TrendingUp },
                                { id: 'Rimpe Negocio Popular', label: 'RIMPE Popular', icon: LucideIcons.Store },
                            ].map(reg => {
                                const isActive = selectedRegime === reg.id;
                                return (
                                    <button
                                        key={reg.id}
                                        onClick={() => {
                                            setSelectedRegime(reg.id as any);
                                            setSelectedObligation('all');
                                            setSelectedPeriod('all');
                                        }}
                                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${isActive ? 'bg-primary text-white scale-[1.02] shadow-lg shadow-primary/20' : 'bg-slate-50 dark:bg-black/20 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
                                    >
                                        <reg.icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                                        <span>{reg.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. OBLIGACIONES */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] font-premium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            2. Obligación SRI
                        </label>
                        <div className="flex flex-col gap-2">
                            {(() => {
                                const allowedObs: { id: 'all' | 'IVA' | 'RENTA', label: string, icon: any, disabled: boolean, desc?: string }[] = [];
                                
                                allowedObs.push({ id: 'all', label: 'Todas las Obligaciones', icon: LucideIcons.ClipboardList, disabled: false });
                                
                                const isPopular = selectedRegime === 'Rimpe Negocio Popular';
                                const isEmprendedor = selectedRegime === 'Rimpe Emprendedor';

                                allowedObs.push({
                                    id: 'IVA',
                                    label: isEmprendedor ? 'IVA Semestral' : isPopular ? 'IVA (Exento)' : 'IVA Mensual',
                                    icon: LucideIcons.CalendarRange,
                                    disabled: isPopular,
                                    desc: isPopular ? 'Negocio Popular no declara IVA' : undefined
                                });

                                allowedObs.push({
                                    id: 'RENTA',
                                    label: isPopular ? 'Renta Anual Simplif.' : 'Renta Anual',
                                    icon: LucideIcons.ShieldCheck,
                                    disabled: false
                                });

                                return allowedObs.map(ob => {
                                    const isActive = selectedObligation === ob.id;
                                    return (
                                        <button
                                            key={ob.id}
                                            onClick={() => {
                                                if (ob.disabled) return;
                                                setSelectedObligation(ob.id);
                                                setSelectedPeriod('all');
                                            }}
                                            disabled={ob.disabled}
                                            title={ob.desc}
                                            className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${ob.disabled ? 'opacity-40 cursor-not-allowed text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/5' : isActive ? 'bg-primary text-white scale-[1.02] shadow-lg shadow-primary/20' : 'bg-slate-50 dark:bg-black/20 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
                                        >
                                            <ob.icon size={14} className={ob.disabled ? 'text-slate-300 dark:text-slate-700' : isActive ? 'text-white' : 'text-slate-400'} />
                                            <span>{ob.label}</span>
                                            {ob.disabled && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black tracking-widest text-slate-400">EXENTO</span>
                                            )}
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* 3. PERÍODOS */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] font-premium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                            3. Período Fiscal
                        </label>
                        <div className="flex flex-col gap-2">
                            {(() => {
                                const isObligationSelected = selectedObligation !== 'all';
                                if (!isObligationSelected) {
                                    return (
                                        <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-black/10 rounded-2xl border border-dashed border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 text-center py-10">
                                            <LucideIcons.CalendarOff size={20} className="mb-2 text-slate-300 dark:text-slate-700" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Selecciona una obligación para habilitar períodos</span>
                                        </div>
                                    );
                                }

                                const periods: string[] = ['all'];
                                const today = new Date();
                                const currentYear = today.getFullYear();
                                const rentaPeriod = (currentYear - 1).toString();

                                if (selectedObligation === 'IVA') {
                                    const isSemestral = selectedRegime === 'Rimpe Emprendedor';
                                    if (isSemestral) {
                                        const currentMonth = today.getMonth();
                                        if (currentMonth >= 6) {
                                            periods.push(`${currentYear}-S1`, `${currentYear - 1}-S2`);
                                        } else {
                                            periods.push(`${currentYear - 1}-S2`, `${currentYear - 1}-S1`);
                                        }
                                    } else {
                                        // Monthly
                                        for (let i = 0; i < 6; i++) {
                                            const date = subMonths(today, i + 1);
                                            periods.push(format(date, 'yyyy-MM'));
                                        }
                                    }
                                } else if (selectedObligation === 'RENTA') {
                                    periods.push(rentaPeriod, (currentYear - 2).toString());
                                }

                                return (
                                    <div className="grid grid-cols-2 gap-2 max-h-[170px] overflow-y-auto pr-2 custom-scrollbar">
                                        {periods.map(p => {
                                            const isActive = selectedPeriod === p;
                                            const label = p === 'all' ? 'Todos' : p;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setSelectedPeriod(p)}
                                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-all duration-300 ${isActive ? 'bg-primary text-white scale-[1.02] shadow-lg shadow-primary/20' : 'bg-slate-50 dark:bg-black/20 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaign Progress Legend (Subtle) */}
            <div className="flex items-center gap-4 px-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white"></div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">{completados.length} Declarados</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/10"></div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">{pendientes.length} Pendientes</span>
                </div>
            </div>



            {/* Critical Alerts Panel Refinado */}
            {(expiringSignatures.length > 0 || activeRentaRefunds.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Renta Refunds Panel - High Priority */}
                    {activeRentaRefunds.length > 0 && (
                        <div className="bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none animate-fade-in-down lg:col-span-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-2xl">
                                        <LucideIcons.HandCoins size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] font-premium">Devoluciones de Renta</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{activeRentaRefunds.length} expedientes en monitoreo</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white animate-pulse"></div>
                                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest font-premium">ACTIVO</span>
                                </div>
                            </div>
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeRentaRefunds.map(c => {
                                    const requestedAt = c.rentaRefundRequestedAt ? new Date(c.rentaRefundRequestedAt) : new Date();
                                    const hoursPassed = Math.abs(new Date().getTime() - requestedAt.getTime()) / 36e5;
                                    const isCritical = hoursPassed > 24;
                                    return (
                                        <div key={c.id} className={`group/item flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-5 rounded-[2rem] border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all`}>
                                            <div className="flex flex-col min-w-0 pr-4">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-50 uppercase tracking-tight font-premium truncate">{c.name}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest mt-2 ${isCritical ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    Tiempo: {hoursPassed.toFixed(1)}H {isCritical && '• PRIORIDAD'}
                                                </span>
                                            </div>
                                            <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="shrink-0 px-6 py-2.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all font-premium">
                                                DETALLE
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {/* Expiring Signatures Alert */}
                    {expiringSignatures.length > 0 && (
                        <div className="bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none animate-fade-in-down lg:col-span-full mt-4">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl">
                                        <LucideIcons.AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] font-premium">Firmas por Caducar</h3>
                                        <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest mt-2">{expiringSignatures.length} perfiles requieren renovación</p>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight className="text-slate-300" size={20} />
                            </div>
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                                {expiringSignatures.map(c => (
                                    <div key={c.id} className="group/item flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-5 rounded-[2rem] border border-transparent hover:border-rose-200 dark:hover:border-rose-900/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-50 uppercase tracking-tight font-premium">{c.name}</span>
                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-2">VENCE: {c.signatureExpirationDate}</span>
                                        </div>
                                        <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-6 py-2.5 bg-rose-500 text-white hover:bg-rose-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all font-premium shadow-lg shadow-rose-200/50 dark:shadow-none">
                                            RENOVAR
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* ── FILTER DOCK INTELIGENTE (contextual por campaña) ── */}
            <div className="sticky bottom-4 sm:static z-[100] px-4 sm:px-0">
                <div className="glass-tactical-dock rounded-2xl sm:rounded-full p-2 flex items-center gap-1 sm:gap-1.5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] border border-white/10 dark:border-white/5 backdrop-blur-3xl no-scrollbar overflow-x-auto scroll-smooth">
                    {[
                        { id: 'all', label: 'Directorio', icon: LucideIcons.Users, gradient: 'from-slate-500 to-slate-600', always: true },
                        { id: 'digital-mando', label: 'Mando Digital', icon: LucideIcons.Activity, gradient: 'from-sky-500 to-blue-600', color: 'text-sky-400', always: true },
                        // IVA Mensual: visible siempre pero con badge de campaña si está activa
                        { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.CalendarCheck, gradient: 'from-violet-500 to-purple-600', always: false, showWhen: campaign.showMensualTab },
                        // IVA Semestral: solo visible en julio y enero (campaña semestral activa)
                        { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.CalendarRange, gradient: 'from-blue-500 to-indigo-600', always: false, showWhen: campaign.showSemestralTab, highlight: campaign.isSemestralMonth },
                        // Renta: solo visible en marzo-junio
                        { id: 'renta', label: 'Renta Anual', icon: LucideIcons.ShieldCheck, gradient: 'from-emerald-500 to-teal-600', always: false, showWhen: campaign.showRentaTab, highlight: campaign.isRentaMonth },
                        { id: 'urgent', label: 'Crítico', icon: LucideIcons.Zap, gradient: 'from-rose-500 to-red-600', color: 'text-rose-400', always: true },
                    ]
                    // Mostrar siempre los que tienen always=true. Los contextuales solo si showWhen=true (o están activos)
                    .filter(tab => tab.always || tab.showWhen || filter === tab.id)
                    .map(tab => {
                        const isActive = filter === tab.id;
                        const isHighlighted = (tab as any).highlight && !isActive;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`relative flex items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 whitespace-nowrap hover:scale-[1.03] active:scale-95 shrink-0 ${
                                    isActive
                                        ? 'text-white shadow-lg'
                                        : isHighlighted
                                        ? 'text-blue-500 dark:text-blue-400 hover:bg-blue-500/10'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.07]'
                                }`}
                            >
                                {isActive && (
                                    <div className={`absolute inset-0 rounded-xl sm:rounded-full bg-gradient-to-tr ${tab.gradient} opacity-100`}
                                        style={{ boxShadow: `0 4px 15px -4px rgba(0,0,0,0.35)` }}
                                    />
                                )}
                                {/* Ring de campaña activa (semestral/renta) */}
                                {isHighlighted && !isActive && (
                                    <div className="absolute inset-0 rounded-xl sm:rounded-full ring-1 ring-blue-400/40 animate-pulse" />
                                )}
                                <tab.icon size={13} className={`relative z-10 transition-all duration-300 ${
                                    isActive ? 'text-white' : (tab.color || 'text-slate-500')
                                }`} />
                                <span className="relative z-10">{tab.label}</span>
                                {/* Badge de urgentes en tab Crítico */}
                                {urgentPriorities.length > 0 && tab.id === 'urgent' && (
                                    <span className={`relative z-10 ml-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-500'
                                    }`}>{urgentPriorities.length}</span>
                                )}
                                {/* Indicador de campaña semestral activa */}
                                {isHighlighted && tab.id === 'semestral' && (
                                    <span className="relative z-10 ml-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                )}
                                {/* Indicador de campaña renta activa */}
                                {isHighlighted && tab.id === 'renta' && (
                                    <span className="relative z-10 ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Indicador contextual del dígito SRI (bajo el dock) */}
                {campaign.todaySriDigit !== null && (
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/8 dark:bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            <span>Auto-ordenado por vencimiento SRI · Dígito {campaign.todaySriDigit} vence hoy</span>
                        </div>
                    </div>
                )}
                {campaign.phase === 'mensual_preparacion' && campaign.daysUntilOpen !== null && (
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/8 dark:bg-slate-500/10 border border-slate-200 dark:border-white/[0.06] text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <LucideIcons.Clock size={11} />
                            <span>Próxima campaña abre en {campaign.daysUntilOpen} días · Preparación activa</span>
                        </div>
                    </div>
                )}
            </div>


            {/* ── INBOX TABS ELITE ── */}
            {!searchTerm && (
                <div className="flex flex-col gap-3 z-10 relative px-4 sm:px-0">
                    {/* ── MESA DE TRABAJO HEADER ── */}
                    {(filter === 'mensual' || filter === 'digital-mando' || filter === 'semestral' || filter === 'renta') && (
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">
                                        Mesa de Trabajo
                                    </span>
                                </div>
                                {/* Badge del periodo activo */}
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
                                    <LucideIcons.CalendarCheck size={11} className="text-violet-500" />
                                    <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                                        {filter === 'semestral' 
                                            ? `Semestral ${campaign.activePeriodLabel}`
                                            : filter === 'renta'
                                            ? `Renta Anual ${new Date().getFullYear() - 1}`
                                            : campaign.activePeriodLabel 
                                                ? formatPeriodForDisplay(campaign.activePeriodLabel).toUpperCase()
                                                : 'IVA Mensual'
                                        }
                                    </span>
                                </div>
                                {/* Mini progreso */}
                                {allResults.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-2">
                                        <div className="w-20 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                                                style={{ width: `${Math.round((completados.length / allResults.length) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {Math.round((completados.length / allResults.length) * 100)}% listo
                                        </span>
                                    </div>
                                )}
                            </div>
                            {/* Acciones rápidas */}
                            <div className="hidden sm:flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{allResults.length} en vista</span>
                                <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                                <button
                                    onClick={() => setShowMarkAllModal(true)}
                                    disabled={activeList.length === 0}
                                    title="Marcar todos como declarados y pagados al día"
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    <LucideIcons.CheckCheck size={13} />
                                    Marcar Todos
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-100/80 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-200 dark:border-white/[0.06]">
                        {/* Tab: Pendientes */}
                        <button
                            onClick={() => setInboxTab('pendientes')}
                            className={`relative flex-1 sm:flex-none flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                                inboxTab === 'pendientes'
                                    ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <div className={`p-2 rounded-lg transition-all duration-300 ${
                                inboxTab === 'pendientes'
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'bg-transparent text-slate-400'
                            }`}>
                                <LucideIcons.Flashlight size={14} strokeWidth={2.5} />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none mb-0.5">Pendientes SRI</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-black tracking-tight leading-none">En Proceso</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                        inboxTab === 'pendientes'
                                            ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                                    }`}>{pendientes.length + urgentPriorities.length}</span>
                                </div>
                            </div>
                        </button>

                        {/* Tab: Cobros */}
                        <button
                            onClick={() => setInboxTab('cobros')}
                            className={`relative flex-1 sm:flex-none flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                                inboxTab === 'cobros'
                                    ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <div className={`p-2 rounded-lg transition-all duration-300 ${
                                inboxTab === 'cobros'
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                                    : 'bg-transparent text-slate-400'
                            }`}>
                                <LucideIcons.DollarSign size={14} strokeWidth={2.5} />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none mb-0.5">Por Cobrar</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-black tracking-tight leading-none">Honorarios</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                        inboxTab === 'cobros'
                                            ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                                    }`}>{cobros.length}</span>
                                </div>
                            </div>
                        </button>

                        {/* Tab: Completados */}
                        <button
                            onClick={() => setInboxTab('completados')}
                            className={`relative flex-1 sm:flex-none flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                                inboxTab === 'completados'
                                    ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <div className={`p-2 rounded-lg transition-all duration-300 ${
                                inboxTab === 'completados'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                                    : 'bg-transparent text-slate-400'
                            }`}>
                                <LucideIcons.ShieldCheck size={14} strokeWidth={2.5} />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none mb-0.5">Procesados</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-black tracking-tight leading-none">Al Día</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                        inboxTab === 'completados'
                                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                                    }`}>{completados.length}</span>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Acciones no-campaña o mobile fallback */}
                    {!(filter === 'mensual' || filter === 'digital-mando' || filter === 'semestral' || filter === 'renta') && (
                        <div className="ml-auto hidden sm:flex items-center gap-3 text-slate-400">
                            <LucideIcons.CalendarDays size={14} className="text-slate-400" />
                            <span className="text-xs font-semibold uppercase tracking-widest">
                                {formatPeriodForDisplay(getPeriod({ ruc: '0000000000001' } as any, new Date())).split(' ')[0]}
                            </span>
                            <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{allResults.length} en vista</span>
                            <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                            <button
                                onClick={() => setShowMarkAllModal(true)}
                                disabled={activeList.length === 0}
                                title="Marcar todos como declarados y pagados al día"
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <LucideIcons.CheckCheck size={13} />
                                Marcar Todos
                            </button>
                        </div>
                    )}
                    </div>
                </div>
            )}

            {/* ── SEARCH RESULT BANNER ── */}
            {searchTerm && (
                <div className="flex items-center gap-4 bg-white/70 dark:bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] animate-fade-in-down shadow-lg px-4 sm:px-5 mx-4 sm:mx-0">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 shrink-0">
                        <LucideIcons.Search size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white truncate">Resultados para <span className="text-blue-500 dark:text-blue-400">"{searchTerm}"</span></span>
                        <span className="text-xs text-slate-400 mt-0.5">{activeList.length} clientes encontrados</span>
                    </div>
                    <button
                        onClick={() => setSearchTerm('')}
                        className="ml-auto shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                    >
                        <LucideIcons.X size={12} />
                        Limpiar
                    </button>
                </div>
            )}

            {/* Client Grid (Virtualized) or Matrix View */}
            <div className="animate-fade-in no-print">

                {/* Active Segmentation Context Ribbon */}
                {(selectedRegime !== 'all' || selectedObligation !== 'all' || selectedPeriod !== 'all') && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 px-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">
                            <LucideIcons.Eye size={12} />
                            <span>Vista filtrada:</span>
                        </div>
                        {selectedRegime !== 'all' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-wider border border-primary/20 font-premium">
                                <LucideIcons.Building2 size={10} />
                                {selectedRegime}
                            </span>
                        )}
                        {selectedObligation !== 'all' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 font-premium">
                                <LucideIcons.ShieldCheck size={10} />
                                {selectedObligation}
                            </span>
                        )}
                        {selectedPeriod !== 'all' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-sky-500/20 font-premium">
                                <LucideIcons.Calendar size={10} />
                                {formatPeriodForDisplay(selectedPeriod)}
                            </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-premium ml-1">
                            — {activeList.length} clientes
                        </span>
                    </div>
                )}

                {viewMode === 'matrix' ? (
                    <TaxComplianceMatrix 
                        clients={matrixClients}
                        onViewClient={(c) => setWorkspaceClient({ client: c })}
                        onUploadReceipt={handleUploadFromMatrix}
                        onPreviewReceipt={(c, d) => setPreviewState({ isOpen: true, client: c, declaration: d })}
                        theme={theme}
                    />
                ) : activeList.length > 0 ? (
                    <VirtualClientList
                        clients={activeList}
                        serviceFees={serviceFees}
                        onQuickAction={handleAction}
                        onView={(c) => setWorkspaceClient({ client: c })}
                        onUploadReceipt={handleUploadFromMatrix}
                        frequency={filter === 'semestral' ? 'Semestral' : (filter === 'mensual' || filter === 'digital-mando') ? 'Mensual' : 'all'}
                        customPeriod={selectedPeriod !== 'all' ? selectedPeriod : undefined}
                        isTrashView={filter === 'trash'}
                        onPreview={(c, d) => setPreviewState({ isOpen: true, client: c, declaration: d })}
                    />
                ) : (
                    <div className="py-32 text-center">
                        <div className="relative inline-flex mb-6">
                            <div className="absolute inset-0 bg-brand-teal/20 blur-3xl rounded-full"></div>
                            <div className="relative p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl">
                                <LucideIcons.Inbox size={48} className="text-slate-300 dark:text-slate-700" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">Búsqueda sin resultados</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm font-medium">
                            No encontramos clientes que coincidan con el filtro <span className="text-brand-teal font-medium">"{filter}"</span> o tu búsqueda actual.
                        </p>
                        <button
                            onClick={() => { setSearchTerm(''); setFilter('all'); }}
                            className="mt-8 px-6 py-2.5 bg-brand-navy text-white rounded-xl font-semibold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Restablecer Flujo
                        </button>
                    </div>
                )}
            </div>

            {/* ── MODAL CONFIRMAR MARCAR TODOS AL DÍA ── */}
            {showMarkAllModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in-up">
                    <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
                        {/* Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-[60px] -ml-16 -mb-16 pointer-events-none" />

                        <div className="relative z-10">
                            {/* Icon */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                                    {isBulkMarking
                                        ? <LucideIcons.Loader2 size={26} className="text-white animate-spin" />
                                        : <LucideIcons.CheckCheck size={26} className="text-white" />
                                    }
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Acción Masiva</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                        {activeList.length} clientes en vista
                                    </p>
                                </div>
                            </div>

                            {/* Selector de modo */}
                            <div className="mb-6 space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">¿Qué deseas marcar?</p>
                                {([
                                    { id: 'both', label: 'Declarados + Pagados al Día', desc: 'Marca la declaración SRI como enviada Y los honorarios como cobrados', icon: LucideIcons.ShieldCheck, color: 'emerald' },
                                    { id: 'declared', label: 'Solo Declarados', desc: 'Registra la declaración SRI como enviada al fisco', icon: LucideIcons.FileCheck, color: 'blue' },
                                    { id: 'paid', label: 'Solo Pagados', desc: 'Marca los honorarios profesionales como cobrados', icon: LucideIcons.DollarSign, color: 'amber' },
                                ] as const).map(opt => {
                                    const isActive = markAllMode === opt.id;
                                    const colorMap = {
                                        emerald: isActive ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-emerald-300',
                                        blue: isActive ? 'bg-blue-500 border-blue-500 text-white' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-300',
                                        amber: isActive ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-amber-300',
                                    };
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => setMarkAllMode(opt.id)}
                                            className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${colorMap[opt.color]}`}
                                        >
                                            <opt.icon size={18} className={`shrink-0 mt-0.5 ${isActive ? 'text-white' : ''}`} />
                                            <div>
                                                <p className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{opt.label}</p>
                                                <p className={`text-[10px] mt-0.5 leading-relaxed ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{opt.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Warning */}
                            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl mb-6">
                                <LucideIcons.AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">
                                    Esta acción modifica el período actual de <strong>{activeList.length} clientes</strong>. Solo afecta a los que están en la vista activa.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowMarkAllModal(false)}
                                    disabled={isBulkMarking}
                                    className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleMarkAllDeclaredAndPaid}
                                    disabled={isBulkMarking || activeList.length === 0}
                                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black uppercase tracking-widest hover:from-emerald-600 hover:to-teal-600 transition-all active:scale-95 shadow-xl shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isBulkMarking ? (
                                        <><LucideIcons.Loader2 size={16} className="animate-spin" /> Procesando...</>
                                    ) : (
                                        <><LucideIcons.CheckCheck size={16} /> Confirmar</>  
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden component for Print Export */}
            <ComplianceReportExport 
                clients={matrixClients}
                periods={matrixPeriods}
                frequency={filter === 'semestral' ? 'Semestral' : 'Mensual'}
            />

            {previewState.client && previewState.declaration && (
                <PdfPreviewModal
                    isOpen={previewState.isOpen}
                    onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
                    client={previewState.client}
                    declaration={previewState.declaration}
                    onDownload={() => {
                        const link = document.createElement('a');
                        link.href = previewState.declaration.proof_file.url;
                        link.download = previewState.declaration.proof_file.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                />
            )}
            <BulkUploadReportModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                results={bulkResults as any}
            />

            <ClientWorkspaceModal
                isOpen={!!workspaceClient}
                onClose={() => setWorkspaceClient(null)}
                client={workspaceClient?.client || null}
                initialPeriod={workspaceClient?.period}
            />

            {/* Renta Refund Floating Orb */}
            {activeRentaRefunds.length > 0 && (
                <div className="fixed bottom-24 right-6 z-50 animate-bounce-slow">
                    <button
                        onClick={() => setFilter('renta')}
                        className="group relative flex items-center gap-3 p-4 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-[2rem] shadow-[0_20px_40px_rgba(245,158,11,0.4)] border border-amber-300/30 transition-all hover:scale-110 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <LucideIcons.HandCoins size={24} className="relative z-10" />
                        <span className="font-semibold text-xs tracking-widest uppercase relative z-10 pr-2">
                            {activeRentaRefunds.length} Refund{activeRentaRefunds.length > 1 ? 's' : ''}
                        </span>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center">
                            <LucideIcons.AlertCircle size={8} strokeWidth={4} />
                        </div>
                    </button>
                </div>
            )}

            <input
                type="file"
                accept=".pdf"
                ref={matrixFileInputRef}
                onChange={onMatrixFileChange}
                className="hidden"
            />
        </div>
    );
};
