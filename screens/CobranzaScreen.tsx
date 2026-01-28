
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Client, Declaration, DeclarationStatus, ReminderType, ReceiptData, TaxRegime } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { getClientServiceFee, addAdvancePayments } from '../services/clientService';
import { differenceInCalendarDays, isToday, format, isPast, isSameMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, CheckCircle, MessageSquare, Mail, Info, DollarSign, 
    Printer, Clipboard, Search, Loader, CreditCard, X, Copy, TrendingUp, 
    Users, Calendar, ArrowRight, Filter, Download, CheckSquare, Square, 
    BarChart3, PieChart, Wallet
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAppStore } from '../store/useAppStore';
import { Modal } from '../components/Modal';
import { printSalesNote } from '../services/printService';
import { Logo } from '../components/Logo';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface CobranzaScreenProps {
    autoRegister?: boolean;
    clearAutoAction?: () => void;
}

// Estructura extendida para el deudor
interface DebtorItem {
    client: Client;
    totalDebt: number;
    overdueDebt: number;
    pendingCount: number;
    oldestPeriod: string;
    oldestDueDate: Date | null;
    riskLevel: 'low' | 'medium' | 'high';
    daysOverdue: number;
    pendingItems: { period: string; amount: number; dueDate: Date | null; isOverdue: boolean }[];
}

export const CobranzaScreen: React.FC<CobranzaScreenProps> = ({ autoRegister, clearAutoAction }) => {
    const { clients, setClients, serviceFees, reminderConfig, businessProfile, setTasks } = useAppStore();
    const { toast } = useToast();

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDebtors, setSelectedDebtors] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof DebtorItem, direction: 'asc' | 'desc' }>({ key: 'overdueDebt', direction: 'desc' });

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [activeDebtor, setActiveDebtor] = useState<DebtorItem | null>(null);
    const [selectedPeriodsToPay, setSelectedPeriodsToPay] = useState<Set<string>>(new Set());
    const [includeRenta, setIncludeRenta] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Cheque'>('Transferencia');
    const [paymentReference, setPaymentReference] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    
    // Receipt Modal
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Auto-open modal effect
    useEffect(() => {
        if (autoRegister) {
            // Logic to auto-select would go here, or just open generic modal
             if(clearAutoAction) clearAutoAction();
        }
    }, [autoRegister, clearAutoAction]);

    // --- DATA PROCESSING & LOGIC ---

    const debtorList = useMemo(() => {
        const list: DebtorItem[] = [];
        
        clients.forEach(client => {
            if (!(client.isActive ?? true)) return;

            const pendingDecls = client.declarationHistory.filter(d => d.status !== DeclarationStatus.Pagada);
            if (pendingDecls.length === 0 && client.regime === TaxRegime.RimpeNegocioPopular) {
                 // Check logic for RIMPE NP if strictly needed, usually handled by declaration generation
            }
            if (pendingDecls.length === 0) return;

            let clientDebt = 0;
            let clientOverdue = 0;
            let oldestDueDate: Date | null = null;
            let oldestPeriod = '';
            const pendingItemsDetails: { period: string; amount: number; dueDate: Date | null; isOverdue: boolean }[] = [];

            // Sort to find oldest
            pendingDecls.sort((a,b) => a.period.localeCompare(b.period));
            
            pendingDecls.forEach(d => {
                const amount = d.amount ?? getClientServiceFee(client, serviceFees);
                const dueDate = getDueDateForPeriod(client, d.period);
                const overdue = dueDate ? isPast(dueDate) : false;

                clientDebt += amount;
                if (overdue) clientOverdue += amount;

                if (dueDate) {
                    if (!oldestDueDate || dueDate < oldestDueDate) {
                        oldestDueDate = dueDate;
                        oldestPeriod = d.period;
                    }
                }
                
                pendingItemsDetails.push({
                    period: d.period,
                    amount,
                    dueDate,
                    isOverdue: overdue
                });
            });

            const daysOverdue = oldestDueDate ? differenceInCalendarDays(new Date(), oldestDueDate) : 0;
            let riskLevel: 'low' | 'medium' | 'high' = 'low';
            if (daysOverdue > 90) riskLevel = 'high';
            else if (daysOverdue > 30) riskLevel = 'medium';

            list.push({
                client,
                totalDebt: clientDebt,
                overdueDebt: clientOverdue,
                pendingCount: pendingDecls.length,
                oldestPeriod,
                oldestDueDate,
                riskLevel,
                daysOverdue,
                pendingItems: pendingItemsDetails
            });
        });

        // Filter
        let filtered = list.filter(item => 
            item.client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.client.ruc.includes(searchTerm)
        );

        // Sort
        filtered.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            
            if (valA === null) return 1;
            if (valB === null) return -1;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [clients, serviceFees, searchTerm, sortConfig]);

    // --- AGING CHART DATA ---
    const agingData = useMemo(() => {
        const buckets = {
            'Corriente': 0,
            '1-30 Días': 0,
            '31-60 Días': 0,
            '61-90 Días': 0,
            '+90 Días': 0
        };

        debtorList.forEach(d => {
            d.pendingItems.forEach(item => {
                if (!item.isOverdue) {
                    buckets['Corriente'] += item.amount;
                } else {
                    const days = item.dueDate ? differenceInCalendarDays(new Date(), item.dueDate) : 0;
                    if (days <= 30) buckets['1-30 Días'] += item.amount;
                    else if (days <= 60) buckets['31-60 Días'] += item.amount;
                    else if (days <= 90) buckets['61-90 Días'] += item.amount;
                    else buckets['+90 Días'] += item.amount;
                }
            });
        });

        return Object.entries(buckets).map(([name, value]) => ({ name, value }));
    }, [debtorList]);

    // --- HANDLERS ---

    const handleSort = (key: keyof DebtorItem) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleSelection = (clientId: string) => {
        const newSet = new Set(selectedDebtors);
        if (newSet.has(clientId)) newSet.delete(clientId);
        else newSet.add(clientId);
        setSelectedDebtors(newSet);
    };

    const toggleAllSelection = () => {
        if (selectedDebtors.size === debtorList.length) setSelectedDebtors(new Set());
        else setSelectedDebtors(new Set(debtorList.map(d => d.client.id)));
    };

    const handleOpenPaymentModal = (debtor: DebtorItem) => {
        setActiveDebtor(debtor);
        // Pre-select all pending items by default
        setSelectedPeriodsToPay(new Set(debtor.pendingItems.map(i => i.period)));
        setIncludeRenta(false);
        setPaymentReference('');
        setIsPaymentModalOpen(true);
    };

    const handleProcessPayment = () => {
        if (!activeDebtor) return;
        if (selectedPeriodsToPay.size === 0 && !includeRenta) {
            toast.warning("Debe seleccionar al menos un ítem para pagar.");
            return;
        }

        setIsProcessingPayment(true);

        setTimeout(() => {
            // We calculate how many periods are selected to use the existing `addAdvancePayments` logic
            // OR ideally, we refactor `addAdvancePayments` to accept specific periods.
            // For now, we simulate by filtering the client history and marking specific ones as paid.
            
            const now = new Date().toISOString();
            const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
            
            const updatedHistory = activeDebtor.client.declarationHistory.map(decl => {
                if (selectedPeriodsToPay.has(decl.period)) {
                    return {
                        ...decl,
                        status: DeclarationStatus.Pagada,
                        paidAt: now,
                        updatedAt: now,
                        transactionId,
                        // Persist payment method info in a robust app, here simplified
                    };
                }
                return decl;
            });

            let updatedClient = { ...activeDebtor.client, declarationHistory: updatedHistory };
            
            // Handle Renta Logic (creates a task)
            if (includeRenta && activeDebtor.client.regime !== TaxRegime.RimpeNegocioPopular) {
                 // Add renta task logic here if needed, similar to clientService
            }

            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));

            // Generate Receipt
            const paidItems = activeDebtor.pendingItems.filter(i => selectedPeriodsToPay.has(i.period));
            const total = paidItems.reduce((s, i) => s + i.amount, 0) + (includeRenta ? serviceFees.rentaGeneral : 0);
            
            if (includeRenta) {
                paidItems.push({ period: 'Abono Renta', amount: serviceFees.rentaGeneral, dueDate: null, isOverdue: false });
            }

            setReceiptData({
                transactionId,
                clientName: updatedClient.name,
                clientRuc: updatedClient.ruc,
                client: updatedClient,
                paymentDate: format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: es }),
                paidPeriods: paidItems,
                totalAmount: total
            });

            setIsProcessingPayment(false);
            setIsPaymentModalOpen(false);
            setIsReceiptOpen(true);
            toast.success("Pago registrado exitosamente");

        }, 1000);
    };

    const handleBulkNotify = () => {
        if (selectedDebtors.size === 0) return;
        
        let count = 0;
        selectedDebtors.forEach(id => {
            const debtor = debtorList.find(d => d.client.id === id);
            if (debtor && debtor.client.phones?.length) {
                const phone = debtor.client.phones[0].replace(/\D/g, '');
                const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
                const message = `Estimado/a ${debtor.client.name}, le recordamos que mantiene un saldo pendiente de $${debtor.totalDebt.toFixed(2)}. Agradecemos su pago.`;
                // Opening multiple windows is blocked by browsers usually, so this is a UX limitation in web apps.
                // In a real app, this would use a backend API (Twilio/Meta) to send messages.
                // For this demo, we simulate or just open the first one.
                if (count === 0) window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
                count++;
            }
        });
        
        if (count > 0) toast.success(`Se inició el proceso de notificación para ${count} clientes.`);
        else toast.warning("Los clientes seleccionados no tienen teléfono válido.");
        
        setSelectedDebtors(new Set());
    };

    const totalPortfolio = debtorList.reduce((sum, d) => sum + d.totalDebt, 0);
    const totalOverdue = debtorList.reduce((sum, d) => sum + d.overdueDebt, 0);

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <Wallet className="text-gold"/> Gestión de Cobranza
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Control de flujo de caja y recuperación de cartera.</p>
                </div>
                <div className="flex gap-2">
                     {selectedDebtors.size > 0 && (
                        <button onClick={handleBulkNotify} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all font-bold text-sm animate-fade-in">
                            <MessageSquare size={18}/> Notificar ({selectedDebtors.size})
                        </button>
                     )}
                </div>
            </div>

            {/* Financial Overview & Aging Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 grid grid-cols-1 gap-4">
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10"><DollarSign size={64} className="text-brand-navy dark:text-white"/></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cartera Total</p>
                        <h3 className="text-3xl font-mono font-black text-brand-navy dark:text-white mt-1">${totalPortfolio.toFixed(2)}</h3>
                        <p className="text-xs text-slate-500 mt-2 font-medium">Deuda acumulada de {debtorList.length} clientes.</p>
                     </div>
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10"><AlertTriangle size={64} className="text-red-500"/></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Vencido (&gt;1 día)</p>
                        <h3 className="text-3xl font-mono font-black text-red-600 mt-1">${totalOverdue.toFixed(2)}</h3>
                        <p className="text-xs text-red-400 mt-2 font-bold">{((totalOverdue/totalPortfolio)*100 || 0).toFixed(1)}% de la cartera.</p>
                     </div>
                </div>
                
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2"><BarChart3 size={16}/> Antigüedad de Deuda (Aging)</h4>
                    <div className="h-48 w-full">
                        <ResponsiveContainer>
                            <BarChart data={agingData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Monto']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {agingData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : index === 2 ? '#f59e0b' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Smart Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Table Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                     <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, RUC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-400 hover:text-brand-navy hover:bg-slate-100 rounded-lg transition-colors" title="Filtros"><Filter size={18}/></button>
                        <button className="p-2 text-slate-400 hover:text-brand-navy hover:bg-slate-100 rounded-lg transition-colors" title="Exportar"><Download size={18}/></button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 bg-slate-50/80 dark:bg-slate-800/50 p-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 items-center">
                    <div className="col-span-1 text-center">
                        <button onClick={toggleAllSelection} className="text-slate-400 hover:text-brand-teal">
                            {selectedDebtors.size === debtorList.length && debtorList.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                        </button>
                    </div>
                    <div className="col-span-4 cursor-pointer hover:text-brand-teal flex items-center gap-1" onClick={() => handleSort('client')}>
                        Cliente / RUC {sortConfig.key === 'client' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-2 text-right cursor-pointer hover:text-brand-teal" onClick={() => handleSort('totalDebt')}>
                        Deuda Total {sortConfig.key === 'totalDebt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-2 text-center cursor-pointer hover:text-brand-teal" onClick={() => handleSort('daysOverdue')}>
                        Antigüedad {sortConfig.key === 'daysOverdue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-3 text-center">Acción</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto max-h-[600px]">
                    {debtorList.length > 0 ? debtorList.map((debtor) => (
                        <div key={debtor.client.id} className={`grid grid-cols-12 p-4 border-b border-slate-100 dark:border-slate-800 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${selectedDebtors.has(debtor.client.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                             <div className="col-span-1 text-center">
                                <button onClick={() => toggleSelection(debtor.client.id)} className={`${selectedDebtors.has(debtor.client.id) ? 'text-brand-teal' : 'text-slate-300 hover:text-slate-500'}`}>
                                    {selectedDebtors.has(debtor.client.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                </button>
                            </div>
                            <div className="col-span-4 pr-2">
                                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{debtor.client.name}</p>
                                <p className="font-mono text-xs text-slate-400">{debtor.client.ruc}</p>
                                {debtor.riskLevel === 'high' && <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded uppercase">Alto Riesgo</span>}
                            </div>
                            <div className="col-span-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                ${debtor.totalDebt.toFixed(2)}
                            </div>
                            <div className="col-span-2 text-center">
                                {debtor.overdueDebt > 0 ? (
                                    <div className="flex flex-col items-center">
                                        <span className={`text-xs font-bold ${debtor.daysOverdue > 60 ? 'text-red-500' : 'text-amber-500'}`}>
                                            {debtor.daysOverdue} días
                                        </span>
                                        <span className="text-[9px] text-slate-400">Vencido</span>
                                    </div>
                                ) : (
                                    <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">Al Día</span>
                                )}
                            </div>
                            <div className="col-span-3 flex justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleOpenPaymentModal(debtor)}
                                    className="px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-1"
                                >
                                    <DollarSign size={12}/> Cobrar
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center text-slate-400">
                            <CheckCircle size={48} className="mx-auto mb-4 opacity-20"/>
                            <p className="font-medium">Excelente trabajo. No hay deudas pendientes bajo este criterio.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Registrar Pago">
                {activeDebtor && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Cliente</p>
                                <p className="font-bold text-slate-800 dark:text-white text-lg">{activeDebtor.client.name}</p>
                                <p className="font-mono text-slate-500 text-sm">{activeDebtor.client.ruc}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Deuda Total</p>
                                <p className="font-mono text-xl font-black text-brand-navy dark:text-white">${activeDebtor.totalDebt.toFixed(2)}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccione Ítems a Pagar</p>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                                {activeDebtor.pendingItems.map((item) => (
                                    <div 
                                        key={item.period} 
                                        onClick={() => {
                                            const newSet = new Set(selectedPeriodsToPay);
                                            if (newSet.has(item.period)) newSet.delete(item.period);
                                            else newSet.add(item.period);
                                            setSelectedPeriodsToPay(newSet);
                                        }}
                                        className={`flex justify-between items-center p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-colors ${selectedPeriodsToPay.has(item.period) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedPeriodsToPay.has(item.period) ? 'bg-brand-teal border-brand-teal text-white' : 'border-slate-300'}`}>
                                                {selectedPeriodsToPay.has(item.period) && <CheckSquare size={12}/>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatPeriodForDisplay(item.period)}</p>
                                                {item.isOverdue && <span className="text-[10px] text-red-500 font-bold">Vencido</span>}
                                            </div>
                                        </div>
                                        <p className="font-mono font-bold text-slate-800 dark:text-white">${item.amount.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                            {activeDebtor.client.regime !== TaxRegime.RimpeNegocioPopular && (
                                <div className="mt-2 flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => setIncludeRenta(!includeRenta)}>
                                     <div className={`w-4 h-4 border rounded flex items-center justify-center ${includeRenta ? 'bg-brand-teal border-brand-teal text-white' : 'border-slate-300'}`}>
                                        {includeRenta && <CheckSquare size={12}/>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Abono Renta Anual</p>
                                    </div>
                                    <p className="font-mono font-bold text-slate-800 dark:text-white">+${serviceFees.rentaGeneral.toFixed(2)}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Forma de Pago</label>
                                <select 
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                                >
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Referencia / N° Comp.</label>
                                <input 
                                    type="text" 
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                                    placeholder="Ej: 123456"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <span className="font-bold text-slate-500">Total a Pagar:</span>
                            <span className="text-3xl font-mono font-black text-brand-teal">
                                ${(
                                    [...activeDebtor.pendingItems]
                                    .filter(i => selectedPeriodsToPay.has(i.period))
                                    .reduce((acc, curr) => acc + curr.amount, 0) + 
                                    (includeRenta ? serviceFees.rentaGeneral : 0)
                                ).toFixed(2)}
                            </span>
                        </div>

                        <button 
                            onClick={handleProcessPayment} 
                            disabled={isProcessingPayment}
                            className="w-full py-4 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isProcessingPayment ? <Loader className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                            <span>Procesar Pago</span>
                        </button>
                    </div>
                )}
            </Modal>

            {/* Receipt Modal Logic (Same as before but linked to new state) */}
             <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Comprobante de Ingreso">
                {receiptData && (
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden">
                        <div ref={receiptRef} className="p-8 bg-white dark:bg-slate-950 border-b border-dashed border-slate-300 dark:border-slate-700 relative">
                             {/* ... (Existing Receipt Design) ... */}
                             <div className="text-center mb-6">
                                <div className="inline-block p-3 bg-green-50 rounded-full mb-2"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                                <h3 className="font-black text-xl text-brand-navy dark:text-white uppercase tracking-tight">Comprobante de Pago</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase">{receiptData.transactionId}</p>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                                <div>
                                    <p className="text-slate-400 font-bold uppercase">Cliente</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{receiptData.clientName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 font-bold uppercase">Fecha</p>
                                    <p className="font-mono text-slate-800 dark:text-white">{receiptData.paymentDate}</p>
                                </div>
                             </div>

                             <table className="w-full text-xs mb-6">
                                <thead className="border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="text-left py-2 font-black text-slate-400 uppercase">Concepto</th>
                                        <th className="text-right py-2 font-black text-slate-400 uppercase">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receiptData.paidPeriods.map((p, i) => (
                                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                                            <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{formatPeriodForDisplay(p.period)}</td>
                                            <td className="py-2 text-right font-mono font-bold">${p.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>

                             <div className="flex justify-between items-center pt-2 border-t-2 border-slate-100 dark:border-slate-800">
                                 <span className="font-black text-slate-800 dark:text-white">TOTAL</span>
                                 <span className="text-xl font-mono font-black text-brand-teal">${receiptData.totalAmount.toFixed(2)}</span>
                             </div>
                        </div>
                        
                        <div className="p-4 flex gap-3">
                             <button onClick={() => printSalesNote(receiptData, businessProfile)} className="flex-1 py-3 bg-brand-navy text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                                <Printer size={18}/> Imprimir
                             </button>
                             <button onClick={() => setIsReceiptOpen(false)} className="px-4 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors">
                                Cerrar
                             </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};