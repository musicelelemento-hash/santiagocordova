import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, Command, Globe, Users, 
    LayoutDashboard, Settings, LogOut, 
    ChevronRight, Zap, RefreshCw, PlusCircle,
    Copy, User, FileText, KeyRound, Wallet,
    Calendar, TrendingUp, ShieldCheck, FileSpreadsheet,
    DollarSign, Briefcase, FileCheck, Layers, Award
} from 'lucide-react';
import { Client } from '../types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onNavigate: (screen: string) => void;
    onAction: (action: string, payload?: any) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ 
    isOpen, onClose, clients, onNavigate, onAction 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const placeholders = [
        "Buscar cliente por nombre o RUC...",
        "Escribe 'Dashboard' o 'Inicio'...",
        "Escribe 'Firmas' o 'Facturación'...",
        "Escribe 'Cobranza' o 'Reportes'...",
        "Presiona 'Enter' para seleccionar...",
        "Pulsa 'Esc' para cerrar comando..."
    ];

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
            const interval = setInterval(() => {
                setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const ALL_NAV_ITEMS = [
        { id: 'nav-dash', type: 'nav', label: 'Dashboard Principal', screen: 'home', icon: <LayoutDashboard size={18} className="text-[#00A896]" /> },
        { id: 'nav-clients', type: 'nav', label: 'Expedientes de Clientes', screen: 'clients', icon: <Users size={18} className="text-[#2B6AFF]" /> },
        { id: 'nav-firmas', type: 'nav', label: 'Gestor de Firmas .P12', screen: 'firmas', icon: <KeyRound size={18} className="text-[#C9A96E]" /> },
        { id: 'nav-facturacion', type: 'nav', label: 'Facturación SRI & Nueva Luz 3.0', screen: 'sri_facturacion', icon: <Zap size={18} className="text-[#00A896]" /> },
        { id: 'nav-cobranza', type: 'nav', label: 'Cartera y Cobranzas', screen: 'cobranza', icon: <Wallet size={18} className="text-rose-400" /> },
        { id: 'nav-tasks', type: 'nav', label: 'Tareas & Órdenes Tácticas', screen: 'tasks', icon: <Briefcase size={18} className="text-amber-400" /> },
        { id: 'nav-reports', type: 'nav', label: 'Reportes & Analítica IA', screen: 'reports', icon: <TrendingUp size={18} className="text-teal-400" /> },
        { id: 'nav-calendar', type: 'nav', label: 'Calendario Fiscal SRI', screen: 'calendar', icon: <Calendar size={18} className="text-indigo-400" /> },
        { id: 'nav-facturadores', type: 'nav', label: 'Facturadores Electrónicos', screen: 'facturadores', icon: <FileSpreadsheet size={18} className="text-[#00A896]" /> },
        { id: 'nav-cotizaciones', type: 'nav', label: 'Cotizaciones de Servicios', screen: 'cotizaciones', icon: <DollarSign size={18} className="text-emerald-400" /> },
        { id: 'nav-crm', type: 'nav', label: 'Pipeline CRM de Clientes', screen: 'crm_pipeline', icon: <Layers size={18} className="text-[#2B6AFF]" /> },
        { id: 'nav-audit', type: 'nav', label: 'Registro de Auditoría', screen: 'audit_log', icon: <ShieldCheck size={18} className="text-slate-400" /> },
        { id: 'nav-settings', type: 'nav', label: 'Configuración del Sistema', screen: 'settings', icon: <Settings size={18} className="text-slate-300" /> },
        { id: 'nav-services', type: 'nav', label: 'Catálogo de Servicios Web', screen: 'services', icon: <Globe size={18} className="text-[#00A896]" /> },
    ];

    const results = useMemo(() => {
        const normalizedQuery = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const terms = normalizedQuery.split(/\s+/).filter(Boolean);

        if (!terms.length) {
            const navs = ALL_NAV_ITEMS.slice(0, 6);
            const actions = [
                { id: 'act-new', type: 'action', label: 'Nuevo Cliente', action: 'new_client', icon: <PlusCircle size={18} className="text-[#00A896]" /> },
                { id: 'act-sync', type: 'action', label: 'Sincronizar Datos SRI', action: 'sync', icon: <RefreshCw size={18} className="text-[#2B6AFF]" /> },
            ];
            const cls = clients.filter(c => !c.isDeleted && c.isActive).slice(0, 5).map(c => ({
                id: `client-${c.id}`,
                type: 'client',
                label: c.name,
                subLabel: `${c.ruc} · ${c.regime || 'General'}`,
                client: c,
                icon: <User size={18} className="text-[#C9A96E]" />
            }));
            return [...navs, ...actions, ...cls];
        }

        const navigationResults = ALL_NAV_ITEMS.filter(item => {
            const labelNorm = item.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const screenNorm = item.screen.toLowerCase();
            return terms.every(t => labelNorm.includes(t) || screenNorm.includes(t));
        });

        const actionResults = [
            { id: 'act-new', type: 'action', label: 'Nuevo Cliente', action: 'new_client', icon: <PlusCircle size={18} className="text-[#00A896]" /> },
            { id: 'act-sync', type: 'action', label: 'Sincronizar Datos SRI', action: 'sync', icon: <RefreshCw size={18} className="text-[#2B6AFF]" /> },
            { id: 'act-logout', type: 'action', label: 'Cerrar Sesión', action: 'logout', icon: <LogOut size={18} className="text-rose-400" /> },
        ].filter(item => {
            const labelNorm = item.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            return terms.every(t => labelNorm.includes(t));
        });

        const clientResults = clients
            .filter(c => {
                if (c.isDeleted) return false;
                const fullText = `${c.name} ${c.ruc} ${c.tradeName || ''} ${c.notes || ''}`
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase();
                return terms.every(t => fullText.includes(t));
            })
            .slice(0, 10)
            .map(c => ({
                id: `client-${c.id}`,
                type: 'client',
                label: c.name,
                subLabel: `${c.ruc} · ${c.regime || 'General'}`,
                client: c,
                icon: <User size={18} className="text-[#C9A96E]" />
            }));

        return [...navigationResults, ...actionResults, ...clientResults];
    }, [searchTerm, clients]);

    useEffect(() => {
        setSelectedIndex(Math.min(selectedIndex, results.length - 1));
        if (selectedIndex < 0 && results.length > 0) setSelectedIndex(0);
    }, [results]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) {
                handleSelect(results[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleSelect = (item: any) => {
        if (item.type === 'nav') {
            onNavigate(item.screen);
        } else if (item.type === 'action') {
            onAction(item.action);
        } else if (item.type === 'client') {
            onNavigate('clients');
            onAction('view_client', item.client.id);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[#051424]/95 border border-white/15 border-t-white/30 rounded-[2rem] shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col backdrop-blur-2xl font-mono text-white animate-in zoom-in-95 duration-200">
                {/* Search Bar Input */}
                <div className="flex items-center px-6 py-4 border-b border-white/10 relative">
                    <Search className="text-[#00A896] mr-4 shrink-0" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholders[placeholderIndex]}
                        className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 focus:outline-none uppercase tracking-wider"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white p-1">
                            <span className="text-xs">✕</span>
                        </button>
                    )}
                </div>

                {/* Results List */}
                <div ref={listRef} className="max-h-96 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                    {results.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                            <Command size={36} className="mx-auto mb-3 opacity-30 text-[#00A896]" />
                            <p className="text-xs font-bold uppercase tracking-wider">No se encontraron resultados para "{searchTerm}"</p>
                        </div>
                    ) : (
                        results.map((item, index) => {
                            const isSelected = selectedIndex === index;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                                        isSelected 
                                            ? 'bg-gradient-to-r from-[#00A896]/25 to-[#2B6AFF]/15 text-white border border-[#00A896]/40 shadow-lg' 
                                            : 'hover:bg-white/5 text-slate-300 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`p-2 rounded-xl border ${
                                            isSelected ? 'bg-[#00A896]/20 border-[#00A896]/40' : 'bg-white/5 border-white/10'
                                        }`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold uppercase tracking-wider truncate text-white">{item.label}</span>
                                            {'subLabel' in item && Boolean((item as any).subLabel) && (
                                                <span className="text-[10px] text-slate-400 font-mono truncate">{(item as any).subLabel}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                                            {item.type === 'nav' ? 'Módulo' : item.type === 'action' ? 'Acción' : 'Cliente'}
                                        </span>
                                        <ChevronRight size={14} className={isSelected ? 'text-[#00A896]' : 'text-slate-600'} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Hotkeys Guide */}
                <div className="px-6 py-3 border-t border-white/10 bg-[#020b14]/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center gap-4">
                        <span>↑↓ Navegar</span>
                        <span>↵ Seleccionar</span>
                        <span>ESC Cerrar</span>
                    </div>
                    <span className="text-[#00A896] font-bold">Santiago Córdova PRO</span>
                </div>
            </div>
        </div>
    );
};
