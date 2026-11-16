import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Screen } from '../../types';
import { NAV_GROUPS } from './Sidebar';

interface NavItem {
    screen: string;
    icon: React.ElementType;
    label: string;
    count?: number;
}

interface MobileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    navItems: NavItem[];
    activeScreen: Screen;
    onNavigate: (screen: string) => void;
}

const EXCLUDED_SCREENS = ['add_client', 'landing'];

/**
 * Menú completo del celular.
 *
 * Tres mejoras sobre la versión anterior:
 *  - **Buscador**: con ~25 módulos, escribir dos letras es más rápido que bajar.
 *  - **Aria**: el destino activo queda marcado con aria-current.
 *  - **Safe-area**: el pie no queda debajo del gesto del sistema.
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, navItems, activeScreen, onNavigate }) => {
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Al cerrar se limpia el filtro: el próximo uso arranca en el menú completo.
    useEffect(() => {
        if (!isOpen) setFiltro('');
    }, [isOpen]);

    const grupos = useMemo(() => {
        const filteredItems = navItems.filter((i) => !EXCLUDED_SCREENS.includes(i.screen));
        const q = filtro
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        const coincide = (i: NavItem) =>
            !q || `${i.label} ${i.screen}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q);

        const salida: { label: string; items: NavItem[] }[] = [];
        const usados = new Set<string>();
        for (const group of NAV_GROUPS) {
            const items = group.screens
                .map((s) => filteredItems.find((i) => i.screen === s))
                .filter(Boolean)
                .filter((i) => coincide(i as NavItem)) as NavItem[];
            if (items.length > 0) {
                salida.push({ label: group.label, items });
                items.forEach((i) => usados.add(i.screen));
            }
        }
        const restantes = filteredItems.filter((i) => !usados.has(i.screen) && coincide(i));
        if (restantes.length > 0) salida.push({ label: 'Módulos', items: restantes });
        return salida;
    }, [navItems, filtro]);

    if (!isOpen) return null;

    return (
        <div className="md:hidden fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <aside
                className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[86vw] bg-[#051424]/97 border-r border-white/10
                    shadow-[0_25px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col animate-in slide-in-from-left duration-300"
                role="dialog"
                aria-modal="true"
                aria-label="Menú de módulos"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {/* Header con buscador */}
                <div className="shrink-0 border-b border-white/10 bg-[#0b1326]/70 px-4 pb-3 pt-3">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#00A896]">
                            Navegación
                        </span>
                        <button
                            onClick={onClose}
                            aria-label="Cerrar menú"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:border-[#00A896]/40 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="relative mt-2.5">
                        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            placeholder="Buscar módulo…"
                            aria-label="Buscar módulo"
                            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-8 pr-8 text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#00A896]/40"
                        />
                        {filtro && (
                            <button
                                onClick={() => setFiltro('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-200"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Grupos */}
                <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Módulos">
                    {grupos.length === 0 && (
                        <p className="px-2 py-8 text-center text-[11px] text-slate-500">Sin módulos para “{filtro}”.</p>
                    )}
                    {grupos.map((group) => (
                        <div key={group.label}>
                            <div className="mb-2 flex items-center gap-2 px-2">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-[#C9A96E]/80">
                                    {group.label}
                                </span>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {group.items.map(({ screen, icon: Icon, label, count }) => {
                                    const isActive = activeScreen === screen;
                                    const esFirmas = screen === 'firmas';
                                    return (
                                        <button
                                            key={screen}
                                            onClick={() => onNavigate(screen)}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={`
                                                group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-all duration-300
                                                ${isActive
                                                    ? esFirmas
                                                        ? 'border border-[#C9A96E]/40 bg-gradient-to-r from-[#C9A96E]/20 via-[#C9A96E]/10 to-transparent font-semibold text-white shadow-[0_0_20px_rgba(201,169,110,0.15)]'
                                                        : 'border border-[#00A896]/40 bg-gradient-to-r from-[#00A896]/20 via-[#00A896]/10 to-transparent font-semibold text-white shadow-[0_0_20px_rgba(0,168,150,0.15)]'
                                                    : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100'}
                                            `}
                                        >
                                            {isActive && (
                                                <div className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full ${esFirmas ? 'bg-gradient-to-b from-amber-400 to-[#C9A96E] shadow-[2px_0_10px_rgba(201,169,110,0.6)]' : 'bg-gradient-to-b from-[#00A896] to-[#2B6AFF] shadow-[2px_0_10px_rgba(0,168,150,0.6)]'}`} />
                                            )}
                                            <Icon
                                                size={17}
                                                strokeWidth={isActive ? 2.5 : 2}
                                                className={`shrink-0 transition-all duration-300 ${isActive ? (esFirmas ? 'scale-110 text-[#C9A96E]' : 'scale-110 text-[#00A896]') : 'group-hover:text-[#00A896]'}`}
                                            />
                                            <span className="flex-1 truncate text-left font-sans text-[12px] font-medium tracking-wide">{label}</span>
                                            {count !== undefined && count > 0 && (
                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-400">
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="shrink-0 border-t border-white/10 bg-[#0b1326]/85 px-4 py-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Santiago Córdova PRO</span>
                </div>
            </aside>
        </div>
    );
};
