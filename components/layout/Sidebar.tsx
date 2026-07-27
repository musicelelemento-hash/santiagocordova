import React from 'react';
import { LogOut, RefreshCw, Check, Cloud, WifiOff, AlertCircle, Zap, ArrowRightLeft, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Screen, Theme } from '../../types';
import { SystemPulse } from './SystemPulse';


interface NavItem {
    screen: Screen;
    icon: React.ElementType;
    label: string;
    count?: number;
    onHover?: () => void;
    onClick?: () => void;
}

interface SidebarProps {
    onNavigate: (screen: Screen) => void;
    activeScreen: Screen;
    navItems: NavItem[];
    onQuickManagement: () => void;
    onLogout: () => void;
    cloudStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline';
    onManualSave?: () => void;
    userName?: string;
    role?: string;
    sessionCode?: string;
    theme?: Theme;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onOpenSalesModal?: () => void;
}

// Groupings for nav items to add visual section separators
const NAV_GROUPS: { label: string; screens: string[] }[] = [
    { label: 'Principal', screens: ['home', 'clients', 'cobranza'] },
    { label: 'Operaciones', screens: ['sri_facturacion', 'tasks', 'calendar', 'web_orders'] },
    { label: 'Sistema', screens: ['settings', 'audit_log', 'services'] },
];

export const Sidebar: React.FC<SidebarProps> = ({
    onNavigate,
    activeScreen,
    navItems,
    onQuickManagement,
    onLogout,
    cloudStatus,
    onManualSave,
    userName,
    role,
    sessionCode,
    theme = 'dark',
    isCollapsed = false,
    onToggleCollapse,
    onOpenSalesModal
}) => {

    const getCloudStatusIcon = () => {
        switch (cloudStatus) {
            case 'loading': case 'saving': return <RefreshCw size={16} className="animate-spin text-slate-400" />;
            case 'saved': return <Check size={16} className="text-white" />;
            case 'error': return <AlertCircle size={16} className="text-rose-500" />;
            case 'offline': return <WifiOff size={16} className="text-slate-500" />;
            default: return <Cloud size={16} className="text-slate-500" />;
        }
    };

    const migracionZifactItem = navItems.find(i => i.screen === 'migracion_zifact' as any);

    // Filter out special items and group the rest
    const filteredItems = navItems.filter(i =>
        (i.screen as any) !== 'add_client' &&
        (i.screen as any) !== 'migracion_zifact' &&
        (i.screen as any) !== 'landing'
    );

    // Build grouped nav: group by NAV_GROUPS, ungrouped items go at end
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

    // Any remaining items not in groups
    const remaining = filteredItems.filter(i => !usedScreens.has(i.screen));
    if (remaining.length > 0) {
        groupedNav.push({ label: 'Más', items: remaining });
    }

    const renderNavButton = ({ screen, icon: Icon, label, count }: NavItem) => {
        const isActive = activeScreen === screen;
        const isDark = theme === 'dark';

        return (
            <button
                key={screen}
                onClick={() => onNavigate(screen)}
                title={isCollapsed ? label : undefined}
                className={`
                    group relative flex items-center rounded-xl transition-all duration-300
                    ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-4 py-2.5 gap-3'}
                    ${isActive
                        ? isDark
                            ? 'bg-gradient-to-r from-[#2B6AFF]/20 to-[#6366F1]/10 text-white border border-[#2B6AFF]/30 shadow-[0_0_20px_rgba(43,106,255,0.12)]'
                            : 'bg-slate-900 text-white border border-slate-800 shadow-lg'
                        : isDark
                            ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }
                `}
            >
                {/* Icon */}
                <Icon
                    size={18}
                    className={`transition-all duration-300 flex-shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                />

                {/* Label */}
                <span className={`
                    text-[12px] font-bold tracking-wide flex-1 text-left transition-all duration-300
                    ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}
                `}>
                    {label}
                </span>

                {/* Count badge */}
                {count !== undefined && count > 0 && (
                    isCollapsed ? (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-slate-900 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    ) : (
                        <span className={`
                            px-2 py-0.5 rounded-md text-[9px] font-black border transition-colors duration-300
                            ${isActive
                                ? isDark ? 'bg-white/20 text-white border-white/20' : 'bg-white text-slate-900 border-slate-200'
                                : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }
                        `}>
                            {count}
                        </span>
                    )
                )}

                {/* Left active bar — gradient azure */}
                {isActive && !isCollapsed && (
                    <div className={`
                        absolute left-0 w-[3px] h-5 rounded-r-full
                        bg-gradient-to-b from-[#2B6AFF] to-[#6366F1]
                        shadow-[3px_0_10px_rgba(43,106,255,0.5)]
                    `} />
                )}

                {/* Collapsed active dot */}
                {isActive && isCollapsed && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2B6AFF] shadow-[0_0_6px_rgba(43,106,255,0.9)]" />
                )}
            </button>
        );
    };

    return (
        <aside className={`
            hidden md:flex flex-col h-screen fixed left-0 top-0 z-50 border-r
            transition-all duration-500 overflow-visible no-print
            ${isCollapsed ? 'w-[84px]' : 'w-[264px]'}
            ${theme === 'dark'
                ? 'bg-slate-950 border-white/5 shadow-2xl'
                : 'bg-white border-slate-200 shadow-xl'
            }
        `}>
            {/* Collapse Toggle Button */}
            {onToggleCollapse && (
                <button
                    onClick={onToggleCollapse}
                    className={`
                        absolute right-[-14px] top-8 z-[60] w-7 h-7 flex items-center justify-center
                        rounded-full border transition-all duration-300 shadow-md hover:scale-110 active:scale-95
                        ${theme === 'dark'
                            ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-[#2B6AFF]/40'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                        }
                    `}
                    title={isCollapsed ? "Expandir Menú" : "Colapsar Menú"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={12} strokeWidth={2.5} />
                    ) : (
                        <ChevronLeft size={12} strokeWidth={2.5} />
                    )}
                </button>
            )}

            {/* System Pulse - Top */}
            <div className={`border-b transition-colors duration-500 ${
                theme === 'dark' ? 'border-white/5 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
            }`}>
                <SystemPulse
                    userName={userName}
                    role={role}
                    sessionCode={sessionCode}
                    theme={theme}
                    isCollapsed={isCollapsed}
                />
            </div>

            {/* Navigation Section */}
            <nav className={`flex-1 overflow-y-auto py-5 no-scrollbar ${isCollapsed ? 'px-[10px] flex flex-col items-center gap-1' : 'px-3'}`}>

                {groupedNav.map((group, gIdx) => (
                    <div key={group.label} className={`${gIdx > 0 ? 'mt-4' : ''}`}>
                        {/* Group label — hidden in collapsed mode */}
                        {!isCollapsed && (
                            <div className={`flex items-center gap-2 px-2 mb-2 ${gIdx > 0 ? 'mt-4' : ''}`}>
                                <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                                    theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                                }`}>
                                    {group.label}
                                </span>
                                <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
                            </div>
                        )}

                        {/* Group separator in collapsed mode */}
                        {isCollapsed && gIdx > 0 && (
                            <div className={`w-6 h-px mx-auto my-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
                        )}

                        <div className={`flex flex-col gap-0.5 ${isCollapsed ? 'w-full items-center' : ''}`}>
                            {group.items.map(item => renderNavButton(item))}
                        </div>
                    </div>
                ))}

                {/* Quick Actions Separator */}
                {!isCollapsed && (
                    <div className="mt-5 mb-2 px-2 flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                            theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                            Acciones Rápidas
                        </span>
                        <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
                    </div>
                )}
                {isCollapsed && (
                    <div className={`w-6 h-px mx-auto my-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
                )}

                <div className={`flex flex-col gap-0.5 ${isCollapsed ? 'w-full items-center' : ''}`}>
                    <button
                        onClick={onQuickManagement}
                        title={isCollapsed ? "Gestión Inmediata" : undefined}
                        className={`
                            group flex items-center rounded-xl border transition-all duration-300
                            ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-4 py-2.5 gap-3'}
                            ${theme === 'dark'
                                ? 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
                            }
                        `}
                    >
                        <Zap size={16} className="transition-transform group-hover:scale-110 flex-shrink-0" />
                        <span className={`text-[11px] font-bold tracking-wide transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                            Gestión Inmediata
                        </span>
                    </button>

                    {migracionZifactItem?.onClick && (
                        <button
                            onClick={migracionZifactItem.onClick}
                            title={isCollapsed ? "Migrar a Zifact" : undefined}
                            className={`
                                group flex items-center rounded-xl border transition-all duration-300
                                ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-4 py-2.5 gap-3'}
                                ${theme === 'dark'
                                    ? 'bg-slate-800/40 border-white/5 text-[#2B6AFF] hover:text-white hover:bg-[#2B6AFF]/10 hover:border-[#2B6AFF]/20'
                                    : 'bg-slate-50 border-slate-200 text-[#2B6AFF] hover:text-white hover:bg-[#2B6AFF] hover:border-[#2B6AFF]'
                                }
                            `}
                        >
                            <ArrowRightLeft size={16} className="transition-transform group-hover:scale-110 flex-shrink-0" />
                            <span className={`text-[11px] font-bold tracking-wide transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                                Migrar a Zifact
                            </span>
                        </button>
                    )}

                    {onOpenSalesModal && (
                        <button
                            onClick={onOpenSalesModal}
                            title={isCollapsed ? "💳 Vender Plan / Firma" : undefined}
                            className={`
                                group flex items-center rounded-xl border transition-all duration-300 shadow-md active:scale-95
                                ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-4 py-2.5 gap-3'}
                                bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-500
                            `}
                        >
                            <ShoppingBag size={16} className="transition-transform group-hover:scale-110 flex-shrink-0 text-amber-500" />
                            <span className={`text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                                💳 Vender Plan / Firma
                            </span>
                        </button>
                    )}
                </div>
            </nav>

            {/* Footer: Sync & Logout */}
            <div className={`p-3 border-t transition-colors duration-500 ${
                theme === 'dark' ? 'bg-slate-900/80 border-white/5' : 'bg-slate-50 border-slate-100'
            }`}>
                <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-2'}`}>
                    {onManualSave && (
                        <button
                            onClick={onManualSave}
                            title="Sincronizar Manualmente"
                            className={`
                                flex items-center justify-center gap-2 h-9 rounded-xl border transition-all duration-300 group
                                ${isCollapsed ? 'w-10 h-10 flex-none' : 'flex-1'}
                                ${theme === 'dark'
                                    ? 'bg-slate-800/50 border-white/5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/5 hover:border-sky-400/20'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-200'
                                }
                            `}
                        >
                            {getCloudStatusIcon()}
                            <span className={`text-[10px] font-bold uppercase tracking-wider group-hover:text-sky-400 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                                Sync
                            </span>
                        </button>
                    )}

                    <button
                        onClick={onLogout}
                        className={`
                            w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-300
                            ${theme === 'dark'
                                ? 'bg-slate-800/50 border-white/5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 hover:border-rose-400/20'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100'
                            }
                        `}
                        title="Cerrar Sesión"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
