import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, DeclarationStatus, Declaration, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, TranscribableField } from '../types';
import * as LucideIcons from 'lucide-react';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod, getIdentifierSortKey, fetchSRIPublicData, safeFormat } from '../services/sri';
import { Modal } from '../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { isPast, subMonths, subYears } from 'date-fns';
import { getClientServiceFee } from '../services/clientService';
import { useTranscription } from '../hooks/useTranscription';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClientDetailView } from '../components/features/ClientDetailView';
import { ClientForm } from '../components/features/ClientForm';
import { useToast } from '../context/ToastContext';
import { VirtualClientList } from '../components/features/VirtualClientList';
import { VirtualClientTable } from '../components/features/VirtualClientTable';
import { ClientCard } from '../components/features/ClientCard';
import { extractDataFromDeclarationPdf, fileToBase64, extractDataFromSriPdf } from '../services/pdfExtraction';
import { StoredFile } from '../types';
import { BulkUploadReportModal, BulkUploadResult } from '../components/features/BulkUploadReportModal';
import { motion, AnimatePresence } from 'framer-motion';
import { TaxComplianceMatrix } from '../components/features/TaxComplianceMatrix';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { getClientDebtSummary, getClientUndeclaredSummary } from '../services/complianceEngine';
import { useCampaignContext } from '../hooks/useCampaignContext';
import { CampaignBanner } from '../components/ui/CampaignBanner';
import { useDebounce } from '../hooks/useDebounce';

const OBLIGATION_GROUPS = [
    { id: 'all', label: 'Todos', icon: LucideIcons.Users, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'vencidos', label: 'Vencidos', icon: LucideIcons.AlertCircle, color: 'text-primary bg-primary/10 ring-primary/20' },
    { id: 'ordenes', label: 'Órdenes', icon: LucideIcons.Zap, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'cobros', label: 'Por Cobrar', icon: LucideIcons.Sparkles, color: 'text-accent bg-accent/10 ring-accent/20' },
    { id: 'al-dia', label: 'Al Día', icon: LucideIcons.ShieldCheck, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Clock, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Briefcase, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'matrix', label: 'Matriz Fiscal', icon: LucideIcons.LayoutGrid, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'trash', label: 'Papelera', icon: LucideIcons.Trash2, color: 'text-primary bg-primary/10 ring-primary/20' },
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
}

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
    initialFilter,
    navigate,
    initialClientData,
    clearInitialClientData,
    clientToView,
    clearClientToView,
    sriCredentialsProp,
    initialTab
}) => {
    const { clients, setClients, updateClient, addClient, removeClient, restoreClient, purgeTrash, serviceFees, sriCredentials: storeCredentials } = useAppStore();
    const sriCredentials = sriCredentialsProp || storeCredentials;
    const { toast } = useToast();
    // ── CAMPAÑA INTELIGENTE ──
    const campaign = useCampaignContext();
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('clients_search') || '');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const [sortOption, setSortOption] = useState<'9th_digit' | 'name' | 'status' | 'pending_obligations' | 'pending_payments'>(() => (sessionStorage.getItem('clients_sort') as any) || '9th_digit');
    const [filterOption, setFilterOption] = useState<'active' | 'inactive' | 'all'>('active');
    const [isComboModalOpen, setIsComboModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => (sessionStorage.getItem('clients_view_mode') as any) || 'list');
    const receiptFileInputRef = useRef<HTMLInputElement>(null);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [receiptUploadState, setReceiptUploadState] = useState<{ client: Client, period?: string } | null>(null);
    const [bulkResults, setBulkResults] = useState<BulkUploadResult[]>([]);
    const [isBulkReportOpen, setIsBulkReportOpen] = useState(false);
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
    const [isWorkspaceView, setIsWorkspaceView] = useState(false);
    const [isCobrosView, setIsCobrosView] = useState(false);
    const [isAlertasView, setIsAlertasView] = useState(false);
    const [isMatrixView, setIsMatrixView] = useState(false);
    const [previewItem, setPreviewItem] = useState<{ client: Client, declaration: Declaration } | null>(null);

    // Smart Tabs Logic
    const getInitialGroupTab = () => {
        const saved = sessionStorage.getItem('clients_group_tab');
        if (saved) return saved;
        if (!initialFilter) return 'all';
        return 'all';
    };

    const [activeGroupTab, setActiveGroupTab] = useState(getInitialGroupTab());
    const [specificCategoryFilter, setSpecificCategoryFilter] = useState<any | null>(null);
    const [regimeFilter, setRegimeFilter] = useState<TaxRegime | 'all'>('all');

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
        setIsMatrixView(activeGroupTab === 'matrix');
        setIsWorkspaceView(['all', 'mensual', 'semestral', 'al-dia', 'ordenes', 'trash'].includes(activeGroupTab));
        setIsCobrosView(activeGroupTab === 'cobros');
        setIsAlertasView(activeGroupTab === 'vencidos');
    }, [activeGroupTab]);

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
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
            const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
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

    useEffect(() => {
        if (initialClientData) {
            setIsModalOpen(true);
            clearInitialClientData();
        }
    }, [initialClientData, clearInitialClientData]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            // Lógica de Papelera: Si estamos en la pestaña trash, solo mostrar isDeleted.
            // Si NO estamos en trash, ocultar isDeleted.
            if (activeGroupTab === 'trash') {
                if (!client.isDeleted) return false;
            } else {
                if (client.isDeleted) return false;
            }

            const statusMatch = filterOption === 'all' ||
                (filterOption === 'active' && (client.isActive ?? true)) ||
                (filterOption === 'inactive' && !(client.isActive ?? true));
            if (!statusMatch) return false;

            const terms = debouncedSearchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
            const clientName = client.name.toLowerCase();
            const clientRuc = client.ruc;
            const clientTrade = (client.tradeName || "").toLowerCase();
            const clientNotes = (client.notes || "").toLowerCase();

            const searchMatch = terms.length === 0 || terms.every(term =>
                clientName.includes(term) ||
                clientRuc.includes(term) ||
                clientTrade.includes(term) ||
                clientNotes.includes(term)
            );

            if (!searchMatch) return false;

            // SI HAY BÚSQUEDA ACTIVADA, saltamos los filtros de pestañas para mostrar resultados globales
            if (debouncedSearchTerm) return true;

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
                
                const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
                const currentYear = today.getFullYear();
                const rentaPeriod = (currentYear - 1).toString();
                const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
                const isRentaPaid = !needsRenta || !!rentaDecl?.is_paid;
                const isRentaDeclared = !needsRenta || !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;

                return !debtSummary.hasPendingPayment && !undeclaredSummary.hasPendingObligation && isRentaPaid && isRentaDeclared;
            }

            if (activeGroupTab === 'mensual') {
                const isSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor;
                const isAnual = client.taxProfile?.ivaFrequency === 'Ninguno';
                const isNegocioPopular = client.regime === TaxRegime.RimpeNegocioPopular; // RIMPE NP no declara IVA
                if (isSemestral || isAnual || isNegocioPopular) return false;
            } else if (activeGroupTab === 'semestral') {
                const isSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor;
                if (!isSemestral) return false;
            } else if (activeGroupTab === 'renta') {
                const hasRenta = client.taxProfile?.requiresAnnualRenta ||
                    client.regime === TaxRegime.RimpeEmprendedor ||
                    client.regime === TaxRegime.RimpeNegocioPopular ||
                    client.regime === TaxRegime.General;
                const hasDev = client.taxProfile?.hasActiveDevolucionIva;
                const hasAnexo = client.taxProfile?.requiresAnexosGastos;
                if (!hasRenta && !hasDev && !hasAnexo) return false;
            }

            if (regimeFilter !== 'all' && client.regime !== regimeFilter) return false;

            // FILTRO DE AUDITORÍA DE BÓVEDA (Missing PDFs)
            if (initialFilter?.hasMissingPdf) {
                const missingPdf = client.declarations.some(d => 
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
            const decl = client.declarations.find(d => d.period === period);
            
            const isIvaDeclared = !!decl?.proof_file;
            const isIvaPaid = !!decl?.is_paid;

            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular || client.regime === TaxRegime.General);
            const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
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

    const handleOpenClientDetails = (client: Client) => {
        setSelectedClient(client);
        setIsClientDetailsOpen(true);
    };

    const handleCloseClientDetails = () => {
        setIsClientDetailsOpen(false);
        setTimeout(() => setSelectedClient(null), 300);
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
        const idx = history.findIndex(d => d.period === period);
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
    };

    const handleExportCSV = () => {
        const headers = ["RUC", "Nombre", "WhatsApp", "Email", "Régimen", "Frecuencia IVA", "Estado", "Al día desde"];
        const rows = sortedClients.map(c => [
            c.ruc,
            c.name,
            c.phones?.join('; ') || '',
            c.email || '',
            c.regime,
            c.taxProfile?.ivaFrequency || 'Mensual',
            c.isActive ? 'Activo' : 'Inactivo',
            c.clientStartPeriod || ''
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Clientes_Export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Exportación CSV descargada");
    };

    const handleUploadReceipt = (client: Client, period?: string) => {
        setReceiptUploadState({ client, period });
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

            const base64 = await fileToBase64(file);
            const today = new Date();
            const period = receiptUploadState.period || data.period || getPeriod(receiptUploadState.client, today);
            const nowIso = today.toISOString();

            // CRITICAL FIX: Leer siempre el cliente FRESCO del store
            const freshClient = clients.find(c => c.id === receiptUploadState.client.id) || receiptUploadState.client;
            const history = [...(freshClient.declarations || [])];
            const idx = history.findIndex(d => d.period === period);

            const proofFileObj: StoredFile = {
                name: file.name,
                type: 'pdf',
                size: file.size,
                lastModified: file.lastModified,
                content: base64,
                metadata: {
                    amount: data.amount,
                    period: period,
                    formType: data.formType,
                    sriId: data.id,
                    uploadedAt: nowIso,
                    previewText: data.previewText
                }
            };

            const entry: Declaration = {
                period,
                type: period.includes('-') ? 'IVA' : 'RENTA',
                status: DeclarationStatus.Enviada,
                updatedAt: nowIso,
                declaredAt: nowIso,
                is_paid: false,
                amount: data.amount || 0,
                transactionId: data.id || `PDF-${Date.now().toString().slice(-4)}`,
                proof_file: proofFileObj
            };

            if (idx > -1) {
                history[idx] = { ...history[idx], ...entry };
            } else {
                history.push(entry);
            }

            const updates: Partial<Client> = { declarations: history };

            updateClient(freshClient.id, updates);
            toast.success('¡Comprobante validado! Obligación marcada como HECHA (Cobro Pendiente)');

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
                        const newClient: Client = {
                            id: uuidv4(),
                            name: data.apellidos_nombres,
                            ruc: data.ruc,
                            sriPassword: '',
                            regime: data.regimen,
                            isActive: true,
                            phones: [data.contacto.celular].filter(Boolean),
                            email: data.contacto.email,
                            address: data.direccion,
                            notes: `Creado desde Certificado de RUC`,
                            needsVerification: true,
                            verificationReason: 'Registrado automáticamente por Carga Masiva (RUC)',
                            taxProfile: {
                                ivaFrequency: data.obligaciones_tributarias === 'semestral' ? 'Semestral' : 'Mensual',
                                requiresAnnualRenta: data.lista_obligaciones.includes('Impuesto a la Renta'),
                                requiresAnexosGastos: false,
                                hasActiveDevolucionIva: false,
                                hasActiveElderlyDevolucionIva: false,
                                requiresIce: false,
                                requiresAnexoPvp: false
                            },
                            declarations: [],
                            vault: []
                        };
                        addClient(newClient);
                        targetClient = newClient;
                        
                        results.push({
                            fileName: file.name,
                            status: 'new_client',
                            clientName: data.apellidos_nombres,
                            ruc: data.ruc,
                            period: 'RUC',
                            type: 'CERTIFICADO RUC',
                            phones: [data.contacto.celular].filter(Boolean)
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
                                ...targetClient.taxProfile,
                                ivaFrequency: targetClient.taxProfile?.ivaFrequency || (data.obligaciones_tributarias === 'semestral' ? 'Semestral' : 'Mensual'),
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
                if (!targetClient) {
                    // AUTO-REGISTRO: Crear nuevo cliente desde el comprobante
                    const newClient: Client = {
                        id: uuidv4(),
                        name: data.clientName || 'NUEVO CLIENTE (AUTO)',
                        ruc: data.ruc,
                        sriPassword: '',
                        regime: TaxRegime.General,
                        isActive: true,
                        phones: [''],
                        email: '',
                        address: '',
                        notes: `COMPLETAR CON RUC DATOS DE CLIENTE EXTRAIDOS DE COMPROBANTES (Serie: ${data.id})`,
                        needsVerification: true,
                        verificationReason: 'Registrado automáticamente por Carga Rápida',
                        taxProfile: {
                            ivaFrequency: data.frequency,
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
                    addClient(newClient);
                    targetClient = newClient;
                }

                const period = data.period;
                const nowIso = new Date().toISOString();
                const history = [...(targetClient.declarations || [])];
                const idx = history.findIndex(d => d.period === period);

                // Detección de Duplicados
                const isDuplicate = history.some(d => d.period === period && d.proof_file?.metadata?.sriId === data.id);

                // Determine payment status
                const existingDecl = history.find(d => d.period === period);
                const isPaid = !!existingDecl?.is_paid;

                if (isDuplicate) {
                    results.push({
                        fileName: file.name,
                        status: 'duplicate',
                        clientName: targetClient.name,
                        ruc: targetClient.ruc,
                        period: formatPeriodForDisplay(period),
                        type: data.formType,
                        amount: data.amount,
                        is_paid: isPaid,
                        phones: targetClient.phones
                    });
                    continue;
                }

                const proofFileObj: StoredFile = {
                    name: file.name,
                    type: 'pdf',
                    size: file.size,
                    lastModified: file.lastModified,
                    content: base64,
                    metadata: {
                        amount: data.amount,
                        period: period,
                        formType: data.formType,
                        sriId: data.id,
                        uploadedAt: nowIso,
                        previewText: data.previewText
                    }
                };

                const entry: Declaration = {
                    period,
                    type: period.includes('-') ? 'IVA' : 'RENTA',
                    status: DeclarationStatus.Enviada,
                    updatedAt: nowIso,
                    declaredAt: nowIso,
                    is_paid: false,
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
                    is_paid: isPaid,
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

        setBulkResults(results);
        setIsBulkReportOpen(true);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
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
        <div className="bg-surface-lowest min-h-screen">
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
                            <LucideIcons.Shield size={12} className="text-tertiary" />
                            <span>MANTENIMIENTO ACTIVOS</span>
                        </div>
                        <span className="px-3 py-1.5 bg-tertiary/10 text-tertiary rounded-lg border border-tertiary/20">{sortedClients.length} EXPEDIENTES</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBulkUpload}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] bg-surface-low text-on-surface font-bold text-[11px] uppercase tracking-[0.2em] border border-outline-variant hover:bg-surface-medium transition-all duration-500 shadow-sm font-premium"
                    >
                        <LucideIcons.UploadCloud size={18} />
                        SUBIR PDFs / RUCs
                    </motion.button>
                    
                    <motion.button 
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-10 py-5 rounded-[1.5rem] bg-primary text-white shadow-tactical font-bold text-[11px] uppercase tracking-[0.2em] transition-all duration-500 font-premium relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <LucideIcons.PlusCircle size={18} strokeWidth={2.5} />
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
                                <LucideIcons.Filter size={20} />
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


            {/* TACTICAL COMMAND BAR - Unificado */}
            <div className="bg-surface p-4 sm:p-5 rounded-[2rem] border border-outline-variant/30 flex flex-col xl:flex-row gap-5 items-center mb-8 mx-1 sm:mx-0 shadow-sm relative z-20">
                {/* Search Input */}
                <div className="relative flex-1 w-full group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <LucideIcons.Search className="text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={20} />
                    </div>
                    <input 
                        type="text"
                        placeholder="BUSCAR EXPEDIENTE..."
                        className="w-full bg-surface-medium border border-outline-variant/30 rounded-2xl py-4.5 pl-14 pr-6 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-premium tracking-widest uppercase"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Tactical Segmented Control for Tabs - CONTEXTUAL por campaña */}
                <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1.5 bg-surface-medium rounded-2xl border border-outline-variant/20 w-full xl:w-auto shrink-0">
                    {[
                        // Tabs fijas — siempre visibles
                        { id: 'all', label: 'Todos', icon: LucideIcons.Users, always: true },
                        { id: 'al-dia', label: 'Al Día', icon: LucideIcons.ShieldCheck, always: true },
                        { id: 'vencidos', label: 'Alertas', icon: LucideIcons.AlertTriangle, always: true },
                        { id: 'cobros', label: 'Cobros', icon: LucideIcons.DollarSign, always: true },
                        // Tabs contextuales — visibles según campaña activa
                        {
                            id: 'mensual',
                            label: campaign.showMensualTab ? `Mensual` : 'IVA Mensual',
                            icon: campaign.showMensualTab ? LucideIcons.Zap : LucideIcons.Calendar,
                            always: false,
                            showWhen: campaign.showMensualTab || activeGroupTab === 'mensual',
                            isCampaignActive: campaign.showMensualTab,
                            campaignColor: 'violet',
                            badge: campaign.showMensualTab ? globalStats.vencidos : undefined,
                        },
                        {
                            id: 'semestral',
                            label: 'Semestral',
                            icon: LucideIcons.CalendarRange,
                            always: false,
                            // Semestral visible en julio, enero, o si ya está seleccionado
                            showWhen: campaign.showSemestralTab || campaign.isSemestralMonth || activeGroupTab === 'semestral',
                            isCampaignActive: campaign.isSemestralMonth,
                            campaignColor: 'blue',
                            badge: campaign.isSemestralMonth ? (
                                clients.filter(c => !c.isDeleted && c.isActive && c.taxProfile?.ivaFrequency === 'Semestral').length
                            ) : undefined,
                        },
                        {
                            id: 'renta',
                            label: 'Renta',
                            icon: LucideIcons.ShieldCheck,
                            always: false,
                            // Renta visible en mar-jun, o si ya está seleccionado
                            showWhen: campaign.showRentaTab || campaign.isRentaMonth || activeGroupTab === 'renta',
                            isCampaignActive: campaign.isRentaMonth,
                            campaignColor: 'emerald',
                        },
                        // Matriz y papelera siempre disponibles
                        { id: 'matrix', label: 'Matriz', icon: LucideIcons.LayoutGrid, always: true },
                        { id: 'trash', label: 'Papelera', icon: LucideIcons.Trash2, always: true },
                    ]
                    .filter(tab => tab.always || (tab as any).showWhen || activeGroupTab === tab.id)
                    .map((tab) => {
                        const isActive = activeGroupTab === tab.id;
                        const isCampaignActive = (tab as any).isCampaignActive;
                        const campaignColor = (tab as any).campaignColor;
                        const badge = (tab as any).badge;

                        const getTabStyle = () => {
                            if (isActive) return 'bg-primary text-white shadow-md';
                            if (isCampaignActive) {
                                const colorMap: Record<string, string> = {
                                    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-400/40',
                                    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-400/40',
                                    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-400/40',
                                };
                                return colorMap[campaignColor] || 'text-slate-500 hover:text-slate-700';
                            }
                            return 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5';
                        };

                        const getIconColor = () => {
                            if (isActive) return 'text-white';
                            if (isCampaignActive) {
                                const colorMap: Record<string, string> = {
                                    violet: 'text-violet-500',
                                    blue: 'text-blue-500',
                                    emerald: 'text-emerald-500',
                                };
                                return colorMap[campaignColor] || 'text-slate-400';
                            }
                            return 'text-slate-400';
                        };

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveGroupTab(tab.id as any)}
                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${getTabStyle()}`}
                            >
                                {/* Pulse ring para campaña activa */}
                                {isCampaignActive && !isActive && (
                                    <div className="absolute inset-0 rounded-xl animate-pulse opacity-30"
                                        style={{
                                            background: campaignColor === 'blue' ? 'rgba(59,130,246,0.15)' :
                                                        campaignColor === 'emerald' ? 'rgba(16,185,129,0.15)' :
                                                        'rgba(139,92,246,0.15)'
                                        }}
                                    />
                                )}
                                <tab.icon size={14} className={getIconColor()} />
                                <span>{tab.label}</span>
                                {/* Badge de conteo si hay campaña activa */}
                                {badge !== undefined && badge > 0 && (
                                    <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${
                                        isActive
                                            ? 'bg-white/25 text-white'
                                            : campaignColor === 'blue' ? 'bg-blue-500 text-white'
                                            : campaignColor === 'violet' ? 'bg-violet-500 text-white'
                                            : 'bg-emerald-500 text-white'
                                    }`}>{badge}</span>
                                )}
                                {/* Punto pulsante para semestral en mes activo */}
                                {isCampaignActive && !isActive && badge === undefined && (
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                        campaignColor === 'blue' ? 'bg-blue-400' :
                                        campaignColor === 'emerald' ? 'bg-emerald-400' :
                                        'bg-violet-400'
                                    }`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Actions & Toggles */}
                <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
                    <button 
                        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        className={`p-3.5 rounded-xl transition-all border
                            ${isFilterPanelOpen 
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                : 'bg-surface-medium text-slate-500 border-outline-variant/30 hover:text-slate-700'}`}
                        title="Filtros Avanzados"
                    >
                        <LucideIcons.Filter size={18} />
                    </button>
                    <div className="relative" ref={sortMenuRef}>
                        <button
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                            className="p-3.5 bg-surface-medium border border-outline-variant/30 rounded-xl text-slate-500 hover:text-slate-700 transition-all"
                            title="Ordenar"
                        >
                            <LucideIcons.ArrowUpDown size={18} />
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
                            <LucideIcons.LayoutList size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`p-2.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}
                        >
                            <LucideIcons.LayoutGrid size={16} />
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

            {/* MINI HEALTH DASHBOARD (Only visible when Al Día, Vencidos or Por Cobrar is selected to provide context) */}
            {['all', 'al-dia', 'vencidos', 'cobros', 'ordenes'].includes(activeGroupTab) && (
                <div className="mb-8 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
                                <LucideIcons.ShieldCheck size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Cartera en Orden</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white">{globalStats.elite} Clientes</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 rounded-3xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/30">
                                <LucideIcons.AlertTriangle size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Alertas SRI</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white">{globalStats.vencidos} Clientes</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/30">
                                <LucideIcons.DollarSign size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Cobros Pendientes</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white">{globalStats.cobros} Clientes</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* IVA MENSUAL PROGRESS WORKFLOW - Zen Mode */}
            {
                activeGroupTab === 'mensual' && (
                    <div className="mb-6 p-6 glass-zen rounded-3xl border border-primary/10 animate-fade-in shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Ritmo de Gestión Tributaria • {safeFormat(new Date(), 'MMMM')}</span>
                                    <span className="text-xs font-bold text-primary">{sortedClients.filter(c => {
                                        const d = c.declarations.find(dh => dh.period === getPeriod(c, new Date()));
                                        return !!d?.proof_file || d?.status === DeclarationStatus.Enviada;
                                    }).length} / {sortedClients.length}</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(134,167,137,0.4)]"
                                        style={{
                                            width: `${(sortedClients.filter(c => {
                                                const d = c.declarations.find(dh => dh.period === getPeriod(c, new Date()));
                                                return !!d?.proof_file || d?.status === DeclarationStatus.Enviada;
                                            }).length / (sortedClients.length || 1)) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSortOption('9th_digit')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${sortOption === '9th_digit' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/5 hover:bg-slate-50'}`}
                                >
                                    Calendario SRI
                                </button>
                                <button
                                    onClick={() => setSortOption('name')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${sortOption === 'name' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/5 hover:bg-slate-50'}`}
                                >
                                    A - Z
                                </button>
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
                            <LucideIcons.Sparkles size={18} /> Iniciar Gestión $25.00
                        </button>
                    </div>
                )
            }

            {/* PAPELERA BANNER */}
            {activeGroupTab === 'trash' && sortedClients.length > 0 && (
                <div className="mb-8 p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-800/30 rounded-3xl flex justify-between items-center animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                            <LucideIcons.Trash2 size={20} />
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
                            onUploadReceipt={(client, period) => {
                                setReceiptUploadState({ client, period });
                                receiptFileInputRef.current?.click();
                            }}
                            onPreviewReceipt={(client, declaration) => {
                                setPreviewItem({ client, declaration });
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
                        {viewMode === 'list' ? (
                            <VirtualClientTable
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onQuickAction={handleQuickAction}
                                onUploadReceipt={handleUploadReceipt}
                                frequency={frequencyForList}
                                isTrashView={activeGroupTab === 'trash'}
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
                                        <LucideIcons.DollarSign size={20} />
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
                                        const decl = c.declarations.find(d => d.period === period);
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
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                />
                            )}
                        </section>

                        {/* SECCIÓN AL DÍA (ELITE) */}
                        <section>
                            <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        <LucideIcons.ShieldCheck size={20} />
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
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today, frequencyForList);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                    frequency={frequencyForList}
                                />
                            )}
                        </section>
                    </motion.div>
                ) : isAlertasView ? (
                    <motion.div
                        key="alerts"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-12 pb-20"
                    >
                        {/* ALERTAS CRÍTICAS - TACTICAL VIEW */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                    <LucideIcons.AlertTriangle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-premium mb-1">
                                        VENCIMIENTOS TÁCTICOS
                                    </h3>
                                    <p className="text-lg font-bold text-on-surface uppercase tracking-tight font-premium">
                                        OBLIGACIONES REQUIRIENDO ACCIÓN INMEDIATA
                                    </p>
                                </div>
                            </div>
                        </div>

                        {viewMode === 'list' ? (
                            <VirtualClientTable
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onQuickAction={handleQuickAction}
                                onUploadReceipt={handleUploadReceipt}
                                frequency={frequencyForList}
                            />
                        ) : (
                            <VirtualClientList
                                clients={sortedClients}
                                serviceFees={serviceFees}
                                onView={handleOpenClientDetails}
                                onQuickAction={handleQuickAction}
                                onUploadReceipt={handleUploadReceipt}
                                frequency={frequencyForList}
                            />
                        )}
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
                            <LucideIcons.Plus size={18} /> Crear Nuevo Cliente con Tarifa Pro
                        </button>
                    </div>
                </div>
            </Modal>

            <BulkUploadReportModal
                isOpen={isBulkReportOpen}
                onClose={() => setIsBulkReportOpen(false)}
                results={bulkResults}
            />

            {/* OVERLAY DE DETALLE DE CLIENTE: Preserva el estado de la lista al no desmontarla */}
            {selectedClient && (
                <div className={`fixed inset-0 z-50 h-full overflow-y-auto bg-white dark:bg-gray-900 transform transition-transform duration-500 ${isClientDetailsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <ClientDetailView 
                        client={selectedClient} 
                        onSave={handleUpdateClient} 
                        onBack={handleCloseClientDetails} 
                        serviceFees={serviceFees} 
                        sriCredentials={sriCredentialsProp || sriCredentials}
                        initialTab={initialTab}
                    />
                </div>
            )}

            {previewItem && (
                <PdfPreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    client={previewItem.client}
                    declaration={previewItem.declaration}
                    onDownload={() => {
                        if (previewItem.declaration.proof_file) {
                            const link = document.createElement('a');
                            link.href = previewItem.declaration.proof_file.content || '';
                            link.download = previewItem.declaration.proof_file.name;
                            link.click();
                        }
                    }}
                />
            )}
        </div >
    );
};