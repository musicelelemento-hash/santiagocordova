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
    isSubItem?: boolean;   // renders indented under group parent
    groupLabel?: string;   // shows a non-clickable parent header before this item
    subLabel?: string;     // legacy mini-label
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

// Groupings for nav items following Stitch Nueva Luz 3.0 Architecture
const NAV_GROUPS: { label: string; screens: string[] }[] = [
    { label: 'Principal', screens: ['declaraciones', 'clients', 'firmas', 'facturadores', 'cobranza'] },
    { label: 'Operaciones', screens: ['sri_facturacion', '3d-studio', 'tasks', 'calendar', 'web_orders'] },
    { label: 'Sistema & Control', screens: ['settings', 'audit_log', 'services'] },
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
            case 'loading': case 'saving': return <RefreshCw size={14} className="animate-spin text-[#00A896]" />;
            case 'saved': return <Check size={14} className="text-[#00A896]" />;
            case 'error': return <AlertCircle size={14} className="text-rose-500" />;
            case 'offline': return <WifiOff size={14} className="text-slate-500" />;
            default: return <Cloud size={14} className="text-slate-400" />;
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
        groupedNav.push({ label: 'Módulos', items: remaining });
    }

    const renderNavButton = ({ screen, icon: Icon, label, count, isSubItem, groupLabel }: NavItem) => {
        const isActive = activeScreen === screen;
        const isDark = theme === 'dark';
        const isFirmas = screen === 'firmas';

        return (
            <React.Fragment key={screen}>
                {groupLabel && !isCollapsed && (
                    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                        <span className={`text-[9px] font-bold uppercase tracking-[0.25em] font-mono ${
                            isDark ? 'text-[#00A896]' : 'text-teal-700'
                        }`}>
                            {groupLabel}
                        </span>
                        <div className={`flex-1 h-px ${isDark ? 'bg-[#00A896]/20' : 'bg-teal-500/20'}`} />
                    </div>
                )}
                <button
                    onClick={() => onNavigate(screen)}
                    title={isCollapsed ? label : undefined}
                    className={`
                        group relative flex items-center rounded-2xl transition-all duration-300
                        ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3.5 py-2.5 gap-3 w-full'}
                        ${isSubItem && !isCollapsed ? 'ml-3 w-[calc(100%-0.75rem)] border-l border-[#00A896]/30 rounded-l-none pl-3' : ''}
                        ${isActive
                            ? isDark
                                ? 'bg-gradient-to-r from-[#00A896]/20 via-[#00A896]/10 to-transparent text-white border border-[#00A896]/40 shadow-[0_0_20px_rgba(0,168,150,0.15)] font-semibold'
                                : 'bg-slate-900 text-white border border-slate-800 shadow-md font-semibold'
                            : isDark
                                ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 border border-transparent'
                        }
                    `}
                >
                    {/* Left Active Glow Indicator */}
                    {isActive && !isCollapsed && (
                        <div className={`
                            absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full
                            ${isFirmas
                                ? 'bg-gradient-to-b from-amber-400 to-[#C9A96E] shadow-[2px_0_10px_rgba(201,169,110,0.6)]'
                                : 'bg-gradient-to-b from-[#00A896] to-[#2B6AFF] shadow-[2px_0_10px_rgba(0,168,150,0.6)]'
                            }
                        `} />
                    )}

                    {/* Icon with Dynamic State Glow */}
                    <Icon
                        size={17}
                        className={`transition-all duration-300 flex-shrink-0 ${
                            isActive 
                                ? isDark ? 'text-[#00A896] scale-110' : 'text-white scale-110' 
                                : 'group-hover:scale-105 group-hover:text-[#00A896]'
                        }`}
                        strokeWidth={isActive ? 2.5 : 2}
                    />

                    {/* Label */}
                    <span className={`
                        text-[12px] font-medium tracking-wide flex-1 text-left transition-all duration-300 font-sans truncate
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
                                px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-colors duration-300
                                ${isActive
                                    ? isDark ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40' : 'bg-white text-slate-900 border-slate-200'
                                    : isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }
                            `}>
                                {count}
                            </span>
                        )
                    )}

                    {/* Firmas neon dot */}
                    {isFirmas && !isCollapsed && (
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] shrink-0 animate-pulse"
                            style={{ boxShadow: '0 0 8px rgba(201,169,110,0.9)' }}
                        />
                    )}

                    {/* Collapsed active dot */}
                    {isActive && isCollapsed && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00A896] shadow-[0_0_8px_rgba(0,168,150,0.9)]" />
                    )}
                </button>
            </React.Fragment>
        );
    };

    return (
        <aside className={`
            hidden md:flex flex-col h-screen fixed left-0 top-0 z-50 border-r
            transition-all duration-500 overflow-visible no-print
            ${isCollapsed ? 'w-[84px]' : 'w-[264px]'}
            ${theme === 'dark'
                ? 'bg-[#051424]/95 border-white/10 shadow-2xl backdrop-blur-2xl'
                : 'bg-white/95 border-slate-200 shadow-xl backdrop-blur-md'
            }
        `}>
            {/* Collapse Toggle Button */}
            {onToggleCollapse && (
                <button
                    onClick={onToggleCollapse}
                    className={`
                        absolute right-[-14px] top-8 z-[60] w-7 h-7 flex items-center justify-center
                        rounded-full border transition-all duration-300 shadow-lg hover:scale-110 active:scale-95
                        ${theme === 'dark'
                            ? 'bg-[#0b1326] border-white/15 text-slate-300 hover:text-white hover:border-[#00A896]/50'
                            : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                        }
                    `}
                    title={isCollapsed ? "Expandir Menú" : "Colapsar Menú"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={13} strokeWidth={2.5} />
                    ) : (
                        <ChevronLeft size={13} strokeWidth={2.5} />
                    )}
                </button>
            )}

            {/* System Pulse Header */}
            <div className={`border-b transition-colors duration-500 ${
                theme === 'dark' ? 'border-white/10 bg-[#0b1326]/60' : 'border-slate-100 bg-slate-50/70'
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
            <nav className={`flex-1 overflow-y-auto py-4 no-scrollbar ${isCollapsed ? 'px-2.5 flex flex-col items-center gap-1' : 'px-3'}`}>

                {groupedNav.map((group, gIdx) => (
                    <div key={group.label} className={`${gIdx > 0 ? 'mt-4' : ''}`}>
                        {/* Group label — hidden in collapsed mode */}
                        {!isCollapsed && (
                            <div className={`flex items-center gap-2 px-2 mb-2 ${gIdx > 0 ? 'mt-4' : ''}`}>
                                <span className={`text-[9px] font-bold uppercase tracking-[0.25em] font-mono ${
                                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
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
                        <span className={`text-[9px] font-bold uppercase tracking-[0.25em] font-mono ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                            Acciones de Mando
                        </span>
                        <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
                    </div>
                )}
                {isCollapsed && (
                    <div className={`w-6 h-px mx-auto my-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
                )}

                <div className={`flex flex-col gap-1 ${isCollapsed ? 'w-full items-center' : ''}`}>
                    <button
                        onClick={onQuickManagement}
                        title={isCollapsed ? "Gestión Inmediata" : undefined}
                        className={`
                            group flex items-center rounded-2xl border transition-all duration-300
                            ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3.5 py-2.5 gap-3'}
                            ${theme === 'dark'
                                ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-[#00A896]/40'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
                            }
                        `}
                    >
                        <Zap size={15} className="transition-transform group-hover:scale-110 flex-shrink-0 text-[#00A896]" />
                        <span className={`text-[11px] font-semibold tracking-wide transition-all duration-300 font-sans ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                            Gestión Inmediata
                        </span>
                    </button>

                    {migracionZifactItem?.onClick && (
                        <button
                            onClick={migracionZifactItem.onClick}
                            title={isCollapsed ? "Migrar a Zifact" : undefined}
                            className={`
                                group flex items-center rounded-2xl border transition-all duration-300
                                ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3.5 py-2.5 gap-3'}
                                ${theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-[#2B6AFF] hover:text-white hover:bg-[#2B6AFF]/15 hover:border-[#2B6AFF]/40'
                                    : 'bg-slate-50 border-slate-200 text-[#2B6AFF] hover:text-white hover:bg-[#2B6AFF] hover:border-[#2B6AFF]'
                                }
                            `}
                        >
                            <ArrowRightLeft size={15} className="transition-transform group-hover:scale-110 flex-shrink-0" />
                            <span className={`text-[11px] font-semibold tracking-wide transition-all duration-300 font-sans ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                                Migrar a Zifact
                            </span>
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (onOpenSalesModal) {
                                onOpenSalesModal();
                            } else {
                                window.dispatchEvent(new CustomEvent('open-sales-modal'));
                            }
                        }}
                        title={isCollapsed ? "💳 Vender Plan / Firma" : undefined}
                        className={`
                            group flex items-center rounded-2xl border transition-all duration-300 shadow-md active:scale-95
                            ${isCollapsed ? 'w-10 h-10 justify-center p-0' : 'px-3.5 py-2.5 gap-3'}
                            bg-gradient-to-r from-[#C9A96E]/20 via-[#f59e0b]/15 to-[#C9A96E]/20 border-[#C9A96E]/40 text-[#C9A96E] hover:bg-[#C9A96E] hover:text-slate-950 hover:border-[#C9A96E]
                        `}
                    >
                        <ShoppingBag size={15} className="transition-transform group-hover:scale-110 flex-shrink-0" />
                        <span className={`text-[11px] font-bold uppercase tracking-wider font-mono transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                            💳 Vender Plan / Firma
                        </span>
                    </button>
                </div>
            </nav>

            {/* Footer: Cloud Sync & Logout */}
            <div className={`p-3 border-t transition-colors duration-500 ${
                theme === 'dark' ? 'bg-[#0b1326]/80 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
                <div className={`flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-2'}`}>
                    {onManualSave && (
                        <button
                            onClick={onManualSave}
                            title="Sincronizar Manualmente con la Nube"
                            className={`
                                flex items-center justify-center gap-2 h-9 rounded-xl border transition-all duration-300 group
                                ${isCollapsed ? 'w-10 h-10 flex-none' : 'flex-1'}
                                ${theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-slate-400 hover:text-[#00A896] hover:bg-[#00A896]/10 hover:border-[#00A896]/30'
                                    : 'bg-white border-slate-200 text-slate-600 hover:text-[#00A896] hover:border-[#00A896]/30'
                                }
                            `}
                        >
                            {getCloudStatusIcon()}
                            <span className={`text-[10px] font-bold uppercase tracking-widest font-mono group-hover:text-[#00A896] transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : ''}`}>
                                Sync
                            </span>
                        </button>
                    )}

                    <button
                        onClick={onLogout}
                        className={`
                            w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-300
                            ${theme === 'dark'
                                ? 'bg-white/5 border-white/10 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200'
                            }
                        `}
                        title="Cerrar Sesión"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
