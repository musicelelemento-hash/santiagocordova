
// LOCKED COMPONENT - ELITE PRO VERSION
import React from 'react';
import { Pin, PinOff, Zap, LogOut, RefreshCw, Check, Cloud, WifiOff, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Logo } from './Logo';
import { Screen } from '../types';

interface NavItem {
    screen: string;
    icon: React.ElementType;
    label: string;
    count?: number;
    onHover?: () => void;
}

interface SidebarProps {
    isExpanded: boolean;
    isLocked: boolean;
    onToggleLock: () => void;
    onToggleExpand: (val: boolean) => void;
    onNavigate: (screen: Screen) => void;
    activeScreen: Screen;
    navItems: NavItem[];
    onQuickManagement: () => void;
    onLogout: () => void;
    cloudStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline';
}

export const Sidebar: React.FC<SidebarProps> = ({
    isExpanded,
    isLocked,
    onToggleLock,
    onToggleExpand,
    onNavigate,
    activeScreen,
    navItems,
    onQuickManagement,
    onLogout,
    cloudStatus
}) => {

    const getCloudStatusIcon = () => {
        switch(cloudStatus) {
            case 'loading': case 'saving': return <RefreshCw className="w-4 h-4 animate-spin text-brand-teal" />;
            case 'saved': return <Check className="w-4 h-4 text-green-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-amber-500" />;
            case 'offline': return <WifiOff className="w-4 h-4 text-slate-400" />;
            default: return <Cloud className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <aside 
            className={`hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all duration-500 ease-in-out ${isExpanded ? 'w-64' : 'w-[72px]'} h-screen sticky top-0 z-40`}
            onMouseEnter={() => !isLocked && onToggleExpand(true)}
            onMouseLeave={() => !isLocked && onToggleExpand(false)}
        >
            {/* Logo Section */}
            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 h-16 overflow-hidden">
                 <div className={`flex items-center gap-3 transition-all duration-500 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
                    <Logo className="w-8 h-8 flex-shrink-0" />
                    <span className="font-display font-black text-brand-navy dark:text-white tracking-tighter text-xl">SC PRO</span>
                </div>
                {!isExpanded && (
                    <div className="absolute inset-x-0 flex justify-center animate-fade-in">
                        <Logo className="w-9 h-9" />
                    </div>
                )}
                {isExpanded && (
                    <button 
                        onClick={onToggleLock} 
                        className={`p-1.5 rounded-lg transition-colors shadow-sm border ${isLocked ? 'bg-brand-teal text-white border-brand-teal' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
                    >
                        {isLocked ? <Pin size={16} /> : <PinOff size={16}/>}
                    </button>
                )}
            </div>

            {/* Quick Action */}
            <div className={`p-3 transition-all duration-500 ${isExpanded ? 'pt-6' : 'pt-4 flex justify-center'}`}>
                <button 
                    onClick={onQuickManagement} 
                    className={`flex items-center justify-center gap-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest ${isExpanded ? 'w-full py-4 text-[10px]' : 'w-12 h-12 p-0'}`}
                >
                    <Zap size={20} className={isExpanded ? "" : "flex-shrink-0"} />
                    {isExpanded && <span>Gestión Rápida</span>}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-3 no-scrollbar">
                {navItems.map(({ screen, icon: Icon, label, count }) => {
                    const isActive = activeScreen === screen;
                    return (
                        <button 
                            key={screen}
                            onClick={() => onNavigate(screen as Screen)}
                            className={`flex items-center w-full rounded-2xl transition-all duration-300 group relative
                                ${isActive 
                                    ? 'bg-brand-navy dark:bg-slate-800 text-white shadow-xl shadow-brand-navy/10' 
                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-brand-navy dark:hover:text-slate-100'
                                } ${isExpanded ? 'p-3' : 'justify-center w-12 h-12 mx-auto'}`}
                            title={!isExpanded ? label : ''}
                        >
                            <div className="relative flex-shrink-0">
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                {count !== undefined && count > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-pulse">{count}</span>
                                )}
                            </div>
                            {isExpanded && <span className="ml-4 text-xs font-bold uppercase tracking-wider truncate animate-fade-in">{label}</span>}
                            
                            {/* Active Indicator Bar */}
                            {isActive && !isExpanded && (
                                <div className="absolute right-[-12px] w-1 h-6 bg-brand-teal rounded-l-full shadow-[0_0_8px_#14b8a6]"></div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                 <div className={`flex items-center gap-3 ${isExpanded ? 'px-2' : 'justify-center'} text-[10px] font-bold text-slate-400 uppercase tracking-widest`}>
                    <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg">{getCloudStatusIcon()}</div>
                    {isExpanded && <span className="animate-fade-in">Sincronizado</span>}
                 </div>
                 <button 
                    onClick={onLogout} 
                    className={`flex items-center gap-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ${isExpanded ? 'w-full p-3 text-xs font-bold uppercase' : 'w-12 h-12 justify-center mx-auto'}`}
                 >
                    <LogOut size={20} />
                    {isExpanded && <span>Cerrar Sesión</span>}
                 </button>
            </div>
        </aside>
    );
};
