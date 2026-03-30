
import React from 'react';
import { Pin, PinOff, Zap, LogOut, RefreshCw, Check, Cloud, WifiOff, AlertCircle, UserPlus } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Screen } from '../../types';

interface NavItem {
    screen: string;
    icon: React.ElementType;
    label: string;
    count?: number;
    onHover?: () => void;
}

interface SidebarProps {
    onNavigate: (screen: Screen) => void;
    activeScreen: Screen;
    navItems: NavItem[];
    onQuickManagement: () => void;
    onLogout: () => void;
    cloudStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline';
    onManualSave?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    onNavigate,
    activeScreen,
    navItems,
    onQuickManagement,
    onLogout,
    cloudStatus,
    onManualSave
}) => {

    const getCloudStatusIcon = () => {
        switch (cloudStatus) {
            case 'loading': case 'saving': return <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />;
            case 'saved': return <Check className="w-4 h-4 text-emerald-400" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-amber-400" />;
            case 'offline': return <WifiOff className="w-4 h-4 text-slate-400" />;
            default: return <Cloud className="w-4 h-4 text-slate-400" />;
        }
    };

    const getCloudStatusText = () => {
        switch (cloudStatus) {
            case 'loading': return 'Cargando...';
            case 'saving': return 'Guardando...';
            case 'saved': return 'Sincronizado';
            case 'error': return 'Error de conexión';
            case 'offline': return 'Modo Local (Offline)';
            default: return 'En línea';
        }
    };

    const addClientItem = navItems.find(i => i.screen === 'add_client' as any) as any;

    return (
        <aside className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 z-50 glass-elite items-center gap-1 p-2.5 rounded-[2rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-5 fade-in">
            {/* Logo Section */}
            <div className="flex items-center gap-3 pr-4 pl-2 border-r border-white/10">
                <div className="p-2 bg-gradient-to-tr from-primary/80 via-primary to-amber-400 rounded-2xl shadow-xl shadow-primary/20 group cursor-pointer relative" onClick={() => onNavigate('home')}>
                    <Logo className="w-8 h-8 text-secondary group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl">
                        Inicio
                    </div>
                </div>
            </div>

            {/* Navigation Items (Dock style) */}
            <nav className="flex items-center gap-1.5 px-3">
                {navItems.filter(i => i.screen !== 'add_client' && i.screen !== 'home').map(({ screen, icon: Icon, label, count, onHover }) => (
                    <button
                        key={screen}
                        onClick={() => onNavigate(screen as Screen)}
                        onMouseEnter={onHover}
                        className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500 
                            ${activeScreen === screen
                                ? 'bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]'
                                : 'hover:bg-white/5 active:scale-95'
                            }`}
                    >
                        {activeScreen === screen && (
                            <div className="absolute -bottom-2 w-5 h-1 bg-primary rounded-t-full shadow-[0_0_15px_rgba(212,181,140,0.8)]"></div>
                        )}
                        <Icon className={`w-6 h-6 transition-all duration-500 ${activeScreen === screen ? 'text-primary scale-110' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-125 group-hover:-translate-y-1'}`} />
                        
                        {count !== undefined && count > 0 && (
                            <span className="absolute top-1 right-1 h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[9px] font-medium bg-rose-400 text-white border-2 border-slate-900 shadow-lg shadow-rose-400/30">
                                {count}
                            </span>
                        )}

                        {/* Hover Tooltip */}
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl z-50">
                            {label}
                            {/* Decorative arrow */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-white/5 rotate-45"></div>
                        </div>
                    </button>
                ))}
            </nav>

            <div className="w-[1px] h-10 bg-white/10 mx-3"></div>

            {/* Quick Actions & Status */}
            <div className="flex items-center gap-3 pl-1 pr-1">
                <button onClick={onQuickManagement} className="group relative w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-secondary transition-all duration-500 hover:-translate-y-1 hover:scale-110 shadow-lg shadow-primary/10">
                    <Zap size={22} className={activeScreen === 'home' ? 'fill-current' : ''} />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl z-50">
                        Gestión Rápida
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-white/5 rotate-45"></div>
                    </div>
                </button>

                {addClientItem?.onClick && (
                    <button onClick={addClientItem.onClick} className="group relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-all duration-500 hover:-translate-y-1 hover:scale-110">
                        <UserPlus size={22} />
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl z-50">
                            Nuevo Cliente
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-white/5 rotate-45"></div>
                        </div>
                    </button>
                )}

                <div className="w-[1px] h-8 bg-white/10 mx-2"></div>

                {onManualSave && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onManualSave(); }}
                        className="group relative w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-all duration-500 text-slate-400 hover:text-sky-400"
                    >
                        {getCloudStatusIcon()}
                        <div className="absolute -top-14 right-0 translate-x-1/4 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl z-50">
                            {getCloudStatusText()}
                            <div className="absolute -bottom-1 right-6 w-2 h-2 bg-slate-900 border-b border-r border-white/5 rotate-45"></div>
                        </div>
                        {cloudStatus === 'saved' && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>}
                    </button>
                )}

                <button onClick={onLogout} className="group relative w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-rose-400/10 text-slate-500 hover:text-rose-400 transition-all duration-500 hover:-translate-y-1 hover:scale-110">
                    <LogOut size={20} />
                    <div className="absolute -top-14 right-0 translate-x-1/4 bg-slate-900/95 border border-white/5 text-white text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl z-50">
                        Cerrar Sesión
                        <div className="absolute -bottom-1 right-5 w-2 h-2 bg-slate-900 border-b border-r border-white/5 rotate-45"></div>
                    </div>
                </button>
            </div>
        </aside>
    );
};
