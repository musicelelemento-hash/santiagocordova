import React, { useEffect } from 'react';
import { X } from 'lucide-react';
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

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, navItems, activeScreen, onNavigate }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filteredItems = navItems.filter(i => !EXCLUDED_SCREENS.includes(i.screen));

    const groupedNav: { label: string; items: NavItem[] }[] = [];
    const usedScreens = new Set<string>();

    for (const group of NAV_GROUPS) {
        const items = group.screens
            .map(s => filteredItems.find(i => i.screen === s))
            .filter(Boolean) as NavItem[];
        if (items.length > 0) {
            groupedNav.push({ label: group.label, items });
            items.forEach(i => usedScreens.add(i.screen));
        }
    }

    const remaining = filteredItems.filter(i => !usedScreens.has(i.screen));
    if (remaining.length > 0) {
        groupedNav.push({ label: 'Módulos', items: remaining });
    }

    return (
        <div className="md:hidden fixed inset-0 z-[70]">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-[290px] max-w-[85vw] bg-[#051424]/95 border-r border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col animate-in slide-in-from-left duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 bg-[#0b1326]/60 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] font-mono text-[#00A896]">
                        Navegación
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar menú"
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-[#00A896]/40 transition-all active:scale-95"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Groups */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar space-y-4">
                    {groupedNav.map((group) => (
                        <div key={group.label}>
                            <div className="flex items-center gap-2 px-2 mb-2">
                                <span className="text-[9px] font-bold uppercase tracking-[0.25em] font-mono text-slate-500">
                                    {group.label}
                                </span>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {group.items.map(({ screen, icon: Icon, label, count }) => {
                                    const isActive = activeScreen === screen;
                                    return (
                                        <button
                                            key={screen}
                                            onClick={() => onNavigate(screen)}
                                            className={`
                                                group relative flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl transition-all duration-300
                                                ${isActive
                                                    ? 'bg-gradient-to-r from-[#00A896]/20 via-[#00A896]/10 to-transparent text-white border border-[#00A896]/40 shadow-[0_0_20px_rgba(0,168,150,0.15)] font-semibold'
                                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                                }
                                            `}
                                        >
                                            {isActive && (
                                                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-[#00A896] to-[#2B6AFF] shadow-[2px_0_10px_rgba(0,168,150,0.6)]" />
                                            )}
                                            <Icon
                                                size={17}
                                                strokeWidth={isActive ? 2.5 : 2}
                                                className={`transition-all duration-300 flex-shrink-0 ${
                                                    isActive ? 'text-[#00A896] scale-110' : 'group-hover:text-[#00A896]'
                                                }`}
                                            />
                                            <span className="text-[12px] font-medium tracking-wide flex-1 text-left font-sans truncate">
                                                {label}
                                            </span>
                                            {count !== undefined && count > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/5 text-slate-400 border border-white/10">
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
                <div className="px-4 py-3 border-t border-white/10 bg-[#0b1326]/80 shrink-0">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Santiago Córdova PRO</span>
                </div>
            </aside>
        </div>
    );
};
