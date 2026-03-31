import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, Command, Globe, Users, 
    LayoutDashboard, Settings, LogOut, 
    ChevronRight, Zap, RefreshCw, PlusCircle,
    Copy, User, FileText
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
        "Escribe 'Dashboard' para ver resumen...",
        "Escribe 'Clientes' para gestionar lista...",
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

    const results = useMemo(() => {
        const query = searchTerm.toLowerCase();
        
        const navigationResults = [
            { id: 'nav-dash', type: 'nav', label: 'Ver Dashboard', screen: 'dashboard', icon: <LayoutDashboard size={18} /> },
            { id: 'nav-clients', type: 'nav', label: 'Ver Clientes', screen: 'clients', icon: <Users size={18} /> },
            { id: 'nav-services', type: 'nav', label: 'Ver Servicios', screen: 'services', icon: <Globe size={18} /> },
            { id: 'nav-settings', type: 'nav', label: 'Configuración', screen: 'settings', icon: <Settings size={18} /> },
        ].filter(item => item.label.toLowerCase().includes(query));

        const actionResults = [
            { id: 'act-new', type: 'action', label: 'Nuevo Cliente', action: 'new_client', icon: <PlusCircle size={18} /> },
            { id: 'act-sync', type: 'action', label: 'Sincronizar Datos', action: 'sync', icon: <RefreshCw size={18} /> },
            { id: 'act-logout', type: 'action', label: 'Cerrar Sesión', action: 'logout', icon: <LogOut size={18} /> },
        ].filter(item => item.label.toLowerCase().includes(query));

        const clientResults = clients
            .filter(c => !c.isDeleted && c.isActive && (
                c.name.toLowerCase().includes(query) || 
                c.ruc.includes(query) ||
                (c.tradeName?.toLowerCase().includes(query))
            ))
            .slice(0, 10)
            .map(c => ({
                id: `client-${c.id}`,
                type: 'client',
                label: c.name,
                subLabel: c.ruc,
                client: c,
                icon: <User size={18} />
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
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            const selected = results[selectedIndex];
            if (selected) {
                handleSelection(selected);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleSelection = (item: any) => {
        if (item.type === 'nav') {
            onNavigate(item.screen);
        } else if (item.type === 'action') {
            onAction(item.action);
        } else if (item.type === 'client') {
            onAction('view_client', item.client);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-500"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={onClose}
        >
            <div 
                className="w-full max-w-2xl bg-surface-lowest rounded-[2.5rem] overflow-hidden shadow-architect border border-surface-low animate-in slide-in-from-top-6 duration-700 hover:scale-[1.01] transition-transform"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search Header */}
                <div className="flex items-center p-8 gap-5 border-b border-surface-low bg-surface relative overflow-hidden">
                    {/* Architectural Accent */}
                    <div className="absolute top-0 left-0 w-2 h-full bg-primary/20"></div>
                    
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-architect-low">
                        <Search size={22} className="animate-pulse" />
                    </div>
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={placeholders[placeholderIndex]}
                        className="flex-1 bg-transparent border-none outline-none text-on-surface text-2xl font-extrabold placeholder:text-on-surface-variant/20 tracking-tight font-premium"
                    />
                    
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low text-on-surface-variant/40 text-[10px] font-black uppercase tracking-[0.25em] border border-surface-low font-premium">
                        <Command size={12} />
                        <span>K</span>
                    </div>
                </div>

                {/* Results List */}
                <div 
                    ref={listRef}
                    className="max-h-[55vh] overflow-y-auto p-4 scroll-smooth no-scrollbar space-y-2"
                >
                    {results.length > 0 ? (
                        <div className="space-y-2">
                            {results.map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelection(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`
                                        w-full flex items-center gap-5 p-5 rounded-[1.5rem] transition-all duration-500 text-left group/item
                                        ${idx === selectedIndex ? 'bg-surface-low shadow-architect-low scale-[1.02]' : 'hover:bg-surface-low/50'}
                                    `}
                                >
                                    <div className={`
                                        w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700
                                        ${idx === selectedIndex ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110' : 'bg-surface text-on-surface-variant/40 group-hover/item:text-primary/60'}
                                    `}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`text-lg font-extrabold transition-colors tracking-tight uppercase font-premium ${idx === selectedIndex ? 'text-on-surface' : 'text-on-surface-variant/60 group-hover/item:text-on-surface'}`}>
                                            {item.label}
                                        </div>
                                        {(item as any).subLabel && (
                                            <div className={`text-[10px] font-black uppercase tracking-[0.15em] mt-1 font-premium transition-colors ${idx === selectedIndex ? 'text-on-surface-variant' : 'text-on-surface-variant/30'}`}>
                                                {(item as any).subLabel}
                                            </div>
                                        )}
                                    </div>
                                    {idx === selectedIndex && (
                                        <div className="flex items-center gap-3 text-primary animate-in fade-in slide-in-from-right-4 duration-500">
                                            <span className="text-[10px] font-black uppercase tracking-[0.25em] font-premium">EJECUTAR</span>
                                            <ChevronRight size={16} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-20 text-center space-y-6 group/empty">
                            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto shadow-inner group-hover/empty:scale-110 transition-transform duration-700">
                                <Search className="text-on-surface-variant/10" size={40} />
                            </div>
                            <div className="text-on-surface-variant/40 text-[10px] uppercase font-black tracking-[0.3em] font-premium">Sin coincidencias para el protocolo actual</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-surface border-t border-surface-low flex items-center justify-between text-[9px] font-black uppercase tracking-[0.25em] text-on-surface-variant/40 font-premium">
                    <div className="flex gap-8">
                        <span className="flex items-center gap-3 group/nav">
                            <span className="bg-surface-low px-2 py-1 rounded border border-surface-low text-on-surface shadow-sm font-premium">↑↓</span> 
                            <span className="group-hover/nav:text-primary transition-colors">NAVEGAR</span>
                        </span>
                        <span className="flex items-center gap-3 group/sel">
                            <span className="bg-surface-low px-2 py-1 rounded border border-surface-low text-on-surface shadow-sm font-premium">↵</span> 
                            <span className="group-hover/sel:text-primary transition-colors">SELECCIONAR</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-3 opacity-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        CENTRO DE CONTROL ESTRATÉGICO
                    </div>
                </div>
            </div>
        </div>
    );
};

