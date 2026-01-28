
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime, Screen, ClientFilter, ServiceFeesConfig, DeclarationStatus } from '../types';
import { Plus, Search, UserCheck, UserX, Users, ExternalLink, SlidersHorizontal, X } from 'lucide-react';
import { getPeriod, getDueDateForPeriod, getIdentifierSortKey } from '../services/sri';
import { Modal } from '../components/Modal';
import { isPast } from 'date-fns';
import { ClientDetailView } from '../components/ClientDetailView';
import { VirtualClientList } from '../components/VirtualClientList';
import { ClientForm } from '../components/ClientForm';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
    
    // Filters
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [sortOption, setSortOption] = useState<'9th_digit' | 'name' | 'status'>('9th_digit');
    const [filterOption, setFilterOption] = useState<'active' | 'inactive' | 'all'>('active');
    const [categoryFilter, setCategoryFilter] = useState<ClientCategory | 'all'>('all');
    const [regimeFilter, setRegimeFilter] = useState<TaxRegime | 'all'>('all');
    
    const sortMenuRef = useRef<HTMLDivElement>(null);

    // Initial Load Logic
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
        }
    }, [initialClientData]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setIsSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Optimized Sorting and Filtering
    const filteredAndSortedClients = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        
        let result = clients.filter(client => {
            if (client.isDeleted) return false;
            
            const statusMatch = filterOption === 'all' || 
                               (filterOption === 'active' && (client.isActive ?? true)) || 
                               (filterOption === 'inactive' && !(client.isActive ?? true));
            if (!statusMatch) return false;
            
            const searchMatch = searchTerm === '' || 
                                client.name.toLowerCase().includes(searchLower) || 
                                client.ruc.includes(searchLower);
            if (!searchMatch) return false;

            if (categoryFilter !== 'all' && client.category !== categoryFilter) return false;
            if (regimeFilter !== 'all' && client.regime !== regimeFilter) return false;
            
            if (initialFilter) {
                 if (initialFilter.category && client.category !== initialFilter.category) return false;
                 if (initialFilter.regimes && !initialFilter.regimes.includes(client.regime)) return false;
            }

            return true;
        });

        // Sorting Helper
        const getStatusScore = (c: Client) => {
            const p = getPeriod(c, new Date());
            const d = c.declarationHistory.find(dh => dh.period === p);
            const due = getDueDateForPeriod(c, p);
            if (d?.status === DeclarationStatus.Enviada) return 1;
            if (due && isPast(due)) return 0; // Urgent
            return 2;
        };

        return result.sort((a, b) => {
            if (sortOption === 'status') return getStatusScore(a) - getStatusScore(b) || a.name.localeCompare(b.name);
            if (sortOption === 'name') return a.name.localeCompare(b.name);
            const keyA = getIdentifierSortKey(a.ruc);
            const keyB = getIdentifierSortKey(b.ruc);
            return keyA - keyB || a.name.localeCompare(b.name);
        });
    }, [clients, searchTerm, filterOption, categoryFilter, regimeFilter, initialFilter, sortOption]);

    // Handlers
    const handleSaveClient = (client: Client) => {
        setClients(prev => [...prev, client]);
        setIsModalOpen(false);
        clearInitialClientData();
    };

    const handleUpdateClient = (updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setSelectedClient(updatedClient);
    };

    const handleQuickAction = (client: Client, action: 'declare' | 'pay') => {
        setSelectedClient(client);
        setIsClientDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setIsClientDetailsOpen(false);
        setTimeout(() => setSelectedClient(null), 300);
    };

    if (selectedClient) {
        return (
             <div className={`fixed inset-0 z-30 h-full overflow-y-auto bg-white dark:bg-gray-900 transform transition-transform duration-300 ${isClientDetailsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <ClientDetailView 
                    client={selectedClient} 
                    onSave={handleUpdateClient} 
                    onBack={handleCloseDetails} 
                    serviceFees={serviceFees} 
                    sriCredentials={sriCredentials}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 flex-shrink-0">
                <h2 className="text-3xl font-display text-sky-600 dark:text-sky-400 mb-2 sm:mb-0">{initialFilter?.title || 'Todos los Clientes'}</h2>
                <div className="flex space-x-2">
                    <a href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 bg-slate-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-slate-700 transition-colors text-sm font-medium"><ExternalLink size={16} /><span>Ir al SRI</span></a>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-5 py-2 rounded-xl shadow-lg shadow-sky-200 dark:shadow-sky-900/30 hover:scale-105 transition-all"><Plus size={20} /><span>Nuevo Cliente</span></button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                 <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="Buscar por nombre o RUC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-sm" />
                </div>
                <div className="relative" ref={sortMenuRef}>
                     <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="w-full sm:w-auto p-3 px-4 flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm"><SlidersHorizontal size={18} /><span className="text-sm font-medium">Filtros</span></button>
                     {isSortMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 border border-slate-100 dark:border-gray-700 p-2 animate-fade-in-down">
                            <div className="flex space-x-1 mb-3">
                                {[{id: 'active', icon: UserCheck}, {id: 'inactive', icon: UserX}, {id: 'all', icon: Users}].map(item => (
                                     <button key={item.id} onClick={() => setFilterOption(item.id as any)} className={`flex-1 p-2 rounded-lg flex justify-center ${filterOption === item.id ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-100 text-slate-500'}`}><item.icon size={16}/></button>
                                ))}
                            </div>
                            <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value as any)} className="w-full p-2 mb-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-900">
                                <option value="all">Todos los Regímenes</option>
                                {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                     )}
                </div>
            </div>
            
            {/* Active Filters Display */}
             {initialFilter?.title && (
                <div className="mb-4 flex items-center justify-between text-sm flex-shrink-0">
                    <div className="flex items-center bg-sky-100 text-sky-800 px-3 py-1 rounded-full text-xs font-bold">
                        <span className="mr-2">Filtrado por:</span> {initialFilter.title}
                        <button onClick={() => navigate('home')} className="ml-2 hover:text-sky-900"><X size={14}/></button>
                    </div>
                </div>
             )}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between px-1 flex-shrink-0">
                <span>Mostrando {filteredAndSortedClients.length} clientes</span>
            </div>

            {/* Content (Virtualized) */}
            <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                <VirtualClientList 
                    clients={filteredAndSortedClients} 
                    serviceFees={serviceFees} 
                    onView={(c) => { setSelectedClient(c); setIsClientDetailsOpen(true); }}
                    onQuickAction={handleQuickAction}
                />
            </div>

            {/* Create Client Modal (Extracted) */}
             <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); clearInitialClientData(); }} title="Agregar Nuevo Cliente">
                 <ClientForm 
                    initialData={initialClientData || {}} 
                    onSubmit={handleSaveClient} 
                    onCancel={() => { setIsModalOpen(false); clearInitialClientData(); }}
                    sriCredentials={sriCredentials}
                 />
             </Modal>
        </div>
    );
};
