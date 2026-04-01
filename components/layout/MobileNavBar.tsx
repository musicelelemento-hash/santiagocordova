
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
    const desiredScreens = ['home', 'clients', 'tasks', 'cobranza', 'settings'];
    const mobileItems = desiredScreens
        .map(screenName => navItems.find(i => i.screen === screenName))
        .filter(Boolean) as NavItem[];

    return (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-sm">
            <nav className="glass-elite backdrop-blur-3xl bg-slate-950/40 border border-white/5 rounded-full px-2 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                <div className="flex justify-between items-center px-1">
                    {mobileItems.map((item) => (
                        <button
                            key={item.screen}
                            onClick={() => onNavigate(item.screen as Screen)}
                            className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 relative py-1 hover:-translate-y-1 active:scale-90 ${activeScreen === item.screen
                                ? 'text-white'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <item.icon 
                                size={22} 
                                strokeWidth={activeScreen === item.screen ? 2.5 : 2} 
                                className={`transition-all duration-300 ${activeScreen === item.screen ? 'scale-110 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]' : ''}`}
                            />
                            
                            {/* Indicador de ítem activo minimalista (Zen Dot) */}
                            {activeScreen === item.screen && (
                                <div className="absolute -bottom-1.5 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)]"></div>
                            )}
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
};
