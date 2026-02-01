
import React, { useMemo, useState, useRef } from 'react';
import { Client, DeclarationStatus, ReceiptData, TaxRegime } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, getPeriod } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { differenceInCalendarDays, isSameMonth, parseISO, isValid, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, CheckCircle, MessageSquare, DollarSign, 
    Printer, Search, Loader, TrendingUp, 
    Wallet, Layers, Filter, RefreshCw, CheckSquare, Square
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAppStore } from '../store/useAppStore';
import { Modal } from '../components/Modal';
import { printSalesNote } from '../services/printService';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CobranzaScreenProps {
    autoRegister?: boolean;
    clearAutoAction?: () => void;
}

type TabView = 'receivable' | 'projected' | 'collected';
type ObligationFilter = 'all' | 'mensual' | 'semestral' | 'renta';

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
    isVirtual?: boolean; // Deuda detectada automáticamente
}

export const CobranzaScreen: React.FC<CobranzaScreenProps> = () => {
    const { clients, setClients, serviceFees, businessProfile } = useAppStore();
    const { toast } = useToast();

    // UI States
    const [activeTab, setActiveTab] = useState<TabView>('receivable');
    const [obligationFilter, setObligationFilter] = useState<ObligationFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);
    
    // Actions State
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); 
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Transferencia');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Receipt Logic
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    // --- MOTOR DE AUDITORÍA FINANCIERA (ELITE V2) ---
    const financialData = useMemo(() => {
        const receivable: FinancialItem[] = [];
        const projected: FinancialItem[] = [];
        const collected: FinancialItem[] = [];
        const now = new Date();
        const selectedMonth = new Date(); // Asumimos mes actual por defecto para la vista de ingresos

        clients.forEach(client => {
            // Ignorar clientes eliminados o explícitamente inactivos
            if (client.isDeleted || client.isActive === false) return;

            // Calcular tarifa (Si es 0 o undefined, forzar mínimo $5 para evitar ceros en pantalla)
            let fee = getClientServiceFee(client, serviceFees);
            if (fee <= 0) fee = 5.00; 

            // Determinar Tipo de Obligación
            let type: FinancialItem['type'] = 'mensual';
            if (client.category.includes('Semestral') || client.regime === TaxRegime.RimpeEmprendedor) type = 'semestral';
            else if (client.regime === TaxRegime.RimpeNegocioPopular) type = 'renta';
            else if (client.category.includes('Devolución')) type = 'dev';

            // Filtro Global
            if (obligationFilter !== 'all' && type !== obligationFilter && !(obligationFilter === 'renta' && type === 'dev')) return;

            // Mapa para rastrear periodos ya procesados en el historial
            const processedPeriods = new Set<string>();

            // 1. PROCESAR HISTORIAL EXISTENTE
            client.declarationHistory.forEach(decl => {
                processedPeriods.add(decl.period);

                if (decl.status === DeclarationStatus.Pagada) {
                    // INGRESOS (Collected)
                    if (decl.paidAt) {
                        const paidDate = parseISO(decl.paidAt);
                        if (isValid(paidDate) && isSameMonth(paidDate, selectedMonth)) {
                            collected.push({
                                clientId: client.id,
                                clientName: client.name,
                                ruc: client.ruc,
                                period: decl.period,
                                amount: decl.amount || fee,
                                status: DeclarationStatus.Pagada,
                                type,
                                dateReference: paidDate,
                                phones: client.phones || []
                            });
                        }
                    }
                } else if (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pendiente) {
                    // POR COBRAR (Receivable) - Deuda explícita
                    const dueDate = getDueDateForPeriod(client, decl.period) || now;
                    receivable.push({
                        clientId: client.id,
                        clientName: client.name,
                        ruc: client.ruc,
                        period: decl.period,
                        amount: decl.amount || fee,
                        status: decl.status,
                        type,
                        dateReference: dueDate,
                        daysDiff: differenceInCalendarDays(now, dueDate),
                        phones: client.phones || []
                    });
                }
            });

            // 2. DETECCIÓN DE DEUDAS FANTASMA (El caso "Alan")
            // Analizamos si faltan declaraciones recientes que NO están en el historial.
            // Para mensuales: revisamos mes actual y anterior.
            // Para semestrales: revisamos semestre actual.

            const periodsToAudit: string[] = [];

            if (type === 'mensual' || type === 'dev') {
                // Periodo Actual (Proyección)
                periodsToAudit.push(getPeriod(client, now)); 
                // Mes Anterior (Deuda Potencial si hoy > dia de vencimiento del mes pasado)
                periodsToAudit.push(getPeriod(client, subMonths(now, 1)));
            } else if (type === 'semestral') {
                periodsToAudit.push(getPeriod(client, now));
            } else if (type === 'renta') {
                // Renta es anual, se verifica el año en curso
                periodsToAudit.push(getPeriod(client, now));
            }

            periodsToAudit.forEach(p => {
                if (!processedPeriods.has(p)) {
                    // ¡Ajá! Falta este periodo en el historial.
                    const dueDate = getDueDateForPeriod(client, p);
                    
                    // Si no hay fecha de vencimiento (error de config), asumimos fin de mes
                    const effectiveDueDate = dueDate || new Date(); 
                    const diff = differenceInCalendarDays(now, effectiveDueDate);

                    const item: FinancialItem = {
                        clientId: client.id,
                        clientName: client.name,
                        ruc: client.ruc,
                        period: p,
                        amount: fee,
                        status: DeclarationStatus.Pendiente, // Estado virtual
                        type,
                        dateReference: effectiveDueDate,
                        daysDiff: diff,
                        phones: client.phones || [],
                        isVirtual: true
                    };

                    // REGLA DE ORO: 
                    // Si ya pasó la fecha de vencimiento (diff > 0), es DEUDA REAL (Por Cobrar).
                    // Si no ha pasado (diff <= 0), es PROYECCIÓN.
                    if (diff > 0) {
                        receivable.push(item);
                    } else {
                        projected.push(item);
                    }
                }
            });
        });

        // Ordenamiento
        // Por cobrar: Los más atrasados primero
        receivable.sort((a, b) => (b.daysDiff || 0) - (a.daysDiff || 0));
        // Ingresos: Los más recientes primero
        collected.sort((a, b) => b.dateReference.getTime() - a.dateReference.getTime());
        // Proyección: Alfabético
        projected.sort((a, b) => a.clientName.localeCompare(b.clientName));

        return { receivable, projected, collected };
    }, [clients, serviceFees, obligationFilter, isRecalculating]); // Dependencia added: isRecalculating

    // --- CHART DATA ---
    const chartData = useMemo(() => {
        const data = [
            { name: 'Mensual', value: 0, fill: '#00A896' }, // Brand Teal
            { name: 'Semestral', value: 0, fill: '#0B2149' }, // Brand Navy
            { name: 'Renta', value: 0, fill: '#F59E0B' }, // Amber
        ];
        
        const list = activeTab === 'collected' ? financialData.collected : (activeTab === 'receivable' ? financialData.receivable : financialData.projected);
        
        list.forEach(item => {
            if (item.type === 'mensual' || item.type === 'dev') data[0].value += item.amount;
            else if (item.type === 'semestral') data[1].value += item.amount;
            else data[2].value += item.amount;
        });
        
        return data.filter(d => d.value > 0);
    }, [financialData, activeTab]);

    // Filtering List
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

    const totalAmount = currentList.reduce((sum, item) => sum + item.amount, 0);

    // --- HANDLERS ---
    const handleToggleSelect = (key: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setSelectedItems(newSet);
    };

    const handleSelectAll = () => {
        if (selectedItems.size === currentList.length) setSelectedItems(new Set());
        else setSelectedItems(new Set(currentList.map(i => `${i.clientId}-${i.period}`)));
    };

    const handleProcessPayment = () => {
        if (selectedItems.size === 0) return;
        setIsProcessing(true);
        
        const now = new Date().toISOString();
        const transactionId = `PAY-${Date.now().toString().slice(-6)}`;
        let totalPaid = 0;
        let lastClient: Client | null = null;
        let paidPeriods: any[] = [];

        // Clonamos clientes para mutar
        const newClients = [...clients];

        // Recorremos los seleccionados
        selectedItems.forEach(key => {
            // key format: "clientId-period"
            // Nota: Este split es simple, si ID contiene guiones podría fallar. Mejor buscar en currentList.
            const item = currentList.find(i => `${i.clientId}-${i.period}` === key);
            if (!item) return;

            const clientIndex = newClients.findIndex(c => c.id === item.clientId);
            if (clientIndex === -1) return;

            const client = newClients[clientIndex];
            const history = [...client.declarationHistory];
            const existingDeclIndex = history.findIndex(d => d.period === item.period);

            totalPaid += item.amount;
            paidPeriods.push({ period: item.period, amount: item.amount });

            if (existingDeclIndex > -1) {
                // Actualizar existente
                history[existingDeclIndex] = {
                    ...history[existingDeclIndex],
                    status: DeclarationStatus.Pagada,
                    paidAt: now,
                    transactionId,
                    amount: item.amount
                };
            } else {
                // Crear nueva (Vino de virtual/proyección)
                history.push({
                    period: item.period,
                    status: DeclarationStatus.Pagada,
                    updatedAt: now,
                    paidAt: now,
                    declaredAt: now, // Asumimos declarado si paga
                    transactionId,
                    amount: item.amount
                });
            }
            
            // Actualizar cliente en array
            newClients[clientIndex] = { ...client, declarationHistory: history };
            lastClient = newClients[clientIndex];
        });

        setTimeout(() => {
            setClients(newClients);
            setIsProcessing(false);
            setIsPaymentModalOpen(false);
            setSelectedItems(new Set());
            
            if (lastClient) { // Generar recibo del último (o único) cliente
                 setReceiptData({
                    transactionId,
                    clientName: lastClient.name,
                    clientRuc: lastClient.ruc,
                    client: lastClient,
                    paymentDate: format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: es }),
                    paidPeriods: paidPeriods,
                    totalAmount: totalPaid
                });
                setIsReceiptOpen(true);
            }
            toast.success(`Cobro registrado: $${totalPaid.toFixed(2)}`);
            // Forzar recálculo
            setIsRecalculating(p => !p);
        }, 800);
    };

    const handleWhatsAppNotify = (item: FinancialItem) => {
        if (!item.phones[0]) {
            toast.warning("El cliente no tiene teléfono registrado.");
            return;
        }
        const phone = item.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        
        let message = '';
        if (activeTab === 'receivable') {
            message = `Estimado/a ${item.clientName}, le recordamos que su valor pendiente de $${item.amount.toFixed(2)} por la declaración de ${formatPeriodForDisplay(item.period)} está vencido. Agradecemos su pago.`;
        } else if (activeTab === 'projected') {
            message = `Estimado/a ${item.clientName}, se aproxima su declaración de ${formatPeriodForDisplay(item.period)}. Valor estimado: $${item.amount.toFixed(2)}.`;
        } else {
             message = `Estimado/a ${item.clientName}, gracias por su pago de ${formatPeriodForDisplay(item.period)}.`;
        }
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div className="pb-20 space-y-6">
            
            {/* Header Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <Wallet className="text-gold"/> Gestión de Cobranza
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Control financiero en tiempo real.</p>
                </div>
                
                 <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-red-500 shadow-sm min-w-[160px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Por Cobrar</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                            ${financialData.receivable.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-blue-500 shadow-sm min-w-[160px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Proyección</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                             ${financialData.projected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-lg min-w-[160px] text-white">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle size={14}/> <span className="text-xs font-bold uppercase">Recaudado</span>
                        </div>
                        <p className="text-2xl font-black">
                            ${financialData.collected.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full lg:w-auto">
                    <button onClick={() => setActiveTab('receivable')} className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'receivable' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-slate-500'}`}>
                        <AlertTriangle size={14}/> Por Cobrar
                    </button>
                    <button onClick={() => setActiveTab('projected')} className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'projected' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                        <TrendingUp size={14}/> Proyección
                    </button>
                    <button onClick={() => setActiveTab('collected')} className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'collected' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>
                        <Wallet size={14}/> Ingresos
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                    </div>
                    <button onClick={() => setIsRecalculating(p => !p)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-brand-teal" title="Refrescar Datos">
                        <RefreshCw size={16}/>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Left: Chart & Action */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 h-fit">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Composición</h4>
                    <div className="h-48 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '10px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <p className="text-[10px] text-slate-400 font-bold">Total</p>
                            <p className="text-sm font-black text-slate-800 dark:text-white">${totalAmount.toFixed(0)}</p>
                        </div>
                    </div>

                    {activeTab !== 'collected' && selectedItems.size > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 animate-fade-in-up">
                            <p className="text-xs text-slate-500 mb-2 font-medium">Seleccionados: <strong className="text-slate-800 dark:text-white">{selectedItems.size}</strong></p>
                            <button 
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="w-full py-3 bg-brand-teal hover:bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <DollarSign size={16}/> Registrar Pago
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: List */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[10px] font-black text-slate-400 uppercase tracking-wider items-center">
                        <div className="col-span-1 text-center">
                            <button onClick={handleSelectAll}>
                                {selectedItems.size === currentList.length && currentList.length > 0 ? <CheckSquare size={16} className="text-brand-teal"/> : <Square size={16}/>}
                            </button>
                        </div>
                        <div className="col-span-4">Cliente / RUC</div>
                        <div className="col-span-3 text-center">Periodo</div>
                        <div className="col-span-2 text-right">Monto</div>
                        <div className="col-span-2 text-center">Acción</div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[600px]">
                        {currentList.length > 0 ? currentList.map((item) => {
                            const key = `${item.clientId}-${item.period}`;
                            const isSelected = selectedItems.has(key);
                            
                            return (
                                <div key={key} className={`grid grid-cols-12 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                    <div className="col-span-1 text-center">
                                        {activeTab !== 'collected' ? (
                                            <button onClick={() => handleToggleSelect(key)} className={`${isSelected ? 'text-brand-teal' : 'text-slate-300 hover:text-slate-500'}`}>
                                                {isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                            </button>
                                        ) : <CheckCircle size={16} className="text-emerald-500 mx-auto"/>}
                                    </div>
                                    <div className="col-span-4">
                                        <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{item.clientName}</p>
                                        <p className="font-mono text-xs text-slate-400">{item.ruc}</p>
                                    </div>
                                    <div className="col-span-3 text-center">
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                            {formatPeriodForDisplay(item.period)}
                                        </span>
                                        {item.isVirtual && activeTab === 'receivable' && (
                                            <p className="text-[9px] text-red-500 font-bold mt-1">Detectado (Sin Historial)</p>
                                        )}
                                        {!item.isVirtual && item.daysDiff !== undefined && item.daysDiff > 0 && activeTab === 'receivable' && (
                                            <p className="text-[9px] text-red-500 font-bold mt-1">Hace {item.daysDiff} días</p>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <p className="font-mono font-bold text-slate-700 dark:text-white">${item.amount.toFixed(2)}</p>
                                    </div>
                                    <div className="col-span-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleWhatsAppNotify(item)} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors">
                                            <MessageSquare size={14}/>
                                        </button>
                                        {activeTab === 'collected' && (
                                            <button className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                                                <Printer size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Layers size={48} className="mb-4 opacity-20"/>
                                <p className="font-medium text-sm">Todo al día. No hay registros.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Registrar Cobro Masivo">
                <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total a Cobrar</p>
                        <p className="text-4xl font-black text-brand-navy dark:text-white">${
                            currentList.filter(i => selectedItems.has(`${i.clientId}-${i.period}`)).reduce((s, i) => s + i.amount, 0).toFixed(2)
                        }</p>
                        <p className="text-xs text-slate-500 mt-2">{selectedItems.size} items seleccionados</p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Método de Pago</label>
                        <div className="grid grid-cols-3 gap-2">
                             {['Efectivo', 'Transferencia', 'Cheque'].map(m => (
                                 <button 
                                    key={m}
                                    onClick={() => setPaymentMethod(m)}
                                    className={`py-3 rounded-xl text-xs font-bold border transition-all ${paymentMethod === m ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {m}
                                </button>
                             ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleProcessPayment} 
                        disabled={isProcessing}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isProcessing ? <Loader className="animate-spin"/> : <CheckCircle size={20}/>}
                        <span>Confirmar Cobro</span>
                    </button>
                </div>
            </Modal>
            
            {/* Receipt Modal */}
            <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Comprobante Generado">
                {receiptData && (
                    <div className="text-center p-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32}/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">¡Pago Registrado!</h3>
                        <p className="text-slate-500 text-sm mb-6">El cobro se ha guardado correctamente.</p>
                        <div className="flex gap-3">
                             <button onClick={() => printSalesNote(receiptData, businessProfile)} className="flex-1 py-3 bg-brand-navy text-white font-bold rounded-xl flex items-center justify-center gap-2">
                                <Printer size={18}/> Imprimir
                             </button>
                             <button onClick={() => setIsReceiptOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">
                                Cerrar
                             </button>
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
};
