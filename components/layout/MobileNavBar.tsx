
import React from 'react';
import { Screen } from '../../types';

interface NavItem {
    screen: string;
    icon: React.ElementType;
    label: string;
    count?: number;
}

interface MobileNavBarProps {
    navItems: NavItem[];
    activeScreen: Screen;
    onNavigate: (screen: Screen) => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ navItems, activeScreen, onNavigate }) => {
    // Tomamos los 5 ítems más críticos para no saturar el espacio móvil
    const mobileItems = [
        navItems[0], // Inicio
        navItems[1], // Clientes
        navItems[2], // Tareas
        navItems[6], // Cobros
        navItems[7], // Ajustes
    ].filter(Boolean);

    return (
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
            <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-[32px] px-2 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-black/5">
                <div className="flex justify-around items-center">
                    {mobileItems.map((item) => (
                        <button
                            key={item.screen}
                            onClick={() => onNavigate(item.screen as Screen)}
                            className={`flex flex-col items-center justify-center flex-1 transition-all duration-500 relative py-1 ${activeScreen === item.screen
                                ? 'text-brand-teal'
                                : 'text-slate-400 dark:text-slate-500'
                                }`}
                        >
                            <div className={`p-3 rounded-2xl transition-all duration-500 ${activeScreen === item.screen 
                                ? 'bg-brand-teal/15 shadow-inner scale-110 -translate-y-1' 
                                : 'active:scale-90'}`}>
                                <item.icon 
                                    size={20} 
                                    strokeWidth={activeScreen === item.screen ? 2.5 : 2} 
                                    className={`transition-transform duration-500 ${activeScreen === item.screen ? 'rotate-3' : ''}`}
                                />
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest mt-1.5 transition-all duration-500 ${activeScreen === item.screen ? 'opacity-100 translate-y-0 text-brand-teal' : 'opacity-40 -translate-y-1 scale-90'}`}>
                                {item.label}
                            </span>

                            {/* Indicador de ítem activo premium */}
                            {activeScreen === item.screen && (
                                <div className="absolute -bottom-1 w-6 h-1 bg-brand-teal rounded-full shadow-[0_0_12px_rgba(0,203,169,0.9)] animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
};
