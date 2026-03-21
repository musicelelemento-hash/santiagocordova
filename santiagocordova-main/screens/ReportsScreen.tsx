
import React, { useMemo, useState } from 'react';
import { Screen, DeclarationStatus, TaskStatus, AnalysisType, TaxRegime, Client, Task, ServiceFeesConfig } from '../types';
import { getClientServiceFee } from '../services/clientService';
import { runStrategicAnalysis } from '../services/geminiService';
import { 
    Loader, AlertTriangle, TrendingUp, BarChart, 
    DollarSign, Clock, Zap, Activity, Users, Shield, 
    LineChart, Calendar, PieChart as PieChartIcon
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Modal } from '../components/Modal';
import { format, isSameMonth, isSameYear, subMonths, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReportsScreenProps {
  clients: Client[];
  tasks: Task[];
  serviceFees: ServiceFeesConfig;
  navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}

const COLORS = ['#00A896', '#0B2149', '#F59E0B', '#EF4444', '#8B5CF6'];

const MetricCard: React.FC<{ title: string; value: string; description: string; color: string; icon: React.ElementType; trend?: string }> = ({ title, value, description, color, icon: Icon, trend }) => (
    <div className={`p-6 rounded-[1.5rem] shadow-lg border border-white/10 bg-gradient-to-br ${color} text-white transition-all hover:scale-[1.02] relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Icon size={64} />
        </div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner">
                    <Icon size={24} className="text-white" />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full flex items-center shadow-sm backdrop-blur-md">
                        <TrendingUp size={10} className="mr-1"/> {trend}
                    </span>
                )}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">{title}</p>
            <h3 className="text-3xl font-display font-black tracking-tight">{value}</h3>
            <p className="text-xs opacity-80 mt-2 font-medium bg-black/10 inline-block px-2 py-0.5 rounded">{description}</p>
        </div>
    </div>
);

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ clients, tasks, serviceFees, navigate }) => {
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
        let potentialIncome = 0; // Tarifa configurada total
        const incomeByClient: { [key: string]: number } = {};
        const debtByClient: { [key: string]: { name: string; amount: number; id: string } } = {};
        const now = new Date();

        // Filtro de Fechas
        const filterFn = (dateStr: string) => {
            if (!dateStr) return false;
            const date = parseISO(dateStr);
            if (!isValid(date)) return false;
            if (timeRange === 'month') return isSameMonth(date, now);
            return isSameYear(date, now);
        };

        // 1. Procesar Clientes y Declaraciones
        clients.forEach(client => {
            if (client.isDeleted) return;
            const clientName = client.name;
            if (!incomeByClient[clientName]) incomeByClient[clientName] = 0;

            // Ingreso Potencial (Proyección basada en activos)
            if (client.isActive !== false) {
                const fee = getClientServiceFee(client, serviceFees);
                // Si es Mensual, suma al potencial. Si es Anual, lo dividimos para la proyección mensual aprox.
                if (client.category.includes('Mensual')) potentialIncome += fee;
                else if (client.category.includes('Semestral')) potentialIncome += (fee / 6);
                else potentialIncome += (fee / 12);
            }

            // Historial de Pagos
            client.declarationHistory.forEach(d => {
                const fee = d.amount ?? getClientServiceFee(client, serviceFees, d.period);
                
                // Ingresos Reales
                if (d.status === DeclarationStatus.Pagada) {
                    // Usar fecha de pago si existe, sino fecha de actualización
                    const dateToCheck = d.paidAt || d.updatedAt;
                    if (filterFn(dateToCheck)) {
                        totalPaid += fee;
                        incomeByClient[clientName] += fee;
                    }
                } 
                // Cuentas por Cobrar (Deuda) - Acumulado histórico (no filtra por mes, la deuda es deuda)
                else if (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pendiente) {
                    accountsReceivable += fee;
                    
                    if (!debtByClient[client.id]) {
                        debtByClient[client.id] = { name: client.name, amount: 0, id: client.id };
                    }
                    debtByClient[client.id].amount += fee;
                }
            });
        });

        // 2. Procesar Tareas
        tasks.forEach(task => {
            const fee = task.cost ?? 0;
            const balance = fee - (task.advancePayment || 0);
            
            // Ingresos Tareas
            if (task.status === TaskStatus.Pagada) {
                // Asumimos que la fecha de pago es la fecha de completado o dueDate si no hay otra
                const dateToCheck = task.dueDate; 
                if (filterFn(dateToCheck)) {
                    totalPaid += fee;
                }
            } 
            // Cuentas por Cobrar Tareas
            else if (task.status === TaskStatus.Completada && balance > 0) {
                 accountsReceivable += balance;
            }
        });

        // Top Clientes
        const topClientsData = Object.entries(incomeByClient)
            .map(([name, income]) => ({ name, Ingresos: income }))
            .filter(c => c.Ingresos > 0)
            .sort((a, b) => b.Ingresos - a.Ingresos)
            .slice(0, 5); // Top 5

        // Top Deudores
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

    // --- CHART DATA GENERATORS ---

    // 1. Trend Data (Last 6 Months)
    const trendData = useMemo(() => {
        const data = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const monthDate = subMonths(today, i);
            const monthName = format(monthDate, 'MMM', { locale: es }).toUpperCase();
            let monthIncome = 0;

            // Sumar pagos de declaraciones en este mes
            clients.forEach(c => {
                c.declarationHistory.forEach(d => {
                    if (d.status === DeclarationStatus.Pagada && d.paidAt) {
                        if (isSameMonth(parseISO(d.paidAt), monthDate)) {
                            monthIncome += (d.amount || getClientServiceFee(c, serviceFees, d.period));
                        }
                    }
                });
            });

            // Sumar pagos de tareas en este mes (aprox por dueDate para demo)
            tasks.forEach(t => {
                if (t.status === TaskStatus.Pagada && isSameMonth(parseISO(t.dueDate), monthDate)) {
                    monthIncome += (t.cost || 0);
                }
            });

            data.push({ name: monthName, Ingresos: monthIncome });
        }
        return data;
    }, [clients, tasks, serviceFees]);

    // 2. Regime Distribution
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
        } catch(err: any) {
            setAnalysisError(err.message || 'Error desconocido');
        } finally {
            setIsAnalyzing(false);
        }
    };

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                    <BarChart className="text-brand-teal"/> Reportes Ejecutivos
                </h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Panorama financiero y operativo.</p>
            </div>
            
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setTimeRange('month')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${timeRange === 'month' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-500 hover:text-brand-navy'}`}
                >
                    <Calendar size={14}/> Este Mes
                </button>
                <button 
                    onClick={() => setTimeRange('year')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${timeRange === 'year' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-500 hover:text-brand-navy'}`}
                >
                    <TrendingUp size={14}/> Año {format(new Date(), 'yyyy')}
                </button>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
                title="Ingresos Reales"
                value={`$${metrics.totalPaid.toFixed(2)}`}
                description={timeRange === 'month' ? "Cobrado este mes" : "Acumulado anual"}
                color="from-emerald-500 to-teal-600"
                icon={DollarSign}
                trend="+12%"
            />
             <MetricCard 
                title="Por Cobrar (Cartera)"
                value={`$${metrics.accountsReceivable.toFixed(2)}`}
                description="Gestión Pendiente Total"
                color="from-rose-500 to-pink-600"
                icon={Clock}
            />
            <MetricCard 
                title="Proyección (Tarifas)"
                value={`$${metrics.potentialIncome.toFixed(2)}`}
                description="Promedio Mensual Esperado"
                color="from-blue-500 to-indigo-600"
                icon={LineChart}
            />
            <MetricCard 
                title="Clientes Activos"
                value={`${clients.filter(c => c.isActive !== false).length}`}
                description="Base de datos total"
                color="from-violet-500 to-purple-600"
                icon={Users}
            />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Trend Chart (Main) */}
            <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white">Evolución de Ingresos</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Últimos 6 meses</p>
                    </div>
                    <div className="p-2 bg-brand-teal/10 rounded-lg">
                        <Activity className="text-brand-teal" size={20}/>
                    </div>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00A896" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#00A896" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ingresos']}
                            />
                            <Area type="monotone" dataKey="Ingresos" stroke="#00A896" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Distribution Pie Chart */}
            <div className="lg:col-span-1 p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Composición Cartera</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-6">Por Régimen Tributario</p>
                
                <div className="flex-1 min-h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={regimeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {regimeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [value, 'Clientes']} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{fontSize: '11px'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                        <span className="text-3xl font-black text-brand-navy dark:text-white">{clients.length}</span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Lists Row: Top Payers & Top Debtors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Clients */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="text-brand-teal" size={20}/> Top 5 Clientes ({timeRange === 'month' ? 'Mes' : 'Año'})
                    </h3>
                </div>
                <div className="space-y-4">
                    {metrics.topClientsData.length > 0 ? metrics.topClientsData.map((client, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-xs">
                                    {idx + 1}
                                </div>
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{client.name}</span>
                            </div>
                            <span className="font-mono font-bold text-brand-teal">${client.Ingresos.toFixed(2)}</span>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-slate-400 text-sm">No hay ingresos registrados en este periodo.</div>
                    )}
                </div>
            </div>

            {/* Top Debtors */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20}/> Cuentas Críticas (Por Cobrar)
                    </h3>
                </div>
                <div className="space-y-4">
                     {metrics.topDebtors.length > 0 ? metrics.topDebtors.map((debtor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                                    !
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{debtor.name}</span>
                                    <button className="text-[10px] text-red-400 font-bold uppercase cursor-pointer hover:underline text-left" onClick={() => navigate('clients', { clientIdToView: debtor.id })}>
                                        Ver Perfil
                                    </button>
                                </div>
                            </div>
                            <span className="font-mono font-bold text-red-600">${debtor.amount.toFixed(2)}</span>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-emerald-500 font-bold text-sm flex flex-col items-center">
                            <Shield size={32} className="mb-2 opacity-50"/>
                            ¡Excelente! No hay deuda crítica acumulada.
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* AI FAB */}
        <div className="bg-gradient-to-r from-brand-navy to-slate-900 rounded-[2rem] p-8 shadow-xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal rounded-full blur-[100px] opacity-20 -mt-20 -mr-20"></div>
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                 <div>
                     <h3 className="text-2xl font-display font-black mb-2 flex items-center gap-2">
                         <Zap size={24} className="text-brand-teal"/> Análisis Estratégico IA
                     </h3>
                     <p className="text-slate-300 text-sm leading-relaxed mb-6">
                         Obtenga un diagnóstico profundo de su cartera. Detecte fugas de dinero y oportunidades de crecimiento ocultas.
                     </p>
                     <div className="flex gap-3 flex-wrap">
                         <button onClick={() => handleRunAnalysis('cashflow', 'Análisis de Flujo de Caja')} className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-all border border-white/10">Flujo de Caja</button>
                         <button onClick={() => handleRunAnalysis('riskMatrix', 'Matriz de Riesgo')} className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-sm transition-all border border-white/10">Riesgo Cartera</button>
                     </div>
                 </div>
                 <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                     <p className="text-[10px] font-bold text-brand-teal uppercase tracking-widest mb-3">Recomendación Rápida</p>
                     <p className="text-sm font-medium leading-relaxed italic">
                         "Basado en los datos actuales, su tasa de recuperación de cartera es del {metrics.potentialIncome > 0 ? Math.round((metrics.totalPaid / metrics.potentialIncome) * 100) : 0}%. Se recomienda enfocar esfuerzos de cobranza en los 5 clientes críticos listados abajo para mejorar la liquidez inmediata."
                     </p>
                 </div>
             </div>
        </div>

        <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} title={analysisTitle}>
            {isAnalyzing && (
                <div className="text-center p-12">
                    <Loader className="w-16 h-16 text-brand-teal animate-spin mx-auto mb-6"/>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">Procesando datos con IA...</p>
                    <p className="text-sm text-slate-500 mt-2">Analizando patrones de pago y comportamiento fiscal.</p>
                </div>
            )}
            {analysisError && (
                 <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-xl flex items-center gap-3">
                    <AlertTriangle size={24} />
                    <span className="font-medium">{analysisError}</span>
                </div>
            )}
            {analysisResult && (
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: analysisResult }} />
                </div>
            )}
        </Modal>

    </div>
  );
};
