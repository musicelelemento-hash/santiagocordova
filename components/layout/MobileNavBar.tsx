
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
    // 5 ítems más usados — incluye Facturación SRI
    const desiredScreens = ['home', 'clients', 'sri_facturacion', 'tasks', 'settings'];
    const mobileItems = desiredScreens
        .map(screenName => navItems.find(i => i.screen === screenName))
        .filter(Boolean) as NavItem[];

    return (
        <div className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-sm">
            <nav className="
                relative
                backdrop-blur-3xl
                bg-slate-950/60
                border border-white/8
                rounded-[2rem]
                px-3 py-2.5
                shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)]
            ">
                {/* Subtle inner glow */}
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                <div className="relative flex justify-around items-end px-1">
                    {mobileItems.map((item) => {
                        const isActive = activeScreen === item.screen;
                        return (
                            <button
                                key={item.screen}
                                onClick={() => onNavigate(item.screen as Screen)}
                                className={`
                                    relative flex flex-col items-center justify-end gap-1
                                    flex-1 pb-0.5 pt-2
                                    transition-all duration-300
                                    active:scale-90
                                    ${isActive ? '' : 'hover:-translate-y-0.5'}
                                `}
                                aria-label={item.label}
                            >
                                {/* Icon container */}
                                <div className={`
                                    relative flex items-center justify-center
                                    transition-all duration-300
                                    ${isActive ? 'scale-110' : 'scale-100'}
                                `}>
                                    {/* Active glow behind icon */}
                                    {isActive && (
                                        <div className="absolute inset-0 w-8 h-8 -m-1 rounded-full bg-[#2B6AFF]/25 blur-md" />
                                    )}
                                    <item.icon
                                        size={20}
                                        strokeWidth={isActive ? 2.5 : 1.8}
                                        className={`
                                            relative z-10 transition-all duration-300
                                            ${isActive
                                                ? 'text-white drop-shadow-[0_0_10px_rgba(43,106,255,0.8)]'
                                                : 'text-slate-500'
                                            }
                                        `}
                                    />
                                    {/* Count badge */}
                                    {item.count !== undefined && item.count > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 flex items-center justify-center bg-rose-500 text-white rounded-full text-[7px] font-black border border-slate-950 shadow-[0_0_8px_rgba(244,63,94,0.7)]">
                                            {item.count > 9 ? '9+' : item.count}
                                        </span>
                                    )}
                                </div>

                                {/* Label */}
                                <span className={`
                                    text-[8px] font-black uppercase tracking-[0.08em] leading-none
                                    transition-all duration-300
                                    ${isActive ? 'text-white' : 'text-slate-600'}
                                `}>
                                    {item.label === 'Facturación SRI' ? 'Factura' : item.label}
                                </span>

                                {/* Active dot indicator */}
                                {isActive && (
                                    <div className="absolute -bottom-0.5 w-4 h-0.5 rounded-full bg-gradient-to-r from-[#2B6AFF] to-[#6366F1] shadow-[0_0_8px_rgba(43,106,255,0.9)]" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};
