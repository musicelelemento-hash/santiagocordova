
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, TranscribableField } from '../types';
import { Plus, Search, User, Users, X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, ExternalLink, ShieldCheck, Phone, Mail, FileText, Zap, UserCheck, ToggleLeft, ToggleRight, UserX, UserCheck2, MoreHorizontal, Printer, Clipboard, CheckCircle, SlidersHorizontal, MessageCircle, Pin, Send, XCircle, Loader, ArrowDownToLine, ChevronUp, ChevronDown, Sparkles, AlertTriangle, Star, Info, Clock, Mic, Image as ImageIcon, MapPin, Briefcase, Key, CreditCard, Calendar, TrendingUp, RefreshCw, Layers } from 'lucide-react';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod, getIdentifierSortKey, fetchSRIPublicData } from '../services/sri';
import { Modal } from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { format, isPast, subMonths, subYears } from 'date-fns';
import { addAdvancePayments, getClientServiceFee } from '../services/clientService';
import { es } from 'date-fns/locale';
import { useTranscription } from '../hooks/useTranscription';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClientDetailView } from '../components/ClientDetailView';
import { ClientForm } from '../components/ClientForm';
import { useToast } from '../context/ToastContext';

// ... (Constants and declarationStatusColors remain same)
const declarationStatusColors: { [key in DeclarationStatus]: string } = {
    [DeclarationStatus.Pendiente]: 'bg-gray-400/20 text-gray-500 dark:text-gray-400',
    [DeclarationStatus.Enviada]: 'bg-blue-500/20 text-blue-500',
    [DeclarationStatus.Pagada]: 'bg-green-500/20 text-green-500',
    [DeclarationStatus.Cancelada]: 'bg-red-500/20 text-red-500',
    [DeclarationStatus.Vencida]: 'bg-red-500/20 text-red-600',
};

// ... (OBLIGATION_GROUPS Config remains same)
const OBLIGATION_GROUPS = [
    { id: 'all', label: 'Todas', icon: Layers, color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
    { id: 'mensual', label: 'IVA Mensual', icon: Calendar, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
    { id: 'semestral', label: 'IVA Semestral', icon: Clock, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
    { id: 'renta', label: 'Impuesto Renta', icon: TrendingUp, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20' },
    { id: 'devolucion', label: 'Devoluciones', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' },
];

interface ClientsScreenProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  initialFilter: ClientFilter | null;
  navigate: (screen: Screen, options?: { taskFilter: { clientId: string } }) => void;
  serviceFees: ServiceFeesConfig;
  initialClientData: Partial<Client> | null;
  clearInitialClientData: () => void;
  clientToView: Client | null;
  clearClientToView: () => void;
  sriCredentials?: Record<string, string>;
}

// ... (Helper functions: getRecentPeriods, DeclarationProgressBar, PaymentHistoryChart, DynamicStatusIndicator remain the same) ...
const getRecentPeriods = (client: Client, count: number): string[] => {
    const periods: string[] = [];
    let currentDate = new Date();
    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) { periods.push(period); }
        if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) { currentDate = subMonths(currentDate, 1); } 
        else if (client.category.includes('Semestral')) { currentDate = subMonths(currentDate, 6); } 
        else { currentDate = subYears(currentDate, 1); }
    }
    return periods.slice(0, count).reverse();
};

const DeclarationProgressBar: React.FC<{ client: Client }> = ({ client }) => {
    const periodsToDisplay = getRecentPeriods(client, 12);
    const historyMap = new Map(client.declarationHistory.map(d => [d.period, d.status]));
    return (
        <div className="flex mt-3 h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            {periodsToDisplay.map(period => {
                const status = historyMap.get(period);
                let colorClass = 'bg-gray-300 dark:bg-gray-600';
                if (status === DeclarationStatus.Pagada) colorClass = 'bg-green-500';
                else if (status === DeclarationStatus.Enviada) colorClass = 'bg-blue-500';
                else if (status === DeclarationStatus.Pendiente) {
                    const dueDate = getDueDateForPeriod(client, period);
                    if (dueDate && isPast(dueDate)) { colorClass = 'bg-red-500'; } else { colorClass = 'bg-yellow-500'; }
                }
                const displayPeriod = formatPeriodForDisplay(period);
                return (
                    <div key={period} className="h-full flex-1 group relative cursor-pointer">
                        <div className={`h-full w-full ${colorClass}`}></div>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                           {displayPeriod}: <span className="font-bold">{status || 'No Generado'}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const DynamicStatusIndicator: React.FC<{ client: Client, declaration: Declaration }> = ({ client, declaration }) => {
    const { status, period, updatedAt, paidAt, declaredAt } = declaration;
    const isMonthly = client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad;
    const isSemestral = client.category.includes('Semestral');
    const frequency = isMonthly ? 'MEN' : (isSemestral ? 'SEM' : '');

    if (status === DeclarationStatus.Pagada || status === DeclarationStatus.Enviada) {
        const statusDate = paidAt ? new Date(paidAt) : (declaredAt ? new Date(declaredAt) : new Date(updatedAt));
        const fullPeriodDisplay = formatPeriodForDisplay(period);
        const currentPeriodDisplay = fullPeriodDisplay.includes('Renta') ? fullPeriodDisplay : `${frequency} ${fullPeriodDisplay.split(' ')[0]}`;
        const nextPeriod = getNextPeriod(period);
        const nextDueDate = getDueDateForPeriod(client, nextPeriod);
        const fullNextPeriodDisplay = formatPeriodForDisplay(nextPeriod);
        const nextPeriodDisplay = fullNextPeriodDisplay.includes('Renta') ? fullNextPeriodDisplay : null;
        const nextFrequency = nextPeriod.includes("-S") ? 'SEM' : (nextPeriod.includes("-") ? 'MEN' : '');

        return (
            <div className="text-xs text-right flex-shrink-0 ml-2">
                <div className="flex items-center justify-end space-x-1 text-green-500 font-bold">
                    <ShieldCheck size={14} />
                    <span>Al día con el SRI</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                    {status === DeclarationStatus.Pagada ? 'Pag.' : 'Decl.'} {currentPeriodDisplay}: {format(statusDate, 'dd MMM/yy', { locale: es })}
                </div>
                {nextDueDate && (
                    <div className="text-gray-500 dark:text-gray-500">
                        Próx. {nextPeriodDisplay || `${nextFrequency} ${formatPeriodForDisplay(nextPeriod).split(' ')[0]}`}: {format(nextDueDate, 'dd MMM/yy', { locale: es })}
                    </div>
                )}
            </div>
        );
    }
    
    const dueDate = getDueDateForPeriod(client, period);
    const daysUntilDue = dueDate ? getDaysUntilDue(dueDate) : null;
    const periodDisplay = formatPeriodForDisplay(period).split(' ')[0];

    if (daysUntilDue !== null && daysUntilDue < 0) {
        return (
            <div className="text-xs text-right text-red-500 font-semibold flex-shrink-0 ml-2">
                <div>Venció hace {Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? 'día' : 'días'}</div>
                <div className="text-red-400/80">{frequency} {periodDisplay} - {dueDate ? format(dueDate, 'dd MMM/yy', { locale: es }) : ''}</div>
            </div>
        );
    } else {
        let countdownText = '';
        let colorClass = 'text-gray-400';
         if (daysUntilDue !== null) {
            if (daysUntilDue > 1) {
                countdownText = `en ${daysUntilDue} días`;
                colorClass = daysUntilDue <= 7 ? 'text-yellow-500' : 'text-gray-400';
            } else if (daysUntilDue === 1) {
                countdownText = 'mañana';
                colorClass = 'text-yellow-500 font-semibold';
            } else if (daysUntilDue === 0) {
                countdownText = 'hoy';
                colorClass = 'text-orange-500 font-bold';
            }
         }

        return (
            <div className="text-xs text-right flex-shrink-0 ml-2">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Pendiente: {periodDisplay}</div>
                {countdownText && <div className={colorClass}>Vence {dueDate ? format(dueDate, 'dd MMM/yy', { locale: es }) : ''} ({countdownText})</div>}
            </div>
        );
    }
};

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
  clients,
  setClients,
  initialFilter,
  navigate,
  serviceFees,
  initialClientData,
  clearInitialClientData,
  clientToView,
  clearClientToView,
  sriCredentials
}) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const [sortOption, setSortOption] = useState<'9th_digit' | 'name' | 'status'>('9th_digit');
    const [filterOption, setFilterOption] = useState<'active' | 'inactive' | 'all'>('active');
    
    // --- SMART TABS STATE LOGIC ---
    const getInitialGroupTab = () => {
        if (!initialFilter?.category) return 'all';
        const cat = initialFilter.category;
        if (cat.includes('Mensual') && !cat.includes('Devolución')) return 'mensual';
        if (cat.includes('Semestral')) return 'semestral';
        if (cat.includes('Renta') || cat.includes('Popular')) return 'renta';
        if (cat.includes('Devolución')) return 'devolucion';
        return 'all';
    };

    const [activeGroupTab, setActiveGroupTab] = useState(getInitialGroupTab());
    const [specificCategoryFilter, setSpecificCategoryFilter] = useState<ClientCategory | null>(initialFilter?.category || null);
    const [regimeFilter, setRegimeFilter] = useState<TaxRegime | 'all'>('all');

    // Reset filters if navigation changes from outside
    useEffect(() => {
        setActiveGroupTab(getInitialGroupTab());
        setSpecificCategoryFilter(initialFilter?.category || null);
    }, [initialFilter]);

    // Handle Tab Click - Clears specific filters to allow broader view
    const handleTabClick = (tabId: string) => {
        setActiveGroupTab(tabId);
        setSpecificCategoryFilter(null); // Unlock the specific filter when user manually switches tabs
    };

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
        if(clientToView) {
            setSelectedClient(clientToView);
            setIsClientDetailsOpen(true);
            clearClientToView();
        }
    }, [clientToView, clearClientToView]);

    useEffect(() => {
        if (initialClientData) {
            // If there's initial data, open the modal to create a new client
            setIsModalOpen(true);
            clearInitialClientData();
        }
    }, [initialClientData, clearInitialClientData]);
    
    // --- FILTER LOGIC ---
    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            if (client.isDeleted) return false;
            
            // Status Filter
            const statusMatch = filterOption === 'all' || 
                               (filterOption === 'active' && (client.isActive ?? true)) || 
                               (filterOption === 'inactive' && !(client.isActive ?? true));
            if (!statusMatch) return false;
            
            // Search Filter
            const searchMatch = searchTerm === '' || 
                                client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                client.ruc.includes(searchTerm);
            if (!searchMatch) return false;

            // Specific Category Filter (From Dashboard Navigation)
            if (specificCategoryFilter) {
                if (client.category !== specificCategoryFilter) return false;
            } else {
                // Group Filter (Smart Tabs)
                if (activeGroupTab === 'mensual') {
                    if (!client.category.includes('Mensual') || client.category.includes('Devolución')) return false;
                } else if (activeGroupTab === 'semestral') {
                    if (!client.category.includes('Semestral')) return false;
                } else if (activeGroupTab === 'renta') {
                    if (!client.category.includes('Renta') && !client.category.includes('Popular')) return false;
                } else if (activeGroupTab === 'devolucion') {
                    if (!client.category.includes('Devolución')) return false;
                }
            }

            // Additional Filter (Regime)
            if (regimeFilter !== 'all' && client.regime !== regimeFilter) return false;

            return true;
        });
    }, [clients, searchTerm, specificCategoryFilter, filterOption, activeGroupTab, regimeFilter]);
    
     const sortedClients = useMemo(() => {
        const getStatusScore = (client: Client): number => {
            const currentPeriod = getPeriod(client, new Date());
            const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
            const dueDate = getDueDateForPeriod(client, currentPeriod);
            if (declaration?.status === DeclarationStatus.Enviada) return 1;
            if (dueDate && isPast(dueDate)) return 0;
            if (declaration?.status === DeclarationStatus.Pendiente) return 2;
            return 3;
        };
        return [...filteredClients].sort((a, b) => {
            if (sortOption === 'status') return getStatusScore(a) - getStatusScore(b) || a.name.localeCompare(b.name);
            if (sortOption === 'name') return a.name.localeCompare(b.name);
            const sortKeyA = getIdentifierSortKey(a.ruc);
            const sortKeyB = getIdentifierSortKey(b.ruc);
            return sortKeyA - sortKeyB || a.name.localeCompare(b.name);
        });
    }, [filteredClients, sortOption]);

    const handleCreateClient = (client: Client) => {
        if (clients.some(c => c.ruc === client.ruc)) {
            toast.error('Ya existe un cliente con este RUC.');
            return;
        }
        setClients(prev => [client, ...prev]);
        setIsModalOpen(false);
        toast.success('Cliente creado exitosamente');
    };

    const handleUpdateClient = (updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
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
    
    // UI Helpers for Client Card
    const getClientCardBg = (client: Client) => {
        if (client.category.includes('Suscripción')) return 'bg-sky-50 dark:bg-sky-900/20';
        if (client.category.includes('Interno')) return 'bg-blue-50 dark:bg-blue-900/10';
        return 'bg-white dark:bg-gray-800';
    }
    
    const getClientCardBorder = (client: Client) => {
        if (!client.declarationHistory || client.declarationHistory.length === 0) {
            const dueDate = getDueDateForPeriod(client, getPeriod(client, new Date()));
            if (dueDate && isPast(dueDate)) return 'border-red-500';
            return 'border-gray-200 dark:border-gray-700';
        }
        const latestDeclaration = [...client.declarationHistory].sort((a,b) => b.period.localeCompare(a.period))[0];
        if (latestDeclaration.status === DeclarationStatus.Pendiente || latestDeclaration.status === DeclarationStatus.Enviada) {
            const dueDate = getDueDateForPeriod(client, latestDeclaration.period);
            if (dueDate && isPast(dueDate)) return 'border-red-500';
            if (dueDate && getDaysUntilDue(dueDate)! <= 7) return 'border-yellow-500';
        }
        return 'border-gray-200 dark:border-gray-700';
    }

    const statusCounts = useMemo(() => {
        let pending = 0;
        let completed = 0;
        const now = new Date();
        sortedClients.forEach(client => {
            const currentPeriod = getPeriod(client, now);
            const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
            const dueDate = getDueDateForPeriod(client, currentPeriod);
            if (!declaration || declaration.status === DeclarationStatus.Pendiente || declaration.status === DeclarationStatus.Enviada || (dueDate && isPast(dueDate))) {
                pending++;
            } else {
                completed++;
            }
        });
        return { pending, completed };
    }, [sortedClients]);

    if (selectedClient) {
        return (
             <div className={`fixed inset-0 z-30 h-full overflow-y-auto bg-white dark:bg-gray-900 transform transition-transform duration-500 ${isClientDetailsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <ClientDetailView client={selectedClient} onSave={handleUpdateClient} onBack={handleCloseClientDetails} serviceFees={serviceFees} sriCredentials={sriCredentials}/>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-display text-sky-600 dark:text-sky-400 mb-2 sm:mb-0">{initialFilter?.title || 'Todos los Clientes'}</h2>
                <div className="flex space-x-2">
                    <a href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 bg-slate-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-slate-700 transition-colors text-sm font-medium"><ExternalLink size={16} /><span>Ir al SRI</span></a>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-5 py-2 rounded-xl shadow-lg shadow-sky-200 dark:shadow-sky-900/30 hover:scale-105 transition-all"><Plus size={20} /><span>Nuevo Cliente</span></button>
                </div>
            </div>
            
            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="Buscar por nombre o RUC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-sm" />
                </div>
                <div className="relative" ref={sortMenuRef}>
                    <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="w-full sm:w-auto p-3 px-4 flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm"><SlidersHorizontal size={18} /><span className="text-sm font-medium">Filtros</span></button>
                    {isSortMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-10 border border-slate-100 dark:border-gray-700 p-2 animate-fade-in-down">
                            <p className="text-xs font-bold text-slate-400 px-2 pb-1 uppercase tracking-wider">Estado</p>
                            <div className="flex space-x-1 mb-3">
                                {[{id: 'active', label: 'Activos', icon: UserCheck}, {id: 'inactive', label: 'Inactivos', icon: UserX}, {id: 'all', label: 'Todos', icon: Users}].map(item => (
                                     <button key={item.id} onClick={() => setFilterOption(item.id as any)} className={`flex-1 p-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${filterOption === item.id ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500'}`}><item.icon size={14}/><span>{item.label}</span></button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* OBLIGATION TYPE TABS - NEW ELITE NAVIGATION */}
            <div className="mb-4 overflow-x-auto pb-2">
                <div className="flex space-x-2">
                    {OBLIGATION_GROUPS.map(group => (
                        <button
                            key={group.id}
                            onClick={() => handleTabClick(group.id)}
                            className={`
                                flex items-center space-x-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all whitespace-nowrap
                                ${activeGroupTab === group.id 
                                    ? `border-transparent shadow-md ring-2 ring-offset-1 ring-sky-500 ${group.color.replace('bg-slate-100', 'bg-slate-200').replace('text-slate-600', 'text-slate-800')}` 
                                    : `border-transparent bg-white dark:bg-gray-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-700`
                                }
                            `}
                        >
                            <group.icon size={16} />
                            <span>{group.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            
             {(initialFilter?.title || specificCategoryFilter) && (
                <div className="mb-4 flex items-center justify-between text-sm">
                    <div className="flex items-center bg-sky-100 text-sky-800 px-3 py-1 rounded-full text-xs font-bold">
                        <span className="mr-2">Filtrado por:</span> {specificCategoryFilter || initialFilter?.title || 'Filtro Personalizado'}
                        <button onClick={() => { navigate('clients'); setSpecificCategoryFilter(null); }} className="ml-2 hover:text-sky-900"><X size={14}/></button>
                    </div>
                </div>
             )}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 flex items-center justify-between px-1">
                <span>Mostrando {sortedClients.length} Clientes</span>
                <span>Resumen: <strong className="text-slate-700 dark:text-slate-200">{statusCounts.pending}</strong> Pendientes / <strong className="text-slate-700 dark:text-slate-200">{statusCounts.completed}</strong> Completadas</span>
            </div>
            
            <div className="space-y-4">
                {sortedClients.map((client, index) => {
                    const latestDeclaration = [...client.declarationHistory].sort((a,b) => b.period.localeCompare(a.period)).find(d => d.status === DeclarationStatus.Pendiente || d.status === DeclarationStatus.Enviada);
                    const overduePayments = client.declarationHistory.filter(d => {
                        const dueDate = getDueDateForPeriod(client, d.period);
                        return dueDate && isPast(dueDate) && d.status !== DeclarationStatus.Pagada;
                    }).length;

                    let GroupIcon = Layers;
                    if (client.category.includes('Mensual')) GroupIcon = Calendar;
                    else if (client.category.includes('Semestral')) GroupIcon = Clock;
                    else if (client.category.includes('Renta') || client.category.includes('Popular')) GroupIcon = TrendingUp;
                    else if (client.category.includes('Devolución')) GroupIcon = DollarSign;

                    return (
                        <div key={client.id} onClick={() => handleOpenClientDetails(client)} className={`p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-700 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer border-l-4 ${getClientCardBg(client)} ${getClientCardBorder(client)} animate-slide-up-fade group`}>
                            <div className="flex justify-between items-start">
                               <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate text-lg group-hover:text-sky-600 transition-colors">{client.name}</h3>
                                        {client.isActive === false && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Inactivo</span>}
                                    </div>
                                    <div className="flex items-center space-x-3 text-sm text-slate-500 dark:text-gray-400 mb-2">
                                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{client.ruc}</span>
                                        <button className="hover:text-sky-500 transition-colors" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(client.ruc); alert('RUC copiado!'); }}><Copy size={14} /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-1">
                                            <GroupIcon size={12}/> {client.category}
                                        </span>
                                    </div>
                               </div>
                               <div className="flex-shrink-0 ml-2">
                                {latestDeclaration ? (<DynamicStatusIndicator client={client} declaration={latestDeclaration}/>) : (client.isActive ?? true) && (<div className="text-xs text-right text-slate-400 italic">Sin historial reciente</div>)}
                               </div>
                            </div>
                            <div className="mt-4">
                                <DeclarationProgressBar client={client} />
                            </div>
                            {overduePayments > 0 && (<div className="mt-3 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg inline-flex items-center space-x-1"><AlertTriangle size={14} /><span>{overduePayments} {overduePayments > 1 ? 'pagos vencidos' : 'pago vencido'} - ¡Atención!</span></div>)}
                        </div>
                    );
                })}
                
                {sortedClients.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="inline-flex p-4 rounded-full bg-slate-50 dark:bg-slate-800 mb-4">
                            <Users size={32} className="text-slate-300"/>
                        </div>
                        <p className="text-slate-500 font-medium">No se encontraron clientes en esta categoría.</p>
                        <p className="text-xs text-slate-400 mt-1">Pruebe cambiando los filtros o la búsqueda.</p>
                    </div>
                )}
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Agregar Nuevo Cliente"
                disableBackdropClick={true} // Prevents accidental closing
            >
                 <ClientForm 
                    onSubmit={handleCreateClient} 
                    onCancel={() => setIsModalOpen(false)} 
                    initialData={initialClientData || undefined}
                    sriCredentials={sriCredentials}
                />
            </Modal>
        </div>
    );
};
