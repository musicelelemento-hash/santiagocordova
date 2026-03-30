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
import { extractDataFromDeclarationPdf, fileToBase64 } from '../services/pdfExtraction';
import { StoredFile } from '../types';
import { BulkUploadReportModal, BulkUploadResult } from '../components/features/BulkUploadReportModal';

const OBLIGATION_GROUPS = [
    { id: 'all', label: 'Todos', icon: LucideIcons.Users, color: 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-700/80 ring-slate-200' },
    { id: 'vencidos', label: 'Vencidos', icon: LucideIcons.AlertCircle, color: 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/50 ring-rose-300' },
    { id: 'ordenes', label: 'Órdenes de Trabajo', icon: LucideIcons.Zap, color: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50 ring-amber-300' },
    { id: 'cobros', label: 'Por Cobrar', icon: LucideIcons.DollarSign, color: 'text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/50 ring-sky-300' },
    { id: 'al-dia', label: 'Elite / Al Día', icon: LucideIcons.ShieldCheck, color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50 ring-emerald-300' },
    { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Clock, color: 'text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-900/50 ring-slate-200' },
    { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Briefcase, color: 'text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-900/50 ring-slate-200' },
    { id: 'trash', label: 'Papelera', icon: LucideIcons.Trash2, color: 'text-rose-500 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/50 ring-rose-200' },
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
}

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
    initialFilter,
    navigate,
    initialClientData,
    clearInitialClientData,
    clientToView,
    clearClientToView,
    sriCredentialsProp
}) => {
    const { clients, setClients, updateClient, addClient, serviceFees, sriCredentials: storeCredentials } = useAppStore();
    const sriCredentials = sriCredentialsProp || storeCredentials;
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('clients_search') || '');
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

    const globalStats = useMemo(() => {
        const stats = { vencidos: 0, ordenes: 0, cobros: 0, elite: 0, total: clients.filter(c => !c.isDeleted).length };
        const today = new Date();

        clients.filter(c => !c.isDeleted).forEach(client => {
            const period = getPeriod(client, today);
            const decl = client.declarations.find(d => d.period === period);
            const dueDate = getDueDateForPeriod(client, period);

            const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
            const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && ivaFreq !== 'Ninguno';
            const isIvaDeclared = !needsIva || (decl?.status === 'Enviada' || decl?.status === 'Pagada' || !!decl?.proof_file);
            const isIvaPaid = !needsIva || (decl?.is_paid || decl?.status === 'Pagada');

            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
            const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
            const isRentaDeclared = !needsRenta || (!!rentaDecl?.proof_file || rentaDecl?.status === 'Enviada' || rentaDecl?.status === 'Pagada' || false);
            const isRentaPaid = !needsRenta || (!!rentaDecl?.is_paid || rentaDecl?.status === 'Pagada' || false);

            const fullyDeclared = isIvaDeclared && isRentaDeclared;
            const fullyPaid = isIvaPaid && isRentaPaid;

            const isVencido = dueDate ? (isPast(dueDate) && !isIvaDeclared) : false;
            const isWorkOrder = !fullyDeclared && fullyPaid;
            const isCobroPending = fullyDeclared && !fullyPaid;
            const isElite = fullyDeclared && fullyPaid;

            if (isVencido) stats.vencidos++;
            else if (isWorkOrder) stats.ordenes++;
            else if (isCobroPending) stats.cobros++;
            else if (isElite) stats.elite++;
        });
        return stats;
    }, [clients]);

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

            const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
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
            if (searchTerm) return true;

            if (activeGroupTab === 'vencidos') {
                const today = new Date();
                const period = getPeriod(client, today);
                const decl = client.declarations.find(d => d.period === period);
                const dueDate = getDueDateForPeriod(client, period);

                const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
                const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && ivaFreq !== 'Ninguno';
                const isIvaDeclared = !needsIva || (decl?.status === 'Enviada' || decl?.status === 'Pagada' || !!decl?.proof_file);

                return !!dueDate && isPast(dueDate) && !isIvaDeclared;
            }

            if (activeGroupTab === 'ordenes') {
                const today = new Date();
                const period = getPeriod(client, today);
                const decl = client.declarations.find(d => d.period === period);

                const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
                const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && ivaFreq !== 'Ninguno';
                const isIvaDeclared = !needsIva || (decl?.status === 'Enviada' || decl?.status === 'Pagada' || !!decl?.proof_file);
                const isIvaPaid = !needsIva || (decl?.is_paid || decl?.status === 'Pagada');

                if (isIvaPaid && !isIvaDeclared) return true;

                const currentYear = today.getFullYear();
                const rentaPeriod = (currentYear - 1).toString();
                const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
                const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
                const isRentaDeclared = !needsRenta || (!!rentaDecl?.proof_file || rentaDecl?.status === 'Enviada' || rentaDecl?.status === 'Pagada' || false);
                const isRentaPaid = !needsRenta || (!!rentaDecl?.is_paid || rentaDecl?.status === 'Pagada' || false);

                if (isRentaPaid && !isRentaDeclared) return true;
                return false;
            }

            if (activeGroupTab === 'cobros') {
                const today = new Date();
                const period = getPeriod(client, today);
                const decl = client.declarations.find(d => d.period === period);

                const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
                const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && ivaFreq !== 'Ninguno';
                const isIvaDeclared = !needsIva || (decl?.status === 'Enviada' || decl?.status === 'Pagada' || !!decl?.proof_file);
                const isIvaPaid = !needsIva || (decl?.is_paid || decl?.status === 'Pagada');

                if (isIvaDeclared && !isIvaPaid) return true;
                return false;
            }

            if (activeGroupTab === 'al-dia') {
                const today = new Date();
                const period = getPeriod(client, today);
                const decl = client.declarations.find(d => d.period === period);

                const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';
                const needsIva = client.regime !== TaxRegime.RimpeNegocioPopular && ivaFreq !== 'Ninguno';
                const isIvaDeclared = !needsIva || (decl?.status === 'Enviada' || decl?.status === 'Pagada' || !!decl?.proof_file);
                const isIvaPaid = !needsIva || (decl?.is_paid || decl?.status === 'Pagada');

                const currentYear = today.getFullYear();
                const rentaPeriod = (currentYear - 1).toString();
                const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
                const rentaDecl = client.declarations.find(d => d.period === rentaPeriod);
                const isRentaDeclared = !needsRenta || (!!rentaDecl?.proof_file || rentaDecl?.status === 'Enviada' || rentaDecl?.status === 'Pagada' || false);
                const isRentaPaid = !needsRenta || (!!rentaDecl?.is_paid || rentaDecl?.status === 'Pagada' || false);

                return isIvaDeclared && isIvaPaid && isRentaDeclared && isRentaPaid;
            }

            if (activeGroupTab === 'mensual') {
                const isSemestral = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor;
                const isAnual = client.taxProfile?.ivaFrequency === 'Ninguno';
                if (isSemestral || isAnual) return false;
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
    }, [clients, searchTerm, filterOption, activeGroupTab, regimeFilter, initialFilter]);

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

    const handleQuickAction = (client: Client, action: 'declare' | 'pay' | 'deactivate', customPeriod?: string) => {
        const today = new Date();
        const period = customPeriod || getPeriod(client, today);
        const nowIso = today.toISOString();

        if (action === 'deactivate') {
            updateClient(client.id, { isActive: false });
            toast.success(`${client.name} desactivado`);
            return;
        }

        let updatedClient = client;

        const history = [...client.declarations];
        const idx = history.findIndex(d => d.period === period);
        const newStatus = action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada;

        const newEntry = {
            period,
            status: newStatus,
            updatedAt: nowIso,
            ...(action === 'declare' ? { declaredAt: nowIso } : {}),
            ...(action === 'pay' ? { is_paid: true, paidAt: nowIso, transactionId: `Q-${Date.now().toString().slice(-4)}` } : {})
        };

        if (idx > -1) {
            history[idx] = { ...history[idx], ...newEntry };
        } else {
            history.push(newEntry);
        }

        const updates: Partial<Client> = { declarations: history };

        updateClient(client.id, updates);

        // AJUSTE CRÍTICO: Sincronizar el cliente seleccionado si está abierto en el modal
        if (selectedClient && selectedClient.id === client.id) {
            setSelectedClient({ ...client, ...updates });
        }

        toast.success(action === 'declare' ? 'Declaración registrada' : 'Pago registrado');
    };

    const handleUploadReceipt = (client: Client, period?: string) => {
        setReceiptUploadState({ client, period });
        setTimeout(() => {
            receiptFileInputRef.current?.click();
        }, 100);
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

            const history = [...receiptUploadState.client.declarations];
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

            updateClient(receiptUploadState.client.id, updates);
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
                const data = await extractDataFromDeclarationPdf(file);
                const base64 = await fileToBase64(file);

                let targetClient = clients.find(c => c.ruc === data.ruc);
                
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
                        verificationReason: 'Registrado automáticamente por Escuadrón Rápido',
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
        <div>
            {/* FINANCIAL INTELLIGENCE COMMAND - ELITE HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-1 sm:px-0 mb-6 sm:mb-8 animate-fade-in">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-400/10 border border-sky-400/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>
                            <span className="text-[9px] sm:text-[10px] font-semibold text-sky-400 uppercase tracking-widest">Client Sync Protocol</span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Elite Access</span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-2">
                        Intelligence <span className="text-gradient-sky">Command</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[9px] sm:text-[11px] font-medium uppercase tracking-widest">
                        <LucideIcons.Shield size={10} className="text-sky-400" />
                        <span>Gestión de Activos Tributarios</span>
                        <span className="ml-2 px-2 py-0.5 bg-sky-400 text-white rounded-lg text-[9px]">{sortedClients.length} UNITS</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <button
                        onClick={handleBulkUpload}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                        <LucideIcons.UploadCloud size={16} />
                        ESCUADRÓN
                    </button>
                    
                    <button onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow-xl shadow-sky-400/30 font-semibold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-white/10"
                    >
                        <LucideIcons.PlusCircle size={16} strokeWidth={3} />
                        RECLUTAR
                    </button>

                    <a href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT" target="_blank" rel="noopener noreferrer"
                        className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/5 hover:text-sky-400 transition-colors hidden sm:block"
                    >
                        <LucideIcons.ExternalLink size={20} />
                    </a>
                </div>
            </div>

            {/* ACTIVE FILTER BANNER */}
            {initialFilter && (
                <div className="mb-6 animate-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-sky-400/10 border border-sky-400/20 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-sky-400 text-white shadow-lg shadow-sky-400/20">
                                <LucideIcons.Filter size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-sky-500 dark:text-sky-400 uppercase tracking-widest">
                                    Filtro de Inteligencia Activo
                                </h4>
                                <p className="text-[10px] font-medium text-slate-500 uppercase">
                                    {initialFilter.title || 'Vista Personalizada'} • Mostrando {sortedClients.length} resultados
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate('clients', { initialFilter: null })}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-white/5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-rose-400 border border-slate-200 dark:border-white/5 transition-all"
                        >
                            Limpiar Filtro
                        </button>
                    </div>
                </div>
            )}

            {/* TACTICAL SEARCH & FILTERS - MOBILE LUXURY */}
            <div className="glass-tactical p-3 sm:p-2 rounded-[2rem] sm:rounded-3xl shadow-2xl border border-white/10 flex flex-col lg:flex-row gap-4 lg:gap-4 items-center mb-6 mx-1 sm:mx-0">
                <div className="flex p-1 bg-slate-900/5 dark:bg-black/40 rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => {
                            setIsWorkspaceView(!isWorkspaceView);
                            if (!isWorkspaceView) setIsCobrosView(false);
                        }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 shrink-0
                            ${isWorkspaceView 
                                ? 'bg-amber-400 text-white shadow-xl shadow-amber-400/20 ring-1 ring-amber-400/50' 
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <LucideIcons.ShieldAlert size={14} className={isWorkspaceView ? 'animate-pulse' : ''} />
                        MESA OPS
                    </button>
                    <button 
                        onClick={() => {
                            setIsCobrosView(!isCobrosView);
                            if (!isCobrosView) setIsWorkspaceView(false);
                        }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 shrink-0
                            ${isCobrosView 
                                ? 'bg-emerald-400 text-white shadow-xl shadow-emerald-400/20 ring-1 ring-emerald-400/50' 
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <LucideIcons.DollarSign size={14} />
                        COBROS
                    </button>
                </div>

                <div className="relative flex-grow w-full px-1">
                    <LucideIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-400/50 pointer-events-none" size={16} />
                    <input 
                        type="text" 
                        placeholder="TACTICAL SEARCH / IDENTIFICADOR" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-11 pr-5 py-3 sm:py-4 bg-white/30 dark:bg-slate-950/30 border border-slate-200/50 dark:border-white/5 rounded-2xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition-all font-mono" 
                    />
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto px-1">
                    <div className="flex p-1 bg-slate-900/5 dark:bg-black/40 rounded-2xl flex-grow lg:flex-grow-0">
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`flex-1 p-3 rounded-xl transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-sky-400 shadow-lg' : 'text-slate-400'}`}
                        >
                            <LucideIcons.LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`flex-1 p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-sky-400 shadow-lg' : 'text-slate-400'}`}
                        >
                            <LucideIcons.List size={16} />
                        </button>
                    </div>

                    <div className="relative" ref={sortMenuRef}>
                        <button 
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} 
                            className="p-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl border border-slate-200 dark:border-white/5 hover:text-sky-400 transition-all active:scale-95"
                        >
                            <LucideIcons.SlidersHorizontal size={18} />
                        </button>
                        {isSortMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 glass-tactical border border-white/10 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in-down">
                                <p className="text-[10px] font-semibold text-slate-400 px-3 pb-2 uppercase tracking-[0.2em]">Visual Priority</p>
                                <div className="space-y-1">
                                    <button onClick={() => { setSortOption('pending_obligations'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest rounded-xl transition-all ${sortOption === 'pending_obligations' ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/30' : 'text-slate-500 hover:bg-white/5 dark:hover:bg-white/5'}`}>Obligaciones</button>
                                    <button onClick={() => { setSortOption('pending_payments'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest rounded-xl transition-all ${sortOption === 'pending_payments' ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/30' : 'text-slate-500 hover:bg-white/5 dark:hover:bg-white/5'}`}>Cobros</button>
                                    <button onClick={() => { setSortOption('9th_digit'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest rounded-xl transition-all ${sortOption === '9th_digit' ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/30' : 'text-slate-500 hover:bg-white/5 dark:hover:bg-white/5'}`}>Vencimiento (SRI)</button>
                                    <button onClick={() => { setSortOption('name'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest rounded-xl transition-all ${sortOption === 'name' ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/30' : 'text-slate-500 hover:bg-white/5 dark:hover:bg-white/5'}`}>Alfabético</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* STATUS SPHERE (FINANCIAL INTELLIGENCE HUB) */}
            <div className="mb-8 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-400/20 via-emerald-400/10 to-transparent rounded-[1.5rem] sm:rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                <button 
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className="relative w-full glass-tactical p-4 sm:p-8 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden text-left transition-all duration-500 hover:border-white/20"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8 relative z-10">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="relative shrink-0">
                                <div className="absolute -inset-2 bg-sky-400/15 rounded-full blur-xl animate-pulse"></div>
                                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-2 sm:border-4 border-slate-800 dark:border-white/5 flex items-center justify-center relative bg-slate-900/40 backdrop-blur-xl">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="3" fill="transparent"
                                            className="text-slate-800 dark:text-white/5"
                                        />
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="3" fill="transparent"
                                            strokeDasharray="264"
                                            strokeDashoffset={264 - (264 * (globalStats.elite / (globalStats.total || 1)))}
                                            className="text-sky-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-sm sm:text-2xl font-semibold text-sky-400 leading-none">
                                            {Math.round((globalStats.elite / (globalStats.total || 1)) * 100)}%
                                        </span>
                                        <span className="text-[6px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">ELITE</span>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[8px] sm:text-[10px] font-semibold text-sky-400 uppercase tracking-[0.2em] mb-0.5 sm:mb-1 block">Operational Status v3.0</span>
                                <h3 className="text-xl sm:text-3xl font-semibold text-slate-900 dark:text-white leading-[0.9] tracking-tighter mb-1 sm:mb-2 text-balance uppercase">
                                    Cumplimiento <br className="hidden sm:block" /> Global de Cartera
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                                        <LucideIcons.BarChart3 size={10} className="text-emerald-400" />
                                        <span className="text-[8px] sm:text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Analytics Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 bg-black/5 dark:bg-white/2 p-3 sm:p-0 rounded-2xl sm:bg-transparent">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-[8px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Alerts</span>
                                    <span className="text-sm sm:text-xl font-semibold text-rose-400 font-mono">
                                        {globalStats.vencidos}
                                    </span>
                                </div>
                                <div className="w-px h-6 sm:h-8 bg-slate-200 dark:bg-white/10"></div>
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-[8px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Processed</span>
                                    <span className="text-sm sm:text-xl font-semibold text-emerald-400 font-mono">
                                        {globalStats.elite}
                                    </span>
                                </div>
                            </div>
                            <div className={`p-1.5 sm:p-2 rounded-xl transition-all ${isAnalysisExpanded ? 'rotate-180 bg-sky-400 text-white shadow-lg' : 'bg-slate-200/50 dark:bg-white/5 text-slate-400'}`}>
                                <LucideIcons.ChevronDown size={18} />
                            </div>
                        </div>
                    </div>
                </button>
            
                {isAnalysisExpanded && (
                    <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-black/20 animate-fade-in-down">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Compliance Radar */}
                            <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-white/5 shadow-inner">
                                <div className="relative">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                                            strokeDasharray={364}
                                            strokeDashoffset={364 - (364 * (globalStats.elite / (globalStats.total || 1)))}
                                            strokeLinecap="round"
                                            className="text-emerald-400 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-semibold text-slate-800 dark:text-white font-mono">{Math.round((globalStats.elite / (globalStats.total || 1)) * 100)}%</span>
                                        <span className="text-[8px] font-semibold uppercase text-slate-400 tracking-tighter">Elite Score</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tactical Breakdown Grid */}
                            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[
                                    { id: 'mensual', label: 'Mensuales', value: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual').length, icon: LucideIcons.Calendar, color: 'sky' },
                                    { id: 'semestral', label: 'Semestrales', value: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Semestral').length, icon: LucideIcons.Clock, color: 'amber' },
                                    { id: 'vencidos', label: 'Vencidos (Alerta)', value: globalStats.vencidos, icon: LucideIcons.AlertTriangle, color: 'rose' },
                                    { id: 'ordenes', label: 'Órdenes Trabajo', value: globalStats.ordenes, icon: LucideIcons.Zap, color: 'amber' },
                                    { id: 'cobros', label: 'Pendiente Caja', value: globalStats.cobros, icon: LucideIcons.DollarSign, color: 'emerald' },
                                    { id: 'al-dia', label: 'Status Elite', value: globalStats.elite, icon: LucideIcons.ShieldCheck, color: 'indigo' }
                                ].map(stat => (
                                    <button 
                                        key={stat.id}
                                        onClick={(e) => { e.stopPropagation(); setActiveGroupTab(stat.id as any); }}
                                        className={`group flex flex-col p-4 rounded-2xl border transition-all relative overflow-hidden ${activeGroupTab === stat.id ? `bg-${stat.color}-500/10 border-${stat.color}-500/30 ring-1 ring-${stat.color}-500/20` : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 hover:border-sky-400/30 dark:hover:border-sky-400/20'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`p-2 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                                                <stat.icon size={16} />
                                            </div>
                                            <span className={`text-[9px] font-semibold uppercase tracking-widest ${activeGroupTab === stat.id ? `text-${stat.color}-500` : 'text-slate-400'}`}>{stat.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-semibold font-mono ${activeGroupTab === stat.id ? `text-${stat.color}-600 dark:text-${stat.color}-400` : 'text-slate-700 dark:text-slate-300'}`}>{stat.value}</span>
                                            <span className="text-[10px] font-medium text-slate-400">UNITS</span>
                                        </div>
                                        {activeGroupTab === stat.id && (
                                            <div className={`absolute bottom-0 left-0 h-1 bg-${stat.color}-500 w-full shadow-[0_-4px_10px_rgba(0,0,0,0.1)]`}></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* PRODUCTIVIDAD TABS (Elite Tactical) */}
            <div className="mb-6 flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
                {[
                    { id: 'all', label: 'Todos', count: clients.length, icon: LucideIcons.Users },
                    { id: 'mensual', label: 'Mes', count: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual').length, icon: LucideIcons.Calendar },
                    { id: 'semestral', label: 'Sem', count: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Semestral').length, icon: LucideIcons.Clock },
                    { id: 'vencidos', label: 'Venc (Alerta)', count: globalStats.vencidos, icon: LucideIcons.AlertCircle },
                    { id: 'ordenes', label: 'Ord (Trabajo)', count: globalStats.ordenes, icon: LucideIcons.Zap },
                    { id: 'cobros', label: 'Cob', count: globalStats.cobros, icon: LucideIcons.DollarSign },
                    { id: 'al-dia', label: 'Elite', count: globalStats.elite, icon: LucideIcons.ShieldCheck }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveGroupTab(tab.id as any)}
                        className={`group relative flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-2xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 shrink-0
                            ${activeGroupTab === tab.id 
                                ? 'bg-white dark:bg-slate-900 text-sky-500 shadow-xl shadow-sky-400/10 ring-1 ring-sky-400/20' 
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}
                    >
                        <tab.icon size={tab.id === activeGroupTab ? 16 : 14} className={activeGroupTab === tab.id ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-400 transition-colors'} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label}</span>
                        <span className={`px-1 rounded-md text-[8px] sm:text-[9px] font-mono ${activeGroupTab === tab.id ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/30' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                            {tab.count}
                        </span>
                        {activeGroupTab === tab.id && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] sm:h-1 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* IVA MENSUAL PROGRESS WORKFLOW */}
            {
                activeGroupTab === 'mensual' && (
                    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Progreso Declaraciones {safeFormat(new Date(), 'MMMM')}</span>
                                    <span className="text-xs font-semibold text-sky-500">{sortedClients.filter(c => {
                                        const d = c.declarations.find(dh => dh.period === getPeriod(c, new Date()));
                                        return !!d?.proof_file || d?.status === DeclarationStatus.Enviada;
                                    }).length} de {sortedClients.length}</span>
                                </div>
                                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-sky-400 transition-all duration-1000"
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
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${sortOption === '9th_digit' ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    Calendario SRI
                                </button>
                                <button
                                    onClick={() => setSortOption('name')}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${sortOption === 'name' ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    Alfabético
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- COMBO BUTTON SECTION --- */}
            {
                activeGroupTab === 'renta' && (
                    <div className="mb-6 p-6 bg-gradient-to-r from-emerald-400 to-teal-600 rounded-2xl text-white shadow-lg animate-fade-in-down flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-white/20 text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-md">Producto Destacado</span>
                                <span className="text-xl font-medium">Combo Devolución Renta</span>
                            </div>
                            <p className="text-emerald-100 text-sm max-w-md">
                                Incluye: Declaración de Renta + Anexo Gastos Personales + Solicitud de Devolución de Retenciones.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsComboModalOpen(true)}
                            className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-xl shadow-lg hover:bg-emerald-50 transition-transform transform hover:scale-105 flex items-center gap-2"
                        >
                            <LucideIcons.Plus size={20} strokeWidth={3} /> Vender Combo $25.00
                        </button>
                    </div>
                )
            }

            {/* Client Grid or List */}
            {
                isWorkspaceView ? (
                    <div className="space-y-8 pb-20">
                        {/* SECCIÓN POR DECLARAR (ÓRDENES DE TRABAJO) */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.Clock className="text-amber-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-white uppercase tracking-widest">
                                    Órdenes de Trabajo (Por Declarar)
                                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            return !!decl?.is_paid && !decl?.proof_file;
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && !decl?.proof_file;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && !decl?.proof_file;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                            {sortedClients.filter(c => {
                                const today = new Date();
                                const period = getPeriod(c, today);
                                const decl = c.declarations.find(d => d.period === period);
                                return !!decl?.is_paid && !decl?.proof_file;
                            }).length === 0 && (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-400 text-xs font-medium uppercase">No hay órdenes de trabajo pendientes</p>
                                </div>
                            )}
                        </section>

                        {/* SECCIÓN DECLARADOS */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.CheckCircle2 className="text-emerald-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-white uppercase tracking-widest">
                                    Declarados (Completados)
                                    <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            return !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                        </section>

                        {/* RESTANTES */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.CircleDashed className="text-slate-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                                    Pendiente de Gestión Inicial
                                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            const isWorkOrder = !!decl?.is_paid && !decl?.proof_file;
                                            const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                            return !isWorkOrder && !isDeclared;
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isWorkOrder = !!decl?.is_paid && !decl?.proof_file;
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return !isWorkOrder && !isDeclared;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isWorkOrder = !!decl?.is_paid && !decl?.proof_file;
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return !isWorkOrder && !isDeclared;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                        </section>
                    </div>
                ) : isCobrosView ? (
                    <div className="space-y-8 pb-20">
                        {/* SECCIÓN COBRO PENDIENTE */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.DollarSign className="text-sky-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-white uppercase tracking-widest">
                                    Cobros Pendientes (Declarados)
                                    <span className="ml-2 text-[10px] bg-sky-100 text-sky-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                            return isDeclared && !decl?.is_paid;
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                            {sortedClients.filter(c => {
                                const today = new Date();
                                const period = getPeriod(c, today);
                                const decl = c.declarations.find(d => d.period === period);
                                const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                return isDeclared && !decl?.is_paid;
                            }).length === 0 && (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-400 text-xs font-medium uppercase">No hay cobros pendientes</p>
                                </div>
                            )}
                        </section>

                        {/* SECCIÓN AL DÍA (ELITE) */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.ShieldCheck className="text-emerald-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-white uppercase tracking-widest">
                                    Elite / Al Día
                                    <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && (!!decl?.proof_file || decl?.status === DeclarationStatus.Enviada);
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                        </section>

                        {/* EL RESTO */}
                        <section className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <LucideIcons.Clock className="text-slate-400" size={18} />
                                <h3 className="text-sm font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                                    En Proceso / Pendientes
                                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                        {sortedClients.filter(c => {
                                            const today = new Date();
                                            const period = getPeriod(c, today);
                                            const decl = c.declarations.find(d => d.period === period);
                                            const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                            const isElite = !!decl?.is_paid && isDeclared;
                                            const isCobroPending = isDeclared && !decl?.is_paid;
                                            return !isElite && !isCobroPending;
                                        }).length}
                                    </span>
                                </h3>
                            </div>
                            {viewMode === 'list' ? (
                                <VirtualClientTable
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        const isElite = !!decl?.is_paid && isDeclared;
                                        const isCobroPending = isDeclared && !decl?.is_paid;
                                        return !isElite && !isCobroPending;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            ) : (
                                <VirtualClientList
                                    clients={sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        const isElite = !!decl?.is_paid && isDeclared;
                                        const isCobroPending = isDeclared && !decl?.is_paid;
                                        return !isElite && !isCobroPending;
                                    })}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            )}
                        </section>
                    </div>
                ) : (
                    (() => {
                        const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
                        const finalMode = isMobileViewport ? 'cards' : viewMode;

                        if (finalMode === 'list') {
                            return (
                                <VirtualClientTable
                                    clients={sortedClients}
                                    serviceFees={serviceFees}
                                    onView={handleOpenClientDetails}
                                    onQuickAction={handleQuickAction}
                                    onUploadReceipt={handleUploadReceipt}
                                />
                            );
                        }

                        return (
                            <div className="animate-fade-in">
                                {sortedClients.length > 0 ? (
                                    <VirtualClientList
                                        clients={sortedClients}
                                        serviceFees={serviceFees}
                                        onView={handleOpenClientDetails}
                                        onQuickAction={handleQuickAction}
                                        onUploadReceipt={handleUploadReceipt}
                                    />
                                ) : (
                                    <div className="py-20 text-center">
                                        <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
                                            <LucideIcons.Search size={32} />
                                        </div>
                                        <p className="text-slate-500 font-medium">No se encontraron clientes con este filtro.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()
                )
            }

            <input
                type="file"
                ref={receiptFileInputRef}
                onChange={processReceiptFile}
                accept="application/pdf"
                className="hidden"
            />

            <input
                type="file"
                ref={bulkFileInputRef}
                onChange={processBulkReceiptFiles}
                accept="application/pdf"
                multiple
                className="hidden"
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
                        sriCredentials={sriCredentials} 
                    />
                </div>
            )}
        </div >
    );
};