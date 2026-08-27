import React, { useMemo, useState } from 'react';
import { Screen, DeclarationStatus, TaskStatus, AnalysisType, TaxRegime, Client, Task, ServiceFeesConfig, FinancialItem } from '../types';
import { getClientServiceFee } from '../services/clientService';
import { runStrategicAnalysis } from '../services/geminiService';
import {
    Loader, AlertTriangle, TrendingUp, BarChart,
    DollarSign, Clock, Zap, Activity, Users, Shield,
    LineChart, Calendar, PieChart as PieChartIcon,
    ChevronRight, TrendingDown, Target, Briefcase, MessageSquare
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

const COLORS = ['#00A896', '#2B6AFF', '#C9A96E', '#f43f5e', '#8b5cf6'];

const MetricCard: React.FC<{ title: string; value: string; description: string; color: string; icon: React.ElementType; trend?: string }> = ({ title, value, description, color, icon: Icon, trend }) => (
    <div className="p-6 rounded-[2rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl relative overflow-hidden group transition-all duration-300 hover:border-white/20 hover:scale-[1.01] font-mono">
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3.5 rounded-2xl ${color} text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className="text-[9px] font-bold bg-[#00A896]/15 text-[#00A896] px-2.5 py-1 rounded-full flex items-center border border-[#00A896]/30 uppercase tracking-widest font-mono">
                        <TrendingUp size={10} className="mr-1" /> {trend}
                    </span>
                )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{title}</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight leading-none mb-2">{value}</h3>
            <div className="pt-3 border-t border-white/5">
                <p className="text-xs font-medium text-slate-400 font-sans">{description}</p>
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
            (client.declarations ?? []).forEach(d => {
                if (d.status === DeclarationStatus.Pagada) {
                    paidPeriods.add(d.period);
                }
            });

            (client.declarations ?? []).forEach(d => {
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
                (c.declarations ?? []).forEach(d => {
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

        const activeClients = clients.filter(c => c.isActive !== false && !c.isDeleted);
        activeClients.forEach(c => {
            const regUpper = (c.regime || '').toUpperCase();
            if (regUpper.includes('EMPRENDEDOR')) counts[TaxRegime.RimpeEmprendedor]++;
            else if (regUpper.includes('POPULAR')) counts[TaxRegime.RimpeNegocioPopular]++;
            else counts[TaxRegime.General]++;
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
        <div className="space-y-6 pb-24 animate-in fade-in duration-300 relative font-sans min-h-screen">
            {/* ── TOP EXECUTIVE STRIPE ── */}
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 border-t-white/20 bg-[#051424]/90 shadow-2xl backdrop-blur-2xl p-6 sm:p-10 transition-all duration-500">
                    {/* Mesh Gradient */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-radial from-[#2B6AFF]/15 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-radial from-[#00A896]/15 to-transparent blur-3xl" />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="w-full sm:w-auto font-mono">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-[0_0_10px_rgba(0,168,150,0.2)]">
                                    <div className="relative w-2 h-2 rounded-full bg-[#00A896]">
                                        <div className="absolute inset-0 rounded-full bg-[#00A896] animate-ping opacity-60" />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.25em]">INTELIGENCIA ANALÍTICA TRIBUTARIA</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">• Santiago Córdova Intelligence</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-white leading-none tracking-tight font-display">
                                REPORTES & <span className="bg-gradient-to-r from-[#00A896] via-teal-400 to-[#2B6AFF] bg-clip-text text-transparent">ANALÍTICAS</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-sm text-slate-300 font-sans font-medium">
                                Métricas de rendimiento, liquidaciones efectivas y proyecciones de capital.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto font-mono">
                            <button 
                                onClick={() => handleRunAnalysis(AnalysisType.Strategic, 'Análisis Estratégico Global')}
                                className="flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/20 cursor-pointer border border-white/10 hover:scale-[1.02] active:scale-95"
                            >
                                <Zap size={16} />
                                EJECUTAR IA STRATEGY
                            </button>
                            <div className="flex p-1.5 bg-[#0b1326] rounded-2xl border border-white/10">
                                <button 
                                    onClick={() => setTimeRange('month')}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        timeRange === 'month' 
                                            ? 'bg-white/15 text-white shadow-md border border-white/20' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >MES</button>
                                <button 
                                    onClick={() => setTimeRange('year')}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        timeRange === 'year' 
                                            ? 'bg-white/15 text-white shadow-md border border-white/20' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >AÑO</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4 LUXURY KPI METRIC CARDS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0">
                <MetricCard 
                    title="Ingresos Totales" 
                    value={`$${metrics.totalPaid.toFixed(2)}`} 
                    description="Efectivo Liquidado (Pagado)" 
                    color="bg-gradient-to-br from-[#00A896] to-teal-600 shadow-[#00A896]/20" 
                    icon={DollarSign} 
                    trend="+12.4%"
                />
                <MetricCard 
                    title="Cuentas x Cobrar" 
                    value={`$${metrics.accountsReceivable.toFixed(2)}`} 
                    description="Cartera Pendiente de Gestión" 
                    color="bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20" 
                    icon={Clock} 
                />
                <MetricCard 
                    title="Ingreso Potencial" 
                    value={`$${metrics.potentialIncome.toFixed(2)}`} 
                    description="Proyección Mensual Teórica" 
                    color="bg-gradient-to-br from-amber-500 to-[#C9A96E] shadow-amber-500/20" 
                    icon={TrendingUp} 
                />
                <MetricCard
                    title="Activos Totales"
                    value={`${clients.filter(c => c.isActive !== false && !c.isDeleted).length}`}
                    description="Base de Operaciones Activa"
                    color="bg-gradient-to-br from-indigo-500 to-[#2B6AFF] shadow-[#2B6AFF]/20"
                    icon={Users}
                />
            </div>

            {/* ── CHARTS SECTION ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-0">
                {/* Evolution Area Chart */}
                <div className="lg:col-span-2 p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden h-[450px]">
                    <div className="flex items-center justify-between mb-6 relative z-10 font-mono">
                        <div>
                            <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight">Evolución Operativa</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Histórico de Ingresos (Últimos 6 Ciclos)</p>
                        </div>
                        <div className="p-3 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                            <Activity size={18} />
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full relative z-10 font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00A896" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#00A896" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} opacity={0.05} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020b14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', fontFamily: 'JetBrains Mono' }}
                                    itemStyle={{ color: '#00A896', fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#ffffff', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}
                                    cursor={{ stroke: '#00A896', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="Ingresos" stroke="#00A896" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Regime Donut Pie Chart */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl flex flex-col items-center justify-center relative overflow-hidden font-mono">
                    <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight self-start mb-0.5">Estructura Regime</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest self-start mb-6">Composición de Cartera SRI</p>
                    
                    <div className="flex-1 w-full min-h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={regimeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={92}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {regimeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020b14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', fontFamily: 'JetBrains Mono' }}
                                    itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center">
                            <span className="text-4xl font-black text-white leading-none font-mono">{clients.filter(c => c.isActive !== false && !c.isDeleted).length}</span>
                            <p className="text-[9px] font-bold text-[#00A896] uppercase tracking-widest mt-1">Activos</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PARTNERS & RISK PERIMETER (TOP 5 LISTS) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 sm:px-0">
                {/* Elite Partners */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl">
                    <div className="flex justify-between items-center mb-6 font-mono">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                                <Users size={20} />
                            </div>
                            <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight">Elite Partners</h3>
                        </div>
                        <span className="text-[9px] font-bold text-[#00A896] bg-[#00A896]/15 px-3 py-1 rounded-full border border-[#00A896]/30 uppercase tracking-wider">Top Ingresos</span>
                    </div>

                    <div className="space-y-3 font-mono">
                        {metrics.topClientsData.length > 0 ? metrics.topClientsData.map((client, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-[#020b14] rounded-2xl border border-white/10 hover:border-[#00A896]/40 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#00A896]/15 text-[#00A896] flex items-center justify-center font-bold text-sm border border-[#00A896]/30">
                                        {idx + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-xs text-white uppercase truncate max-w-[160px] sm:max-w-xs">{client.name}</span>
                                        <span className="text-[10px] text-slate-400">Contribuyente Destacado</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-bold text-[#00A896] block font-mono">${client.Ingresos.toFixed(2)}</span>
                                    <span className="text-[9px] text-slate-400 uppercase">Liquidado</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 text-slate-500 font-bold text-xs uppercase tracking-wider">Sin datos de ingresos</div>
                        )}
                    </div>
                </div>

                {/* Risk Perimeter */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl">
                    <div className="flex justify-between items-center mb-6 font-mono">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight">Risk Perimeter</h3>
                        </div>
                        <span className="text-[9px] font-bold text-rose-300 bg-rose-500/15 px-3 py-1 rounded-full border border-rose-500/30 uppercase tracking-wider">Por Cobrar</span>
                    </div>

                    <div className="space-y-3 font-mono">
                        {metrics.topDebtors.length > 0 ? metrics.topDebtors.map((debtor, idx) => {
                            const clientObj = clients.find(c => c.id === debtor.id);
                            const rawPhone = clientObj?.phones?.[0]?.replace(/\D/g, '');
                            const fullPhone = rawPhone ? (rawPhone.startsWith('593') ? rawPhone : ('593' + rawPhone.replace(/^0/, ''))) : null;

                            return (
                                <div key={idx} className="flex items-center justify-between p-4 bg-[#020b14] rounded-2xl border border-white/10 hover:border-rose-500/40 transition-all">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold text-sm border border-rose-500/30 animate-pulse shrink-0">
                                            !
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-xs text-white uppercase truncate max-w-[130px] sm:max-w-xs">{debtor.name}</span>
                                            <button 
                                                onClick={() => navigate('clients', { clientIdToView: debtor.id })}
                                                className="flex items-center gap-1 text-[10px] text-[#00A896] font-bold uppercase tracking-wider hover:underline cursor-pointer text-left"
                                            >
                                                Ver Expediente <ChevronRight size={11} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {fullPhone && (
                                            <button
                                                onClick={() => {
                                                    const msg = `Estimado(a) *${debtor.name}*, le saluda Santiago Córdova - Soluciones Tributarias PRO.\n\nLe recordamos cordialmente que mantiene un saldo pendiente de *$${debtor.amount.toFixed(2)} USD* por concepto de servicios contables y declaraciones SRI.\n\n🏛️ *Datos para transferencia:*\nBanco Pichincha - Cta Ahorros\nTitular: Roberto Santiago Córdova Ramírez\nRUC: 0705787745001\n\nAgradecemos remitir su comprobante por este medio. ¡Muchas gracias!`;
                                                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                }}
                                                className="p-2 bg-[#00A896]/15 hover:bg-[#00A896] text-[#00A896] hover:text-white rounded-xl transition-all border border-[#00A896]/30 cursor-pointer shadow-sm"
                                                title="Enviar recordatorio de cobro por WhatsApp"
                                            >
                                                <MessageSquare size={13} />
                                            </button>
                                        )}
                                        <div className="text-right">
                                            <span className="text-base font-bold text-rose-400 block font-mono">${debtor.amount.toFixed(2)}</span>
                                            <span className="text-[9px] text-slate-400 uppercase">Pendiente</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-12 flex flex-col items-center justify-center">
                                <Shield size={36} className="text-[#00A896] mb-2" />
                                <p className="text-xs font-bold text-[#00A896] uppercase tracking-wider">Cartera 100% al Día</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── AI STRATEGY MODAL ── */}
            <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} title={analysisTitle}>
                <div className="p-2 font-mono">
                    <div className="bg-[#020b14] rounded-2xl p-6 sm:p-8 min-h-[350px] border border-white/10">
                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center text-center p-10 min-h-[300px]">
                                <Loader className="w-10 h-10 text-[#00A896] animate-spin mb-4" />
                                <p className="text-xl font-bold font-display text-white uppercase tracking-tight mb-2">Neural Processing...</p>
                                <p className="text-xs text-slate-400 uppercase tracking-wider max-w-xs leading-relaxed font-mono">
                                    Decodificando flujos de capital e indicadores estratégicos mediante protocolo avanzado SRI.
                                </p>
                            </div>
                        )}
                        {analysisError && (
                            <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-center gap-4">
                                <AlertTriangle size={32} className="shrink-0 text-rose-400" />
                                <div>
                                    <p className="font-bold text-sm uppercase tracking-wider mb-1">Error de Comunicación</p>
                                    <span className="text-xs opacity-80">{analysisError}</span>
                                </div>
                            </div>
                        )}
                        {analysisResult && (
                            <div className="prose prose-sm prose-invert max-w-none">
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm text-xs leading-relaxed text-slate-300 font-sans" dangerouslySetInnerHTML={{ __html: analysisResult }} />
                                <div className="mt-6 flex justify-end">
                                    <button 
                                        onClick={() => setIsAnalysisModalOpen(false)}
                                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-white/10"
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

