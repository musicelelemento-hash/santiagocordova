import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Search, X, User, LayoutGrid, Command, Sparkles, Building2, ShoppingBag } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNavBar } from './MobileNavBar';
import { Clock } from '../ui/Clock';
import { NotificationBell } from './NotificationBell';
import { SalesComboModal } from '../features/SalesComboModal';
import { Screen, Theme, Client } from '../../types';

interface AppLayoutProps {
    onLogout: () => void;
    onQuickManagement: () => void;
    theme?: Theme;
    onToggleTheme?: () => void;
    clients: Client[];
    onSelectClient?: (client: Client) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    onLogout,
    onQuickManagement,
    theme = 'dark',
    clients,
    onSelectClient
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Map route paths to screen names
    const getScreenFromPath = (path: string): Screen => {
        if (path.includes('/facturacion')) return 'sri_facturacion';
        if (path.includes('/cobranzas')) return 'cobranza';
        if (path.includes('/tareas')) return 'tasks';
        if (path.includes('/calendario')) return 'calendar';
        if (path.includes('/reportes')) return 'reports';
        if (path.includes('/ajustes')) return 'settings';
        if (path.includes('/audit')) return 'audit_log';
        if (path.includes('/convertidor')) return 'services';
        if (path.includes('/pedidos')) return 'web_orders';
        return 'clients';
    };

    const activeScreen = getScreenFromPath(location.pathname);

    // 🔥 Wake-up al navegar a Facturación SRI (web y móvil comparten este layout)
    // Se dispara cuando el usuario presiona "Facturación SRI" en el menú,
    // así el servidor de Render ya lleva ~30s despertando cuando lleguen al botón de emitir.
    useEffect(() => {
        if (location.pathname.includes('/facturacion')) {
            const API_URL = (import.meta as any).env?.VITE_FACTURACION_API_URL || 'https://facturador-sri-api.onrender.com';
            fetch(`${API_URL}/api/v1/ping`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Authorization': '0HXtqJOyU1JFsIIaF6kOls3uPKbXe3ir' }
            }).catch(() => {}); // silencioso — solo para despertar
        }
    }, [location.pathname]);

    const [globalQuery, setGlobalQuery] = useState('');
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Ctrl+K / Cmd+K Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape') {
                setIsSearchOpen(false);
                setIsMobileSearchExpanded(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchResults = React.useMemo(() => {
        if (!globalQuery.trim()) return [];
        const q = globalQuery.toLowerCase().trim();
        return clients.filter(c => 
            !c.isDeleted && c.isActive && (
                c.name.toLowerCase().includes(q) || 
                c.ruc.includes(q) || 
                (c.tradeName && c.tradeName.toLowerCase().includes(q))
            )
        ).slice(0, 6);
    }, [clients, globalQuery]);

    const handleSelectMatrixMatch = (client: Client) => {
        sessionStorage.setItem('clients_search', client.name);
        sessionStorage.setItem('dashboard_search', client.name);
        sessionStorage.setItem('matrix_highlight_ruc', client.ruc);
        setIsSearchOpen(false);
        setIsMobileSearchExpanded(false);
        setGlobalQuery('');
        navigate('/dashboard/clientes');
    };

    const handleSelectProfileMatch = (client: Client) => {
        setIsSearchOpen(false);
        setIsMobileSearchExpanded(false);
        setGlobalQuery('');
        if (onSelectClient) onSelectClient(client);
    };


    const handleNavigate = (screen: Screen) => {
        const routeMap: Record<Screen, string> = {
            home: '/dashboard',
            clients: '/dashboard/clientes',
            sri_facturacion: '/dashboard/facturacion',
            cobranza: '/dashboard/cobranzas',
            tasks: '/dashboard/tareas',
            calendar: '/dashboard/calendario',
            reports: '/dashboard/reportes',
            settings: '/dashboard/ajustes',
            audit_log: '/dashboard/audit',
            services: '/dashboard/convertidor',
            web_orders: '/dashboard/pedidos',
            scanner: '/dashboard/clientes',
            migracion_zifact: '/dashboard/convertidor'
        };
        navigate(routeMap[screen] || '/dashboard/clientes');
    };

    const navItems = [
        { screen: 'clients' as Screen, icon: () => null, label: 'Clientes & Matriz' },
        { screen: 'sri_facturacion' as Screen, icon: () => null, label: 'Facturación SRI' },
        { screen: 'cobranza' as Screen, icon: () => null, label: 'Cobranzas' },
        { screen: 'tasks' as Screen, icon: () => null, label: 'Tareas' },
        { screen: 'calendar' as Screen, icon: () => null, label: 'Calendario' },
        { screen: 'reports' as Screen, icon: () => null, label: 'Reportes' },
        { screen: 'settings' as Screen, icon: () => null, label: 'Ajustes' }
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
            {/* Persistent Sidebar (Desktop) */}
            <Sidebar
                onNavigate={handleNavigate}
                activeScreen={activeScreen}
                navItems={navItems as any}
                onQuickManagement={onQuickManagement}
                onLogout={onLogout}
                cloudStatus="saved"
                theme={theme}
                onOpenSalesModal={() => setIsSalesModalOpen(true)}
            />

            {/* Persistent Mobile Navigation Bar */}
            <MobileNavBar
                activeScreen={activeScreen}
                onNavigate={handleNavigate}
                navItems={navItems as any}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 md:ml-[264px] h-screen overflow-y-auto custom-scrollbar relative">
                {/* Header bar */}
                <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-950/85 backdrop-blur-2xl border-b border-white/5 no-print gap-3">
                    {/* Left: Clock */}
                    <div className="flex items-center gap-3 shrink-0">
                        <Clock />
                    </div>

                    {/* Center: Global Search (Desktop & Mobile) */}
                    <div className="flex-1 max-w-xl relative" ref={searchContainerRef}>
                        {/* Mobile Search Toggle Icon */}
                        <div className="flex md:hidden items-center justify-end">
                            {!isMobileSearchExpanded ? (
                                <button
                                    onClick={() => {
                                        setIsMobileSearchExpanded(true);
                                        setIsSearchOpen(true);
                                        setTimeout(() => searchInputRef.current?.focus(), 100);
                                    }}
                                    className="p-2.5 bg-white/5 hover:bg-white/10 text-primary border border-white/10 rounded-xl transition-all flex items-center gap-2"
                                    title="Buscar Cliente"
                                >
                                    <Search size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Buscar</span>
                                </button>
                            ) : (
                                <div className="w-full flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            placeholder="Nombre o RUC..."
                                            value={globalQuery}
                                            onChange={(e) => {
                                                setGlobalQuery(e.target.value);
                                                setIsSearchOpen(true);
                                            }}
                                            className="w-full pl-8 pr-7 py-2 bg-slate-900 border border-primary/40 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                                        />
                                        {globalQuery && (
                                            <button onClick={() => setGlobalQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsMobileSearchExpanded(false);
                                            setIsSearchOpen(false);
                                            setGlobalQuery('');
                                        }}
                                        className="p-2 bg-white/5 text-slate-400 rounded-xl"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Desktop Search Bar */}
                        <div className="hidden md:block relative">
                            <div className="relative flex items-center">
                                <Search size={14} className="absolute left-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar cliente por Nombre o RUC (Ctrl + K)..."
                                    value={globalQuery}
                                    onFocus={() => setIsSearchOpen(true)}
                                    onChange={(e) => {
                                        setGlobalQuery(e.target.value);
                                        setIsSearchOpen(true);
                                    }}
                                    className="w-full pl-9 pr-24 py-2 bg-white/5 hover:bg-white/[0.08] focus:bg-slate-900 border border-white/10 focus:border-primary/50 rounded-2xl text-xs font-medium text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                                />
                                {globalQuery ? (
                                    <button
                                        onClick={() => setGlobalQuery('')}
                                        className="absolute right-3 p-1 rounded-full bg-white/10 hover:bg-rose-500 text-slate-400 hover:text-white transition-all"
                                    >
                                        <X size={10} />
                                    </button>
                                ) : (
                                    <div className="absolute right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-slate-500 pointer-events-none">
                                        <Command size={10} /> K
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dropdown Results with Double Action (Ver en Matriz vs Expediente 360) */}
                        {isSearchOpen && globalQuery.trim().length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-2 border-b border-white/5 flex items-center justify-between px-4 py-2 bg-white/[0.02]">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-premium flex items-center gap-1.5">
                                        <Sparkles size={12} className="text-primary" /> Coincidencias ({searchResults.length})
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-mono">Selecciona una acción</span>
                                </div>

                                {searchResults.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 space-y-1">
                                        <Building2 size={24} className="mx-auto opacity-30 mb-1" />
                                        <p className="text-xs font-semibold">No se encontraron clientes para "{globalQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map(client => (
                                            <div
                                                key={client.id}
                                                className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 group"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                                        {client.ruc.slice(8, 9)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-white truncate group-hover:text-primary transition-colors">
                                                            {client.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                                            <span>{client.ruc}</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span className="text-purple-400 font-sans font-semibold">{client.regime || 'General'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                    <button
                                                        onClick={() => handleSelectMatrixMatch(client)}
                                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-primary text-slate-300 hover:text-white border border-white/10 hover:border-primary text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                        title="Ver casillas de IVA/Renta en la Matriz"
                                                    >
                                                        <LayoutGrid size={11} />
                                                        <span>Ver en Matriz</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleSelectProfileMatch(client)}
                                                        className="px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/30 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                                        title="Abrir Expediente 360° en Modal"
                                                    >
                                                        <User size={11} />
                                                        <span>Expediente</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Notifications & Quick Sales Button */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={() => setIsSalesModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                            title="Registrar Venta de Plan o Firma Electrónica"
                        >
                            <ShoppingBag size={13} />
                            <span className="hidden sm:inline">💳 Vender Plan / Firma</span>
                            <span className="sm:hidden">💳 Venta</span>
                        </button>

                        <NotificationBell
                            clients={clients}
                            navigate={(screen: Screen) => handleNavigate(screen)}
                        />
                    </div>
                </header>

                {/* Modal Global de Ventas de Combos / Firmas */}
                <SalesComboModal
                    isOpen={isSalesModalOpen}
                    onClose={() => setIsSalesModalOpen(false)}
                    onEmitSriInvoice={(client, description, amount) => {
                        navigate('/facturacion', { state: { targetClient: client, description, amount } });
                    }}
                />

                {/* Dynamic Route Content with Suspense Loading */}
                <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-300">
                            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 font-premium">
                                Cargando Módulo...
                            </span>
                        </div>
                    }>
                        <Outlet />
                    </Suspense>
                </div>
            </main>
        </div>
    );
};
