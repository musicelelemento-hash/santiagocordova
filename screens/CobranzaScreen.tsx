import React, { useMemo, useState, useRef } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime, ServiceFeesConfig, ReminderConfig, BusinessProfile, FinancialItem } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod, safeFormat } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { differenceInCalendarDays, isSameMonth, parseISO, isValid, subMonths } from 'date-fns';
import {
    AlertTriangle, CheckCircle, MessageSquare, DollarSign,
    Printer, Search, Loader, RefreshCw, CheckSquare, Square, Layers,
    Shield, ExternalLink, ChevronDown, BarChart3, Timer, ShieldAlert,
    ShieldCheck, Calendar, Zap, Activity
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { printSalesNote } from '../services/printService';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';

import { useAppStore } from '../store/useAppStore';

interface CobranzaScreenProps {
    reminderConfigProp?: ReminderConfig;
    // Props form previous version (for compatibility if needed)
    clientsProp?: Client[];
    setClientsProp?: React.Dispatch<React.SetStateAction<Client[]>>;
    serviceFeesProp?: ServiceFeesConfig;
}


const defaultBusinessProfile: BusinessProfile = {
    ruc: '0700000000001',
    businessName: 'Santiago Cordova',
    tradeName: 'Soluciones Tributarias',
    address: 'Colon y Sucre / Pasaje - El Oro',
    phone: '+593 978 980 722',
    email: 'info@santiagocordova.com',
    authNumber: '0000000000'
};

export const CobranzaScreen: React.FC<CobranzaScreenProps> = ({ 
    reminderConfigProp,
    clientsProp,
    setClientsProp,
    serviceFeesProp
}) => {
    // Use Store or Props
    const store = useAppStore();
    const clients = clientsProp || store.clients;
    const setClients = setClientsProp || store.setClients;
    const serviceFees = serviceFeesProp || store.serviceFees;
    const storeReminderConfig = store.reminderConfig;
    const reminderConfig = reminderConfigProp || storeReminderConfig;

    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'receivable' | 'projected' | 'collected'>('receivable');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);

    // Referencia para impresión
    const receiptRef = useRef<HTMLDivElement>(null);

    const financialData = useMemo(() => {
        const receivable: FinancialItem[] = [];
        const projected: FinancialItem[] = [];
        const collected: FinancialItem[] = [];
        const now = new Date();
        const selectedMonth = new Date();

        clients.forEach(client => {
            if (client.isDeleted || client.isActive === false) return;
            let fee = getClientServiceFee(client, serviceFees);
            if (fee <= 0) fee = 10.00;

            let type: FinancialItem['type'] = 'mensual';
            if (client.taxProfile?.ivaFrequency === 'Semestral') type = 'semestral';
            else if (client.regime === TaxRegime.RimpeNegocioPopular) type = 'renta';
            else if (client.taxProfile?.hasActiveDevolucionIva) type = 'dev';

            const processedPeriods = new Set<string>();
            const paidPeriods = new Set<string>();
            client.declarations.forEach(decl => {
                if (decl.status === DeclarationStatus.Pagada && decl.paidAt) {
                    paidPeriods.add(decl.period);
                }
            });

            client.declarations.forEach(decl => {
                processedPeriods.add(decl.period);
                
                if (decl.status === DeclarationStatus.Pagada && decl.paidAt) {
                    const paidDate = parseISO(decl.paidAt);
                    if (isValid(paidDate) && isSameMonth(paidDate, selectedMonth)) {
                        collected.push({
                            clientId: client.id, clientName: client.name, ruc: client.ruc,
                            period: decl.period, amount: decl.amount || fee, status: DeclarationStatus.Pagada,
                            type, dateReference: paidDate, phones: client.phones || []
                        });
                    }
                } else if ((decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) && !paidPeriods.has(decl.period)) {
                    const dueDate = getDueDateForPeriod(client, decl.period) || now;
                    receivable.push({
                        clientId: client.id, clientName: client.name, ruc: client.ruc,
                        period: decl.period, amount: decl.amount || fee, status: decl.status,
                        type, dateReference: dueDate, daysDiff: differenceInCalendarDays(now, dueDate),
                        phones: client.phones || []
                    });
                }
            });

            const pNow = getPeriod(client, now);
            const pPrev = getPeriod(client, subMonths(now, 1));
            [pNow, pPrev].forEach(p => {
                if (!processedPeriods.has(p)) {
                    const dueDate = getDueDateForPeriod(client, p) || now;
                    const diff = differenceInCalendarDays(now, dueDate);
                    const item: FinancialItem = {
                        clientId: client.id, clientName: client.name, ruc: client.ruc,
                        period: p, amount: fee, status: DeclarationStatus.Pendiente,
                        type, dateReference: dueDate, daysDiff: diff, phones: client.phones || [], isVirtual: true
                    };
                    if (diff > 0) receivable.push(item);
                    else projected.push(item);
                }
            });
        });
        return { receivable, projected, collected };
    }, [clients, serviceFees, isRecalculating]);

    const currentList = useMemo(() => {
        let list = activeTab === 'receivable' ? financialData.receivable
            : activeTab === 'projected' ? financialData.projected
                : financialData.collected;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(i => i.clientName.toLowerCase().includes(lower) || i.ruc.includes(lower));
        }
        return list;
    }, [financialData, activeTab, searchTerm]);

    const chartData = [
        { name: 'Cobrable', value: financialData.receivable.reduce((s, i) => s + i.amount, 0), color: '#ef4444' },
        { name: 'Recaudado', value: financialData.collected.reduce((s, i) => s + i.amount, 0), color: '#10b981' }
    ].filter(d => d.value > 0);

    const handleProcessPayment = () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        
        // Safety check for setClients
        if (typeof setClients !== 'function') {
            console.error("setClients is not a function", setClients);
            setIsProcessing(false);
            toast.error("Error al procesar: setClients no disponible");
            return;
        }

        const newClients = [...clients];
        let lastClient;
        let paidPeriods: any[] = [];

        selectedItems.forEach(key => {
            const item = currentList.find(i => `${i.clientId}-${i.period}` === key);
            if (!item) return;
            const clientIdx = newClients.findIndex(c => c.id === item.clientId);
            if (clientIdx === -1) return;
            const history = [...newClients[clientIdx].declarations];
            const declIdx = history.findIndex(d => d.period === item.period);
            const entry = { period: item.period, status: DeclarationStatus.Pagada, paidAt: nowIso, transactionId, amount: item.amount, updatedAt: nowIso };
            if (declIdx > -1) history[declIdx] = { ...history[declIdx], ...entry };
            else history.push(entry as any);
            newClients[clientIdx] = { ...newClients[clientIdx], declarations: history };
            lastClient = newClients[clientIdx];
            paidPeriods.push({ period: item.period, amount: item.amount });
        });

        setTimeout(() => {
            setClients(newClients);
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
            setSelectedItems(new Set());
            if (lastClient) setReceiptData({ transactionId, clientName: lastClient.name, clientRuc: lastClient.ruc, client: lastClient, paymentDate: safeFormat(new Date(), 'PPpp'), paidPeriods, totalAmount: paidPeriods.reduce((s, p) => s + p.amount, 0) });
            setIsReceiptOpen(true);
            toast.success("Pago registrado");
        }, 800);
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative z-10 px-4 sm:px-0">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2 sm:mb-2 text-center sm:text-left">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                            <span className="text-[10px] sm:text-[10px] font-semibold text-brand-teal uppercase tracking-widest">Financial Grid Alpha</span>
                        </div>
                        <span className="text-[10px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Santiago Cordova Protocol</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-tight sm:leading-[0.85] tracking-tighter mb-2">
                        Financial <span className="text-brand-teal">Command</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[9px] sm:text-[11px] font-medium uppercase tracking-widest">
                        <LucideIcons.ShieldCheck size={12} className="text-brand-teal" />
                        <span>Gestión de Cobranzas de Alto Nivel</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={selectedItems.size === 0}
                        className={`group relative overflow-hidden flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-500 w-full sm:w-auto
                            ${selectedItems.size > 0 
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-brand-teal/20 hover:scale-[1.05] active:scale-[0.95]' 
                                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800'}`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <LucideIcons.DollarSign size={18} className={selectedItems.size > 0 ? "text-brand-teal" : ""} />
                        LIQUIDAR SELECCIÓN <span className="text-brand-teal">({selectedItems.size})</span>
                    </button>
                </div>
            </div>

            {/* FINANCIAL INTELLIGENCE HUB (Status Sphere) */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-teal/20 via-brand-navy/10 to-transparent rounded-[1.5rem] sm:rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                <button 
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className="relative w-full glass-tactical p-4 sm:p-10 rounded-[1.8rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left transition-all duration-500 hover:border-brand-teal/30"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/5 blur-[100px] rounded-full -mr-32 -mt-32" />
                    
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-10 relative z-10">
                        <div className="flex items-center gap-6 sm:gap-10">
                            <div className="relative shrink-0">
                                <div className="absolute -inset-4 bg-brand-teal/10 rounded-full blur-2xl animate-pulse"></div>
                                <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full border-4 sm:border-[6px] border-slate-100 dark:border-slate-800/50 flex items-center justify-center relative bg-white dark:bg-slate-900/60 backdrop-blur-3xl shadow-inner-premium">
                                    <svg className="w-full h-full -rotate-90 scale-110">
                                        <circle
                                            cx="50%" cy="50%" r="40%"
                                            stroke="currentColor" strokeWidth="6" fill="transparent"
                                            className="text-slate-100 dark:text-slate-800"
                                        />
                                        <circle
                                            cx="50%" cy="50%" r="40%"
                                            stroke="url(#aurora-gradient)" strokeWidth="6" fill="transparent"
                                            strokeDasharray="251"
                                            strokeDashoffset={251 - (251 * (financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1))) * 100 / 100}
                                            className="transition-all duration-1000 ease-out drop-shadow-[0_0_12px_rgba(20,184,166,0.5)]"
                                            strokeLinecap="round"
                                        />
                                        <defs>
                                            <linearGradient id="aurora-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#14b8a6" />
                                                <stop offset="100%" stopColor="#0ea5e9" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg sm:text-3xl font-semibold text-slate-900 dark:text-brand-teal leading-none tracking-tighter">
                                            {Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1)) * 100)}%
                                        </span>
                                        <span className="text-[7px] sm:text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-1 sm:mt-2">REVENUE</span>
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-1 bg-brand-teal rounded-full" />
                                    <span className="text-[9px] sm:text-[11px] font-semibold text-brand-teal uppercase tracking-[0.3em]">Tactical Intelligence Hub</span>
                                </div>
                                <h3 className="text-2xl sm:text-4xl font-semibold text-slate-900 dark:text-white leading-[0.9] tracking-tighter mb-2 sm:mb-4">
                                    BALANCE DE <br className="hidden sm:block" /> RENDIMIENTO <span className="text-brand-teal opacity-50 font-display">Elite</span>
                                </h3>
                                <div className="flex gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Target Monthly</span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">$ {(financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)).toFixed(0)}</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Health Score</span>
                                        <span className="text-sm font-medium text-emerald-400">OPTIMAL</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-12 bg-slate-50 dark:bg-black/20 p-5 sm:p-0 rounded-3xl sm:bg-transparent border border-slate-100 dark:border-transparent">
                            <div className="flex items-center gap-6 sm:gap-10">
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-[9px] sm:text-[11px] font-semibold text-slate-500/60 uppercase tracking-widest leading-none mb-2">Por Recaudar</span>
                                    <span className="text-lg sm:text-3xl font-semibold text-rose-400 font-display tracking-tight">
                                        ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="w-px h-10 sm:h-16 bg-slate-200 dark:bg-slate-800" />
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-[9px] sm:text-[11px] font-semibold text-slate-500/60 uppercase tracking-widest leading-none mb-2">Total Cobrado</span>
                                    <span className="text-lg sm:text-3xl font-semibold text-brand-teal font-display tracking-tight">
                                        ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className={`p-2 sm:p-3 rounded-2xl transition-all duration-500 ${isAnalysisExpanded ? 'rotate-180 bg-brand-teal text-white shadow-lg shadow-brand-teal/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                <LucideIcons.ChevronDown size={24} />
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* TACTICAL FILTERS & SEARCH */}
            <div className="glass-tactical p-2 rounded-[1.8rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar border border-slate-200 dark:border-slate-800">
                    {[
                        { id: 'receivable', label: 'Pendientes', icon: LucideIcons.AlertTriangle, color: 'text-rose-400' },
                        { id: 'projected', label: 'Proyectado', icon: LucideIcons.Timer, color: 'text-amber-400' },
                        { id: 'collected', label: 'Efectivo', icon: LucideIcons.CheckCircle, color: 'text-brand-teal' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex flex-1 lg:flex-none items-center justify-center gap-3 px-6 py-4 rounded-xl text-[11px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 shrink-0
                                ${activeTab === tab.id 
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl shadow-brand-teal/10 ring-1 ring-brand-teal/30 scale-105 z-10' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? tab.color : 'text-slate-400'} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.id === 'receivable' && financialData.receivable.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold font-mono ml-1 ${activeTab === tab.id ? 'bg-rose-400 text-white shadow-lg shadow-rose-400/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                    {financialData.receivable.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative flex-grow w-full px-2">
                    <LucideIcons.Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input 
                        type="text" 
                        placeholder="IDENTIFICADOR / RUC / PROTOCOLO" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-14 pr-6 py-4 sm:py-5 bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl text-[11px] font-semibold uppercase tracking-widest placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal/30 transition-all text-slate-900 dark:text-white" 
                    />
                </div>
                <div className="flex items-center gap-3 sm:px-2 w-full lg:w-auto">
                    <button 
                        onClick={() => setIsRecalculating(p => !p)} 
                        className="flex-1 lg:flex-none flex items-center justify-center p-4 text-slate-400 hover:text-brand-teal transition-all hover:rotate-180 duration-700 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg active:scale-90"
                    >
                        <LucideIcons.RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 glass-tactical rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 h-fit relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-brand-teal/10 blur-[100px] rounded-full"></div>
                    <div className="relative z-10">
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                            <LucideIcons.ShieldAlert size={14} className="text-brand-teal" />
                            Security Analysis
                        </h3>
                        <div className="h-64 w-full mb-8 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={chartData} 
                                        cx="50%" cy="50%" 
                                        innerRadius={65} 
                                        outerRadius={95} 
                                        paddingAngle={8} 
                                        dataKey="value"
                                        stroke="none"
                                        animationBegin={0}
                                        animationDuration={1500}
                                    >
                                        {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                    </Pie>
                                    <ReTooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', color: '#fff', padding: '12px' }}
                                        itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pt-2">
                                <span className="text-2xl font-semibold text-slate-900 dark:text-white leading-none tracking-tighter">
                                    ${(financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)).toFixed(0)}
                                </span>
                                <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-[0.2em] mt-1">ESTIMATED</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {chartData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{d.name}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">${d.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <div className="glass-tactical rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col relative group shadow-2xl">
                        <div className="relative z-10 p-5 sm:p-6 bg-white/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center backdrop-blur-2xl">
                            <button onClick={() => {
                                if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                                else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                            }} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 hover:text-brand-teal dark:hover:text-brand-teal transition-all active:scale-95 shadow-sm">
                                {selectedItems.size === currentList.length ? <LucideIcons.CheckSquare size={16} className="text-brand-teal" /> : <LucideIcons.Square size={16} />}
                                SELECT ALL ENTRIES
                            </button>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-brand-teal/10 border border-brand-teal/20 shadow-inner">
                                <LucideIcons.Layers size={14} className="text-brand-teal" />
                                <span className="text-[10px] sm:text-[11px] font-semibold text-brand-teal uppercase tracking-widest">{currentList.length} OPERACIONES</span>
                            </div>
                        </div>

                        <div className="relative z-10 divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[700px] overflow-y-auto no-scrollbar p-3 sm:p-0">
                            {currentList.length === 0 ? (
                                <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                                    <div className="p-8 rounded-full bg-slate-50 dark:bg-slate-900/40 mb-6 border border-slate-100 dark:border-slate-800">
                                        <LucideIcons.ShieldCheck size={64} className="text-slate-200 dark:text-slate-800" />
                                    </div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">No Operations Found</p>
                                </div>
                            ) : (
                                currentList.map(item => {
                                    const key = `${item.clientId}-${item.period}`;
                                    const isSelected = selectedItems.has(key);
                                    return (
                                        <div 
                                            key={key} 
                                            onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => { const n = new Set(s); n.delete(key); return n; }) : setSelectedItems(s => new Set(s).add(key)))} 
                                            className={`group relative p-5 mb-2 sm:mb-0 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-500 cursor-pointer overflow-hidden rounded-3xl sm:rounded-none
                                                ${isSelected 
                                                    ? 'bg-brand-teal/10 dark:bg-brand-teal/5 shadow-inner' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}`}
                                        >
                                            <div className="flex items-center gap-6 relative z-10">
                                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500 border
                                                    ${isSelected 
                                                        ? 'bg-brand-teal border-brand-teal shadow-[0_0_20px_rgba(20,184,166,0.4)] text-white' 
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 group-hover:border-brand-teal/30 group-hover:text-brand-teal shadow-sm'}`}>
                                                    {item.type === 'mensual' ? <LucideIcons.Calendar size={24} /> : <LucideIcons.Zap size={24} />}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[200px] sm:max-w-none">{item.clientName}</p>
                                                        {item.daysDiff && item.daysDiff > 0 && (
                                                            <div className="px-2 py-0.5 rounded-lg bg-rose-400/10 border border-rose-400/20">
                                                                <span className="text-[8px] font-semibold text-rose-400 uppercase tracking-widest">URGENT</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5 py-0.5 px-2 rounded-md bg-slate-100 dark:bg-slate-800/80">
                                                            <LucideIcons.Activity size={10} className="text-slate-400" />
                                                            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 font-mono tracking-widest uppercase">{item.ruc}</span>
                                                        </div>
                                                        <span className="text-slate-200 dark:text-slate-800 text-xs">•</span>
                                                        <span className="text-[10px] font-semibold text-brand-teal uppercase tracking-widest">{formatPeriodForDisplay(item.period)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5 sm:mt-0 flex sm:flex-col justify-between items-end sm:items-end relative z-10 w-full sm:w-auto bg-white/50 dark:bg-black/20 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-slate-100 dark:border-slate-800/50 sm:border-transparent">
                                                <div className="flex flex-col sm:items-end">
                                                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1 sm:hidden">Transaction Sum</span>
                                                    <p className={`text-xl sm:text-2xl font-semibold font-display tracking-tight transition-colors duration-300 ${isSelected ? 'text-brand-teal' : 'text-slate-900 dark:text-white'}`}>
                                                        ${item.amount.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className={`mt-2 flex items-center gap-2 px-3 py-1 rounded-full border
                                                    ${item.status === 'Pagada' 
                                                        ? 'bg-emerald-400/20 text-emerald-400' 
                                                        : item.daysDiff && item.daysDiff > 0 
                                                            ? 'bg-rose-400/20 text-rose-400' 
                                                            : 'bg-slate-200/50 dark:bg-white/10 text-slate-400'}`}>
                                                    <span className="text-[9px] font-semibold uppercase tracking-widest">
                                                        {item.status === 'Pagada' ? 'EXECUTED' : item.daysDiff && item.daysDiff > 0 ? `DELAYED ${item.daysDiff}D` : 'PENDING'}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-brand-teal shadow-[4px_0_15px_rgba(20,184,166,0.5)]"></div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Autorizar Transacción Financiera">
                <div className="p-4 sm:p-8 space-y-10">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-brand-teal to-brand-navy rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-3xl text-center shadow-inner-premium">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 rounded-2xl bg-brand-teal/10 border border-brand-teal/20 text-brand-teal">
                                    <LucideIcons.ShieldCheck size={32} />
                                </div>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.4em] mb-4">Monto de Liquidación Total</p>
                            <p className="text-5xl sm:text-6xl font-semibold text-slate-900 dark:text-white mb-4 tracking-tighter">
                                ${Array.from(selectedItems).reduce<number>((sum: number, key) => sum + (currentList.find(i => `${i.clientId}-${i.period}` === key)?.amount || 0), 0).toFixed(2)}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                                <span className="text-[10px] font-semibold text-brand-teal uppercase tracking-widest">Protocolo de Procedencia Verificado</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleProcessPayment} 
                            disabled={isProcessing} 
                            className="group relative w-full overflow-hidden py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isProcessing ? <LucideIcons.RefreshCw className="animate-spin text-brand-teal" size={20} /> : <LucideIcons.ShieldAlert size={20} className="text-brand-teal" />}
                                {isProcessing ? 'AUTORIZANDO...' : 'CONFIRMAR OPERACIÓN TACTICAL'}
                            </span>
                            <div className="absolute inset-0 bg-brand-teal/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                        <p className="text-center text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-relaxed opacity-50">
                            Al confirmar, se generará un asiento contable digital <br />y se actualizará el historial del contribuyente en el Grid.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Protocolo de Ejecución Exitosa">
                {receiptData && (
                    <div className="p-4 sm:p-10 space-y-10">
                        <div className="relative group">
                            <div className="absolute -inset-2 bg-gradient-to-r from-brand-teal to-brand-navy rounded-[2.5rem] blur-3xl opacity-10"></div>
                            <div ref={receiptRef} className="relative bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] shadow-2xl overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 text-slate-100 dark:text-slate-800/40">
                                    <LucideIcons.Shield size={120} />
                                </div>
                                
                                <div className="text-center mb-10 border-b border-dashed border-slate-200 dark:border-slate-800 pb-8 relative z-10">
                                    <p className="font-semibold text-lg uppercase tracking-[0.2em] mb-2 text-slate-900 dark:text-white">{defaultBusinessProfile.businessName}</p>
                                    <p className="text-[10px] font-medium uppercase tracking-widest leading-tight text-slate-400">{defaultBusinessProfile.tradeName}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">{defaultBusinessProfile.address}</p>
                                    <div className="inline-block mt-6 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-semibold text-[9px] uppercase tracking-widest shadow-lg">
                                        TX-AUTH: {receiptData.transactionId}
                                    </div>
                                </div>

                                <div className="space-y-4 mb-10 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50 relative z-10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[9px] tracking-widest">Contribuyente</span>
                                        <span className="text-right font-semibold uppercase text-slate-900 dark:text-white tracking-tight">{receiptData.clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[9px] tracking-widest">Identificación</span>
                                        <span className="text-right font-semibold text-brand-teal">{receiptData.clientRuc}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 uppercase font-semibold text-[9px] tracking-widest">Digital Timestamp</span>
                                        <span className="text-right font-semibold opacity-80">{receiptData.paymentDate}</span>
                                    </div>
                                </div>

                                <div className="mb-10 relative z-10">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.3em] mb-4 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">Desglose de Cargo</p>
                                    <div className="space-y-3">
                                        {receiptData.paidPeriods.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center py-1">
                                                <span className="font-medium uppercase text-slate-600 dark:text-slate-400">Honorarios Profesionales {p.period}</span>
                                                <span className="font-semibold text-slate-900 dark:text-white tracking-tighter">${p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-brand-teal p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl shadow-brand-teal/20 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-[9px] uppercase tracking-[0.3em] opacity-80">Total Transado</span>
                                        <span className="text-[10px] font-medium opacity-60">PAGO CONFIRMADO</span>
                                    </div>
                                    <span className="text-3xl font-semibold font-display tracking-tighter">${receiptData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => printSalesNote(receiptData, defaultBusinessProfile)} 
                                className="flex-1 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] transition-all"
                            >
                                <LucideIcons.Printer size={20} className="text-brand-teal" /> GENERAR TICKET FÍSICO
                            </button>
                            <button 
                                onClick={() => setIsReceiptOpen(false)} 
                                className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                CERRAR PROTOCOLO
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
