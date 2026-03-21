
import React from 'react';
import { Screen } from '../types';

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
        navItems[2], // Trámites (Tareas)
        navItems[3], // Cobros
        navItems[4], // Agenda
    ].filter(Boolean);

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 pb-safe-area-inset-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex justify-around items-center h-20">
                {mobileItems.map((item) => (
                    <button
                        key={item.screen}
                        onClick={() => onNavigate(item.screen as Screen)}
                        className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 relative ${
                            activeScreen === item.screen 
                                ? 'text-brand-teal' 
                                : 'text-slate-400 dark:text-slate-500'
                        }`}
                    >
                        <div className={`p-2 rounded-2xl transition-all ${activeScreen === item.screen ? 'bg-brand-teal/10' : ''}`}>
                            <item.icon size={22} strokeWidth={activeScreen === item.screen ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${activeScreen === item.screen ? 'opacity-100' : 'opacity-60'}`}>
                            {item.label}
                        </span>
                        
                        {/* Indicador de ítem activo */}
                        {activeScreen === item.screen && (
                            <div className="absolute -top-1 w-1 h-1 bg-brand-teal rounded-full shadow-[0_0_8px_rgba(0,203,169,0.8)]"></div>
                        )}
                    </button>
                ))}
            </div>
        </nav>
    );
};
