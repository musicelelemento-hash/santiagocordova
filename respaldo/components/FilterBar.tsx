
// LOCKED COMPONENT - DO NOT MODIFY LOGIC
// Este componente maneja la barra de búsqueda y los filtros de estado de clientes.
// Contiene la lógica visual de los tabs de estado y el menú desplegable de filtros avanzados.

import React from 'react';
import { Search, SlidersHorizontal, UserCheck, UserX, Users } from 'lucide-react';
import { ClientCategory, TaxRegime } from '../types';

interface FilterBarProps {
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    declarationStatusFilter: string;
    setDeclarationStatusFilter: (val: any) => void;
    isSortMenuOpen: boolean;
    setIsSortMenuOpen: (val: boolean) => void;
    sortMenuRef: React.RefObject<HTMLDivElement>;
    categoryFilter: string;
    setCategoryFilter: (val: any) => void;
    regimeFilter: string;
    setRegimeFilter: (val: any) => void;
    filterOption: string;
    setFilterOption: (val: any) => void;
    statusTabs: Array<{ id: string; label: string; icon: React.ElementType; color: string }>;
    uiText: any;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    searchTerm,
    setSearchTerm,
    declarationStatusFilter,
    setDeclarationStatusFilter,
    isSortMenuOpen,
    setIsSortMenuOpen,
    sortMenuRef,
    categoryFilter,
    setCategoryFilter,
    regimeFilter,
    setRegimeFilter,
    filterOption,
    setFilterOption,
    statusTabs,
    uiText
}) => {
    return (
        <div className="mb-4 flex flex-col space-y-4">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder={uiText.global.searchPlaceholder} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full p-3 pl-10 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-sm" 
                />
            </div>
            
            {/* QUICK STATUS FILTERS */}
            <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                {statusTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setDeclarationStatusFilter(tab.id as any)}
                        className={`
                            flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap
                            ${declarationStatusFilter === tab.id 
                                ? `border-transparent shadow-md ring-2 ring-offset-1 ring-sky-500 ${tab.color.replace('bg-slate-100', 'bg-slate-200').replace('text-slate-600', 'text-slate-800')}` 
                                : `border-transparent hover:bg-white dark:hover:bg-gray-700 ${tab.color} opacity-70 hover:opacity-100`
                            }
                        `}
                    >
                        <tab.icon size={16} />
                        <span className="text-sm font-bold">{tab.label}</span>
                    </button>
                ))}
                
                {/* Advanced Filters Toggle */}
                <div className="relative ml-auto" ref={sortMenuRef}>
                    <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className={`h-full px-4 flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 border ${categoryFilter !== 'all' || regimeFilter !== 'all' ? 'border-sky-500 text-sky-600' : 'border-slate-200 dark:border-gray-700 text-slate-500'} rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm`}>
                        <SlidersHorizontal size={18} />
                    </button>
                    {isSortMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 border border-slate-100 dark:border-gray-700 p-2 animate-fade-in-down">
                            <p className="text-xs font-bold text-slate-400 px-2 pb-1 uppercase tracking-wider">{uiText.clients.filters.status}</p>
                            <div className="flex space-x-1 mb-3">
                                {[{id: 'active', label: uiText.clients.filters.active, icon: UserCheck}, {id: 'inactive', label: uiText.clients.filters.inactive, icon: UserX}, {id: 'all', label: uiText.clients.filters.all, icon: Users}].map(item => (
                                     <button key={item.id} onClick={() => setFilterOption(item.id as any)} className={`flex-1 p-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${filterOption === item.id ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500'}`}><item.icon size={14}/><span>{item.label}</span></button>
                                ))}
                            </div>
                            <p className="text-xs font-bold text-slate-400 px-2 pb-1 uppercase tracking-wider">{uiText.clients.filters.obligation}</p>
                            <select 
                                value={categoryFilter} 
                                onChange={(e) => setCategoryFilter(e.target.value as any)} 
                                className="w-full p-2 mb-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-xs"
                            >
                                <option value="all">Todas</option>
                                {Object.values(ClientCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <p className="text-xs font-bold text-slate-400 px-2 pb-1 uppercase tracking-wider">{uiText.clients.filters.regime}</p>
                            <select 
                                value={regimeFilter} 
                                onChange={(e) => setRegimeFilter(e.target.value as any)} 
                                className="w-full p-2 mb-1 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-xs"
                            >
                                <option value="all">Todos</option>
                                {Object.values(TaxRegime).map(reg => <option key={reg} value={reg}>{reg}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
