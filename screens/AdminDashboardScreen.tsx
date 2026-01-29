
import React, { useMemo, useState } from 'react';
import { 
    Users, Crown, TrendingUp, ShieldCheck, AlertTriangle, 
    Briefcase, Calendar, Filter, Search, DollarSign, Store
} from 'lucide-react';
import { Screen, Client, DeclarationStatus, TaxRegime } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { isPast, isToday, isTomorrow } from 'date-fns';
import { ClientCard } from '../components/ClientCard';
import { useToast } from '../context/ToastContext';

interface AdminDashboardScreenProps {
  navigate: (screen: Screen, options?: any) => void;
  clients: Client[];
  tasks?: any[]; 
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate, clients }) => {
    const { setClients, serviceFees } = useAppStore();
    const { toast } = useToast();
    const [filter, setFilter] = useState<'all' | 'vip' | 'urgent' | 'rimpe' | 'popular'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // --- LOGICA DE CLASIFICACIÓN DEL WORKSPACE ---
    const workspaceData = useMemo(() => {
        let list = clients.filter(c => c.isActive !== false);
        const today = new Date();

        // 1. Filtrado por Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(term) || c.ruc.includes(term));
        }

        // 2. Filtrado por Tabs
        if (filter === 'vip') {
            list = list.filter(c => c.category.includes('Suscripción'));
        } else if (filter === 'urgent') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const d = getDueDateForPeriod(c, p);
                const isPaid = c.declarationHistory.some(dh => dh.period === p && dh.status === DeclarationStatus.Pagada);
                // Urgente: Vencido o Vence en <= 3 días y no está pagado
                return !isPaid && d && (isPast(d) || isToday(d) || isTomorrow(d) || d.getTime() - today.getTime() < 3 * 24 * 60 * 60 * 1000);
            });
        } else if (filter === 'rimpe') {
            list = list.filter(c => c.regime === TaxRegime.RimpeEmprendedor);
        } else if (filter === 'popular') {
            list = list.filter(c => c.regime === TaxRegime.RimpeNegocioPopular);
        }

        // 3. Ordenamiento por Prioridad (Algoritmo de Atencion)
        return list.sort((a, b) => {
            const pA = getPeriod(a, today);
            const pB = getPeriod(b, today);
            const dueA = getDueDateForPeriod(a, pA)?.getTime() || 9999999999999;
            const dueB = getDueDateForPeriod(b, pB)?.getTime() || 9999999999999;

            // Primero los vencidos/próximos
            if (dueA !== dueB) return dueA - dueB;
            
            // Luego VIPs
            const aVip = a.category.includes('Suscripción') ? 1 : 0;
            const bVip = b.category.includes('Suscripción') ? 1 : 0;
            return bVip - aVip;
        });
    }, [clients, filter, searchTerm]);

    const kpis = useMemo(() => {
        const today = new Date();
        const overdue = clients.filter(c => {
             const p = getPeriod(c, today);
             const d = getDueDateForPeriod(c, p);
             const isDone = c.declarationHistory.some(dh => dh.period === p && (dh.status === DeclarationStatus.Pagada || dh.status === DeclarationStatus.Enviada));
             return d && isPast(d) && !isDone && c.isActive;
        }).length;

        const monthlyIncome = clients.filter(c => c.isActive).reduce((sum, c) => sum + (c.customServiceFee || 0), 0);

        return {
            total: clients.length,
            vip: clients.filter(c => c.category.includes('Suscripción')).length,
            overdue,
            projectedIncome: monthlyIncome
        };
    }, [clients]);

    const handleAction = (client: Client, action: 'declare' | 'pay') => {
        const today = new Date();
        const period = getPeriod(client, today);
        const nowIso = today.toISOString();
        
        setClients(prev => prev.map(c => {
            if (c.id !== client.id) return c;
            
            const history = [...c.declarationHistory];
            const idx = history.findIndex(d => d.period === period);
            const newStatus = action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada;
            
            const newEntry = {
                period,
                status: newStatus,
                updatedAt: nowIso,
                ...(action === 'declare' ? { declaredAt: nowIso } : {}),
                ...(action === 'pay' ? { paidAt: nowIso, transactionId: `Q-${Date.now().toString().slice(-4)}` } : {})
            };

            if (idx > -1) {
                history[idx] = { ...history[idx], ...newEntry };
            } else {
                history.push(newEntry);
            }
            return { ...c, declarationHistory: history };
        }));

        toast.success(action === 'declare' ? 'Declaración registrada' : 'Pago registrado');
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white">Área de Trabajo</h2>
                    <p className="text-slate-500 text-sm font-medium">Control operativo y cumplimiento tributario.</p>
                </div>
                <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                    <Search className="text-slate-400 ml-2" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full md:w-64 text-slate-700 dark:text-white placeholder-slate-400"
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-teal/10 rounded-lg text-brand-teal"><Users size={20}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Cartera</span>
                    </div>
                    <p className="text-2xl font-black text-brand-navy dark:text-white">{kpis.total}</p>
                </div>
                
                <div className="bg-gradient-to-br from-[#0B2149] to-[#1a2e5a] p-5 rounded-[1.5rem] shadow-lg text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg text-amber-400"><Crown size={20} fill="currentColor"/></div>
                        <span className="text-xs font-bold text-slate-300 uppercase">VIPs</span>
                    </div>
                    <p className="text-2xl font-black">{kpis.vip}</p>
                </div>

                <div className={`p-5 rounded-[1.5rem] border shadow-sm transition-shadow ${kpis.overdue > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${kpis.overdue > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {kpis.overdue > 0 ? <AlertTriangle size={20}/> : <ShieldCheck size={20}/>}
                        </div>
                        <span className={`text-xs font-bold uppercase ${kpis.overdue > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                            {kpis.overdue > 0 ? 'Atención' : 'Estado'}
                        </span>
                    </div>
                    <p className={`text-2xl font-black ${kpis.overdue > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {kpis.overdue > 0 ? `${kpis.overdue} Vencidos` : 'Al Día'}
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600"><DollarSign size={20}/></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Proyección Mes</span>
                    </div>
                    <p className="text-2xl font-black text-brand-navy dark:text-white">${kpis.projectedIncome}</p>
                </div>
            </div>

            {/* Workflow Tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                {[
                    { id: 'all', label: 'Todos', icon: Briefcase },
                    { id: 'urgent', label: 'Por Vencer', icon: AlertTriangle },
                    { id: 'vip', label: 'VIP Suscritos', icon: Crown },
                    { id: 'rimpe', label: 'RIMPE Emp.', icon: TrendingUp },
                    { id: 'popular', label: 'Neg. Popular', icon: Store },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            filter === tab.id 
                                ? 'bg-brand-navy text-white shadow-md' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <tab.icon size={14}/> {tab.label}
                    </button>
                ))}
            </div>

            {/* Client Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workspaceData.length > 0 ? workspaceData.map(client => (
                    <ClientCard 
                        key={client.id}
                        client={client}
                        serviceFees={serviceFees}
                        onQuickAction={handleAction}
                        onView={(c) => navigate('clients', { clientIdToView: c.id })}
                    />
                )) : (
                    <div className="col-span-full py-20 text-center">
                        <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
                            <Filter size={32}/>
                        </div>
                        <p className="text-slate-500 font-medium">No se encontraron clientes con este filtro.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
