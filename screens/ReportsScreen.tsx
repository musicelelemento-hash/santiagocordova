
import React, { useMemo, useState } from 'react';
import { Screen, DeclarationStatus, TaskStatus, AnalysisType } from '../types';
import { getClientServiceFee } from '../services/clientService';
import { runStrategicAnalysis } from '../services/geminiService';
import { BrainCircuit, Loader, AlertTriangle, TrendingUp, BarChart, FileText, DollarSign, Clock, Zap, Activity, Users, Shield, LineChart, Calendar } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store/useAppStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import format from 'date-fns/format';
import isSameMonth from 'date-fns/isSameMonth';
import isSameYear from 'date-fns/isSameYear';
import es from 'date-fns/locale/es';

interface ReportsScreenProps {
  navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}

const MetricCard: React.FC<{ title: string; value: string; description: string; color: string; icon: React.ElementType }> = ({ title, value, description, color, icon: Icon }) => (
    <div className={`p-5 rounded-2xl shadow-sm border border-white/10 bg-gradient-to-br ${color} text-white transition-transform hover:scale-[1.02]`}>
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon size={24} />
            </div>
        </div>
        <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
        <h3 className="text-3xl font-display font-bold">{value}</h3>
        <p className="text-xs opacity-60 mt-1">{description}</p>
    </div>
);

const AIAnalysisButton: React.FC<{ title: string; description: string; icon: React.ElementType; onClick: () => void; }> = ({ title, description, icon: Icon, onClick }) => (
    <button onClick={onClick} className="w-full text-left p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-brand-teal dark:hover:border-brand-teal shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-start space-x-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl group-hover:bg-brand-teal group-hover:text-white transition-colors text-brand-navy dark:text-gray-300">
                <Icon size={24} />
            </div>
            <div>
                <h4 className="font-bold text-gray-800 dark:text-white text-lg group-hover:text-brand-teal transition-colors">{title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{description}</p>
            </div>
        </div>
    </button>
);


export const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigate }) => {
    const { clients, tasks, serviceFees } = useAppStore();
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [analysisTitle, setAnalysisTitle] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'month' | 'year'>('month');

    const metrics = useMemo(() => {
        let totalPaid = 0;
        let accountsReceivable = 0;
        const incomeByClient: { [key: string]: number } = {};
        const now = new Date();

        // Projections are always monthly/semestral independent of time filter (as they are recurring revenue)
        let gananciaMensual = 0;
        let gananciaSemestral = 0;

        clients.forEach(client => {
            const clientName = client.name;
            if (!incomeByClient[clientName]) incomeByClient[clientName] = 0;

            if (client.isActive ?? true) {
                const fee = getClientServiceFee(client, serviceFees);
                if (client.category.includes('Mensual')) {
                    gananciaMensual += fee;
                } else if (client.category.includes('Semestral')) {
                    gananciaSemestral += fee;
                }
            }

            client.declarationHistory.forEach(d => {
                const fee = d.amount ?? getClientServiceFee(client, serviceFees);
                const dateToCheck = d.paidAt ? new Date(d.paidAt) : new Date(d.updatedAt);
                
                let matchesFilter = false;
                if (timeRange === 'month') matchesFilter = isSameMonth(dateToCheck, now);
                else if (timeRange === 'year') matchesFilter = isSameYear(dateToCheck, now);

                if (matchesFilter) {
                    if (d.status === DeclarationStatus.Pagada) {
                        totalPaid += fee;
                        incomeByClient[clientName] += fee;
                    } else if (d.status === DeclarationStatus.Enviada) {
                        accountsReceivable += fee;
                    }
                }
            });
        });

        tasks.forEach(task => {
            const fee = task.cost ?? 0;
            const balance = fee - (task.advancePayment || 0);
            const taskDate = new Date(task.dueDate); // Or updated date if available

            let matchesFilter = false;
            if (timeRange === 'month') matchesFilter = isSameMonth(taskDate, now);
            else if (timeRange === 'year') matchesFilter = isSameYear(taskDate, now);
            
            if (matchesFilter) {
                if (task.status === TaskStatus.Pagada) {
                    totalPaid += fee;
                     if (task.clientId) {
                        const clientName = clients.find(c => c.id === task.clientId)?.name;
                        if (clientName) {
                            incomeByClient[clientName] = (incomeByClient[clientName] || 0) + fee;
                        }
                    }
                } else if (task.status === TaskStatus.Completada && balance > 0) {
                    accountsReceivable += balance;
                }
            }
        });

        const topClientsData = Object.entries(incomeByClient)
            .map(([name, income]) => ({ name, Ingresos: income }))
            .sort((a, b) => b.Ingresos - a.Ingresos)
            .slice(0, 10);
        
        return { totalPaid, accountsReceivable, topClientsData, gananciaMensual, gananciaSemestral };
    }, [clients, tasks, serviceFees, timeRange]);

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
    <div className="space-y-8 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-3xl font-display font-bold text-brand-navy dark:text-white">Inteligencia de Negocios</h2>
            
            {/* Time Range Filter */}
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setTimeRange('month')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${timeRange === 'month' ? 'bg-brand-teal text-white shadow-md' : 'text-slate-500 hover:text-brand-navy'}`}
                >
                    <Calendar size={16}/> {format(new Date(), 'MMMM', { locale: es })}
                </button>
                <button 
                    onClick={() => setTimeRange('year')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${timeRange === 'year' ? 'bg-brand-teal text-white shadow-md' : 'text-slate-500 hover:text-brand-navy'}`}
                >
                    <TrendingUp size={16}/> {format(new Date(), 'yyyy')}
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
                title="Ingresos Reales"
                value={`$${metrics.totalPaid.toFixed(2)}`}
                description={timeRange === 'month' ? "Cobrado este mes" : "Cobrado este año"}
                color="from-emerald-500 to-teal-600"
                icon={DollarSign}
            />
             <MetricCard 
                title="Por Cobrar"
                value={`$${metrics.accountsReceivable.toFixed(2)}`}
                description="Gestión Pendiente (Enviadas)"
                color="from-blue-500 to-indigo-600"
                icon={Clock}
            />
            <MetricCard 
                title="Proyección Mensual"
                value={`$${metrics.gananciaMensual.toFixed(2)}`}
                description="Recurrencia Fija (Cartera)"
                color="from-purple-500 to-violet-600"
                icon={LineChart}
            />
            <MetricCard 
                title="Proyección Semestral"
                value={`$${metrics.gananciaSemestral.toFixed(2)}`}
                description="Recurrencia Semestral"
                color="from-rose-500 to-pink-600"
                icon={BarChart}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white">Top 10 Clientes (Ingresos)</h3>
                    <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Ranking Financiero</div>
                </div>
                <div style={{ width: '100%', height: 350 }}>
                    <ErrorBoundary compact>
                        <ResponsiveContainer>
                            <RechartsBarChart data={metrics.topClientsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end"/>
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`}/>
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: '#001F5B', /* Brand Navy Background */
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#FFF',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }} 
                                    cursor={{ fill: 'rgba(0, 168, 150, 0.1)' }} /* Brand Teal weak fill */
                                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ingresos']}
                                />
                                {/* Updated to Brand Teal */}
                                <Bar dataKey="Ingresos" fill="#00A896" radius={[4, 4, 0, 0]} barSize={40} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </ErrorBoundary>
                </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <div className="p-6 bg-brand-navy rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    <h3 className="font-bold text-xl mb-2 relative z-10 flex items-center gap-2">
                        <Zap size={20} className="text-brand-teal" /> IA Assistant
                    </h3>
                    <p className="text-slate-300 text-sm mb-6 relative z-10">
                        Análisis estratégico profundo impulsado por Google Gemini. Obtenga insights ocultos en sus datos.
                    </p>
                    <div className="space-y-3 relative z-10">
                         <AIAnalysisButton 
                            title="Flujo de Caja" 
                            description="Detecta patrones de liquidez."
                            icon={Activity}
                            onClick={() => handleRunAnalysis('cashflow', 'Análisis de Flujo de Caja')}
                        />
                         <AIAnalysisButton 
                            title="Riesgo Cliente" 
                            description="Identifica cartera vencida."
                            icon={Shield}
                            onClick={() => handleRunAnalysis('riskMatrix', 'Matriz de Riesgo de Clientes')}
                        />
                         <AIAnalysisButton 
                            title="Oportunidades" 
                            description="Sugerencias de venta cruzada."
                            icon={TrendingUp}
                            onClick={() => handleRunAnalysis('optimization', 'Optimización de Servicios')}
                        />
                    </div>
                </div>
            </div>
        </div>

        <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} title={analysisTitle}>
            {isAnalyzing && (
                <div className="text-center p-8">
                    <Loader className="w-12 h-12 text-gold animate-spin-slow mx-auto"/>
                    <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">Analizando datos con IA...</p>
                    <p className="text-sm text-gray-500">Esto puede tomar un momento debido al análisis profundo.</p>
                </div>
            )}
            {analysisError && (
                 <div className="p-3 flex items-center space-x-2 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    <AlertTriangle size={18} />
                    <span>Error: {analysisError}</span>
                </div>
            )}
            {analysisResult && (
                <div className="prose prose-sm prose-invert max-w-none prose-headings:text-gold prose-strong:text-white" dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br />') }}>
                </div>
            )}
        </Modal>

    </div>
  );
};