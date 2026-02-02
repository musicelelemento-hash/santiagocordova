
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, TranscribableField } from '../types';
import { Plus, Search, User, Users, X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, ExternalLink, ShieldCheck, Phone, Mail, FileText, Zap, UserCheck, ToggleLeft, ToggleRight, UserX, UserCheck2, MoreHorizontal, Printer, Clipboard, CheckCircle, SlidersHorizontal, MessageCircle, Pin, Send, XCircle, Loader, ArrowDownToLine, ChevronUp, ChevronDown, Sparkles, AlertTriangle, Star, Info, Clock, Mic, Image as ImageIcon, MapPin, Briefcase, Key, CreditCard, Calendar } from 'lucide-react';
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
import { VirtualClientList } from '../components/VirtualClientList';

// Agregamos el grupo 'devolucion' explícitamente
const OBLIGATION_GROUPS = [
    { id: 'all', label: 'Todas', icon: Calendar, color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
    { id: 'mensual', label: 'IVA Mensual', icon: Clock, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
    { id: 'semestral', label: 'IVA Semestral', icon: Briefcase, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
    { id: 'renta', label: 'Impuesto Renta', icon: DollarSign, color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20' },
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
    const [isComboModalOpen, setIsComboModalOpen] = useState(false);
    
    // Smart Tabs Logic
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
            setIsModalOpen(true);
            clearInitialClientData();
        }
    }, [initialClientData, clearInitialClientData]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            if (client.isDeleted) return false;
            
            const statusMatch = filterOption === 'all' || 
                               (filterOption === 'active' && (client.isActive ?? true)) || 
                               (filterOption === 'inactive' && !(client.isActive ?? true));
            if (!statusMatch) return false;
            
            const term = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' || 
                                client.name.toLowerCase().includes(term) || 
                                client.ruc.includes(term) ||
                                (client.tradeName && client.tradeName.toLowerCase().includes(term)) ||
                                (client.notes && client.notes.toLowerCase().includes(term));
            
            if (!searchMatch) return false;

            if (activeGroupTab === 'mensual') {
                if (!client.category.includes('Mensual') || client.category.includes('Devolución')) return false;
            } else if (activeGroupTab === 'semestral') {
                const isSemestralCategory = client.category.includes('Semestral');
                const isRimpeEmp = client.regime === TaxRegime.RimpeEmprendedor;
                if (!isSemestralCategory && !isRimpeEmp) return false;
            } else if (activeGroupTab === 'renta') {
                const hasRenta = 
                    client.category.includes('Renta') || 
                    client.category.includes('Popular') ||
                    client.regime === TaxRegime.RimpeEmprendedor ||
                    client.regime === TaxRegime.General;
                if (!hasRenta) return false;
            } else if (activeGroupTab === 'devolucion') {
                if (!client.category.includes('Devolución') && !client.category.includes('Renta')) return false;
            }

            if (regimeFilter !== 'all' && client.regime !== regimeFilter) return false;

            return true;
        });
    }, [clients, searchTerm, specificCategoryFilter, filterOption, activeGroupTab, regimeFilter]);
    
    // --- LÓGICA DE ORDENAMIENTO MEJORADA (CALENDARIO SRI) ---
    const sortedClients = useMemo(() => {
        return [...filteredClients].sort((a, b) => {
            if (sortOption === 'name') return a.name.localeCompare(b.name);
            
            if (sortOption === '9th_digit') {
                // Obtenemos el periodo actual para calcular el vencimiento real
                const periodA = getPeriod(a, new Date());
                const periodB = getPeriod(b, new Date());
                
                const dueA = getDueDateForPeriod(a, periodA);
                const dueB = getDueDateForPeriod(b, periodB);
                
                // Si ambos tienen fecha, ordenamos por fecha (esto maneja el 1...9, 0 correctamente)
                if (dueA && dueB) {
                    return dueA.getTime() - dueB.getTime();
                }
                
                // Fallback a lógica de dígito si falla la fecha (0 al final)
                const digitA = parseInt(a.ruc[8] || '0', 10);
                const digitB = parseInt(b.ruc[8] || '0', 10);
                const valA = digitA === 0 ? 10 : digitA;
                const valB = digitB === 0 ? 10 : digitB;
                return valA - valB;
            }
            
            return 0;
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
                status: 'Pendiente' as any // Force cast if needed or use enum
            } 
        });
        setIsComboModalOpen(false);
    };

    if (selectedClient) {
        return (
             <div className={`fixed inset-0 z-30 h-full overflow-y-auto bg-white dark:bg-gray-900 transform transition-transform duration-500 ${isClientDetailsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <ClientDetailView client={selectedClient} onSave={handleUpdateClient} onBack={handleCloseClientDetails} serviceFees={serviceFees} sriCredentials={sriCredentials}/>
            </div>
        );
    }

    return (
        <div>
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
                    <input type="text" placeholder="Buscar por nombre, RUC o notas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-sm" />
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
                            <p className="text-xs font-bold text-slate-400 px-2 pb-1 uppercase tracking-wider">Orden</p>
                            <div className="flex flex-col space-y-1">
                                <button onClick={() => setSortOption('9th_digit')} className={`text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors ${sortOption === '9th_digit' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30' : 'hover:bg-slate-50 dark:hover:bg-gray-700'}`}>Por Calendario SRI (Vencimiento)</button>
                                <button onClick={() => setSortOption('name')} className={`text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors ${sortOption === 'name' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30' : 'hover:bg-slate-50 dark:hover:bg-gray-700'}`}>Por Nombre</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* OBLIGATION TYPE TABS */}
            <div className="mb-4 overflow-x-auto pb-2">
                <div className="flex space-x-2">
                    {OBLIGATION_GROUPS.map(group => (
                        <button
                            key={group.id}
                            onClick={() => { setActiveGroupTab(group.id); setSpecificCategoryFilter(null); }}
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

            {/* --- COMBO BUTTON SECTION (Only visible on Devoluciones Tab) --- */}
            {activeGroupTab === 'devolucion' && (
                <div className="mb-6 p-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg animate-fade-in-down flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Producto Destacado</span>
                            <span className="text-xl font-bold">Combo Devolución Renta</span>
                        </div>
                        <p className="text-emerald-100 text-sm max-w-md">
                            Incluye: Declaración de Renta + Anexo Gastos Personales + Solicitud de Devolución de Retenciones.
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsComboModalOpen(true)}
                        className="px-6 py-3 bg-white text-emerald-700 font-black rounded-xl shadow-lg hover:bg-emerald-50 transition-transform transform hover:scale-105 flex items-center gap-2"
                    >
                        <Plus size={20} strokeWidth={3}/> Vender Combo $25.00
                    </button>
                </div>
            )}
            
            {/* Client List */}
            <div className="space-y-4">
                 <VirtualClientList 
                    clients={sortedClients} 
                    serviceFees={serviceFees} 
                    onView={handleOpenClientDetails}
                />
            </div>

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

            {/* Modal para Seleccionar Cliente del Combo */}
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
                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{c.name}</p>
                                    <p className="text-xs text-slate-500">{c.ruc}</p>
                                </div>
                                <span className="text-emerald-600 opacity-0 group-hover:opacity-100 font-bold text-xs">Seleccionar →</span>
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-2">
                        <button 
                            onClick={() => { setIsComboModalOpen(false); setIsModalOpen(true); }}
                            className="w-full py-3 bg-brand-navy text-white font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                            <Plus size={18}/> Crear Nuevo Cliente
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
