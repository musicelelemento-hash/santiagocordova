
import React, { useMemo, useState } from 'react';
import { 
    Calendar, DollarSign, ShieldCheck, TrendingUp, 
    Clock, CheckCircle2, AlertCircle, Zap, Bell, 
    BarChart3, Layers, Crown 
} from 'lucide-react';
import { Screen, Client, Task, DeclarationStatus, ServiceFeesConfig, ClientCategory } from '../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { ClientCard } from '../components/ClientCard';
import { isPast, getYear } from 'date-fns';
import { getClientServiceFee } from '../services/clientService';

interface HomeScreenProps {
  navigate: (screen: Screen, options?: any) => void;
  serviceFees: ServiceFeesConfig;
  clients: Client[];
  tasks: Task[];
}

type DashboardFilter = 'all' | 'monthly' | 'semestral' | 'annual';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigate, serviceFees, clients, tasks }) => {
    const [filter, setFilter] = useState<DashboardFilter>('all');
    
    // --- LÓGICA DE NEGOCIO Y DATOS ---
    const dashboardData = useMemo(() => {
        const today = new Date();
        const activeClients = clients.filter(c => c.isActive !== false);

        // 1. Detectar Temporada de Renta (Obligaciones Anuales pendientes)
        const rentaPendingClients = activeClients.filter(c => {
             const period = getPeriod(c, today);
             // Si el periodo es anual (ej: "2024") y no está pagado
             return period.length === 4 && 
                    !c.declarationHistory.some(d => d.period === period && d.status === DeclarationStatus.Pagada);
        });

        const totalRentaRevenue = rentaPendingClients.reduce((sum, c) => sum + getClientServiceFee(c, serviceFees), 0);

        // 2. Filtrado de la Lista Principal
        const filteredList = activeClients.filter(c => {
            if (filter === 'all') return true;
            if (filter === 'monthly') return c.category.includes('Mensual') || c.category === ClientCategory.DevolucionIvaTerceraEdad;
            if (filter === 'semestral') return c.category.includes('Semestral');
            if (filter === 'annual') return c.category.includes('Renta') || c.category.includes('Anual') || getPeriod(c, today).length === 4;
            return true;
        });

        // 3. Ordenamiento por Urgencia (Fecha de Vencimiento)
        const getSortableDate = (client: Client): number => {
            const period = getPeriod(client, today);
            const isPaid = client.declarationHistory.some(d => d.period === period && d.status === DeclarationStatus.Pagada);
            if (isPaid) return 9999999999999; // Al final
            const dueDate = getDueDateForPeriod(client, period);
            return dueDate ? dueDate.getTime() : 8888888888888;
        };

        // Separar VIPs y Regulares
        const vipClients = filteredList.filter(c => c.category.includes('Suscripción')).sort((a, b) => getSortableDate(a) - getSortableDate(b));
        
        // En la vista general, solo mostramos los que tienen acciones pendientes para no saturar
        const urgentPending = filteredList
            .filter(c => !c.category.includes('Suscripción'))
            .filter(c => {
                 if (filter === 'all') {
                     const period = getPeriod(c, today);
                     return !c.declarationHistory.some(d => d.period === period && d.status === DeclarationStatus.Pagada);
                 }
                 return true;
            })
            .sort((a,b) => getSortableDate(a) - getSortableDate(b));

        // KPIs Globales
        const totalPending = activeClients.filter(c => {
            const p = getPeriod(c, today);
            return !c.declarationHistory.some(d => d.period === p && d.status === DeclarationStatus.Pagada);
        }).length;
        
        const totalOverdue = activeClients.filter(c => {
             const p = getPeriod(c, today);
             const d = getDueDateForPeriod(c, p);
             const isPaid = c.declarationHistory.some(dh => dh.period === p && dh.status === DeclarationStatus.Pagada);
             return !isPaid && d && isPast(d);
        }).length;

        return { 
            vipClients, 
            urgentPending,
            totalPending,
            totalOverdue,
            rentaPendingCount: rentaPendingClients.length,
            totalRentaRevenue
        };
    }, [clients, filter, serviceFees]);

    const handleQuickAction = (client: Client, action: 'declare' | 'pay') => {
        navigate('clients', { clientIdToView: client.id });
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* 1. HEADER & KPI STRIP */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-navy rounded-full text-white text-xs font-bold uppercase tracking-widest mb-2 shadow-lg shadow-brand-navy/20">
                        <ShieldCheck size={12} className="text-brand-teal"/>
                        Gestión Fiscal {getYear(new Date())}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-black text-slate-800 dark:text-white leading-tight">
                        Panel de <span className="text-brand-teal">Operaciones</span>
                    </h1>
                </div>
                
                <div className="flex gap-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                     <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendientes</p>
                        <p className="text-2xl font-mono font-black text-brand-navy dark:text-white">{dashboardData.totalPending}</p>
                     </div>
                     <div className="w-px bg-slate-200 dark:bg-slate-700 h-10 self-center"></div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Críticos</p>
                        <p className="text-2xl font-mono font-black text-red-600">{dashboardData.totalOverdue}</p>
                     </div>
                </div>
            </header>

            {/* 2. WIDGET TEMPORADA DE RENTA (Dinámico) */}
            {/* Este bloque solo se muestra si hay clientes con obligaciones anuales pendientes */}
            {dashboardData.rentaPendingCount > 0 && (
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/30 border border-white/10">
                    {/* Efectos de fondo */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse-slow"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 opacity-20 rounded-full blur-3xl -ml-10 -mb-10"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
                                <TrendingUp size={32} className="text-indigo-300"/>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-2xl font-black font-display">Temporada de Renta</h3>
                                    <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Prioridad</span>
                                </div>
                                <p className="text-indigo-200 font-medium text-sm">Gestión Anual {getYear(new Date()) - 1} • RIMPE & General</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-8 bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1">Clientes</p>
                                <p className="text-2xl font-mono font-black">{dashboardData.rentaPendingCount}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Potencial</p>
                                <p className="text-2xl font-mono font-black text-emerald-400">${dashboardData.totalRentaRevenue.toFixed(0)}</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setFilter('annual')} 
                            className="px-8 py-4 bg-white text-indigo-900 font-black rounded-xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 text-sm uppercase tracking-wide flex items-center gap-2"
                        >
                            <Zap size={16} className="fill-current"/>
                            Gestionar Ahora
                        </button>
                    </div>
                </div>
            )}

            {/* 3. FILTROS MAESTROS */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {[
                    { id: 'all', label: 'Todo el Panorama', icon: Layers },
                    { id: 'monthly', label: 'Mensual', icon: Calendar },
                    { id: 'semestral', label: 'Semestral', icon: Clock },
                    { id: 'annual', label: 'Renta Anual', icon: DollarSign },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setFilter(item.id as DashboardFilter)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wide transition-all border ${
                            filter === item.id 
                            ? 'bg-brand-navy text-white border-brand-navy shadow-lg shadow-brand-navy/20' 
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-teal hover:text-brand-teal'
                        }`}
                    >
                        <item.icon size={16} />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* 4. CARTERA VIP (Prioridad) */}
            <section className="bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-gradient-to-br from-brand-navy to-slate-900 text-white rounded-2xl shadow-lg shadow-brand-navy/30">
                        <Crown size={24} fill="currentColor" className="text-amber-400"/>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Clientes Suscritos (VIP)</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Atención prioritaria automática</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                     {dashboardData.vipClients.length > 0 ? (
                        dashboardData.vipClients.map(client => (
                            <ClientCard 
                                key={client.id} 
                                client={client} 
                                serviceFees={serviceFees}
                                onView={(c) => navigate('clients', { clientIdToView: c.id })}
                                onQuickAction={handleQuickAction}
                            />
                        ))
                    ) : (
                        <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                            <p className="text-slate-400 italic text-sm">No hay clientes VIP pendientes bajo este filtro.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. GESTIÓN OPERATIVA (Resto de la Cartera) */}
            <section>
                <div className="flex items-center justify-between mb-6 px-2">
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <AlertCircle size={20} className="text-brand-teal"/>
                        {filter === 'all' ? 'Urgencias y Pendientes' : `Pendientes ${filter}`}
                     </h3>
                     <button onClick={() => navigate('calendar')} className="text-xs font-bold text-brand-teal uppercase tracking-widest hover:underline flex items-center gap-1">
                        Ver Calendario <Calendar size={12}/>
                     </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {dashboardData.urgentPending.length > 0 ? (
                        dashboardData.urgentPending.slice(0, 20).map(client => (
                            <ClientCard 
                                key={client.id} 
                                client={client} 
                                serviceFees={serviceFees}
                                onView={(c) => navigate('clients', { clientIdToView: c.id })}
                                onQuickAction={handleQuickAction}
                            />
                        ))
                    ) : (
                        <div className="col-span-full p-12 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 text-center">
                            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4"/>
                            <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Todo bajo control</h4>
                            <p className="text-emerald-600/80 text-sm mt-1">No hay vencimientos pendientes en esta categoría.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 6. ACCESOS RÁPIDOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <button onClick={() => navigate('clients', { initialClientData: {} })} className="p-6 bg-brand-navy rounded-[2rem] text-white shadow-xl shadow-brand-navy/20 hover:scale-[1.02] transition-transform text-left group border border-white/10">
                    <div className="bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-teal group-hover:text-white transition-colors">
                        <Zap size={24}/>
                    </div>
                    <span className="block font-bold text-lg leading-none mb-1">Nuevo</span>
                    <span className="block text-xs font-medium opacity-60 uppercase tracking-wider">Cliente</span>
                </button>

                <button onClick={() => navigate('tasks', { initialTaskData: { title: 'Consulta Tributaria' } })} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 hover:border-brand-teal transition-colors text-left group shadow-sm">
                    <div className="bg-slate-100 dark:bg-slate-700 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 group-hover:text-brand-teal group-hover:bg-brand-teal/10 transition-colors">
                        <Bell size={24}/>
                    </div>
                    <span className="block font-bold text-slate-700 dark:text-white text-lg leading-none mb-1">Tarea</span>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Recordatorio</span>
                </button>

                <button onClick={() => navigate('cobranza')} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 hover:border-green-500 transition-colors text-left group shadow-sm">
                    <div className="bg-slate-100 dark:bg-slate-700 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 group-hover:text-green-500 group-hover:bg-green-500/10 transition-colors">
                        <DollarSign size={24}/>
                    </div>
                    <span className="block font-bold text-slate-700 dark:text-white text-lg leading-none mb-1">Caja</span>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Registrar Pago</span>
                </button>

                <button onClick={() => navigate('reports')} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-colors text-left group shadow-sm">
                    <div className="bg-slate-100 dark:bg-slate-700 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 group-hover:text-purple-500 group-hover:bg-purple-500/10 transition-colors">
                        <BarChart3 size={24}/>
                    </div>
                    <span className="block font-bold text-slate-700 dark:text-white text-lg leading-none mb-1">Reportes</span>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Análisis IA</span>
                </button>
            </div>
        </div>
    );
};
