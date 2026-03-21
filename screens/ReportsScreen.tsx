import React, { useMemo, useState } from 'react';
import { Screen, DeclarationStatus, TaskStatus, AnalysisType, TaxRegime, Client, Task, ServiceFeesConfig, FinancialItem } from '../types';
import { getClientServiceFee } from '../services/clientService';
import { runStrategicAnalysis } from '../services/geminiService';
import {
    Loader, AlertTriangle, TrendingUp, BarChart,
    DollarSign, Clock, Zap, Activity, Users, Shield,
    LineChart, Calendar, PieChart as PieChartIcon,
    ChevronRight, TrendingDown, Target, Briefcase
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Modal } from '../components/ui/Modal';
import { isSameMonth, isSameYear, subMonths, parseISO, isValid } from 'date-fns';
import { safeFormat } from '../services/sri';

import { useAppStore } from '../store/useAppStore';

interface ReportsScreenProps {
    navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}

const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6'];

const MetricCard: React.FC<{ title: string; value: string; description: string; color: string; icon: React.ElementType; trend?: string }> = ({ title, value, description, color, icon: Icon, trend }) => (
    <div className="p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] glass-tactical border border-white/5 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:scale-[1.02] hover:bg-white/10 hover:border-sky-500/30">
        <div className={`absolute -right-10 -top-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full blur-[60px] sm:blur-[70px] opacity-10 transition-all duration-700 group-hover:opacity-30 group-hover:scale-150 ${color}`}></div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 shadow-inner group-hover:border-sky-500/40 transition-colors group-hover:rotate-3 group-hover:scale-110 duration-500">
                    <Icon size={20} className="text-sky-500 sm:w-6 sm:h-6 transition-colors group-hover:text-sky-400" />
                </div>
                {trend && (
                    <span className="text-[8px] sm:text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 sm:px-3 py-1 rounded-full flex items-center border border-emerald-500/20 uppercase tracking-[0.1em] shadow-lg shadow-emerald-500/10">
                        <TrendingUp size={10} className="mr-1.5" /> {trend}
                    </span>
                )}
            </div>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 mb-1 group-hover:text-sky-500 transition-colors duration-500">{title}</p>
            <h3 className="text-3xl sm:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1 sm:mb-2 group-hover:tracking-tight transition-all duration-500">{value}</h3>
            <div className="flex items-center gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/5 group-hover:border-sky-500/20 transition-colors duration-500">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity whitespace-pre-wrap">{description}</p>
            </div>
        </div>
    </div>
);

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigate }) => {
    const { clients, tasks, serviceFees } = useAppStore();
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [analysisTitle, setAnalysisTitle] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'month' | 'year'>('month');

    // --- FINANCIAL METRICS CALCULATION ---
    const metrics = useMemo(() => {
        let totalPaid = 0;
        let accountsReceivable = 0;
        let potentialIncome = 0; 
        const incomeByClient: { [key: string]: number } = {};
        const debtByClient: { [key: string]: { name: string; amount: number; id: string } } = {};
        const now = new Date();

        const filterFn = (dateStr: string) => {
            if (!dateStr) return false;
            const date = parseISO(dateStr);
            if (!isValid(date)) return false;
            if (timeRange === 'month') return isSameMonth(date, now);
            return isSameYear(date, now);
        };

        clients.forEach(client => {
            if (client.isDeleted) return;
            const clientName = client.name;
            if (!incomeByClient[clientName]) incomeByClient[clientName] = 0;

            if (client.isActive !== false) {
                const fee = getClientServiceFee(client, serviceFees);
                if (client.taxProfile?.ivaFrequency === 'Mensual') potentialIncome += fee;
                else if (client.taxProfile?.ivaFrequency === 'Semestral') potentialIncome += (fee / 6);
                else potentialIncome += (fee / 12);
            }

            if (client.isActive === false) return;

            const paidPeriods = new Set<string>();
            client.declarations.forEach(d => {
                if (d.status === DeclarationStatus.Pagada) {
                    paidPeriods.add(d.period);
                }
            });

            client.declarations.forEach(d => {
                const fee = d.amount ?? getClientServiceFee(client, serviceFees, d.period);
                if (d.status === DeclarationStatus.Pagada) {
                    const dateToCheck = d.paidAt || d.updatedAt;
                    if (filterFn(dateToCheck)) {
                        totalPaid += fee;
                        incomeByClient[clientName] += fee;
                    }
                }
                else if ((d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pendiente) && !paidPeriods.has(d.period)) {
                    accountsReceivable += fee;
                    if (!debtByClient[client.id]) {
                        debtByClient[client.id] = { name: client.name, amount: 0, id: client.id };
                    }
                    debtByClient[client.id].amount += fee;
                }
            });
        });

        tasks.forEach(task => {
            const fee = task.cost ?? 0;
            const balance = fee - (task.advancePayment || 0);

            if (task.status === TaskStatus.Pagada) {
                const dateToCheck = task.dueDate;
                if (filterFn(dateToCheck)) {
                    totalPaid += fee;
                }
            }
            else if (task.status === TaskStatus.Completada && balance > 0) {
                accountsReceivable += balance;
            }
        });

        const topClientsData = Object.entries(incomeByClient)
            .map(([name, income]) => ({ name, Ingresos: income }))
            .filter(c => c.Ingresos > 0)
            .sort((a, b) => b.Ingresos - a.Ingresos)
            .slice(0, 5);

        const topDebtors = Object.values(debtByClient)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        return {
            totalPaid,
            accountsReceivable,
            potentialIncome,
            topClientsData,
            topDebtors
        };
    }, [clients, tasks, serviceFees, timeRange]);

    const trendData = useMemo(() => {
        const data = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
            const monthDate = subMonths(today, i);
            const monthName = safeFormat(monthDate, 'MMM').toUpperCase();
            let monthIncome = 0;

            clients.forEach(c => {
                c.declarations.forEach(d => {
                    if (d.status === DeclarationStatus.Pagada && d.paidAt) {
                        if (isSameMonth(parseISO(d.paidAt), monthDate)) {
                            monthIncome += (d.amount || getClientServiceFee(c, serviceFees, d.period));
                        }
                    }
                });
            });

            tasks.forEach(t => {
                if (t.status === TaskStatus.Pagada && isSameMonth(parseISO(t.dueDate), monthDate)) {
                    monthIncome += (t.cost || 0);
                }
            });

            data.push({ name: monthName, Ingresos: monthIncome });
        }
        return data;
    }, [clients, tasks, serviceFees]);

    const regimeData = useMemo(() => {
        const counts = {
            [TaxRegime.General]: 0,
            [TaxRegime.RimpeEmprendedor]: 0,
            [TaxRegime.RimpeNegocioPopular]: 0
        };

        const activeClients = clients.filter(c => c.isActive !== false);
        activeClients.forEach(c => {
            if (counts[c.regime] !== undefined) counts[c.regime]++;
        });

        return [
            { name: 'General', value: counts[TaxRegime.General] },
            { name: 'Emprendedor', value: counts[TaxRegime.RimpeEmprendedor] },
            { name: 'Popular', value: counts[TaxRegime.RimpeNegocioPopular] },
        ].filter(d => d.value > 0);
    }, [clients]);

    const handleRunAnalysis = async (analysisType: AnalysisType, title: string) => {
        setIsAnalysisModalOpen(true);
        setAnalysisTitle(title);
        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysisResult(null);
        try {
            const result = await runStrategicAnalysis(clients, tasks, analysisType);
            setAnalysisResult(result);
        } catch (err: any) {
            setAnalysisError(err.message || 'Error desconocido');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0 aurora-premium min-h-screen">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-8">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 shadow-lg shadow-sky-500/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>
                            <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Global Analytics Intelligence</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Dashboard v4.5</span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-display font-black text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-2 italic">
                        Strategic <span className="text-gradient-sky">Reports</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                        <Target size={12} className="text-sky-500" />
                        <span>Métricas de Rendimiento y Proyección Fiscal</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <button 
                        onClick={() => handleRunAnalysis(AnalysisType.Strategic, 'Análisis Estratégico Global')}
                        className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto group relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:shadow-sky-500/20 border border-white/5"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/10 to-sky-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <Zap size={18} className="text-sky-400 dark:text-sky-600 transition-transform group-hover:scale-125 group-hover:rotate-12" />
                        EJECUTAR IA STRATEGY
                    </button>
                    <div className="flex p-1 bg-white/5 dark:bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <button 
                            onClick={() => setTimeRange('month')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 ${timeRange === 'month' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >MES</button>
                        <button 
                            onClick={() => setTimeRange('year')}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 ${timeRange === 'year' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >AÑO</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up-fade">
                <MetricCard 
                    title="Ingresos Totales" 
                    value={`$${metrics.totalPaid.toFixed(2)}`} 
                    description="Efectivo Liquidado (Pagado)" 
                    color="bg-sky-500" 
                    icon={DollarSign} 
                    trend="+12.4%"
                />
                <MetricCard 
                    title="Cuentas x Cobrar" 
                    value={`$${metrics.accountsReceivable.toFixed(2)}`} 
                    description="Cartera Pendiente de Gestión" 
                    color="bg-amber-500" 
                    icon={Clock} 
                />
                <MetricCard 
                    title="Ingreso Potencial" 
                    value={`$${metrics.potentialIncome.toFixed(2)}`} 
                    description="Proyección Mensual Teórica" 
                    color="bg-emerald-500" 
                    icon={TrendingUp} 
                />
                <MetricCard
                    title="Activos Totales"
                    value={`${clients.filter(c => c.isActive !== false).length}`}
                    description="Base de Operaciones Activa"
                    color="bg-violet-500"
                    icon={Users}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2 p-8 glass-tactical rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden h-[450px] group transition-all duration-500 hover:border-sky-500/20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <h3 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter group-hover:text-sky-500 transition-colors">Evolución Operativa</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Histórico de Ingresos (6 Ciclos)</p>
                        </div>
                        <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                            <Activity className="text-sky-500" size={20} />
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" vertical={false} opacity={0.05} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: '900' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: '900' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                                    itemStyle={{ color: '#0EA5E9', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}
                                    labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: '900', marginBottom: '4px', letterSpacing: '0.1em' }}
                                    cursor={{ stroke: '#0EA5E9', strokeWidth: 2, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="Ingresos" stroke="#0EA5E9" strokeWidth={5} fillOpacity={1} fill="url(#colorIngresos)" animationDuration={2000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="p-8 glass-tactical rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-sky-500/20 transition-all duration-500">
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full -mr-32 -mb-32 pointer-events-none opacity-50 group-hover:opacity-100"></div>
                    <h3 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter self-start mb-2 group-hover:text-sky-500 transition-colors">Estructura Regime</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest self-start mb-8 tracking-[0.2em]">Composición de Cartera</p>
                    
                    <div className="flex-1 w-full min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={regimeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={75}
                                    outerRadius={95}
                                    paddingAngle={10}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {regimeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', backdropFilter: 'blur(20px)' }}
                                    itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center group-hover:scale-110 transition-transform duration-500">
                            <span className="text-5xl font-black text-slate-900 dark:text-white leading-none tracking-tighter italic">{clients.length}</span>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mt-2">Activos</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative z-10">
                <div className="p-8 glass-tactical rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-500">
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner group-hover:scale-110 transition-transform">
                                <Users className="text-emerald-500" size={24} />
                            </div>
                            <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter group-hover:text-emerald-500 transition-colors">Elite Partners</h3>
                        </div>
                        <span className="text-[9px] font-black text-emerald-500/60 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10 uppercase tracking-widest italic font-mono">Performance: HIGH</span>
                    </div>

                    <div className="space-y-4 relative z-10">
                        {metrics.topClientsData.length > 0 ? metrics.topClientsData.map((client, idx) => (
                            <div key={idx} className="flex items-center justify-between p-5 bg-white/5 rounded-[1.5rem] border border-white/5 hover:bg-white/10 hover:translate-x-1 transition-all group/item">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-emerald-500 flex items-center justify-center font-black text-lg border border-white/10 shadow-lg">
                                        {idx + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-[13px] text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-0.5">{client.name}</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-60 italic">Vip Transaction Node</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-emerald-500 tracking-tighter block">${client.Ingresos.toFixed(2)}</span>
                                    <span className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest">Liquidated</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-16 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] opacity-30">Stream Offline</div>
                        )}
                    </div>
                </div>

                <div className="p-8 glass-tactical rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:border-rose-500/20 transition-all duration-500">
                    <div className="flex justify-between items-center mb-10 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-inner group-hover:scale-110 transition-transform">
                                <AlertTriangle className="text-rose-500" size={24} />
                            </div>
                            <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter group-hover:text-rose-500 transition-colors">Risk Perimeter</h3>
                        </div>
                        <span className="text-[9px] font-black text-rose-500/60 bg-rose-500/5 px-3 py-1.5 rounded-full border border-rose-500/10 uppercase tracking-widest italic font-mono">Cartera: CRITICAL</span>
                    </div>

                    <div className="space-y-4 relative z-10">
                        {metrics.topDebtors.length > 0 ? metrics.topDebtors.map((debtor, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 sm:p-5 bg-rose-500/5 rounded-[1.5rem] border border-rose-500/10 hover:bg-rose-500/10 hover:translate-x-1 transition-all group/item">
                                <div className="flex items-center gap-3 sm:gap-5">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black text-lg sm:text-xl border border-rose-500/20 shadow-lg animate-pulse">
                                        !
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black text-[12px] sm:text-[13px] text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-0.5 truncate max-w-[120px] sm:max-w-none">{debtor.name}</span>
                                        <button 
                                            onClick={() => navigate('clients', { clientIdToView: debtor.id })}
                                            className="group/btn flex items-center gap-2 text-[8px] sm:text-[9px] text-sky-500 font-black uppercase tracking-widest text-left transition-all"
                                        >
                                            Interceptar <span className="hidden sm:inline">Perfil</span>
                                            <ChevronRight size={10} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-base sm:text-lg font-black text-rose-500 tracking-tighter block">${debtor.amount.toFixed(2)}</span>
                                    <span className="text-[8px] font-black text-rose-500/40 uppercase tracking-widest">Unsettled</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-16 flex flex-col items-center justify-center overflow-hidden">
                                <Shield size={48} className="text-emerald-500 opacity-20 mb-4 animate-pulse" />
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.25em] italic">No Risks Detected in Sector</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} title={analysisTitle}>
                <div className="aurora-premium p-1 rounded-[2.5rem]">
                    <div className="glass-tactical rounded-[2.4rem] p-8 min-h-[400px]">
                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center text-center p-12 min-h-[400px]">
                                <div className="relative mb-10 scale-150">
                                    <Loader className="w-12 h-12 text-sky-500 animate-spin" />
                                    <div className="absolute inset-x-0 bottom-0 top-0 left-0 bg-sky-500/20 blur-xl animate-pulse rounded-full"></div>
                                </div>
                                <p className="text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2 italic">Neural Processing...</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] max-w-xs leading-loose">Decodificando flujos de capital e indicadores estratégicos mediante protocolo avanzado</p>
                            </div>
                        )}
                        {analysisError && (
                            <div className="p-8 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl flex items-center gap-6 animate-shake">
                                <div className="p-4 bg-rose-500/20 rounded-2xl">
                                    <AlertTriangle size={40} />
                                </div>
                                <div>
                                    <p className="font-black text-lg uppercase tracking-widest mb-1 italic">Link Failure</p>
                                    <span className="text-sm font-medium opacity-80 leading-relaxed">{analysisError}</span>
                                </div>
                            </div>
                        )}
                        {analysisResult && (
                            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none animate-fade-in">
                                <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-sm shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-3xl -mr-16 -mt-16 group-hover:opacity-100 transition-opacity"></div>
                                    <div dangerouslySetInnerHTML={{ __html: analysisResult }} className="relative z-10 text-[13px] leading-relaxed font-medium text-slate-700 dark:text-slate-300" />
                                </div>
                                <div className="mt-10 flex justify-end">
                                    <button 
                                        onClick={() => setIsAnalysisModalOpen(false)}
                                        className="px-10 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.05] hover:shadow-2xl hover:shadow-sky-500/10 active:scale-95 italic"
                                    >Cerrar Interfaz</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

