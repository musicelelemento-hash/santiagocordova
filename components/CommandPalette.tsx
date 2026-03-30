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
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-300"
            style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div 
                className="w-full max-w-2xl glass-card rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] border border-white/5 animate-in slide-in-from-top-4 duration-500"
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search Header */}
                <div className="flex items-center p-6 gap-4 border-b border-white/5 bg-white/[0.02]">
                    <Search className="text-primary/40" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={placeholders[placeholderIndex]}
                        className="flex-1 bg-transparent border-none outline-none text-white text-xl font-medium placeholder:text-white/10"
                    />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/30 text-[10px] uppercase tracking-[0.2em] font-medium border border-white/5">
                        <Command size={10} />
                        <span>K</span>
                    </div>
                </div>

                {/* Results List */}
                <div 
                    ref={listRef}
                    className="max-h-[55vh] overflow-y-auto p-3 scroll-smooth no-scrollbar"
                >
                    {results.length > 0 ? (
                        <div className="space-y-1.5">
                            {results.map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelection(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`
                                        w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group
                                        ${idx === selectedIndex ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-white/[0.02]'}
                                    `}
                                >
                                    <div className={`
                                        p-3 rounded-xl transition-all duration-300
                                        ${idx === selectedIndex ? 'bg-primary text-secondary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500 group-hover:text-slate-300'}
                                    `}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`font-medium transition-colors ${idx === selectedIndex ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                            {item.label}
                                        </div>
                                        {(item as any).subLabel && (
                                            <div className="text-xs text-slate-500/60 truncate mt-0.5 tracking-wide">
                                                {(item as any).subLabel}
                                            </div>
                                        )}
                                    </div>
                                    {idx === selectedIndex && (
                                        <div className="flex items-center gap-2 text-primary/60 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <span className="text-[9px] font-medium uppercase tracking-[0.2em]">Ejecutar</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <Search className="text-white/10" size={32} />
                            </div>
                            <div className="text-slate-500 font-medium text-sm tracking-wide">No se encontraron resultados para "{searchTerm}"</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/[0.02] flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500 border-t border-white/5">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">↑↓</span> Navegar
                        </span>
                        <span className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">↵</span> Seleccionar
                        </span>
                    </div>
                    <div className="text-primary/40 font-medium">
                        Centro de Operaciones | Santiago Cordova
                    </div>
                </div>
            </div>
        </div>
    );
};
