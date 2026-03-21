
import React, { useMemo, useState } from 'react';
import { Client, ServiceFeesConfig, Screen, Task, DeclarationStatus, TaskStatus, AnalysisType } from './types';
import { getClientServiceFee } from './clientService';
import { runStrategicAnalysis } from './geminiService';
import { BrainCircuit, Loader, AlertTriangle, TrendingUp, BarChart, FileText, DollarSign, Clock, Zap, Activity, Users, Shield, LineChart } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Modal } from './Modal';


interface ReportsScreenProps {
  clients: Client[];
  tasks: Task[];
  serviceFees: ServiceFeesConfig;
  navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}

const MetricCard: React.FC<{ title: string; value: string; description: string; color: string; icon: React.ElementType }> = ({ title, value, description, color, icon: Icon }) => (
    <div className={`p-4 sm:p-6 bg-gradient-to-br ${color} rounded-lg shadow-lg text-white`}>
        <h3 className="text-base sm:text-lg font-bold flex items-center"><Icon size={20} className="mr-2"/>{title}</h3>
        <p className="text-3xl sm:text-4xl font-display mt-2">{value}</p>
        <p className="text-xs sm:text-sm opacity-80">{description}</p>
    </div>
);

const AIAnalysisButton: React.FC<{ title: string; description: string; icon: React.ElementType; onClick: () => void; }> = ({ title, description, icon: Icon, onClick }) => (
    <button onClick={onClick} className="w-full text-left p-4 bg-gray-50 dark:bg-gray-800/50 midnight:bg-slate-800/50 rounded-lg hover:bg-gold/10 dark:hover:bg-gold/10 transition-colors group">
        <div className="flex items-center space-x-3">
            <div className="p-2 bg-gold/20 rounded-full">
                <Icon className="w-6 h-6 text-gold" />
            </div>
            <div>
                <h4 className="font-bold text-gray-800 dark:text-gold">{title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">{description}</p>
            </div>
        </div>
    </button>
);


export const ReportsScreen: React.FC<ReportsScreenProps> = ({ clients, tasks, serviceFees, navigate }) => {
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [analysisTitle, setAnalysisTitle] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const metrics = useMemo(() => {
        let totalPaid = 0;
        let accountsReceivable = 0;
        let gananciaMensual = 0;
        let gananciaSemestral = 0;
        const incomeByClient: { [key: string]: number } = {};

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
                if (d.status === DeclarationStatus.Pagada) {
                    totalPaid += fee;
                    incomeByClient[clientName] += fee;
                } else if (d.status === DeclarationStatus.Enviada) {
                    accountsReceivable += fee;
                }
            });
        });

        tasks.forEach(task => {
            const fee = task.cost ?? 0;
            const balance = fee - (task.advancePayment || 0);
            
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
        });

        const topClientsData = Object.entries(incomeByClient)
            .map(([name, income]) => ({ name, Ingresos: income }))
            .sort((a, b) => b.Ingresos - a.Ingresos)
            .slice(0, 10);
        
        return { totalPaid, accountsReceivable, topClientsData, gananciaMensual, gananciaSemestral };
    }, [clients, tasks, serviceFees]);

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
    <div>
        <h2 className="text-2xl sm:text-3xl font-display text-gold mb-6">Reportes y Métricas</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <MetricCard 
                title="Ingresos Totales (Pagado)"
                value={`$${metrics.totalPaid.toFixed(2)}`}
                description="Incluye Declaraciones y Tareas"
                color="from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700"
                icon={DollarSign}
            />
             <MetricCard 
                title="Cuentas por Cobrar (Enviada)"
                value={`$${metrics.accountsReceivable.toFixed(2)}`}
                description="Declaraciones enviadas no pagadas"
                color="from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700"
                icon={Clock}
            />
            <MetricCard 
                title="Proyección Ingreso Mensual"
                value={`$${metrics.gananciaMensual.toFixed(2)}`}
                description="Suma de tarifas de clientes activos mensuales"
                color="from-purple-500 to-violet-600 dark:from-purple-600 dark:to-violet-700"
                icon={LineChart}
            />
            <MetricCard 
                title="Proyección Ingreso Semestral"
                value={`$${metrics.gananciaSemestral.toFixed(2)}`}
                description="Suma de tarifas de clientes activos semestrales"
                color="from-pink-500 to-rose-600 dark:from-pink-600 dark:to-rose-700"
                icon={BarChart}
            />
        </div>

        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 midnight:bg-slate-800 rounded-lg shadow-md mb-6">
            <h3 className="font-bold text-xl mb-4 dark:text-white">Ingresos por Cliente/Tarea (Top 10)</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <RechartsBarChart data={metrics.topClientsData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="name" tick={{ fill: 'rgb(156 163 175)', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'rgb(156 163 175)', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ 
                                backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                                border: '1px solid #D4AF37',
                                color: '#FFF'
                            }} 
                            cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }}
                         />
                        <Bar dataKey="Ingresos" fill="#D4AF37" />
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </div>
      
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 midnight:bg-slate-800 rounded-lg shadow-md">
            <h3 className="font-bold text-xl mb-4 dark:text-white flex items-center space-x-2">
                <Zap size={24} className="text-gold"/>
                <span>Análisis Estratégico con IA</span>
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Utilice la IA de pensamiento profundo de Gemini para obtener informes detallados y recomendaciones estratégicas para su negocio.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIAnalysisButton 
                    title="Análisis de Flujo de Caja" 
                    description="Identifica deudas y prioriza la cobranza."
                    icon={Activity}
                    onClick={() => handleRunAnalysis('cashflow', 'Análisis de Flujo de Caja')}
                />
                 <AIAnalysisButton 
                    title="Matriz de Riesgo de Clientes" 
                    description="Clasifica clientes por valor y comportamiento."
                    icon={Shield}
                    onClick={() => handleRunAnalysis('riskMatrix', 'Matriz de Riesgo de Clientes')}
                />
                 <AIAnalysisButton 
                    title="Optimización de Servicios" 
                    description="Encuentra oportunidades de venta cruzada."
                    icon={TrendingUp}
                    onClick={() => handleRunAnalysis('optimization', 'Optimización de Servicios')}
                />
                 <AIAnalysisButton 
                    title="Eficiencia Operativa" 
                    description="Detecta cuellos de botella en su proceso."
                    icon={Users}
                    onClick={() => handleRunAnalysis('efficiency', 'Reporte de Eficiencia Operativa')}
                />
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
