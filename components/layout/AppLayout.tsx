import React, { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNavBar } from './MobileNavBar';
import { Clock } from '../ui/Clock';
import { NotificationBell } from './NotificationBell';
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
            web_orders: '/dashboard/pedidos'
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
            />

            {/* Persistent Mobile Navigation Bar */}
            <MobileNavBar
                activeScreen={activeScreen}
                onNavigate={handleNavigate}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 md:ml-[264px] h-screen overflow-y-auto custom-scrollbar relative">
                {/* Header bar */}
                <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 no-print">
                    <div className="flex items-center gap-3">
                        <Clock />
                    </div>
                    <div className="flex items-center gap-3">
                        <NotificationBell
                            clients={clients}
                            onSelectClient={onSelectClient || (() => {})}
                        />
                    </div>
                </header>

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
