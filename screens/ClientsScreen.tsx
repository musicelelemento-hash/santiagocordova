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
    { id: 'all', label: 'Todos', icon: LucideIcons.Users, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'vencidos', label: 'Vencidos', icon: LucideIcons.AlertCircle, color: 'text-primary bg-primary/10 ring-primary/20' },
    { id: 'ordenes', label: 'Órdenes', icon: LucideIcons.Zap, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'cobros', label: 'Por Cobrar', icon: LucideIcons.Sparkles, color: 'text-accent bg-accent/10 ring-accent/20' },
    { id: 'al-dia', label: 'Al Día', icon: LucideIcons.ShieldCheck, color: 'text-tertiary bg-tertiary/10 ring-tertiary/20' },
    { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Clock, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
    { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Briefcase, color: 'text-on-surface-variant bg-surface-low ring-outline-variant' },
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-1 sm:px-0 mb-8 sm:mb-12 animate-fade-in">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-primary/5 border border-primary/10 shadow-architect">
                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]"></div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.25em] font-premium">SISTEMA CORE</span>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-40 sm:block hidden font-premium">• PROTOCOLO ZENITH</span>
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-premium font-bold text-on-surface leading-[1.1] tracking-tighter mb-3">
                        Directorio <span className="text-primary italic font-light">Tributario</span>
                    </h2>
                    <div className="flex items-center gap-4 text-on-surface-variant text-[10px] font-bold uppercase tracking-[0.2em] font-premium">
                        <div className="flex items-center gap-2 px-3 py-1 bg-surface-low rounded-lg border border-outline-variant/30">
                            <LucideIcons.Shield size={12} className="text-tertiary" />
                            <span>MANTENIMIENTO ACTIVOS</span>
                        </div>
                        <span className="px-3 py-1 bg-tertiary/10 text-tertiary rounded-lg border border-tertiary/20">{sortedClients.length} EXPEDIENTES</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto animate-fade-in-right">
                    <button
                        onClick={handleBulkUpload}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-5 rounded-3xl bg-surface-low text-on-surface font-bold text-[11px] uppercase tracking-[0.2em] border border-outline-variant hover:bg-surface-medium transition-all duration-500 shadow-architect font-premium"
                    >
                        <LucideIcons.UploadCloud size={18} />
                        CARGA MASIVA
                    </button>
                    
                    <button onClick={() => setIsModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-5 rounded-3xl bg-primary text-white shadow-architect-lg font-bold text-[11px] uppercase tracking-[0.2em] transition-all duration-500 hover:scale-[1.03] active:scale-95 font-premium"
                    >
                        <LucideIcons.PlusCircle size={18} strokeWidth={2.5} />
                        NUEVO CLIENTE
                    </button>
                </div>
            </div>

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
            {/* ZENITH SEARCH & FILTERS - ARCHITECTURAL CONTROL */}
            <div className="bg-surface-low p-4 rounded-[2.5rem] border border-outline-variant/30 flex flex-col lg:flex-row gap-6 items-center mb-8 mx-1 sm:mx-0 shadow-architect">
                <div className="flex p-1.5 bg-surface-medium rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar border border-outline-variant/20">
                    <button 
                        onClick={() => {
                            setIsWorkspaceView(!isWorkspaceView);
                            if (!isWorkspaceView) setIsCobrosView(false);
                        }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 shrink-0 font-premium
                            ${isWorkspaceView 
                                ? 'bg-primary text-white shadow-architect' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-low'}`}
                    >
                        <LucideIcons.ShieldAlert size={16} />
                        ALERTAS
                    </button>
                    <button 
                        onClick={() => {
                            setIsCobrosView(!isCobrosView);
                            if (!isCobrosView) setIsWorkspaceView(false);
                        }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 shrink-0 font-premium
                            ${isCobrosView 
                                ? 'bg-tertiary text-white shadow-architect' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-low'}`}
                    >
                        <LucideIcons.DollarSign size={16} />
                        CÉLULA COBROS
                    </button>
                </div>

                <div className="relative flex-1 w-full group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <LucideIcons.Search className="text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={20} />
                    </div>
                    <input 
                        type="text"
                        placeholder="BUSCAR EXPEDIENTE POR NOMBRE, RUC O MATRIZ..."
                        className="w-full bg-surface-medium border border-outline-variant/30 rounded-2xl py-5 pl-16 pr-6 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-premium tracking-widest shadow-inner uppercase"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="flex bg-surface-medium p-1 rounded-2xl border border-outline-variant/20 shadow-inner">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-3.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-surface-low text-primary shadow-architect' : 'text-on-surface-variant'}`}
                        >
                            <LucideIcons.LayoutList size={20} />
                        </button>
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`p-3.5 rounded-xl transition-all ${viewMode === 'cards' ? 'bg-surface-low text-primary shadow-architect' : 'text-on-surface-variant'}`}
                        >
                            <LucideIcons.LayoutGrid size={20} />
                        </button>
                    </div>

                    <div className="relative" ref={sortMenuRef}>
                        <button
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                            className="flex items-center gap-3 px-6 py-4.5 bg-surface-medium border border-outline-variant/30 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-all font-premium shadow-architect h-full"
                        >
                            <LucideIcons.ArrowUpDown size={16} className="text-primary" />
                            ORDENAR
                        </button>
                        
                        {isSortMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-architect border border-outline-variant/30 p-2 z-50">
                                {[
                                    { id: '9th_digit', label: 'Vencimiento' },
                                    { id: 'name', label: 'Alfabético' }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setSortOption(opt.id as any); setIsSortMenuOpen(false); }} 
                                        className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${sortOption === opt.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* ZENITH GROWTH HUB - SILENT ANALYSIS */}
            <div className="mb-8 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-slate-400/5 to-transparent rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                <button 
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className="relative w-full glass-zen p-4 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden text-left transition-all duration-700 hover:border-primary/20"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative shrink-0">
                                <div className="absolute -inset-2 bg-primary/10 rounded-full blur-xl"></div>
                                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-slate-100 dark:border-white/5 flex items-center justify-center relative bg-white/50 dark:bg-black/20 backdrop-blur-xl">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="4" fill="transparent"
                                            className="text-slate-100 dark:text-white/5"
                                        />
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="4" fill="transparent"
                                            strokeDasharray="264"
                                            strokeDashoffset={264 - (264 * (globalStats.elite / (globalStats.total || 1)))}
                                            className="text-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(134,167,137,0.3)]"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-sm sm:text-2xl font-bold text-primary leading-none">
                                            {Math.round((globalStats.elite / (globalStats.total || 1)) * 100)}%
                                        </span>
                                        <span className="text-[6px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">ORDEN</span>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs sm:text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1 block">Indicador de Salud Fiscal</span>
                                <h3 className="text-xl sm:text-3xl font-semibold text-slate-900 dark:text-white leading-tight tracking-tighter mb-2 text-balance">
                                    Armonía <span className="text-primary italic font-light">Global</span> de Cartera
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-primary/10 border border-primary/20">
                                        <LucideIcons.BarChart3 size={12} className="text-primary" />
                                        <span className="text-xs sm:text-xs font-semibold text-emerald-400 uppercase tracking-widest">Analytics Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 bg-slate-100/50 dark:bg-white/2 p-3 sm:p-0 rounded-2xl sm:bg-transparent">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-xs sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Alertas</span>
                                    <span className="text-sm sm:text-xl font-bold text-rose-400 font-mono">
                                        {globalStats.vencidos}
                                    </span>
                                </div>
                                <div className="w-px h-6 sm:h-8 bg-slate-200 dark:bg-white/10"></div>
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-xs sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Gestionados</span>
                                    <span className="text-sm sm:text-xl font-bold text-primary font-mono">
                                        {globalStats.elite}
                                    </span>
                                </div>
                            </div>
                            <div className={`p-2 rounded-xl transition-all duration-500 ${isAnalysisExpanded ? 'rotate-180 bg-primary text-white shadow-lg' : 'bg-white/50 dark:bg-white/5 text-slate-400'}`}>
                                <LucideIcons.ChevronDown size={18} />
                            </div>
                        </div>
                    </div>
                </button>
            
                {isAnalysisExpanded && (
                    <div className="p-6 sm:p-10 border-t border-slate-100 dark:border-white/5 bg-slate-50/20 dark:bg-black/20 animate-fade-in-down">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Compliance Radar - Zen Mode */}
                            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                                <div className="relative">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-50 dark:text-slate-800" />
                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent"
                                            strokeDasharray={364}
                                            strokeDashoffset={364 - (364 * (globalStats.elite / (globalStats.total || 1)))}
                                            strokeLinecap="round"
                                            className="text-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(134,167,137,0.3)]"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-bold text-slate-800 dark:text-white font-mono">{Math.round((globalStats.elite / (globalStats.total || 1)) * 100)}%</span>
                                        <span className="text-xs font-bold uppercase text-slate-400 tracking-widest mt-1">Nivel Zen</span>
                                    </div>
                                </div>
                            </div>

                            {/* Client Distribution Grid */}
                            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[
                                    { id: 'mensual', label: 'Mensuales', value: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual').length, icon: LucideIcons.Calendar, color: 'primary' },
                                    { id: 'semestral', label: 'Semestrales', value: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Semestral').length, icon: LucideIcons.Clock, color: 'slate' },
                                    { id: 'vencidos', label: 'Alertas', value: globalStats.vencidos, icon: LucideIcons.AlertTriangle, color: 'rose' },
                                    { id: 'ordenes', label: 'Pendientes', value: globalStats.ordenes, icon: LucideIcons.Zap, color: 'amber' },
                                    { id: 'cobros', label: 'Tesorería', value: globalStats.cobros, icon: LucideIcons.DollarSign, color: 'primary' },
                                    { id: 'al-dia', label: 'En Orden', value: globalStats.elite, icon: LucideIcons.ShieldCheck, color: 'primary' }
                                ].map(stat => (
                                    <button 
                                        key={stat.id}
                                        onClick={(e) => { e.stopPropagation(); setActiveGroupTab(stat.id as any); }}
                                        className={`group flex flex-col p-5 rounded-2xl border transition-all duration-500 relative overflow-hidden ${activeGroupTab === stat.id ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 hover:border-primary/20'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-xl ${activeGroupTab === stat.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400'} transition-all`}>
                                                <stat.icon size={16} />
                                            </div>
                                            <span className={`text-[11px] font-bold uppercase tracking-widest ${activeGroupTab === stat.id ? 'text-primary' : 'text-slate-400'}`}>{stat.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-2xl font-bold font-mono ${activeGroupTab === stat.id ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{stat.value}</span>
                                            <span className="text-xs font-medium text-slate-400 uppercase">Fichas</span>
                                        </div>
                                        {activeGroupTab === stat.id && (
                                            <div className="absolute bottom-0 left-0 h-1 bg-primary w-full"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* PRODUCTIVIDAD TABS (Zen Flow) */}
            <div className="mb-6 flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-slate-100 dark:bg-black/40 rounded-2xl border border-slate-200 dark:border-white/5">
                {[
                    { id: 'all', label: 'Legión', count: clients.length, icon: LucideIcons.Users },
                    { id: 'mensual', label: 'Mensual', count: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual').length, icon: LucideIcons.Calendar },
                    { id: 'semestral', label: 'Semestral', count: clients.filter(c => !c.isDeleted && (c.taxProfile?.ivaFrequency || 'Mensual') === 'Semestral').length, icon: LucideIcons.Clock },
                    { id: 'vencidos', label: 'Deterioro', count: globalStats.vencidos, icon: LucideIcons.AlertCircle },
                    { id: 'ordenes', label: 'Órdenes', count: globalStats.ordenes, icon: LucideIcons.Zap },
                    { id: 'cobros', label: 'Caja', count: globalStats.cobros, icon: LucideIcons.DollarSign },
                    { id: 'al-dia', label: 'Orden', count: globalStats.elite, icon: LucideIcons.ShieldCheck }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveGroupTab(tab.id as any)}
                        className={`group relative flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-[11px] font-bold uppercase tracking-widest transition-all duration-500 shrink-0
                            ${activeGroupTab === tab.id 
                                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-primary/20' 
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                    >
                        <tab.icon size={14} className={activeGroupTab === tab.id ? 'text-primary' : 'text-slate-400 transition-colors'} />
                        <span className="inline">{tab.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono ${activeGroupTab === tab.id ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

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

            {/* Client Grid or List */}
            {
                isWorkspaceView ? (
                    <div className="space-y-8 pb-20">
                        {/* SECCIÓN POR DECLARAR (ÓRDENES DE TRABAJO) */}
                        <section className="animate-fade-in px-1">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        <LucideIcons.Clock size={18} />
                                    </div>
                                    <h3 className="text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-[0.2em]">
                                        Órdenes de Trabajo <span className="text-slate-400 font-medium ml-1">· POR DECLARAR</span>
                                    </h3>
                                </div>
                                <span className="text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-500/20 shadow-sm">
                                    {sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.is_paid && !decl?.proof_file;
                                    }).length} PENDIENTES
                                </span>
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
                        <section className="animate-fade-in px-1">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <LucideIcons.CheckCircle2 size={18} />
                                    </div>
                                    <h3 className="text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-[0.2em]">
                                        Flujo de Cumplimiento <span className="text-slate-400 font-medium ml-1">· COMPLETADOS</span>
                                    </h3>
                                </div>
                                <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 shadow-sm">
                                    {sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        return !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                    }).length} FINALIZADOS
                                </span>
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

                        {/* RESTANTES - PENDIENTE DE GESTIÓN INICIAL */}
                        <section className="animate-fade-in px-1">
                            <div className="flex items-center justify-between mb-5 opacity-80">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                        <LucideIcons.CircleDashed size={18} />
                                    </div>
                                    <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                                        Protocolo Base <span className="text-slate-400 font-medium ml-1">· GESTIÓN PENDIENTE</span>
                                    </h3>
                                </div>
                                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                                    {sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isWorkOrder = !!decl?.is_paid && !decl?.proof_file;
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return !isWorkOrder && !isDeclared;
                                    }).length} EN ESPERA
                                </span>
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
                        <section className="animate-fade-in px-1">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                        <LucideIcons.DollarSign size={18} />
                                    </div>
                                    <h3 className="text-[11px] font-bold text-slate-700 dark:text-white uppercase tracking-[0.2em]">
                                        Recaudación <span className="text-slate-400 font-medium ml-1">· COBROS PENDIENTES</span>
                                    </h3>
                                </div>
                                <span className="text-xs font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-500/20 shadow-sm">
                                    {sortedClients.filter(c => {
                                        const today = new Date();
                                        const period = getPeriod(c, today);
                                        const decl = c.declarations.find(d => d.period === period);
                                        const isDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada;
                                        return isDeclared && !decl?.is_paid;
                                    }).length} POR RECAUDAR
                                </span>
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
                                    <span className="ml-2 text-xs bg-emerald-100 text-emerald-500 px-2 py-0.5 rounded-full">
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
                                    <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
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