import React, { memo } from 'react';
import { ResponsiveContainer, AreaChart as RechartsAreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Client, Declaration, DeclarationStatus } from '../../../types';
import { subMonths, subYears } from 'date-fns';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../services/sri';
import { isPast } from 'date-fns';

const getRecentPeriods = (client: Client, count: number): string[] => {
    if (!client) return [];
    const periods: string[] = [];
    let currentDate = new Date();
    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) periods.push(period);
        if ((client.taxProfile?.ivaFrequency || 'Mensual') === 'Mensual') { currentDate = subMonths(currentDate, 1); }
        else if (client.taxProfile?.ivaFrequency === 'Semestral') { currentDate = subMonths(currentDate, 6); }
        else { currentDate = subYears(currentDate, 1); }
    }
    return periods.slice(0, count).reverse();
};

interface PaymentHistoryChartProps {
    client: Client;
}

export const PaymentHistoryChart: React.FC<PaymentHistoryChartProps> = memo(({ client }) => {
    if (!client) return null;
    const periods = getRecentPeriods(client, 6);
    const historyMap = new Map((client.declarations || []).map(d => [d.period, d] as [string, Declaration]));
    
    const chartData = periods.map(period => {
        const declaration = historyMap.get(period) as Declaration | undefined;
        let status = 'Generando';
        let score = 0;
        
        if (declaration) {
            const dueDate = getDueDateForPeriod(client, period);
            if (declaration.status === DeclarationStatus.Pendiente && dueDate && isPast(dueDate)) { 
                status = 'Vencido'; 
                score = 25;
            }
            else if (declaration.status === DeclarationStatus.Enviada) { 
                status = 'Declarado, Pago Pendiente'; 
                score = 75;
            }
            else if (declaration.status === DeclarationStatus.Pagada) { 
                status = 'Completado'; 
                score = 100;
            }
            else { 
                status = 'A Tiempo'; 
                score = 50;
            }
        }
        return { name: formatPeriodForDisplay(period).split(' ')[0], score, status };
    });

    const statusColors: { [key: string]: string } = { 'Completado': '#10b981', 'Declarado, Pago Pendiente': '#3b82f6', 'A Tiempo': '#f59e0b', 'Vencido': '#ef4444', 'Generando': '#9ca3af' };

    // Calcular el color principal basado en la tendencia reciente
    const recentScores = chartData.map(d => d.score);
    const avgScore = recentScores.reduce((a, b) => a + b, 0) / (recentScores.length || 1);
    const trendColor = avgScore >= 80 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <h4 className="text-[10px] font-black text-slate-400 mb-8 uppercase tracking-[0.3em] flex items-center gap-2 font-premium">
                <TrendingUp size={16} className="text-primary" strokeWidth={3} /> HISTORIAL DE CUMPLIMIENTO
            </h4>
            <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsAreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={trendColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={trendColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                            axisLine={false} 
                            tickLine={false} 
                            dy={10} 
                        />
                        <YAxis hide={true} domain={[0, 100]} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const dataPoint = (payload[0] as any).payload;
                                    return (
                                        <div className="p-4 bg-white/95 text-slate-900 rounded-2xl text-[10px] shadow-2xl border border-slate-100 backdrop-blur-xl font-premium">
                                            <p className="font-black mb-2 text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-3 uppercase tracking-widest">
                                                {label}
                                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-primary border border-slate-100">
                                                    {dataPoint.score}%
                                                </span>
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: statusColors[dataPoint.status] }}></div>
                                                <span className="font-black text-slate-900 tracking-widest uppercase">{dataPoint.status}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke={trendColor} 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                            animationDuration={1500}
                        />
                    </RechartsAreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
});

