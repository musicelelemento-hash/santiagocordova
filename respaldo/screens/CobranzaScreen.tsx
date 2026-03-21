import React, { useMemo, useState, useRef } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime, ServiceFeesConfig, ReminderConfig, BusinessProfile } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { differenceInCalendarDays, isSameMonth, parseISO, isValid, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, CheckCircle, MessageSquare, DollarSign, 
    Printer, Search, Loader, RefreshCw, CheckSquare, Square, Layers
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { printSalesNote } from '../services/printService';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';

interface CobranzaScreenProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    serviceFees: ServiceFeesConfig;
    reminderConfig: ReminderConfig;
}

interface FinancialItem {
    clientId: string;
    clientName: string;
    ruc: string;
    period: string;
    amount: number;
    status: DeclarationStatus;
    type: 'mensual' | 'semestral' | 'renta' | 'dev';
    dateReference: Date; 
    daysDiff?: number;
    phones: string[];
    isVirtual?: boolean; 
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

export const CobranzaScreen: React.FC<CobranzaScreenProps> = ({ clients, setClients, serviceFees }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'receivable' | 'projected' | 'collected'>('receivable');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); 
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    
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
            if (client.category.includes('Semestral')) type = 'semestral';
            else if (client.regime === TaxRegime.RimpeNegocioPopular) type = 'renta';
            else if (client.category.includes('Devolución')) type = 'dev';

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
        { name: 'Cobrable', value: financialData.receivable.reduce((s,i) => s+i.amount, 0), color: '#ef4444' },
        { name: 'Recaudado', value: financialData.collected.reduce((s,i) => s+i.amount, 0), color: '#10b981' }
    ].filter(d => d.value > 0);

    const handleProcessPayment = () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        const nowIso = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
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
            if (lastClient) setReceiptData({ transactionId, clientName: lastClient.name, clientRuc: lastClient.ruc, client: lastClient, paymentDate: format(new Date(), 'PPpp', { locale: es }), paidPeriods, totalAmount: paidPeriods.reduce((s,p) => s+p.amount, 0) });
            setIsReceiptOpen(true);
            toast.success("Pago registrado");
        }, 800);
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-[#0B2149] dark:text-white">Gestiones Tributarias - Santiago Cordova</h2>
                    <p className="text-slate-500 text-sm mt-1">Control de ingresos y cuentas pendientes.</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-red-500 shadow-sm flex-1 min-w-[140px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Por Cobrar</p>
                        <p className="text-xl font-black text-red-600">${financialData.receivable.reduce((s,i) => s+i.amount, 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-emerald-500 shadow-sm flex-1 min-w-[140px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Recaudado (Mes)</p>
                        <p className="text-xl font-black text-emerald-600">${financialData.collected.reduce((s,i) => s+i.amount, 0).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full lg:w-auto">
                    {(['receivable', 'projected', 'collected'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}>
                            {tab === 'receivable' ? 'Por Cobrar' : tab === 'projected' ? 'Proyección' : 'Ingresos'}
                        </button>
                    ))}
                </div>
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm" />
                </div>
                <button onClick={() => setIsRecalculating(p => !p)} className="p-2 text-slate-400 hover:text-brand-teal transition-colors"><RefreshCw size={20}/></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 h-fit">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Estado de Cartera</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                    {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <ReTooltip />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {selectedItems.size > 0 && (
                        <button onClick={() => setIsPaymentModalOpen(true)} className="w-full mt-6 py-3 bg-[#0B2149] text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                            <DollarSign size={16}/> Cobrar Seleccionados ({selectedItems.size})
                        </button>
                    )}
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <button onClick={() => {
                            if (selectedItems.size === currentList.length) setSelectedItems(new Set());
                            else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
                        }} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            {selectedItems.size === currentList.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                            Seleccionar Todos
                        </button>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentList.length} Registros</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                        {currentList.map(item => {
                            const key = `${item.clientId}-${item.period}`;
                            const isSelected = selectedItems.has(key);
                            return (
                                <div key={key} onClick={() => activeTab !== 'collected' && (isSelected ? setSelectedItems(s => {const n=new Set(s);n.delete(key);return n;}) : setSelectedItems(s => new Set(s).add(key)))} className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${item.type === 'mensual' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                                            <Layers size={18}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">{item.clientName}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{formatPeriodForDisplay(item.period)} • {item.ruc}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-sm text-slate-900 dark:text-white">${item.amount.toFixed(2)}</p>
                                        <p className={`text-[9px] font-bold uppercase tracking-widest ${item.daysDiff && item.daysDiff > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {item.status === 'Pagada' ? 'Pagado' : item.daysDiff && item.daysDiff > 0 ? `Vencido hace ${item.daysDiff}d` : 'Por vencer'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Confirmar Cobro">
                <div className="p-4 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total a Recaudar</p>
                        <p className="text-4xl font-black text-[#0B2149] dark:text-white">
                            {/* FIX: Added explicit type parameter to reduce to avoid 'unknown' type error when calling toFixed */}
                            ${Array.from(selectedItems).reduce<number>((sum: number, key) => sum + (currentList.find(i => `${i.clientId}-${i.period}` === key)?.amount || 0), 0).toFixed(2)}
                        </p>
                    </div>
                    <button onClick={handleProcessPayment} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                        {isProcessing ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                        Confirmar Transacción
                    </button>
                </div>
            </Modal>

            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Comprobante de Venta">
                {receiptData && (
                    <div className="p-4">
                        <div ref={receiptRef} className="bg-white p-6 rounded-xl border border-slate-200 text-slate-800 font-mono text-xs">
                            <div className="text-center mb-6">
                                <p className="font-bold text-lg uppercase">{defaultBusinessProfile.businessName}</p>
                                <p>{defaultBusinessProfile.address}</p>
                                <p>RUC: {defaultBusinessProfile.ruc}</p>
                                <p className="mt-4 border-b border-dashed pb-2 font-bold uppercase">Nota de Venta No. {receiptData.transactionId}</p>
                            </div>
                            <div className="space-y-1 mb-6">
                                <p>CLIENTE: {receiptData.clientName}</p>
                                <p>RUC/CI: {receiptData.clientRuc}</p>
                                <p>FECHA: {receiptData.paymentDate}</p>
                            </div>
                            <table className="w-full mb-6">
                                <thead className="border-b border-dashed">
                                    <tr><th className="text-left py-2">DESCRIPCION</th><th className="text-right py-2">TOTAL</th></tr>
                                </thead>
                                <tbody>
                                    {receiptData.paidPeriods.map((p,i) => <tr key={i}><td className="py-2">HONORARIOS PROF. {p.period}</td><td className="text-right">${p.amount.toFixed(2)}</td></tr>)}
                                </tbody>
                            </table>
                            <div className="text-right font-bold text-sm border-t border-dashed pt-2">
                                TOTAL: ${receiptData.totalAmount.toFixed(2)}
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => printSalesNote(receiptData, defaultBusinessProfile)} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Printer size={18}/> Imprimir</button>
                            <button onClick={() => setIsReceiptOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cerrar</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
