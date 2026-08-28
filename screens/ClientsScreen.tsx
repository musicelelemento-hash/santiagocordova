import { arePeriodsEqual } from '../components/features/TaxComplianceMatrix';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Client, DeclarationStatus, Declaration, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, TranscribableField, TaxObligationType } from '../types';
import {
    AlertCircle, AlertTriangle, ArrowUpDown, Briefcase, Check, CheckCircle2, Clock, DollarSign, FileText,
    Filter, LayoutGrid, LayoutList, MessageCircle, Plus, PlusCircle, Search,
    Shield, ShieldCheck, Sparkles, Store, Trash2, UploadCloud, Users, X, Zap,
    Download, Copy, FileSpreadsheet, Building2
} from 'lucide-react';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod, getIdentifierSortKey, fetchSRIPublicData, safeFormat } from '../services/sri';
import { Modal } from '../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { isPast, subMonths, subYears, differenceInCalendarDays } from 'date-fns';
import { getClientServiceFee, isCourtesyClient } from '../services/clientService';
import { useTranscription } from '../hooks/useTranscription';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClientDetailView } from '../components/features/ClientDetailView';
import { ClientForm } from '../components/features/ClientForm';
import { useToast } from '../context/ToastContext';
import { VirtualClientList } from '../components/features/VirtualClientList';
import { VirtualClientTable } from '../components/features/VirtualClientTable';
import { ClientCard } from '../components/features/ClientCard';
import { extractDataFromDeclarationPdf, fileToBase64, extractDataFromSriPdf } from '../services/pdfExtraction';
import { UnifiedStorageService } from '../services/unifiedStorageService';
import { StoredFile } from '../types';
import { BulkUploadReportModal, BulkUploadResult } from '../components/features/BulkUploadReportModal';
import { BulkClientWizardModal, CandidateClientItem } from '../components/features/BulkClientWizardModal';
import { GlobalUploadModal } from '../components/features/GlobalUploadModal';
import { motion, AnimatePresence } from 'framer-motion';
import { TaxComplianceMatrix } from '../components/features/TaxComplianceMatrix';
import { ClientsDashboard } from '../components/features/ClientsDashboard';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { downloadStoredFile } from '../services/fileService';
import { getClientDebtSummary, getClientUndeclaredSummary } from '../services/complianceEngine';
import { useCampaignContext } from '../hooks/useCampaignContext';
import { CampaignBanner } from '../components/ui/CampaignBanner';
import { useDebounce } from '../hooks/useDebounce';

const OBLIGATION_GROUPS = [
    { id: 'all', label: 'Todos', icon: Users, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'vencidos', label: 'Vencidos', icon: AlertCircle, color: 'text-primary bg-primary/10 ring-primary/20' },
    { id: 'ordenes', label: 'Órdenes', icon: Zap, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'cobros', label: 'Por Cobrar', icon: Sparkles, color: 'text-accent bg-accent/10 ring-accent/20' },
    { id: 'al-dia', label: 'Al Día', icon: ShieldCheck, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'mensual', label: 'IVA Mensual', icon: Clock, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'semestral', label: 'IVA Semestral', icon: Briefcase, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'rimpe_emp', label: 'Rimpe Emprendedor', icon: Zap, color: 'text-purple-400 bg-purple-500/10 ring-purple-500/20' },
    { id: 'matrix', label: 'Declaraciones', icon: LayoutGrid, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'trash', label: 'Papelera', icon: Trash2, color: 'text-primary bg-primary/10 ring-primary/20' },
];

import { useAppStore } from '../store/useAppStore';

interface ClientsScreenProps {
    initialFilter: ClientFilter | null;
    navigate: (screen: Screen, options?: any) => void;
    initialClientData: Partial<Client> | null;
    clearInitialClientData: () => void;
    clientToView: Client | null;
    clearClientToView: () => void;
    sriCredentialsProp?: Record<string, string>;
    initialTab?: 'profile' | 'history' | 'vault' | 'settings';
    globalSearchTerm?: string;
    setGlobalSearchTerm?: (term: string) => void;
}

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
    initialFilter,
    navigate,
    initialClientData,
    clearInitialClientData,
    clientToView,
    clearClientToView,
    sriCredentialsProp,
    initialTab,
    globalSearchTerm,
    setGlobalSearchTerm
}) => {
    const { clients, setClients, updateClient, addClient, removeClient, restoreClient, purgeTrash, serviceFees, sriCredentials: storeCredentials } = useAppStore();
    const sriCredentials = sriCredentialsProp || storeCredentials;
    const { toast } = useToast();
    // ── CAMPAÑA INTELIGENTE ──
    const campaign = useCampaignContext();
    const [localSearchTerm, setLocalSearchTerm] = useState(() => sessionStorage.getItem('clients_search') || '');
    const searchTerm = globalSearchTerm !== undefined ? globalSearchTerm : localSearchTerm;
    const setSearchTerm = setGlobalSearchTerm !== undefined ? setGlobalSearchTerm : setLocalSearchTerm;
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    const [billingPromptData, setBillingPromptData] = useState<{ client: Client; amount: number; description: string; } | null>(null);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [sortOption, setSortOption] = useState<'9th_digit' | 'name' | 'status' | 'pending_obligations' | 'pending_payments'>(() => (sessionStorage.getItem('clients_sort') as any) || '9th_digit');
    const [filterOption, setFilterOption] = useState<'active' | 'inactive' | 'all'>('active');
    const [isComboModalOpen, setIsComboModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => (sessionStorage.getItem('clients_view_mode') as any) || 'list');
    const receiptFileInputRef = useRef<HTMLInputElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [receiptUploadState, setReceiptUploadState] = useState<{ client: Client, period?: string, obligationType?: TaxObligationType } | null>(null);
    const [bulkResults, setBulkResults] = useState<BulkUploadResult[]>([]);
    const [isBulkReportOpen, setIsBulkReportOpen] = useState(false);
    const [isGlobalUploadOpen, setIsGlobalUploadOpen] = useState(false);
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
    const [previewItem, setPreviewItem] = useState<{ client: Client, declaration: Declaration } | null>(null);

    // Bulk Wizard State
    const [bulkWizardData, setBulkWizardData] = useState<CandidateClientItem[]>([]);
    const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);

    // Smart Tabs Logic
    const getInitialGroupTab = () => {
        if (initialFilter?.activeGroupTab) return initialFilter.activeGroupTab;
        return 'matrix';
    };

    const [activeGroupTab, setActiveGroupTab] = useState(getInitialGroupTab());
    const isMatrixView = ['matrix', 'matriz', 'renta', 'declaraciones'].includes(activeGroupTab);
    const isCobrosView = ['cobros', 'recaudacion'].includes(activeGroupTab);
    const isWorkspaceView = !isMatrixView && !isCobrosView;
    const isAlertasView = false;
    const [specificCategoryFilter, setSpecificCategoryFilter] = useState<any | null>(null);
    const [regimeFilter, setRegimeFilter] = useState<TaxRegime | 'all'>('all');

    // Sync initialFilter prop changes (e.g. from Dashboard navigation)
    useEffect(() => {
        if (initialFilter) {
            if (initialFilter.activeGroupTab) {
                setActiveGroupTab(initialFilter.activeGroupTab);
            }
            if (initialFilter.searchTerm !== undefined) {
                setSearchTerm(initialFilter.searchTerm);
            }
            if (initialFilter.hasMissingPdf) {
                setActiveGroupTab('all');
            }
        }
    }, [initialFilter]);

    // Search Persistence Effect
    useEffect(() => {
        sessionStorage.setItem('clients_search', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        sessionStorage.setItem('clients_group_tab', activeGroupTab);
    }, [activeGroupTab]);

    useEffect(() => {
        sessionStorage.setItem('clients_sort', sortOption);
    }, [sortOption]);

    useEffect(() => {
        sessionStorage.setItem('clients_view_mode', viewMode);
    }, [viewMode]);

    // Scroll Persistence
    useEffect(() => {
        const savedScroll = sessionStorage.getItem('clients_scroll');
        if (savedScroll) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }, 100);
        }

        const handleScroll = () => {
            sessionStorage.setItem('clients_scroll', window.scrollY.toString());
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setIsSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (clientToView) {
            setSelectedClient(clientToView);
            setIsClientDetailsOpen(true);
        }
    }, [clientToView, clearClientToView]);

    // Responsive ViewMode Logic
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setViewMode('cards');
            } else {
                setViewMode('list');
            }
        };
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const frequencyForList = useMemo(() => {
        if (activeGroupTab === 'mensual') return 'Mensual' as const;
        if (activeGroupTab === 'semestral') return 'Semestral' as const;
        return 'all' as const;
    }, [activeGroupTab]);

    const globalStats = useMemo(() => {
        const stats = { vencidos: 0, ordenes: 0, cobros: 0, elite: 0, total: clients.filter(c => !c.isDeleted).length };
        const today = new Date();

        clients.filter(c => !c.isDeleted).forEach(client => {
            const debtSummary = getClientDebtSummary(client, serviceFees, today);
            const undeclaredSummary = getClientUndeclaredSummary(client, today);

            const isVencido = undeclaredSummary.overduePeriodsCount > 0;
            const isCobroPending = debtSummary.hasPendingPayment && !undeclaredSummary.hasPendingObligation;
            
            const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const rentaDecl = (client.declarations ?? []).find(d => d.period === rentaPeriod);
            const isRentaPaid = !!rentaDecl?.is_paid;
            const isRentaDeclared = !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;

            const isFullyPaid = !debtSummary.hasPendingPayment && (isRentaPaid || !needsRenta);
            const isFullyDeclared = !undeclaredSummary.hasPendingObligation && (isRentaDeclared || !needsRenta);
            const isElite = isFullyPaid && isFullyDeclared;

            const hasWorkOrder = (client.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente);

            if (isVencido) stats.vencidos++;
            else if (hasWorkOrder) stats.ordenes++;
            else if (isCobroPending) stats.cobros++;
            else if (isElite) stats.elite++;
        });
        return stats;
    }, [clients, serviceFees]);

    const trashCount = useMemo(() => clients.filter(c => c.isDeleted).length, [clients]);
    const soloPlanCount = useMemo(() => clients.filter(c => !c.isDeleted && (c.requiresDeclarations === false || c.clientType === 'solo_plan')).length, [clients]);

    useEffect(() => {
        if (initialClientData) {
            setIsModalOpen(true);
            clearInitialClientData();
        }
    }, [initialClientData, clearInitialClientData]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            // Lógica de Papelera: Si estamos en la pestaña trash/papelera, solo mostrar isDeleted.
            // Si NO estamos en trash, ocultar isDeleted.
            if (activeGroupTab === 'trash' || activeGroupTab === 'papelera') {
                if (!client.isDeleted) return false;
            } else {
                if (client.isDeleted) return false;
            }

            const statusMatch = filterOption === 'all' ||
                (filterOption === 'active' && (client.isActive ?? true)) ||
                (filterOption === 'inactive' && !(client.isActive ?? true));
            if (!statusMatch) return false;

            // Smart Search Filtering (Unified with App.tsx tag logic)
            const query = debouncedSearchTerm.toLowerCase().trim();
            let searchMatch = true;

            if (query) {
                if (query.startsWith('r:')) {
                    const targetRegime = query.substring(2).trim().toUpperCase();
                    const cReg = (client.regime || '').toUpperCase();
                    searchMatch = (
                        (targetRegime.includes('POP') && cReg.includes('POPULAR')) ||
                        (targetRegime.includes('EMP') && cReg.includes('EMPRENDEDOR')) ||
                        (targetRegime.includes('GEN') && (cReg.includes('GENERAL') || cReg === ''))
                    );
                } else if (query.startsWith('v:')) {
                    const targetStatus = query.substring(2).trim();
                    if (targetStatus.includes('ven') || targetStatus.includes('pen')) {
                        const today = new Date();
                        searchMatch = getClientUndeclaredSummary(client, today).overduePeriodsCount > 0;
                    }
                } else if (query.startsWith('d:')) {
                    const digit = query.substring(2).trim();
                    if (digit.length === 1 && /^\d$/.test(digit)) {
                        searchMatch = client.ruc[8] === digit;
                    }
                } else if (query.startsWith('n:')) {
                    const noteSearch = query.substring(2).trim();
                    searchMatch = !!(client.notes && client.notes.toLowerCase().includes(noteSearch));
                } else {
                    // Normal search (Accent-insensitive & unordered tokens)
                    const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
                    const haystack = `${client.name} ${client.ruc} ${client.tradeName || ''} ${client.notes || ''}`
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase();
                    searchMatch = terms.every(term => haystack.includes(term));
                }
            }

            if (!searchMatch) return false;

            // SI HAY BÚSQUEDA ACTIVADA, saltamos los filtros de pestañas para mostrar resultados globales
            if (query) return true;

            if (activeGroupTab === 'vencidos') {
                const today = new Date();
                const undeclaredSummary = getClientUndeclaredSummary(client, today);
                return undeclaredSummary.overduePeriodsCount > 0;
            }

            if (activeGroupTab === 'ordenes') {
                return (client.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente);
            }

            if (activeGroupTab === 'cobros') {
                return true;
            }

            if (activeGroupTab === 'al-dia') {
                const today = new Date();
                const debtSummary = getClientDebtSummary(client, serviceFees, today);
                const undeclaredSummary = getClientUndeclaredSummary(client, today);
                
                const cRegUpper = (client.regime || '').toUpperCase();
                const isEmpOrPop = cRegUpper.includes('EMPRENDEDOR') || cRegUpper.includes('POPULAR');
                const needsRenta = client.taxProfile?.requiresAnnualRenta ?? isEmpOrPop;
                const currentYear = today.getFullYear();
                const rentaPeriod = (currentYear - 1).toString();
                const rentaDecl = (client.declarations ?? []).find(d => d.period === rentaPeriod);
                const isRentaPaid = !needsRenta || !!rentaDecl?.is_paid;
                const isRentaDeclared = !needsRenta || !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;

                return !debtSummary.hasPendingPayment && !undeclaredSummary.hasPendingObligation && isRentaPaid && isRentaDeclared;
            }

            const isSoloPlan = client.requiresDeclarations === false || client.clientType === 'solo_plan';

            if (activeGroupTab === 'solo_plan') {
                return isSoloPlan;
            }

            // Para pestañas tributarias/matriz, ignorar clientes de solo plan
            if (isSoloPlan && ['mensual', 'semestral', 'rimpe_emp', 'rimpe_np', 'renta', 'vencidos', 'al-dia'].includes(activeGroupTab)) {
                return false;
            }

            const cRegUpper = (client.regime || '').toUpperCase();

            if (activeGroupTab === 'mensual') {
                const isSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || cRegUpper.includes('EMPRENDEDOR');
                const isAnual = client.taxProfile?.ivaFrequency === 'Ninguno';
                const isNegocioPopular = cRegUpper.includes('POPULAR'); // RIMPE NP no declara IVA
                if (isSemestral || isAnual || isNegocioPopular) return false;
            } else if (activeGroupTab === 'semestral') {
                const isSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || cRegUpper.includes('EMPRENDEDOR');
                if (!isSemestral) return false;
            } else if (activeGroupTab === 'rimpe_emp') {
                const isEmp = cRegUpper.includes('EMPRENDEDOR') || client.taxProfile?.ivaFrequency === 'Semestral';
                if (!isEmp) return false;
            } else if (activeGroupTab === 'rimpe_np') {
                const isNP = cRegUpper.includes('POPULAR');
                if (!isNP) return false;
            } else if (activeGroupTab === 'renta') {
                const hasRenta = client.taxProfile?.requiresAnnualRenta ||
                    cRegUpper.includes('EMPRENDEDOR') ||
                    cRegUpper.includes('POPULAR') ||
                    cRegUpper.includes('GENERAL');
                const hasDev = client.taxProfile?.hasActiveDevolucionIva;
                const hasAnexo = client.taxProfile?.requiresAnexosGastos;
                if (!hasRenta && !hasDev && !hasAnexo) return false;
            }

            if (regimeFilter !== 'all') {
                const fReg = regimeFilter.toUpperCase();
                if (fReg.includes('EMPRENDEDOR') && !cRegUpper.includes('EMPRENDEDOR')) return false;
                if (fReg.includes('POPULAR') && !cRegUpper.includes('POPULAR')) return false;
                if (fReg.includes('GENERAL') && (!cRegUpper.includes('GENERAL') && cRegUpper !== '')) return false;
            }

            // FILTRO DE ATENCIÓN URGENTE (Radar de Vencimientos)
            if (initialFilter?.needsAttention) {
                const today = new Date();
                const alertDays = 30;
                let isExpiring = false;
                if (client.signatureExpirationDate) {
                    const diff = differenceInCalendarDays(new Date(client.signatureExpirationDate), today);
                    if (diff <= alertDays) isExpiring = true;
                }
                if (client.facturadorConfig?.expirationDate) {
                    const diff = differenceInCalendarDays(new Date(client.facturadorConfig.expirationDate), today);
                    if (diff <= alertDays) isExpiring = true;
                }
                if (!isExpiring) return false;
            }

            // FILTRO DE AUDITORÍA DE BÓVEDA (Missing PDFs)
            if (initialFilter?.hasMissingPdf) {
                const missingPdf = (client.declarations ?? []).some(d => 
                    (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
                );
                if (!missingPdf) return false;
            }

            return true;
        });
    }, [clients, debouncedSearchTerm, filterOption, activeGroupTab, regimeFilter, initialFilter]);

    // --- LÓGICA DE ORDENAMIENTO MEJORADA ---
    const sortedClients = useMemo(() => {
        const getPendingStatus = (client: Client) => {
            const today = new Date();
            const period = getPeriod(client, today);
            const decl = (client.declarations ?? []).find(d => d.period === period);
            
            const isIvaDeclared = !!decl?.proof_file;
            const isIvaPaid = !!decl?.is_paid;

            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular || client.regime === TaxRegime.General);
            const rentaDecl = (client.declarations ?? []).find(d => d.period === rentaPeriod);
            const isRentaDeclared = !!rentaDecl?.proof_file || false;
            const isRentaPaid = !!rentaDecl?.is_paid || false;

            const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && client.taxProfile?.ivaFrequency !== 'Ninguno';

            const hasPendingObligation = (needsIva && !isIvaDeclared) || (needsRenta && !isRentaDeclared);
            const hasPendingPayment = (needsIva && isIvaDeclared && !isIvaPaid) || (needsRenta && isRentaDeclared && !isRentaPaid);

            return { hasPendingObligation, hasPendingPayment };
        };

        return [...filteredClients].sort((a, b) => {
            if (sortOption === 'name') return a.name.localeCompare(b.name);

            if (sortOption === 'pending_obligations') {
                const statusA = getPendingStatus(a);
                const statusB = getPendingStatus(b);
                if (statusA.hasPendingObligation && !statusB.hasPendingObligation) return -1;
                if (!statusA.hasPendingObligation && statusB.hasPendingObligation) return 1;
            }

            if (sortOption === 'pending_payments') {
                const statusA = getPendingStatus(a);
                const statusB = getPendingStatus(b);
                if (statusA.hasPendingPayment && !statusB.hasPendingPayment) return -1;
                if (!statusA.hasPendingPayment && statusB.hasPendingPayment) return 1;
            }

            // Fallback a Vencimiento o si sortOption === '9th_digit'
            const periodA = getPeriod(a, new Date());
            const periodB = getPeriod(b, new Date());
            const dueA = getDueDateForPeriod(a, periodA);
            const dueB = getDueDateForPeriod(b, periodB);

            if (dueA && dueB && (sortOption === '9th_digit' || sortOption === 'pending_obligations' || sortOption === 'pending_payments')) {
                const diff = dueA.getTime() - dueB.getTime();
                if (diff !== 0) return diff;
            }

            const digitA = parseInt(a.ruc[8] || '0', 10);
            const digitB = parseInt(b.ruc[8] || '0', 10);
            const valA = digitA === 0 ? 10 : digitA;
            const valB = digitB === 0 ? 10 : digitB;
            return valA - valB;
        });
    }, [filteredClients, sortOption]);

    const handleCreateClient = (client: Client) => {
        const existingClient = clients.find(c => c.id === client.id || c.ruc === client.ruc);
        if (existingClient) {
            const mergedClient: Client = {
                ...client,
                id: existingClient.id,
                declarations: existingClient.declarations,
                vault: existingClient.vault,
                createdAt: existingClient.createdAt
            };
            updateClient(existingClient.id, mergedClient);
            toast.success('Perfil de cliente actualizado exitosamente');
        } else {
            addClient(client);
            toast.success('Cliente creado exitosamente');
        }
        setIsModalOpen(false);
    };

    const handleUpdateClient = (updatedClient: Client) => {
        updateClient(updatedClient.id, updatedClient);
        setSelectedClient(updatedClient);
    };

    const handleTogglePaymentFromMatrix = (client: Client, period: string, type: TaxObligationType | TaxObligationType[], isPaid: boolean) => {
        const types = Array.isArray(type) ? type : [type];
        const now = new Date().toISOString();
        let updatedHistory = [...(client.declarations || [])];

        types.forEach(t => {
            let targetPeriod = period;
            if (t === 'ICE' && !period.includes(':ICE')) targetPeriod = `${period}:ICE`;
            else if (t === 'PVP' && !period.includes(':PVP')) targetPeriod = `${period}:PVP`;
            else if (t === 'DEVOLUCION' && !period.includes(':DEV')) targetPeriod = `${period}:DEV`;

            const idx = updatedHistory.findIndex(d => {
                const matchPeriod = d.period === targetPeriod || d.period === period || arePeriodsEqual(d.period, targetPeriod) || arePeriodsEqual(d.period, period);
                const matchType = (d.type || '').toUpperCase() === t.toUpperCase() || (!d.type && (t === 'IVA' || t === 'RENTA' || t === 'ANEXO'));
                return matchPeriod && matchType;
            });

            if (idx !== -1) {
                updatedHistory[idx] = {
                    ...updatedHistory[idx],
                    is_paid: isPaid,
                    paidAt: isPaid ? now : undefined,
                    status: isPaid ? DeclarationStatus.Pagada : (updatedHistory[idx].status === DeclarationStatus.Pagada ? DeclarationStatus.Enviada : updatedHistory[idx].status),
                    updatedAt: now
                };
            } else {
                updatedHistory.push({
                    period: targetPeriod,
                    type: t,
                    status: isPaid ? DeclarationStatus.Pagada : DeclarationStatus.Pendiente,
                    is_paid: isPaid,
                    paidAt: isPaid ? now : undefined,
                    updatedAt: now
                });
            }
        });

        updateClient(client.id, { declarations: updatedHistory });
        toast.success(isPaid ? `Pago de honorarios (${period}) registrado` : `Pago de honorarios (${period}) revertido`);

        if (isPaid) {
            setTimeout(() => {
                const feeAmount = getClientServiceFee(client, serviceFees, period);
                setBillingPromptData({
                    client,
                    amount: feeAmount,
                    description: `Honorarios de Declaración - Período ${period}`
                });
            }, 100);
        }
    };

    const handleTogglePriorityFromMatrix = (client: Client, period: string, type: TaxObligationType, isPriority: boolean) => {
        const now = new Date().toISOString();
        const updatedHistory = [...(client.declarations || [])];
        const idx = updatedHistory.findIndex(d => d.period === period && d.type === type);
        
        if (idx !== -1) {
            updatedHistory[idx] = {
                ...updatedHistory[idx],
                isPriority,
                updatedAt: now
            };
        } else {
            updatedHistory.push({
                period,
                type,
                status: DeclarationStatus.Pendiente,
                isPriority,
                updatedAt: now
            });
        }
        
        updateClient(client.id, { declarations: updatedHistory });
        toast.success(isPriority ? 'Prioridad de declaración fijada' : 'Prioridad quitada');
    };

    const handleCopyRucs = () => {
        const targetList = filteredClients;
        if (targetList.length === 0) {
            toast.error("No hay expedientes en la lista actual");
            return;
        }
        const rucs = targetList.map(c => c.ruc).filter(Boolean).join("\n");
        navigator.clipboard.writeText(rucs);
        toast.success(`📋 ${targetList.length} RUCs copiados al portapapeles`);
    };

    const handleOpenClientDetails = (client: Client, tab?: string) => {
        setSelectedClient(client);
        const targetTab = tab || initialTab || 'profile';
        (window as any).__TEMP_INITIAL_TAB__ = targetTab;
        setIsClientDetailsOpen(true);
        navigate('clients', { clientIdToView: client.id, initialTab: targetTab });
    };

    const handleCloseClientDetails = () => {
        setIsClientDetailsOpen(false);
        setTimeout(() => setSelectedClient(null), 300);
        clearClientToView();
        navigate('clients');
    };

    const handleQuickAction = (client: Client, action: 'declare' | 'pay' | 'deactivate' | 'restore' | 'purge', customPeriod?: string) => {
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

        // CRITICAL FIX: Leer siempre el cliente FRESCO del store, no el snapshot del card
        const freshClient = clients.find(c => c.id === client.id) || client;
        const history = [...(freshClient.declarations || [])];
        const idx = history.findIndex(d => arePeriodsEqual(d.period, period));
        const newStatus = action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada;

        const existingEntry = history[idx];
        const newEntry = {
            period,
            status: newStatus,
            updatedAt: nowIso,
            ...(action === 'declare' ? { declaredAt: nowIso } : {}),
            ...(action === 'pay' ? { is_paid: true, paidAt: nowIso, transactionId: `Q-${Date.now().toString().slice(-4)}` } : {})
        };

        if (idx > -1) {
            history[idx] = { ...existingEntry, ...newEntry };
        } else {
            history.push(newEntry as Declaration);
        }

        const updates: Partial<Client> = { declarations: history };

        updateClient(client.id, updates);

        // AJUSTE CRÍTICO: Sincronizar el cliente seleccionado si está abierto en el modal
        if (selectedClient && selectedClient.id === client.id) {
            setSelectedClient({ ...client, ...updates });
        }

        toast.success(action === 'declare' ? 'Declaración registrada' : 'Pago registrado');

        if (action === 'pay') {
            setTimeout(() => {
                const feeAmount = getClientServiceFee(client, serviceFees);
                setBillingPromptData({
                    client,
                    amount: feeAmount,
                    description: `Declaración de IVA/Renta - Período ${period}`
                });
            }, 100);
        }
    };

    const handleExportCSV = () => {
        const targetList = filteredClients;
        if (targetList.length === 0) {
            toast.error("No hay expedientes para exportar");
            return;
        }

        const headers = ["RUC", "Razón Social / Nombre", "Nombre Comercial", "Régimen", "Frecuencia IVA", "Email", "Teléfono", "Fecha Registro", "Estado"];
        const rows = targetList.map(c => [
            `"${c.ruc}"`,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${(c.tradeName || '').replace(/"/g, '""')}"`,
            `"${c.regime || 'General'}"`,
            `"${c.taxProfile?.ivaFrequency || 'Mensual'}"`,
            `"${c.email || ''}"`,
            `"${c.phones?.[0] || c.phones?.join('; ') || ''}"`,
            `"${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}"`,
            `"${(c.isActive ?? true) ? 'Activo' : 'Inactivo'}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Directorio_Clientes_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`📊 Exportados ${targetList.length} expedientes a CSV`);
    };

    const handleUploadReceipt = (client: Client, period?: string, type?: TaxObligationType) => {
        setReceiptUploadState({ client, period, obligationType: type });
        receiptFileInputRef.current?.click();
    };

    const processReceiptFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !receiptUploadState) return;

        try {
            toast.info('Analizando comprobante...');
            const data = await extractDataFromDeclarationPdf(file);

            // Validar RUC
            if (data.ruc !== receiptUploadState.client.ruc) {
                toast.error(`Error: El RUC del PDF (${data.ruc}) no coincide con el cliente (${receiptUploadState.client.ruc})`);
                return;
            }

            const today = new Date();
            let period = receiptUploadState.period || data.period || getPeriod(receiptUploadState.client, today);
            const nowIso = today.toISOString();

            // CRITICAL FIX: Leer siempre el cliente FRESCO del store
            const freshClient = clients.find(c => c.id === receiptUploadState.client.id) || receiptUploadState.client;
            
            const targetType = receiptUploadState.obligationType || (
                data.formType === 'ICE' ? 'ICE' :
                (data.formType === 'ANEXO_ICE' || data.formType?.includes('ANEXO')) ? 'ANEXO' :
                data.formType === 'PVP' ? 'PVP' :
                (period.includes('-') ? 'IVA' : 'RENTA')
            );

            let type: TaxObligationType = targetType;

            if (targetType === 'ICE') {
                if (!period.includes(':ICE')) {
                    period = `${period.split(':')[0]}:ICE`;
                }
            } else if (targetType === 'ANEXO') {
                if (!period.includes(':ANEXO_ICE') && !period.includes(':ANEXO')) {
                    period = `${period.split(':')[0]}:ANEXO`;
                }
            } else if (targetType === 'PVP') {
                if (!period.includes(':PVP')) {
                    period = `${period.split(':')[0]}:PVP`;
                }
            }

            // Subir PDF al almacenamiento en la nube (Cloudflare R2 / Supabase Storage)
            const uploadedStoredFile = await UnifiedStorageService.uploadFile(
                file,
                file.name,
                'declaraciones',
                {
                    amount: data.amount,
                    period: period,
                    formType: data.formType,
                    sriId: data.id,
                    uploadedAt: nowIso,
                    previewText: data.previewText
                }
            );

            // ELITE FIX: Solo nullear content si ya hay URL en la nube.
            // Si el upload falló y solo tenemos base64, preservarlo como fallback.
            const proofFileObj: StoredFile = {
                ...uploadedStoredFile,
                content: uploadedStoredFile.url ? null : uploadedStoredFile.content
            };

            const history = [...(freshClient.declarations || [])];
            const idx = history.findIndex(d => arePeriodsEqual(d.period, period) && (d.type === type || !d.type));

            const isCortesia = isCourtesyClient(freshClient);
            const entry: Declaration = {
                period,
                type,
                status: isCortesia ? DeclarationStatus.Pagada : DeclarationStatus.Enviada,
                updatedAt: nowIso,
                declaredAt: nowIso,
                is_paid: isCortesia ? true : false,
                paidAt: isCortesia ? nowIso : undefined,
                amount: data.amount || 0,
                transactionId: data.id || `PDF-${Date.now().toString().slice(-4)}`,
                proof_file: proofFileObj
            };

            if (idx > -1) {
                history[idx] = { ...history[idx], ...entry };
            } else {
                history.push(entry);
            }

            const updates: Partial<Client> = { 
                declarations: history,
                vault: [...(freshClient.vault || []), proofFileObj]
            };

            await updateClient(freshClient.id, updates);
            toast.success(isCortesia ? '¡Comprobante validado y guardado en la nube! (Cortesía)' : '¡Comprobante validado y guardado en la nube!');

        } catch (err) {
            console.error("Error procesando PDF:", err);
            toast.error('No se pudo leer el PDF o no es un formato válido del SRI');
        } finally {
            if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
            setReceiptUploadState(null);
        }
    };

    const handleBulkUpload = () => {
        if (bulkFileInputRef.current) bulkFileInputRef.current.click();
    };

    const processBulkReceiptFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const results: BulkUploadResult[] = [];
        const candidateNewClients: CandidateClientItem[] = [];

        for (const file of files) {
            try {
                let isRucCert = false;
                let data: any = null;
                let sriData: any = null;

                // Paso 1: SIEMPRE intentar extracción como certificado de RUC
                try {
                    sriData = await extractDataFromSriPdf(file);
                } catch (_e) {
                    sriData = null;
                }

                // Paso 2: Decidir si es un certificado de RUC
                // Un certificado es válido si tiene RUC y la bandera isCertificate === true
                // O si tiene RUC y no tiene datos de declaración (formType desconocido)
                if (sriData && sriData.ruc && sriData.isCertificate === true) {
                    isRucCert = true;
                    data = sriData;
                }

                // Paso 3: Si NO es certificado de RUC, intentar como declaración
                if (!isRucCert) {
                    try {
                        data = await extractDataFromDeclarationPdf(file);
                    } catch (declErr: any) {
                        // Si tampoco es declaración, pero tiene datos de RUC, tratarlo como RUC de todas formas
                        if (sriData && sriData.ruc) {
                            isRucCert = true;
                            data = sriData;
                        } else {
                            throw declErr; // No es ni RUC ni declaración
                        }
                    }
                }


                const base64 = await fileToBase64(file);

                let targetClient = clients.find(c => c.ruc === data.ruc);

                // --- MANEJO DE CERTIFICADO DE RUC ---
                if (isRucCert) {
                    if (!targetClient) {
                        const isSemestral = data.obligaciones_tributarias === 'semestral' || data.regimen === TaxRegime.RimpeEmprendedor;
                        const isPopular = data.regimen === TaxRegime.RimpeNegocioPopular;

                        candidateNewClients.push({
                            id: uuidv4(),
                            name: data.apellidos_nombres || 'Contribuyente Nuevo',
                            tradeName: data.nombre_comercial || '',
                            ruc: data.ruc,
                            regime: data.regimen || TaxRegime.General,
                            phones: [data.contacto?.celular].filter(Boolean) as string[],
                            email: data.contacto?.email || '',
                            address: data.direccion || '',
                            origin: 'ruc_pdf',
                            sourceFileName: file.name,
                            subscriptionType: 'declaraciones_completo',
                            ivaFrequency: isPopular ? 'Ninguno' : (isSemestral ? 'Semestral' : 'Mensual'),
                            requiresAnnualRenta: data.lista_obligaciones?.includes('Impuesto a la Renta') ?? true,
                            isSelected: true,
                            notes: `Importado desde Certificado de RUC SRI. Actividad: ${data.actividad_economica_principal || 'No especificada'}`
                        });

                        results.push({
                            fileName: file.name,
                            status: 'new_client',
                            clientName: data.apellidos_nombres,
                            ruc: data.ruc,
                            period: 'RUC',
                            type: 'CERTIFICADO RUC',
                            phones: [data.contacto?.celular].filter(Boolean) as string[]
                        });
                    } else {
                        // Actualizar cliente existente con datos frescos del RUC
                        updateClient(targetClient.id, {
                            name: data.apellidos_nombres,
                            regime: data.regimen,
                            phones: targetClient.phones && targetClient.phones.length > 0 ? targetClient.phones : [data.contacto.celular].filter(Boolean),
                            email: targetClient.email || data.contacto.email,
                            address: targetClient.address || data.direccion,
                            taxProfile: {
                                ivaFrequency: targetClient.taxProfile?.ivaFrequency || (data.obligaciones_tributarias === 'semestral' ? 'Semestral' : 'Mensual'),
                                requiresAnnualRenta: targetClient.taxProfile?.requiresAnnualRenta ?? false,
                                requiresAnexosGastos: targetClient.taxProfile?.requiresAnexosGastos ?? false,
                                hasActiveDevolucionIva: targetClient.taxProfile?.hasActiveDevolucionIva ?? false,
                                hasActiveElderlyDevolucionIva: targetClient.taxProfile?.hasActiveElderlyDevolucionIva ?? false,
                                requiresIce: targetClient.taxProfile?.requiresIce ?? false,
                                requiresAnexoPvp: targetClient.taxProfile?.requiresAnexoPvp ?? false,
                            }
                        });

                        results.push({
                            fileName: file.name,
                            status: 'success',
                            clientName: data.apellidos_nombres,
                            ruc: data.ruc,
                            period: 'RUC',
                            type: 'CERTIFICADO RUC',
                            phones: targetClient.phones
                        });
                    }
                    continue; // Skip declaration logic for this file
                }

                // --- MANEJO DE COMPROBANTE DE DECLARACIÓN ---
                const period = data.period;
                const nowIso = new Date().toISOString();

                // Subir comprobante a la nube
                const uploadedStoredFile = await UnifiedStorageService.uploadFile(
                    file,
                    file.name,
                    'declaraciones',
                    {
                        amount: data.amount,
                        period: period,
                        formType: data.formType,
                        sriId: data.id,
                        uploadedAt: nowIso,
                        previewText: data.previewText
                    }
                );

                const proofFileObj: StoredFile = {
                    ...uploadedStoredFile,
                    content: uploadedStoredFile.url ? null : uploadedStoredFile.content
                };

                const entry: Declaration = {
                    period,
                    type: (data.formType === 'IVA' ? 'IVA' : (data.formType === 'RENTA' ? 'RENTA' : ((data.formType?.includes('ANEXO') || data.formType === 'ANEXO_ICE') ? 'ANEXO' : (period.includes('-') ? 'IVA' : 'RENTA')))),
                    status: DeclarationStatus.Enviada,
                    updatedAt: nowIso,
                    declaredAt: nowIso,
                    is_paid: false,
                    amount: data.amount || 0,
                    transactionId: data.id || `PDF-${Date.now().toString().slice(-4)}`,
                    proof_file: proofFileObj
                };

                if (!targetClient) {
                    // CLIENTE NUEVO DESDE COMPROBANTE: Añadir a lista de aprobación masiva con selector de suscripción
                    candidateNewClients.push({
                        id: uuidv4(),
                        name: data.clientName || 'NUEVO CLIENTE (SRI)',
                        ruc: data.ruc,
                        regime: TaxRegime.General,
                        phones: [''],
                        email: '',
                        address: '',
                        origin: 'declaracion_pdf',
                        sourceFileName: file.name,
                        subscriptionType: 'declaraciones_completo',
                        ivaFrequency: data.frequency || 'Mensual',
                        requiresAnnualRenta: true,
                        initialDeclaration: entry,
                        isSelected: true,
                        notes: `Detectado desde Comprobante de Declaración SRI (${data.formType || 'DECL'} ${data.period || ''})`
                    });

                    results.push({
                        fileName: file.name,
                        status: 'new_client',
                        clientName: data.clientName || 'Nuevo Cliente Detectado',
                        ruc: data.ruc,
                        period: formatPeriodForDisplay(period),
                        type: data.formType,
                        amount: data.amount,
                        is_paid: false,
                        proof_file: proofFileObj
                    });
                    continue;
                }

                const history = [...(targetClient.declarations || [])];
                const idx = history.findIndex(d => d.period === period);

                // Detección de Duplicados
                const isDuplicate = history.some(d => arePeriodsEqual(d.period, period) && d.proof_file?.metadata?.sriId === data.id);

                // Determine payment status
                const existingDecl = history.find(d => d.period === period);
                const isAlreadyPaid = existingDecl ? !!existingDecl.is_paid : false;

                if (isDuplicate) {
                    results.push({
                        fileName: file.name,
                        status: 'duplicate',
                        clientName: targetClient.name,
                        ruc: targetClient.ruc,
                        period: formatPeriodForDisplay(period),
                        type: data.formType,
                        amount: data.amount,
                        is_paid: isAlreadyPaid,
                        phones: targetClient.phones
                    });
                    continue;
                }

                const updatedEntry: Declaration = {
                    ...entry,
                    status: isAlreadyPaid ? DeclarationStatus.Pagada : DeclarationStatus.Enviada,
                    is_paid: isAlreadyPaid
                };

                if (idx > -1) {
                    history[idx] = { ...history[idx], ...updatedEntry };
                } else {
                    history.push(updatedEntry);
                }

                const updates: Partial<Client> = { 
                    declarations: history,
                    vault: [...(targetClient.vault || []), proofFileObj]
                };

                updateClient(targetClient.id, updates);

                results.push({
                    fileName: file.name,
                    status: 'success',
                    clientName: targetClient.name,
                    ruc: targetClient.ruc,
                    period: formatPeriodForDisplay(period),
                    type: data.formType,
                    amount: data.amount,
                    is_paid: isAlreadyPaid,
                    phones: targetClient.phones,
                    proof_file: proofFileObj
                });

            } catch (err) {
                console.error("Error processing bulk file:", file.name, err);
                results.push({
                    fileName: file.name,
                    status: 'error',
                    error: 'Error de lectura o formato inválido SRI'
                });
            }
        }

        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';

        if (candidateNewClients.length > 0) {
            setBulkWizardData(candidateNewClients);
            setIsBulkWizardOpen(true);
            setBulkResults(results);
        } else if (results.length > 0) {
            setBulkResults(results);
            setIsBulkReportOpen(true);
        }
    };

    const handleAddComboTask = (selectedClientId: string) => {
        navigate('tasks', {
            initialTaskData: {
                clientId: selectedClientId,
                title: 'Combo Devolución Impuesto a la Renta',
                description: `SERVICIO COMBO ($25.00) INCLUYE:
1. Elaboración Anexo de Gastos Personales.
2. Trámite de Devolución de Retenciones de la Fuente.
3. Declaración de Impuesto a la Renta.`,
                cost: 25.00,
                status: 'Pendiente' as any
            }
        });
        setIsComboModalOpen(false);
    };

    // El detalle ahora se renderiza como un overlay al final para no desmontar la lista y preservar scroll/estado

    return (
        <div className="bg-surface-lowest min-h-screen flex flex-col lg:flex-row max-w-[1600px] mx-auto">
            
            {/* PANEL IZQUIERDO (Lista de Clientes) */}
            <div className="flex-1 transition-all duration-500 w-full max-w-7xl mx-auto px-2 sm:px-6">
                <div className="py-6 sm:py-8">
            {/* ZENITH CLIENT MANAGEMENT - ARCHITECTURAL HEADER */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-1 sm:px-0 mb-8 sm:mb-12"
            >
                <div>
                    <div className="flex items-center justify-between sm:justify-start gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-primary/5 border border-primary/10 shadow-tactical">
                            <motion.div 
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_rgba(43,106,255,0.6)]"
                            ></motion.div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.25em] font-premium">SISTEMA CORE</span>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-40 sm:block hidden font-premium">• PROTOCOLO ZENITH</span>
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-premium font-extrabold text-on-surface leading-[1.05] tracking-tighter mb-4">
                        Directorio <span className="text-primary italic font-light">Tributario</span>
                    </h2>
                    <div className="flex items-center gap-4 text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.2em] font-premium">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-low/50 backdrop-blur-md rounded-lg border border-outline-variant/30">
                            <Shield size={12} className="text-tertiary" />
                            <span>MANTENIMIENTO ACTIVOS</span>
                        </div>
                        <span className="px-3 py-1.5 bg-tertiary/10 text-tertiary rounded-lg border border-tertiary/20">{sortedClients.length} EXPEDIENTES</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleExportCSV}
                        title="Exportar directorio visible a CSV"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 rounded-[1.2rem] bg-surface-low text-on-surface hover:text-emerald-500 font-bold text-[11px] uppercase tracking-wider border border-outline-variant hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all shadow-sm font-premium"
                    >
                        <FileSpreadsheet size={16} className="text-emerald-500" />
                        <span>CSV Excel</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCopyRucs}
                        title="Copiar todos los RUCs filtrados al portapapeles"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 rounded-[1.2rem] bg-surface-low text-on-surface hover:text-sky-500 font-bold text-[11px] uppercase tracking-wider border border-outline-variant hover:border-sky-500/30 hover:bg-sky-500/5 transition-all shadow-sm font-premium"
                    >
                        <Copy size={16} className="text-sky-500" />
                        <span>Copiar RUCs</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsGlobalUploadOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-[1.2rem] bg-surface-low text-on-surface font-bold text-[11px] uppercase tracking-[0.15em] border border-outline-variant hover:bg-surface-medium transition-all shadow-sm font-premium cursor-pointer"
                    >
                        <UploadCloud size={16} className="text-[#00A896]" />
                        SUBIR PDFs / RUCs
                    </motion.button>
                    
                    <motion.button 
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-[1.2rem] bg-primary text-white shadow-tactical font-bold text-[11px] uppercase tracking-[0.15em] transition-all font-premium relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <PlusCircle size={16} strokeWidth={2.5} />
                        NUEVO CLIENTE
                    </motion.button>
                </div>
            </motion.div>

            {/* ACTIVE FILTER BANNER - Architect Mode */}
            {initialFilter && (
                <div className="mb-8 animate-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center justify-between p-6 rounded-[2rem] bg-surface-low border border-primary/20 shadow-architect">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-primary text-white shadow-architect-lg">
                                <Filter size={20} />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.25em] font-premium mb-1">
                                    FILTRO ESTRATÉGICO
                                </h4>
                                <p className="text-sm font-bold text-on-surface uppercase tracking-tight font-premium">
                                    {initialFilter.title || 'VISTA ANALÍTICA'} • {sortedClients.length} RESULTADOS
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate('clients', { initialFilter: null })}
                            className="px-6 py-3 rounded-2xl bg-surface-medium text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary border border-outline-variant transition-all font-premium active:scale-95"
                        >
                            RESETEAR VISTA
                        </button>
                    </div>
                </div>
            )}


            {/* TACTICAL COMMAND BAR - Barra Unificada Sin Redundancia v5.0 */}
            <div className="bg-surface p-4 sm:p-5 rounded-[2rem] border border-outline-variant/30 flex flex-col xl:flex-row gap-5 items-center justify-between mb-8 mx-1 sm:mx-0 shadow-sm relative z-20">
                {/* BUSCADOR INTEGRADO Y FILTROS UNIFICADOS DE CLIENTES */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full xl:w-auto overflow-x-auto no-scrollbar">
                    {/* Buscador Rápido de Directorio con Atajo Ctrl+K */}
                    <div className="relative flex items-center min-w-[260px] sm:min-w-[320px]">
                        <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por RUC, nombre, cédula... (Ctrl+K)"
                            className="w-full pl-10 pr-20 py-2.5 bg-surface-medium border border-outline-variant/30 rounded-2xl text-xs font-bold text-on-surface placeholder:text-slate-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                        <div className="absolute right-2.5 flex items-center gap-1">
                            {searchTerm ? (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                    title="Limpiar Búsqueda"
                                >
                                    <X size={12} />
                                </button>
                            ) : (
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-400 bg-surface-low border border-outline-variant/40 rounded-md">
                                    ⌘K
                                </kbd>
                            )}
                        </div>
                    </div>

                    <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1.5 bg-surface-medium rounded-2xl border border-outline-variant/20 shrink-0">
                        {[
                            { id: 'matrix', label: '📊 Matriz Declaraciones', icon: LayoutGrid },
                            { id: 'all', label: 'Todos', icon: Users },
                            { id: 'al-dia', label: 'Al Día', icon: CheckCircle2 },
                            { id: 'vencidos', label: 'Alertas SRI', icon: AlertTriangle, badge: globalStats.vencidos, badgeStyle: 'bg-rose-500/20 text-rose-500 dark:text-rose-400' },
                            { id: 'mensual', label: 'IVA Mensual' },
                            { id: 'semestral', label: 'IVA Semestral' },
                            { id: 'renta', label: 'Renta' },
                            { id: 'rimpe_emp', label: '🏢 RIMPE Emp.', icon: Building2 },
                            { id: 'rimpe_np', label: '🏪 RIMPE NP', icon: Store },
                            { id: 'general', label: '🏛️ Rég. General', icon: Briefcase },
                            { id: 'solo_plan', label: 'Solo Plan / Firma', icon: Zap, badge: soloPlanCount, badgeStyle: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
                            { id: 'trash', label: 'Papelera', icon: Trash2, badge: trashCount, badgeStyle: 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300' },
                        ].map((tab) => {
                            const isSelected = activeGroupTab === tab.id || 
                                (tab.id === 'all' && activeGroupTab === 'directorio') || 
                                (tab.id === 'trash' && activeGroupTab === 'papelera');
                            const Icon = tab.icon;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveGroupTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 shrink-0 ${
                                        isSelected
                                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    {Icon && <Icon size={14} />}
                                    <span>{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                            isSelected ? 'bg-white/20 text-white' : tab.badgeStyle || 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* BANNER EJECUTIVO DE CAMPAÑA RENTA RIMPE NEGOCIO POPULAR (ENERO - MAYO) */}
                    {activeGroupTab === 'rimpe_np' && (
                        <div className="my-4 w-full bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 backdrop-blur-2xl rounded-3xl p-5 border border-amber-500/20 shadow-sm animate-in fade-in duration-300">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
                                        <Store size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                            Campaña Renta RIMPE Negocio Popular
                                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase rounded-lg border border-amber-500/30">
                                                Enero - Mayo
                                            </span>
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                            Sin IVA mensual ni semestral. Presentan <strong>1 sola declaración anual de Renta</strong> entre Enero y Mayo.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contribuyentes</p>
                                        <p className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                                            {filteredClients.length} Clientes NP
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const whatsappMsg = encodeURIComponent(
                                                `Estimado cliente RIMPE Negocio Popular, le recordamos que se encuentra activo el período de Declaración Anual de Impuesto a la Renta (Enero - Mayo). Por favor contáctenos para proceder.`
                                            );
                                            window.open(`https://wa.me/?text=${whatsappMsg}`, '_blank');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 shrink-0"
                                    >
                                        <MessageCircle size={14} />
                                        <span>WhatsApp Recordatorio NP</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions & Toggles */}
                <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
                    {searchTerm && (
                        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-xl transition-all duration-300 animate-in fade-in slide-in-from-right-4 shadow-sm shrink-0">
                            <Search size={11} className="animate-pulse" />
                            <span className="text-[9px] font-bold uppercase tracking-wider font-premium">Búsqueda:</span>
                            <span className="text-[11px] font-black font-mono tracking-tight">{searchTerm}</span>
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="p-0.5 hover:bg-primary/20 rounded transition-all ml-1"
                                title="Limpiar Búsqueda"
                            >
                                <X size={10} strokeWidth={3} />
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        className={`p-3.5 rounded-xl transition-all border
                            ${isFilterPanelOpen 
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                : 'bg-surface-medium text-slate-500 border-outline-variant/30 hover:text-slate-700'}`}
                        title="Filtros Avanzados"
                    >
                        <Filter size={18} />
                    </button>
                    <div className="relative" ref={sortMenuRef}>
                        <button
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                            className="p-3.5 bg-surface-medium border border-outline-variant/30 rounded-xl text-slate-500 hover:text-slate-700 transition-all"
                            title="Ordenar"
                        >
                            <ArrowUpDown size={18} />
                        </button>
                        {isSortMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 p-2 z-50">
                                {[
                                    { id: '9th_digit', label: 'Por Vencimiento' },
                                    { id: 'name', label: 'Alfabético' },
                                    { id: 'pending_obligations', label: 'SRI Pendientes' },
                                    { id: 'pending_payments', label: 'Cobros Pendientes' }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setSortOption(opt.id as any); setIsSortMenuOpen(false); }} 
                                        className={`w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${sortOption === opt.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex bg-surface-medium p-1 rounded-xl border border-outline-variant/20">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}
                        >
                            <LayoutList size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`p-2.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expandable Advanced Filters Panel */}
            <AnimatePresence>
                {isFilterPanelOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-surface border border-outline-variant/30 rounded-[2rem] p-6 mb-8 mx-1 sm:mx-0 flex flex-col md:flex-row gap-6 items-start md:items-center overflow-hidden"
                    >
                        <div className="flex-1 w-full">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Filtro de Régimen Tributario</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'all', label: 'Todos' },
                                    { id: TaxRegime.General, label: 'General' },
                                    { id: TaxRegime.RimpeEmprendedor, label: 'Rimpe Emp.' },
                                    { id: TaxRegime.RimpeNegocioPopular, label: 'Rimpe N.P.' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setRegimeFilter(opt.id as any)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border
                                            ${regimeFilter === opt.id 
                                                ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-black dark:border-white shadow-md' 
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-500'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Filtro de Estado</label>
                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                                {[
                                    { id: 'all', label: 'Todos' },
                                    { id: 'active', label: 'Activos' },
                                    { id: 'inactive', label: 'Inactivos' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setFilterOption(opt.id as any)}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                            ${filterOption === opt.id 
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                                                : 'text-slate-400'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* IVA MENSUAL PROGRESS WORKFLOW - Zen Mode */}
            {
                activeGroupTab === 'mensual' && (
                    <div className="mb-6 p-6 glass-zen rounded-3xl border border-primary/10 animate-fade-in shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Ritmo de Gestión Tributaria • {safeFormat(new Date(), 'MMMM')}</span>
                                    <span className="text-xs font-bold text-primary">{sortedClients.filter(c => {
                                        const d = (c.declarations ?? []).find(dh => dh.period === getPeriod(c, new Date()));
                                        return !!d?.proof_file || d?.status === DeclarationStatus.Enviada;
                                    }).length} / {sortedClients.length}</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(134,167,137,0.4)]"
                                        style={{
                                            width: `${(sortedClients.filter(c => {
                                                const d = (c.declarations ?? []).find(dh => dh.period === getPeriod(c, new Date()));
                                                return !!d?.proof_file || d?.status === DeclarationStatus.Enviada;
                                            }).length / (sortedClients.length || 1)) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ZENITH COMBO BANNER - WARM GROWTH */}
            {
                activeGroupTab === 'renta' && (
                    <div className="mb-8 p-6 sm:p-8 glass-zen rounded-3xl border border-primary/20 animate-fade-in-down flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-primary/20">Protocolo de Crecimiento</span>
                                <span className="text-2xl font-premium font-semibold text-slate-800 dark:text-white">Combo <span className="text-primary italic font-light">Devolución</span></span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-md leading-relaxed">
                                Reduzca la carga fiscal: Declaración de Renta + Anexo de Gastos + Gestión de Devolución. Todo en un solo flujo.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsComboModalOpen(true)}
                            className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all duration-500 flex items-center justify-center gap-3 text-[11px] uppercase tracking-widest"
                        >
                            <Sparkles size={18} /> Iniciar Gestión $25.00
                        </button>
                    </div>
                )
            }

            {/* PAPELERA BANNER */}
            {activeGroupTab === 'trash' && sortedClients.length > 0 && (
                <div className="mb-8 p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-800/30 rounded-3xl flex justify-between items-center animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-rose-750 dark:text-rose-450 uppercase tracking-widest">Papelera de Reciclaje</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Los clientes aquí eliminados no serán tomados en cuenta para las métricas fiscales.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (window.confirm("¿Está seguro de eliminar permanentemente todos los clientes en la papelera? Esta acción no se puede deshacer.")) {
                                purgeTrash();
                                toast.success("Papelera vaciada por completo");
                            }
                        }}
                        className="px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                    >
                        Vaciar Papelera
                    </button>
                </div>
            )}

            {/* Client Grid or List */}
            {/* Contenido Dinámico Consolidado - Zenith Command Center */}
            <AnimatePresence mode="wait">
                {isMatrixView ? (
                    <motion.div
                        key="matrix"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="pb-20"
                    >
                        <TaxComplianceMatrix 
                            clients={sortedClients} 
                            onViewClient={handleOpenClientDetails}
                            initialMode={activeGroupTab === 'renta' ? 'RENTA' : 'IVA'}
                            onUploadReceipt={handleUploadReceipt}
                            onPreviewReceipt={async (client, declaration) => {
                                if (declaration.proof_file) {
                                    const ok = await downloadStoredFile(declaration.proof_file);
                                    if (ok) {
                                        toast.success("Comprobante descargado correctamente");
                                    } else {
                                        toast.error("El archivo del comprobante no se pudo procesar");
                                    }
                                } else {
                                    toast.info("Este comprobante fue registrado sin un archivo PDF adjunto");
                                }
                            }}
                            onTogglePayment={handleTogglePaymentFromMatrix}
                            onTogglePriority={handleTogglePriorityFromMatrix}
                            onNavigateToBilling={(clientRuc, period, description) => {
                                const client = clients.find(c => c.ruc === clientRuc);
                                const fee = client ? getClientServiceFee(client, serviceFees) : 5;
                                if (navigate) {
                                    navigate('sri_facturacion', {
                                        clientId: client?.id || clientRuc,
                                        amount: fee,
                                        description: description || `DECLARACION IVA ${period || ''}`
                                    });
                                }
                            }}
                        />
                    </motion.div>
                ) : isWorkspaceView ? (
                    <motion.div
                        key="workspace"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                        className="pb-20"
                    >
                        {activeGroupTab === 'all' ? (
                            <ClientsDashboard
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onExportCSV={handleExportCSV}
                            />
                        ) : viewMode === 'list' ? (
                            <VirtualClientTable
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onQuickAction={handleQuickAction}
                                onUploadReceipt={handleUploadReceipt}
                                frequency={frequencyForList}
                                isTrashView={activeGroupTab === 'trash'}
                                isCobrosView={false}
                            />
                        ) : (
                            <VirtualClientList
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onQuickAction={handleQuickAction}
                                onUploadReceipt={handleUploadReceipt}
                                frequency={frequencyForList}
                                isTrashView={activeGroupTab === 'trash'}
                                isCobrosView={false}
                            />
                        )}
                    </motion.div>
                ) : isCobrosView ? (
                    <motion.div
                        key="cobros"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-12 pb-20"
                    >
                        {/* SECCIÓN COBRO PENDIENTE */}
                        <section className="px-1">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500 shadow-sm border border-orange-500/20">
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em] font-premium mb-1">
                                            RECAUDACIÓN CRÍTICA
                                        </h3>
                                        <p className="text-lg font-bold text-on-surface uppercase tracking-tight font-premium">
                                            COBROS PENDIENTES DE LIQUIDACIÓN
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-2 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-500 font-bold text-xs font-premium">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    {sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = (c.declarations ?? []).find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    }).length} PENDIENTES
                                </div>
                            </div>
                            
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = (c.declarations ?? []).find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                    isCobrosView={true}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = (c.declarations ?? []).find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                    isCobrosView={true}
                                />
                            )}
                        </section>

                        {/* SECCIÓN AL DÍA (ELITE) */}
                        <section>
                            <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] font-premium mb-1">
                                            SEGURIDAD NIVEL ELITE
                                        </h3>
                                        <p className="text-lg font-bold text-on-surface uppercase tracking-tight font-premium">
                                            EXPEDIENTES EN ARMONÍA TOTAL
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = (c.declarations ?? []).find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                    isCobrosView={true}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = (c.declarations ?? []).find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                    isCobrosView={true}
                                />
                            )}
                        </section>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <input
                type="file"
                ref={receiptFileInputRef}
                onChange={processReceiptFile}
                accept="application/pdf"
                className="sr-only"
            />

            <input
                type="file"
                ref={bulkFileInputRef}
                onChange={processBulkReceiptFiles}
                accept="application/pdf"
                multiple
                className="sr-only"
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Agregar Nuevo Cliente"
                size="4xl"
            >
                <ClientForm
                    onSubmit={handleCreateClient}
                    onCancel={() => setIsModalOpen(false)}
                    initialData={initialClientData || undefined}
                    sriCredentials={sriCredentials}
                />
            </Modal>

            {/* Modal para Combo */}
            <Modal isOpen={isComboModalOpen} onClose={() => setIsComboModalOpen(false)} title="Vender Combo Devolución">
                <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        Seleccione un cliente existente para generar la tarea del Combo ($25.00) o cree uno nuevo.
                    </p>

                    <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                        {clients.filter(c => c.isActive).map(c => (
                            <button
                                key={c.id}
                                onClick={() => handleAddComboTask(c.id)}
                                className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors group text-left"
                            >
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-white text-sm">{c.name}</p>
                                    <p className="text-xs text-slate-500">{c.ruc}</p>
                                </div>
                                <span className="text-emerald-500 opacity-0 group-hover:opacity-100 font-medium text-xs">Seleccionar →</span>
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-2">
                        <button
                            onClick={() => { setIsComboModalOpen(false); setIsModalOpen(true); }}
                            className="w-full py-3 bg-brand-navy text-white font-medium rounded-xl flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Crear Nuevo Cliente con Tarifa Pro
                        </button>
                    </div>
                </div>
            </Modal>

            <BulkUploadReportModal
                isOpen={isBulkReportOpen}
                onClose={() => setIsBulkReportOpen(false)}
                results={bulkResults}
            />

            <BulkClientWizardModal
                isOpen={isBulkWizardOpen}
                onClose={() => {
                    setIsBulkWizardOpen(false);
                    setBulkWizardData([]);
                    if (bulkResults.length > 0) {
                        setIsBulkReportOpen(true);
                    }
                }}
                candidates={bulkWizardData}
                onApproveBatch={(approvedClients) => {
                    approvedClients.forEach(c => addClient(c));
                    toast.success(`🎉 ${approvedClients.length} nuevos clientes aprobados e integrados.`);
                }}
            />

            <GlobalUploadModal
                isOpen={isGlobalUploadOpen}
                onClose={() => setIsGlobalUploadOpen(false)}
            />

            </div> {/* End of inner padding container */}
            </div> {/* End of LEFT PANE */}

            {/* RIGHT PANE: COMMAND CENTER DETAIL (FULL SCREEN OVERLAY) */}
            {selectedClient && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
                    <div className="w-full h-full max-w-[1600px] bg-white dark:bg-[#020617] shadow-2xl sm:rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10 relative flex flex-col animate-in zoom-in-[0.98] duration-300 my-auto">
                        <ClientDetailView 
                            client={selectedClient} 
                            onSave={handleUpdateClient} 
                            onBack={handleCloseClientDetails} 
                            serviceFees={serviceFees} 
                            sriCredentials={sriCredentialsProp || sriCredentials}
                            initialTab={(window as any).__TEMP_INITIAL_TAB__ || initialTab}
                        />
                    </div>
                </div>,
                document.body
            )}

            {previewItem && (
                <PdfPreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    client={previewItem.client}
                    declaration={previewItem.declaration}
                    onDownload={() => {
                        if (previewItem?.declaration?.proof_file) {
                            downloadStoredFile(previewItem.declaration.proof_file);
                        }
                    }}
                />
            )}
            {billingPromptData && (
                <Modal 
                    isOpen={!!billingPromptData} 
                    onClose={() => setBillingPromptData(null)} 
                    title="🧾 Facturación Electrónica SRI"
                >
                    <div className="p-6 space-y-6 text-slate-800 dark:text-slate-200 text-left">
                        <div className="text-center space-y-2">
                            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                                <FileText size={24} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white font-premium">
                                Generar Factura SRI
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Se ha registrado un pago con éxito. ¿Cómo desea proceder?
                            </p>
                        </div>

                        {/* Detalle del Pago */}
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-2 text-[10px] font-mono leading-relaxed text-slate-600 dark:text-slate-400">
                            <div><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Cliente:</strong> {billingPromptData.client.name}</div>
                            <div><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Valor Recibido:</strong> ${billingPromptData.amount.toFixed(2)}</div>
                            <div><strong className="text-slate-400 font-sans uppercase tracking-wider text-[8px] block">Detalle:</strong> {billingPromptData.description}</div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {/* Option 1: Solo este pago */}
                            <button
                                type="button"
                                onClick={() => {
                                    const client = billingPromptData.client;
                                    const amount = billingPromptData.amount;
                                    const desc = billingPromptData.description;
                                    setBillingPromptData(null);
                                    navigate('sri_facturacion', {
                                        clientId: client.id,
                                        amount: amount,
                                        description: desc
                                    });
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-gradient-azure text-white rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all active:scale-[0.99]"
                            >
                                <Check size={14} strokeWidth={3} />
                                Facturar Solo Este Pago
                            </button>

                            {/* Option 2: Incluir más pendientes */}
                            <button
                                type="button"
                                onClick={() => {
                                    const client = billingPromptData.client;
                                    setBillingPromptData(null);
                                    navigate('sri_facturacion', {
                                        clientId: client.id
                                    });
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all active:scale-[0.99]"
                            >
                                <Plus size={14} />
                                Facturar y Elegir Más Obligaciones
                            </button>

                            {/* Option 3: Cerrar */}
                            <button
                                type="button"
                                onClick={() => setBillingPromptData(null)}
                                className="w-full py-3 bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider font-premium transition-all"
                              >
                                Solo Registrar Pago (Cerrar)
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div >
    );
};