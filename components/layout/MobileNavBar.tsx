import React from 'react';
import { Screen } from '../../types';
import { MoreHorizontal } from 'lucide-react';

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
    /** Abre el menú completo (drawer) desde el botón "Más". */
    onOpenMenu?: () => void;
}

/**
 * Barra inferior del celular.
 *
 * Cinco destinos de uso diario + "Más" para el menú completo. Respeta el
 * safe-area del iPhone (la barra no queda debajo del gesto del sistema) y
 * marca el destino activo con aria-current.
 */
export const MobileNavBar: React.FC<MobileNavBarProps> = ({ navItems, activeScreen, onNavigate, onOpenMenu }) => {
    const desiredScreens = ['home', 'declaraciones', 'clients', 'firmas', 'sri_facturacion'];
    const mobileItems = desiredScreens
        .map((screenName) => navItems.find((i) => i.screen === screenName))
        .filter(Boolean) as NavItem[];

    const etiqueta = (label: string) => {
        if (/facturaci/i.test(label)) return 'Factura';
        if (/^Centro de Control$/i.test(label)) return 'Inicio';
        return label.length > 10 ? label.slice(0, 10) : label;
    };

    return (
        <div
            className="md:hidden fixed left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-sm no-print"
            style={{ bottom: 'max(14px, env(safe-area-inset-bottom))' }}
        >
            <nav
                className="relative backdrop-blur-3xl bg-[#0b1326]/90 border border-white/12 rounded-[1.7rem] px-2 py-2
                    shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(16,185,129,0.10)]"
                aria-label="Navegación principal"
            >
                <div className="absolute inset-0 rounded-[1.7rem] bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#00A896]/50 to-transparent" />

                <div className="relative flex justify-around items-end px-0.5">
                    {mobileItems.map((item) => {
                        const isActive = activeScreen === item.screen;
                        const esFirmas = item.screen === 'firmas';
                        return (
                            <button
                                key={item.screen}
                                onClick={() => onNavigate(item.screen as Screen)}
                                aria-label={item.label}
                                aria-current={isActive ? 'page' : undefined}
                                className="relative flex flex-1 flex-col items-center justify-end gap-1 pb-0.5 pt-1.5 transition-all duration-300 active:scale-90"
                            >
                                <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                                    {isActive && <div className="absolute inset-0 -m-1 h-8 w-8 rounded-full bg-[#00A896]/25 blur-md" />}
                                    <item.icon
                                        size={20}
                                        strokeWidth={isActive ? 2.5 : 1.8}
                                        className={`relative z-10 transition-all duration-300 ${isActive ? (esFirmas ? 'text-[#C9A96E] drop-shadow-[0_0_10px_rgba(201,169,110,0.8)]' : 'text-[#00A896] drop-shadow-[0_0_10px_rgba(0,168,150,0.8)]') : 'text-slate-400'}`}
                                    />
                                    {item.count !== undefined && item.count > 0 && (
                                        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-[#0b1326] bg-rose-500 px-0.5 text-[7px] font-mono font-bold text-white">
                                            {item.count > 9 ? '9+' : item.count}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[8px] font-mono font-bold uppercase leading-none tracking-[0.06em] transition-all duration-300 ${isActive ? (esFirmas ? 'text-[#C9A96E]' : 'text-white') : 'text-slate-500'}`}>
                                    {etiqueta(item.label)}
                                </span>
                                {isActive && (
                                    <div className={`absolute -bottom-0.5 h-0.5 w-4 rounded-full ${esFirmas ? 'bg-gradient-to-r from-amber-400 to-[#C9A96E] shadow-[0_0_8px_rgba(201,169,110,0.9)]' : 'bg-gradient-to-r from-[#00A896] to-[#2B6AFF] shadow-[0_0_8px_rgba(0,168,150,0.9)]'}`} />
                                )}
                            </button>
                        );
                    })}

                    {/* Más: el menú completo, en un toque */}
                    {onOpenMenu && (
                        <button
                            onClick={onOpenMenu}
                            aria-label="Más módulos"
                            className="relative flex flex-1 flex-col items-center justify-end gap-1 pb-0.5 pt-1.5 transition-all duration-300 active:scale-90"
                        >
                            <div className="relative flex items-center justify-center">
                                <MoreHorizontal size={20} strokeWidth={2} className="text-slate-400" />
                            </div>
                            <span className="text-[8px] font-mono font-bold uppercase leading-none tracking-[0.06em] text-slate-500">
                                Más
                            </span>
                        </button>
                    )}
                </div>
            </nav>
        </div>
    );
};
