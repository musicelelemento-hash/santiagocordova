
// LOCKED COMPONENT - DO NOT MODIFY LOGIC
// Este componente define la estructura visual de la barra lateral de escritorio.
// Contiene la navegación principal y controles de estado de la aplicación.

import React from 'react';
import { Pin, PinOff, Zap, LogOut, RefreshCw, Check, Cloud } from 'lucide-react';
import { Logo } from './Logo';
import { Screen } from '../types';

interface NavItem {
    screen: string;
    icon: React.ElementType;
    label: string;
    count?: number;
    onHover?: () => void; // New prop for prefetching
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
    cloudStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
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
            case 'error': return <Cloud className="w-4 h-4 text-red-500" />;
            default: return <Cloud className="w-4 h-4 text-slate-400" />;
        }
    };

    const getCloudStatusText = () => {
        switch(cloudStatus) {
            case 'loading': return 'Cargando...';
            case 'saving': return 'Guardando...';
            case 'saved': return 'Sincronizado';
            case 'error': return 'Error';
            default: return 'En línea';
        }
    };

    return (
        <aside 
            className={`hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'} h-screen sticky top-0 z-40`}
            onMouseEnter={() => !isLocked && onToggleExpand(true)}
            onMouseLeave={() => !isLocked && onToggleExpand(false)}
        >
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 h-16 overflow-hidden">
                 <div className={`flex items-center space-x-2 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                    <Logo className="w-8 h-8 flex-shrink-0" />
                    <span className="font-display font-bold text-sky-600 dark:text-sky-400 tracking-tight whitespace-nowrap">SC Pro</span>
                </div>
                {!isExpanded && <Logo className="w-8 h-8 mx-auto flex-shrink-0" />}
                {isExpanded && (
                    <button onClick={onToggleLock} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isLocked ? 'text-sky-600' : 'text-slate-400'}`}>
                        {isLocked ? <Pin size={18} fill="currentColor"/> : <PinOff size={18}/>}
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="px-3 pt-4 pb-2 animate-fade-in">
                    <button onClick={onQuickManagement} className="w-full flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm transform hover:scale-[1.02]">
                        <Zap size={18} className="fill-current" />
                        <span>Gestión Rápida</span>
                    </button>
                </div>
            )}
            {!isExpanded && (
                 <div className="px-3 pt-4 pb-2 flex justify-center">
                     <button onClick={onQuickManagement} className="p-3 bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200 transition-colors"><Zap size={20} className="fill-current" /></button>
                 </div>
            )}

            <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
                {navItems.map(({ screen, icon: Icon, label, count, onHover }) => (
                    <button 
                        key={screen}
                        onClick={() => onNavigate(screen as Screen)}
                        onMouseEnter={onHover} // Trigger prefetching
                        className={`flex items-center w-full p-3 rounded-xl transition-all duration-200 group
                            ${activeScreen === screen 
                                ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 font-medium shadow-sm' 
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            } ${isExpanded ? 'justify-start' : 'justify-center'}`}
                        title={!isExpanded ? label : ''}
                    >
                        <div className="relative flex-shrink-0">
                            <Icon className={`w-5 h-5 transition-transform ${activeScreen === screen ? 'scale-110' : ''}`} />
                            {count !== undefined && count > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white dark:border-slate-900">{count}</span>
                            )}
                        </div>
                        <span className={`ml-3 text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>{label}</span>
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                 <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} text-xs text-slate-400 overflow-hidden`}>
                    {isExpanded && <span className="whitespace-nowrap">Estado Nube:</span>}
                    <div title={getCloudStatusText()}>{getCloudStatusIcon()}</div>
                 </div>
                 <button onClick={onLogout} className={`w-full flex items-center ${isExpanded ? 'justify-start' : 'justify-center'} p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}>
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {isExpanded && <span className="ml-2 text-sm font-medium whitespace-nowrap">Salir</span>}
                 </button>
            </div>
        </aside>
    );
};
