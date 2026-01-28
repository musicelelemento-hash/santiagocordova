
import React, { useMemo, useState } from 'react';
import { 
    Users, FileClock, Crown, TrendingUp, Calendar, ShieldCheck, 
    ChevronRight, MessageCircle, Zap, FileCheck, PenTool, AlertTriangle, CheckCircle2, DollarSign
} from 'lucide-react';
import { Screen, Client, DeclarationStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { isPast, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { ClientCard } from '../components/ClientCard';
import { useToast } from '../context/ToastContext';

interface AdminDashboardScreenProps {
  navigate: (screen: Screen, options?: any) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate }) => {
    const { clients, setClients, serviceFees } = useAppStore();
    const { toast } = useToast();
    const [filter, setFilter] = useState<'all' | 'vip' | 'urgent' | 'rimpe'>('all');

    const filteredClients = useMemo(() => {
        let list = clients.filter(c => c.isActive !== false);
        const today = new Date();

        // 1. Filtrado Base
        if (filter === 'vip') {
            list = list.filter(c => c.category.includes('Suscripción'));
        } else if (filter === 'urgent') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const d = getDueDateForPeriod(c, p);
                const isPaid = c.declarationHistory.some(dh => dh.period === p && dh.status === DeclarationStatus.Pagada);
                // Mostrar si vence hoy, mañana o ya venció y no está pagado
                return !isPaid && d && (isPast(d) || isToday(d) || isTomorrow(d));
            });
        } else if (filter === 'rimpe') {
            list = list.filter(c => c.regime.includes('RIMPE'));
        }

        // 2. Ordenamiento Inteligente
        return list.sort((a, b) => {
            const aIsVip = a.category.includes('Suscripción') ? 1 : 0;
            const bIsVip = b.category.includes('Suscripción') ? 1 : 0;
            
            // Prioridad 1: VIP siempre arriba
            if (aIsVip !== bIsVip) return bIsVip - aIsVip;

            // Prioridad 2: Fecha de vencimiento más cercana
            const pA = getPeriod(a, today);
            const pB = getPeriod(b, today);
            const dA = getDueDateForPeriod(a, pA)?.getTime() || 9999999999999;
            const dB = getDueDateForPeriod(b, pB)?.getTime() || 9999999999999;
            return dA - dB;
        });
    }, [clients, filter]);

    const stats = useMemo(() => {
        const today = new Date();
        const overdue = clients.filter(c => {
             const p = getPeriod(c, today);
             const d = getDueDateForPeriod(c, p);
             return d && isPast(d) && !c.declarationHistory.some(dh => dh.period === p && dh.status === DeclarationStatus.Pagada);
        }).length;

        return {
            overdue,
            vipCount: clients.filter(c => c.category.includes('Suscripción')).length
        };
    }, [clients]);

    const handleAction = (client: Client, action: 'declare' | 'pay') => {
        const today = new Date();
        const period = getPeriod(client, today);
        const nowIso = today.toISOString();
        const displayPeriod = formatPeriodForDisplay(period);
        
        setClients(prev => prev.map(c => {
            if (c.id !== client.id) return c;
            
            const history = [...c.declarationHistory];
            const idx = history.findIndex(d => d.period === period);
            const newStatus = action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada;
            
            const newEntry = {
                period,
                status: newStatus,
                updatedAt: nowIso,
                // Si declaramos, guardamos fecha envio. Si pagamos, guardamos fecha pago.
                ...(action === 'declare' ? { declaredAt: nowIso } : {}),
                ...(action === 'pay' ? { paidAt: nowIso, transactionId: `Q-${Date.now().toString().slice(-4)}` } : {})
            };

            if (idx > -1) {
                // Preservar datos anteriores si existen
                history[idx] = { ...history[idx], ...newEntry };
            } else {
                history.push(newEntry);
            }
            return { ...c, declarationHistory: history };
        }));

        if (action === 'declare') {
            toast.success(`Declaración ${displayPeriod} enviada correctamente.`);
        } else {
            toast.success(`Pago registrado para ${displayPeriod}. Ciclo cerrado.`);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* KPI STRIP */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-brand-teal/10 text-brand-teal rounded-2xl"><Users size={24}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cartera Activa</p>
                        <p className="text-2xl font-black text-brand-navy dark:text-white mt-1">{clients.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Crown size={24}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Suscritos VIP</p>
                        <p className="text-2xl font-black text-brand-navy dark:text-white mt-1">{stats.vipCount}</p>
                    </div>
                </div>
                <div className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 ${stats.overdue > 0 ? 'border-l-4 border-l-red-500' : ''}`}>
                    <div className={`p-3 rounded-2xl ${stats.overdue > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{stats.overdue > 0 ? <AlertTriangle size={24}/> : <ShieldCheck size={24}/>}</div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Pendientes Críticos</p>
                        <p className={`text-2xl font-black mt-1 ${stats.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{stats.overdue}</p>
                    </div>
                </div>
                <div className="bg-brand-navy p-6 rounded-[2rem] shadow-xl flex items-center gap-4 relative overflow-hidden group text-white">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-brand-teal/20 rounded-full blur-xl -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
                    <div className="p-3 bg-brand-teal text-white rounded-2xl relative z-10 shadow-lg shadow-teal-500/20"><TrendingUp size={24}/></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Recurrencia Estimada</p>
                        <p className="text-2xl font-black text-brand-teal mt-1">$1.4k</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Panel de Operatividad */}
                <div className="lg:col-span-8 space-y-8">
                    <header className="flex flex-col md:flex-row justify-between items-end gap-4">
                        <div>
                            <h2 className="text-3xl font-display font-black text-[#001F5B] dark:text-white">Workflow de Gestión</h2>
                            <p className="text-slate-500 font-medium text-sm">Organizado por prioridad máxima: VIP &gt; Urgentes SRI.</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                            {['all', 'vip', 'urgent', 'rimpe'].map((f) => (
                                <button 
                                    key={f} 
                                    onClick={() => setFilter(f as any)} 
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filter === f ? 'bg-white dark:bg-slate-700 text-[#001F5B] dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    {f === 'all' ? 'Todos' : f === 'vip' ? 'Suscritos' : f === 'urgent' ? 'Urgentes' : 'RIMPE'}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredClients.length > 0 ? filteredClients.map(client => (
                            <ClientCard 
                                key={client.id} 
                                client={client} 
                                serviceFees={serviceFees}
                                onQuickAction={handleAction}
                                onView={(c) => navigate('clients', { clientIdToView: c.id })}
                            />
                        )) : (
                            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                                <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-200"/>
                                <p className="font-black text-slate-300 uppercase tracking-widest">¡Excelente! Todo al día en este filtro.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Monitor de Firmas & Onboarding */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm sticky top-24">
                        <div className="flex items-center justify-between mb-8">
                             <h3 className="font-black text-brand-navy dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                                <PenTool size={18} className="text-brand-teal"/> Monitor de Firmas
                             </h3>
                             <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Alertas</span>
                        </div>
                        
                        <div className="space-y-4">
                            {clients.filter(c => c.signatureExpirationDate).length > 0 ? clients.filter(c => c.signatureExpirationDate).slice(0,5).map(client => {
                                const diff = differenceInCalendarDays(new Date(client.signatureExpirationDate!), new Date());
                                return (
                                    <div key={client.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-amber-400 transition-colors">
                                        <div className="truncate pr-4">
                                            <p className="font-bold text-slate-800 dark:text-white truncate text-xs">{client.name}</p>
                                            <p className={`text-[10px] font-black ${diff < 15 ? 'text-red-500' : 'text-slate-400'}`}>CADUCA EN {diff} DÍAS</p>
                                        </div>
                                        <button onClick={() => window.open(`https://wa.me/593${client.phones?.[0]?.substring(1)}`, '_blank')} className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-brand-teal opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MessageCircle size={16}/>
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-8 opacity-40">
                                    <ShieldCheck size={40} className="mx-auto mb-3 text-slate-300"/>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin vencimientos próximos</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                             <button onClick={() => navigate('scanner')} className="w-full group p-6 bg-slate-100 dark:bg-slate-800 hover:bg-brand-navy dark:hover:bg-slate-700 rounded-2xl transition-all duration-300 flex items-center justify-between text-slate-600 dark:text-slate-300 hover:text-white">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white dark:bg-slate-700 p-2 rounded-xl group-hover:text-brand-teal"><FileCheck size={20}/></div>
                                    <div className="text-left">
                                        <span className="block font-bold text-sm">Nuevo Cliente</span>
                                        <span className="block text-[10px] opacity-70">Escáner IA RUC</span>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="opacity-50 group-hover:opacity-100"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
