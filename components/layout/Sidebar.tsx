
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
    onManualSave?: () => void;
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
    cloudStatus,
    onManualSave
}) => {

    const getCloudStatusIcon = () => {
        switch (cloudStatus) {
            case 'loading': case 'saving': return <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />;
            case 'saved': return <Check className="w-4 h-4 text-green-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-amber-500" />;
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
        <aside
            className={`hidden md:flex flex-col border-r border-slate-200/40 dark:border-white/5 glass-elite transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'w-80' : 'w-24'} h-screen sticky top-0 z-40 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden`}
            onMouseEnter={() => !isLocked && onToggleExpand(true)}
            onMouseLeave={() => !isLocked && onToggleExpand(false)}
        >
            <div className="p-6 flex items-center justify-between h-24 overflow-hidden relative border-b border-slate-200/30 dark:border-white/5">
                <div className={`flex items-center space-x-4 transition-all duration-700 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 w-0'}`}>
                    <div className="p-2 bg-gradient-to-tr from-sky-600 via-brand-teal to-emerald-500 rounded-2xl shadow-xl shadow-emerald-500/30">
                        <Logo className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-display font-black text-slate-900 dark:text-white leading-none tracking-tighter text-xl uppercase">Legión</span>
                        <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] mt-1.5 opacity-80">STGO. CORDOVA</span>
                    </div>
                </div>
                {!isExpanded && (
                    <div className="mx-auto p-2 bg-gradient-to-tr from-sky-600 to-emerald-500 rounded-xl shadow-lg border border-white/20">
                        <Logo className="w-8 h-8 text-white" />
                    </div>
                )}
                {isExpanded && (
                    <button onClick={onToggleLock} className={`p-2.5 rounded-2xl transition-all duration-300 ${isLocked ? 'bg-sky-50 dark:bg-sky-400/10 text-sky-600 shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        {isLocked ? <Pin size={18} className="fill-current" /> : <PinOff size={18} />}
                    </button>
                )}
            </div>

            <div className="px-6 pt-8 pb-8 flex flex-col gap-4">
                {isExpanded ? (
                    <>
                        <button onClick={onQuickManagement} className="group relative w-full flex items-center p-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[22px] shadow-2xl shadow-slate-900/20 dark:shadow-white/10 transition-all duration-500 hover:-translate-y-1 active:scale-95 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center">
                                <Zap size={18} className="fill-current mr-3 text-amber-400" />
                                <span className="font-display font-black text-sm uppercase tracking-wide">Escuadrón Rápido</span>
                            </div>
                        </button>
                        {addClientItem?.onClick && (
                            <button onClick={addClientItem.onClick} className="group w-full flex items-center p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5 text-slate-800 dark:text-white rounded-[22px] shadow-sm hover:shadow-xl hover:bg-white dark:hover:bg-slate-800 transition-all duration-500 hover:-translate-y-1 active:scale-95">
                                <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-xl mr-3 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                    <UserPlus size={18} />
                                </div>
                                <span className="font-display font-black text-sm uppercase tracking-wide">Nuevo Cliente</span>
                            </button>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col gap-5 items-center">
                        <button onClick={onQuickManagement} className="p-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl transition-all hover:scale-110 active:scale-95"><Zap size={20} className="fill-current text-amber-400" /></button>
                        {addClientItem?.onClick && (
                            <button onClick={addClientItem.onClick} className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white rounded-2xl shadow-lg transition-all hover:scale-110 active:scale-95"><UserPlus size={20} /></button>
                        )}
                    </div>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto pt-2 pb-6 space-y-2 px-6 no-scrollbar">
                <div className={`text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-6 pl-4 transition-opacity duration-700 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    Centro de Comando
                </div>
                {navItems.filter(i => i.screen !== 'add_client').map(({ screen, icon: Icon, label, count, onHover }) => (
                    <button
                        key={screen}
                        onClick={() => onNavigate(screen as Screen)}
                        onMouseEnter={onHover}
                        className={`flex items-center w-full p-4 rounded-[18px] transition-all duration-500 group relative
                            ${activeScreen === screen
                                ? 'bg-sky-600 text-white shadow-xl shadow-sky-600/40'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                            } ${isExpanded ? 'justify-start px-5' : 'justify-center'}`}
                        title={!isExpanded ? label : ''}
                    >
                        {activeScreen === screen && isExpanded && (
                            <div className="absolute left-0 w-2 h-7 bg-emerald-400 rounded-r-full shadow-[0_0_15px_rgba(52,211,153,1)]"></div>
                        )}
                        <Icon className={`w-5 h-5 transition-all duration-500 ${activeScreen === screen ? 'scale-125 rotate-3' : 'group-hover:scale-110'}`} />
                        {count !== undefined && count > 0 && (
                            <span className={`absolute -top-1 -right-1 h-6 min-w-[24px] px-2 flex items-center justify-center rounded-full text-[10px] font-black border-2 transition-colors duration-500 ${activeScreen === screen ? 'bg-white text-sky-600 border-sky-600' : 'bg-rose-500 text-white border-white dark:border-slate-950 shadow-lg shadow-rose-500/20'}`}>
                                {count}
                            </span>
                        )}
                        <span className={`ml-4 text-xs font-black uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-700 font-display ${isExpanded ? 'opacity-100 w-auto translate-x-0' : 'opacity-0 w-0 -translate-x-10'}`}>{label}</span>
                    </button>
                ))}
            </nav>

            <div className="p-6 pb-10 space-y-5">
                <div className="p-5 bg-slate-100/50 dark:bg-white/5 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-inner group/cloud">
                    <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} gap-3`}>
                        {isExpanded && (
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Doble Nube</span>
                                <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-tighter">{getCloudStatusText()}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            {onManualSave && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onManualSave(); }}
                                    className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-sky-600 shadow-sm border border-transparent hover:border-sky-100 dark:hover:border-sky-900"
                                    title="Sincronizar ahora"
                                >
                                    <Cloud size={16} />
                                </button>
                            )}
                            <div className="relative w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                                {getCloudStatusIcon()}
                                {cloudStatus === 'saved' && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>}
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={onLogout} className={`w-full flex items-center ${isExpanded ? 'justify-start' : 'justify-center'} p-4 rounded-2xl text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-500 group shadow-sm hover:shadow-rose-100`}>
                    <div className="p-2.5 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/30 rounded-xl transition-colors">
                        <LogOut size={20} />
                    </div>
                    {isExpanded && <span className="ml-4 text-xs font-black uppercase tracking-[0.2em] font-display">Desconectar</span>}
                </button>
            </div>
        </aside>
    );
};
