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

            client.declarationHistory.forEach(decl => {
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
                } else if (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) {
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
            const history = [...newClients[clientIdx].declarationHistory];
            const declIdx = history.findIndex(d => d.period === item.period);
            const entry = { period: item.period, status: DeclarationStatus.Pagada, paidAt: nowIso, transactionId, amount: item.amount, updatedAt: nowIso };
            if (declIdx > -1) history[declIdx] = { ...history[declIdx], ...entry };
            else history.push(entry as any);
            newClients[clientIdx] = { ...newClients[clientIdx], declarationHistory: history };
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
        <div className="space-y-6 pb-24 animate-fade-in relative">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="animate-fade-in-left">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Financial Sync</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">• Santiago Cordova</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-display font-black text-slate-900 dark:text-white leading-[0.9] tracking-tighter mb-2">
                        Financial <span className="text-gradient-sky">Command</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                        <Shield size={12} className="text-sky-500" />
                        <span>Gestión de Cobranzas y Proyecciones Elite</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={selectedItems.size === 0}
                        className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 w-full sm:w-auto
                            ${selectedItems.size > 0 
                                ? 'bg-sky-500 text-white shadow-xl shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98]' 
                                : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-white/5'}`}
                    >
                        <DollarSign size={16} />
                        COBRAR SELECCIÓN ({selectedItems.size})
                    </button>
                    <button className="hidden sm:block p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/5 hover:text-sky-500 transition-colors">
                        <ExternalLink size={20} />
                    </button>
                </div>
            </div>

            {/* FINANCIAL INTELLIGENCE HUB (Status Sphere) */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/20 via-emerald-500/10 to-transparent rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                <button 
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className="relative w-full glass-tactical p-6 sm:p-8 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden text-left transition-all duration-500 hover:border-white/20"
                >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-sky-500/20 rounded-full blur-2xl animate-pulse"></div>
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-slate-800 dark:border-white/5 flex items-center justify-center relative bg-slate-900/40 backdrop-blur-xl">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="4" fill="transparent"
                                            className="text-slate-800 dark:text-white/5"
                                        />
                                        <circle
                                            cx="50%" cy="50%" r="42%"
                                            stroke="currentColor" strokeWidth="4" fill="transparent"
                                            strokeDasharray="264"
                                            strokeDashoffset={264 - (264 * (financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1))) * 100 / 100}
                                            className="text-sky-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xl sm:text-2xl font-black text-sky-500 leading-none">
                                            {Math.round((financialData.collected.reduce((s, i) => s + i.amount, 0) / (financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0) || 1)) * 100)}%
                                        </span>
                                        <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">META</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.3em] mb-1 block">Centro de Inteligencia</span>
                                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter mb-2">
                                    RECAUDACIÓN Y <br className="hidden sm:block" /> RENDIMIENTO
                                </h3>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                        <BarChart3 size={12} className="text-emerald-500" />
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 uppercase">Estatus: Optimizado</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-8">
                            {!isAnalysisExpanded && (
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Por Cobrar</span>
                                        <span className="text-lg sm:text-xl font-black text-rose-500">
                                            ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recaudado</span>
                                        <span className="text-lg sm:text-xl font-black text-emerald-500">
                                            ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className={`p-2 rounded-xl transition-all ${isAnalysisExpanded ? 'rotate-180 bg-sky-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* TACTICAL FILTERS & SEARCH */}
            <div className="glass-tactical p-2 rounded-[2rem] shadow-2xl border border-white/10 flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex p-1 bg-slate-900/5 dark:bg-black/40 rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar">
                    {[
                        { id: 'receivable', label: 'Pendientes', icon: AlertTriangle },
                        { id: 'projected', label: 'Proyectado', icon: Timer },
                        { id: 'collected', label: 'Efectivo', icon: CheckCircle }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex flex-1 lg:flex-none items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shrink-0
                                ${activeTab === tab.id 
                                    ? 'bg-white dark:bg-slate-900 text-sky-500 shadow-xl shadow-sky-500/10 ring-1 ring-sky-500/20' 
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? 'text-sky-500' : 'text-slate-400'} />
                            {tab.label}
                            {tab.id === 'receivable' && financialData.receivable.length > 0 && (
                                <span className={`px-1.5 rounded-md text-[8px] font-mono ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                                    {financialData.receivable.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="IDENTIFICADOR DE UNIDAD / RUC..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-14 pr-6 py-4 bg-white/30 dark:bg-slate-950/30 border border-slate-200/50 dark:border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest placeholder:text-slate-400 transition-all focus:ring-2 focus:ring-sky-500/20" 
                    />
                </div>
                <div className="flex items-center gap-2 px-2">
                    <button 
                        onClick={() => setIsRecalculating(p => !p)} 
                        className="p-3.5 text-slate-400 hover:text-sky-500 transition-all hover:rotate-180 duration-700 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 glass-tactical rounded-[2rem] p-6 border border-white/5 h-fit relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-sky-500/10 blur-[80px] rounded-full"></div>
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <ShieldAlert size={12} className="text-sky-500" />
                            Análisis de Cartera
                        </h3>
                        <div className="h-56 w-full mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={chartData} 
                                        cx="50%" cy="50%" 
                                        innerRadius={50} 
                                        outerRadius={75} 
                                        paddingAngle={4} 
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                    </Pie>
                                    <ReTooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center mt-3">
                                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                                    ${(financialData.receivable.reduce((s, i) => s + i.amount, 0) + financialData.collected.reduce((s, i) => s + i.amount, 0)).toFixed(0)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">TOTAL</span>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            {chartData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/5 dark:bg-white/2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900 dark:text-white font-mono">${d.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 glass-tactical rounded-[2rem] border border-white/5 overflow-hidden flex flex-col relative group">
                    <div className="absolute inset-0 bg-slate-100/50 dark:bg-transparent pointer-events-none"></div>
                    <div className="relative z-10 p-5 bg-white/40 dark:bg-black/20 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
                        <button onClick={() => {
                            if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                            else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                        }} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-sky-500 transition-all">
                            {selectedItems.size === currentList.length ? <CheckSquare size={16} className="text-sky-500" /> : <Square size={16} />}
                            {selectedItems.size === currentList.length ? 'DESELECCIONAR' : 'SELECCIONAR TODO'}
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                                <Layers size={12} className="text-sky-500" />
                                <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{currentList.length} OPERACIONES</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 divide-y divide-slate-100 dark:divide-white/5 max-h-[600px] overflow-y-auto no-scrollbar">
                        {currentList.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                                <ShieldCheck size={48} className="text-slate-800 dark:text-white/10 mb-4" />
                                <p className="text-xs font-black uppercase tracking-widest">Sin operaciones registradas</p>
                            </div>
                        ) : (
                            currentList.map(item => {
                                const key = `${item.clientId}-${item.period}`;
                                const isSelected = selectedItems.has(key);
                                return (
                                    <div 
                                        key={key} 
                                        onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => { const n = new Set(s); n.delete(key); return n; }) : setSelectedItems(s => new Set(s).add(key)))} 
                                        className={`group relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-300 cursor-pointer overflow-hidden
                                            ${isSelected ? 'bg-sky-500/5 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-white/2'}`}
                                    >
                                        <div className="flex items-center gap-4 sm:gap-5 relative z-10">
                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border
                                                ${isSelected 
                                                    ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/40' 
                                                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 group-hover:bg-white dark:group-hover:bg-sky-500/10 group-hover:text-sky-500 group-hover:border-sky-500/20'}`}>
                                                {item.type === 'mensual' ? <Calendar size={18} /> : <Zap size={18} />}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                    <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[150px] sm:max-w-none">{item.clientName}</p>
                                                    {item.daysDiff && item.daysDiff > 0 && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-[8px] font-black text-white shadow-lg shadow-rose-500/30 shrink-0">VIP ALERT</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[9px] sm:text-[10px] font-black text-sky-500/60 font-mono tracking-widest uppercase">{item.ruc}</span>
                                                    <span className="text-slate-300 dark:text-white/10 text-[10px]">•</span>
                                                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{formatPeriodForDisplay(item.period)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 sm:mt-0 text-left sm:text-right flex sm:flex-col justify-between items-end sm:items-end relative z-10 w-full sm:w-auto">
                                            <p className={`text-lg sm:text-xl font-black transition-colors duration-300 ${isSelected ? 'text-sky-500' : 'text-slate-900 dark:text-white'}`}>
                                                ${item.amount.toFixed(2)}
                                            </p>
                                            <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg inline-block
                                                ${item.status === 'Pagada' 
                                                    ? 'bg-emerald-500/10 text-emerald-500' 
                                                    : item.daysDiff && item.daysDiff > 0 
                                                        ? 'bg-rose-500/10 text-rose-500' 
                                                        : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                                {item.status === 'Pagada' ? 'EXECUTED' : item.daysDiff && item.daysDiff > 0 ? `DELAY: ${item.daysDiff}D` : 'STANDBY'}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)]"></div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Autorizar Transacción Financiera">
                <div className="p-4 space-y-8">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                        <div className="relative bg-slate-50 dark:bg-slate-900 border border-white/5 p-8 rounded-2xl text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Total a Liquidar</p>
                            <p className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                                ${Array.from(selectedItems).reduce<number>((sum: number, key) => sum + (currentList.find(i => `${i.clientId}-${i.period}` === key)?.amount || 0), 0).toFixed(2)}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Procedencia Verificada</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleProcessPayment} 
                            disabled={isProcessing} 
                            className="group relative w-full overflow-hidden py-4 bg-sky-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-sky-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                                {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR OPERACIÓN'}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                        <p className="text-center text-[8px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                            Al confirmar, se generará un asiento contable <br />y se actualizará el historial del contribuyente.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Comprobante de Ejecución">
                {receiptData && (
                    <div className="p-4 space-y-6">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-3xl blur opacity-10"></div>
                            <div ref={receiptRef} className="relative bg-white dark:bg-slate-900 p-8 rounded-[1.5rem] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 font-mono text-xs shadow-2xl overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <Shield size={40} className="text-slate-100 dark:text-white/5" />
                                </div>
                                
                                <div className="text-center mb-8 border-b border-dashed border-slate-200 dark:border-white/10 pb-6">
                                    <p className="font-black text-base uppercase tracking-widest mb-1 text-slate-900 dark:text-white">{defaultBusinessProfile.businessName}</p>
                                    <p className="text-[10px] text-slate-400">{defaultBusinessProfile.address}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">SISTEMA ELITE • RUC: {defaultBusinessProfile.ruc}</p>
                                    <div className="inline-block mt-4 px-3 py-1 bg-sky-500 text-white rounded-full font-black text-[9px] uppercase tracking-widest">
                                        ID: {receiptData.transactionId}
                                    </div>
                                </div>

                                <div className="space-y-2 mb-8 bg-slate-50 dark:bg-white/2 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase font-black text-[9px]">Contribuyente</span>
                                        <span className="text-right font-black uppercase text-slate-900 dark:text-white">{receiptData.clientName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase font-black text-[9px]">Identificación</span>
                                        <span className="text-right font-black text-sky-500">{receiptData.clientRuc}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 uppercase font-black text-[9px]">Timestamp</span>
                                        <span className="text-right font-black">{receiptData.paymentDate}</span>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-dashed border-slate-200 dark:border-white/10 pb-1">Desglose de Operaciones</p>
                                    <table className="w-full text-[10px]">
                                        <tbody>
                                            {receiptData.paidPeriods.map((p, i) => (
                                                <tr key={i} className="border-b border-slate-50 dark:border-white/2">
                                                    <td className="py-3 font-bold uppercase text-slate-600 dark:text-slate-400">HONORARIOS PROF. {p.period}</td>
                                                    <td className="text-right py-3 font-black text-slate-900 dark:text-white">${p.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="bg-slate-900 dark:bg-sky-500 p-5 rounded-2xl flex justify-between items-center text-white">
                                    <span className="font-black text-[10px] uppercase tracking-widest">Total Transado</span>
                                    <span className="text-2xl font-black font-display tracking-tighter">${receiptData.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => printSalesNote(receiptData, defaultBusinessProfile)} 
                                className="flex-1 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all"
                            >
                                <Printer size={18} /> IMPRIMIR TICKET
                            </button>
                            <button 
                                onClick={() => setIsReceiptOpen(false)} 
                                className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
