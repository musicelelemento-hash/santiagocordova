import React, { useMemo, useState } from 'react';
import { Client, ServiceFeesConfig, Screen, Task, DeclarationStatus, TaskStatus, AnalysisType } from '../types';
import { getClientServiceFee } from '../services/clientService';
import { Loader, AlertTriangle, TrendingUp, BarChart, FileText, DollarSign, Clock, Zap, Activity, Users, Shield, LineChart } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Modal } from '../components/Modal';


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


export const ReportsScreen: React.FC<ReportsScreenProps> = ({ clients, tasks, serviceFees, navigate }) => {
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
    </div>
  );
};