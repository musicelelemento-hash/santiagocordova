
import React from 'react';
import { LogOut, RefreshCw, Check, Cloud, WifiOff, AlertCircle, Zap, UserPlus } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Screen } from '../../types';
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
}

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
    sessionCode
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

    const addClientItem = navItems.find(i => i.screen === 'add_client' as any);

    return (
        <aside className="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 z-50 bg-[#0f172a] border-r border-white/5 shadow-2xl transition-all duration-500 overflow-hidden">
            {/* System Pulse - Top Integration */}
            <div className="border-b border-white/5 bg-slate-900/50">
                <SystemPulse 
                    userName={userName} 
                    role={role} 
                    sessionCode={sessionCode} 
                />
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 no-scrollbar">
                <div className="flex flex-col gap-1.5">
                    {navItems.filter(i => (i.screen as any) !== 'add_client' && (i.screen as any) !== 'landing').map(({ screen, icon: Icon, label, count }) => (
                        <button
                            key={screen}
                            onClick={() => onNavigate(screen)}
                            className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 
                                ${activeScreen === screen
                                    ? 'bg-white/10 text-white border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                }`}
                        >
                            <Icon size={20} className={`transition-transform duration-300 ${activeScreen === screen ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="text-[13px] font-black uppercase tracking-widest flex-1 text-left font-premium">
                                {label}
                            </span>
                            
                            {count !== undefined && count > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors duration-300 font-premium
                                    ${activeScreen === screen 
                                        ? 'bg-white text-slate-900 border-white' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700'}
                                `}>
                                    {count}
                                </span>
                            )}

                            {activeScreen === screen && (
                                <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full shadow-[4px_0_12px_rgba(255,255,255,0.4)]"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Quick Actions Separator */}
                <div className="mt-8 mb-4 px-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                        Acciones Rápidas
                    </span>
                </div>

                <div className="flex flex-col gap-1.5 px-1">
                    <button 
                        onClick={onQuickManagement} 
                        className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-300"
                    >
                        <Zap size={18} className="transition-transform group-hover:scale-110" />
                        <span className="text-[11px] font-black uppercase tracking-widest font-premium">Gestión Inmediata</span>
                    </button>

                    {addClientItem?.onClick && (
                        <button 
                            onClick={addClientItem.onClick} 
                            className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-300"
                        >
                            <UserPlus size={18} className="transition-transform group-hover:scale-110" />
                            <span className="text-[11px] font-black uppercase tracking-widest font-premium">Nuevo Cliente</span>
                        </button>
                    )}
                </div>
            </nav>

            {/* Footer Section: Sync & Logout */}
            <div className="p-4 bg-slate-900/80 border-t border-white/5">
                <div className="flex items-center gap-2">
                    {onManualSave && (
                        <button
                            onClick={onManualSave}
                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/5 transition-all duration-300 group"
                            title="Sincronizar Manualmente"
                        >
                            {getCloudStatusIcon()}
                            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-sky-400">Sync</span>
                        </button>
                    )}

                    <button 
                        onClick={onLogout} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/50 border border-white/5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 transition-all duration-300"
                        title="Cerrar Sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
