
import React, { useMemo, useState, useRef } from 'react';
import { 
    Calendar, DollarSign, ShieldCheck, TrendingUp, 
    Clock, CheckCircle2, AlertCircle, Zap, Bell, 
    BarChart3, Layers, Crown, ScanLine, ExternalLink, Copy, CheckCircle, Printer, MessageCircle, FileText
} from 'lucide-react';
import { Screen, Client, Task, DeclarationStatus, ServiceFeesConfig, ClientCategory, ReceiptData, Declaration } from '../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { ClientCard } from '../components/ClientCard';
import { isPast, getYear, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientServiceFee } from '../services/clientService';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { printSalesNote } from '../services/printService';

interface HomeScreenProps {
  navigate: (screen: Screen, options?: any) => void;
  serviceFees: ServiceFeesConfig;
  clients: Client[];
  tasks: Task[];
}

type DashboardFilter = 'all' | 'monthly' | 'semestral' | 'annual';
type WorkflowStep = 'declare' | 'pay' | 'receipt';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigate, serviceFees, clients, tasks }) => {
    const [filter, setFilter] = useState<DashboardFilter>('all');
    const { setClients, businessProfile } = useAppStore();
    const { toast } = useToast();
    
    // --- WORKFLOW STATE ---
    const [workflowClient, setWorkflowClient] = useState<Client | null>(null);
    const [workflowStep, setWorkflowStep] = useState<WorkflowStep | null>(null);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [activePeriod, setActivePeriod] = useState<string>(''); // Track the exact period being worked on
    
    // --- LÓGICA DE NEGOCIO Y DATOS ---
    const dashboardData = useMemo(() => {
        const today = new Date();
        const activeClients = clients.filter(c => c.isActive !== false);
        const prevYearStr = (today.getFullYear() - 1).toString();

        // 1. Detectar Temporada de Renta (Obligaciones Anuales pendientes)
        const rentaPendingClients = activeClients.filter(c => {
             const hasPaidRenta = c.declarationHistory.some(d => d.period === prevYearStr && d.status === DeclarationStatus.Pagada);
             return !hasPaidRenta;
        });

        const totalRentaRevenue = rentaPendingClients.reduce((sum, c) => sum + getClientServiceFee(c, serviceFees), 0);

        // 2. Filtrado de la Lista Principal
        const filteredList = activeClients.filter(c => {
            if (filter === 'all') return true;
            if (filter === 'monthly') return c.category.includes('Mensual') || c.category === ClientCategory.DevolucionIvaTerceraEdad;
            if (filter === 'semestral') return c.category.includes('Semestral');
            if (filter === 'annual') return c.category.includes('Renta') || c.category.includes('Anual') || getPeriod(c, today).length === 4;
            return true;
        });

        // 3. Ordenamiento por Urgencia
        const getSortableDate = (client: Client): number => {
            const period = getPeriod(client, today);
            const isPaid = client.declarationHistory.some(d => d.period === period && d.status === DeclarationStatus.Pagada);
            if (isPaid) return 9999999999999; 
            const dueDate = getDueDateForPeriod(client, period);
            return dueDate ? dueDate.getTime() : 8888888888888;
        };

        const vipClients = filteredList.filter(c => c.category.includes('Suscripción')).sort((a, b) => getSortableDate(a) - getSortableDate(b));
        
        const urgentPending = filteredList
            .filter(c => !c.category.includes('Suscripción'))
            .filter(c => {
                 if (filter === 'all') {
                     const period = getPeriod(c, today);
                     return !c.declarationHistory.some(d => d.period === period && d.status === DeclarationStatus.Pagada);
                 }
                 return true;
            })
            .sort((a,b) => getSortableDate(a) - getSortableDate(b));

        // KPIs Globales
        const totalPending = activeClients.filter(c => {
            const p = getPeriod(c, today);
            return !c.declarationHistory.some(d => d.period === p && d.status === DeclarationStatus.Pagada);
        }).length;
        
        const totalOverdue = activeClients.filter(c => {
             const p = getPeriod(c, today);
             const d = getDueDateForPeriod(c, p);
             const isPaid = c.declarationHistory.some(dh => dh.period === p && dh.status === DeclarationStatus.Pagada);
             return !isPaid && d && isPast(d);
        }).length;

        return { 
            vipClients, 
            urgentPending,
            totalPending,
            totalOverdue,
            rentaPendingCount: rentaPendingClients.length,
            totalRentaRevenue
        };
    }, [clients, filter, serviceFees]);

    const handleQuickAction = (client: Client, action: 'declare' | 'pay' | 'receipt') => {
        setWorkflowClient(client);
        setWorkflowStep(action);
        
        // Determine the target period
        const period = getPeriod(client, new Date());
        setActivePeriod(period);

        // Pre-fill receipt data if just viewing receipt
        if (action === 'receipt') {
            const decl = client.declarationHistory.find(d => d.period === period);
            if (decl) {
                prepareReceiptData(client, decl);
            }
        }
    };

    const prepareReceiptData = (client: Client, decl: Declaration) => {
        const fee = decl.amount ?? getClientServiceFee(client, serviceFees);
        setReceiptData({
            transactionId: decl.transactionId || `TRX-${decl.period}`,
            clientName: client.name,
            clientRuc: client.ruc,
            client: client,
            paymentDate: format(new Date(decl.paidAt || new Date()), 'dd MMMM yyyy, HH:mm', { locale: es }),
            paidPeriods: [{ period: decl.period, amount: fee }],
            totalAmount: fee,
        });
    };

    const handleConfirmDeclaration = () => {
        if (!workflowClient || !activePeriod) return;
        const now = new Date();
        
        // Ensure we work with fresh data from the store just in case, though workflowClient should be synced
        // To be safe, we reconstruct the object for the update
        
        const updatedHistory = [...workflowClient.declarationHistory];
        const existingIdx = updatedHistory.findIndex(d => d.period === activePeriod);
        
        const newDecl: Declaration = {
            period: activePeriod,
            status: DeclarationStatus.Enviada,
            updatedAt: now.toISOString(),
            declaredAt: now.toISOString(),
            // Preserve payment info if for some reason it exists (unlikely in this flow but good practice)
            paidAt: existingIdx > -1 ? updatedHistory[existingIdx].paidAt : undefined,
            transactionId: existingIdx > -1 ? updatedHistory[existingIdx].transactionId : undefined,
            amount: existingIdx > -1 ? updatedHistory[existingIdx].amount : undefined,
        };

        if (existingIdx > -1) updatedHistory[existingIdx] = newDecl;
        else updatedHistory.push(newDecl);
        
        const updatedClient = { ...workflowClient, declarationHistory: updatedHistory };
        
        // Persist
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setWorkflowClient(updatedClient); // Update local modal state
        
        toast.success("Declaración registrada como ENVIADA");
        setWorkflowStep('pay'); // Auto-advance to payment step offer
    };

    const handleConfirmPayment = () => {
        if (!workflowClient || !activePeriod) return;
        const now = new Date();
        const fee = getClientServiceFee(workflowClient, serviceFees);
        
        const updatedHistory = [...workflowClient.declarationHistory];
        const existingIdx = updatedHistory.findIndex(d => d.period === activePeriod);
        
        const newDecl: Declaration = {
            period: activePeriod,
            status: DeclarationStatus.Pagada,
            updatedAt: now.toISOString(),
            paidAt: now.toISOString(),
            amount: fee,
            transactionId: `PAY-${Date.now().toString().slice(-6)}`,
            // Preserve declared date if it exists
            declaredAt: existingIdx > -1 ? updatedHistory[existingIdx].declaredAt : now.toISOString(), 
        };

        if (existingIdx > -1) updatedHistory[existingIdx] = newDecl;
        else updatedHistory.push(newDecl);
        
        const updatedClient = { ...workflowClient, declarationHistory: updatedHistory };
        
        // Persist
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setWorkflowClient(updatedClient);
        
        prepareReceiptData(updatedClient, newDecl);
        toast.success("Pago registrado correctamente");
        setWorkflowStep('receipt'); // Auto-advance to receipt
    };

    const handleCloseWorkflow = () => {
        setWorkflowClient(null);
        setWorkflowStep(null);
        setReceiptData(null);
        setActivePeriod('');
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in relative">
            {/* 1. HEADER & KPI STRIP */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-navy rounded-full text-white text-xs font-bold uppercase tracking-widest mb-2 shadow-lg shadow-brand-navy/20">
                        <ShieldCheck size={12} className="text-brand-teal"/>
                        Gestión Fiscal {getYear(new Date())}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-black text-slate-800 dark:text-white leading-tight">
                        Panel de <span className="text-brand-teal">Operaciones</span>
                    </h1>
                </div>
                
                <div className="flex gap-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                     <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendientes</p>
                        <p className="text-2xl font-mono font-black text-brand-navy dark:text-white">{dashboardData.totalPending}</p>
                     </div>
                     <div className="w-px bg-slate-200 dark:bg-slate-700 h-10 self-center"></div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Críticos</p>
                        <p className="text-2xl font-mono font-black text-red-600">{dashboardData.totalOverdue}</p>
                     </div>
                </div>
            </header>

            {/* 2. WIDGET TEMPORADA DE RENTA (Dinámico) */}
            {dashboardData.rentaPendingCount > 0 && new Date().getMonth() <= 4 && (
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/30 border border-white/10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse-slow"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 opacity-20 rounded-full blur-3xl -ml-10 -mb-10"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
                                <TrendingUp size={32} className="text-indigo-300"/>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-2xl font-black font-display">Temporada de Renta</h3>
                                    <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Campaña</span>
                                </div>
                                <p className="text-indigo-200 font-medium text-sm">Gestión Anual {getYear(new Date()) - 1} • {dashboardData.rentaPendingCount} clientes por declarar.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-8 bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1">Clientes</p>
                                <p className="text-2xl font-mono font-black">{dashboardData.rentaPendingCount}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Potencial</p>
                                <p className="text-2xl font-mono font-black text-emerald-400">${dashboardData.totalRentaRevenue.toFixed(0)}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setFilter('annual')} 
                            className="px-8 py-4 bg-white text-indigo-900 font-black rounded-xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 text-sm uppercase tracking-wide flex items-center gap-2"
                        >
                            <Zap size={16} className="fill-current"/>
                            Filtrar Renta
                        </button>
                    </div>
                </div>
            )}

            {/* 3. FILTROS MAESTROS */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {[
                    { id: 'all', label: 'Todo el Panorama', icon: Layers },
                    { id: 'monthly', label: 'Mensual', icon: Calendar },
                    { id: 'semestral', label: 'Semestral', icon: Clock },
                    { id: 'annual', label: 'Renta Anual', icon: DollarSign },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setFilter(item.id as DashboardFilter)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wide transition-all border ${
                            filter === item.id 
                            ? 'bg-brand-navy text-white border-brand-navy shadow-lg shadow-brand-navy/20' 
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-teal hover:text-brand-teal'
                        }`}
                    >
                        <item.icon size={16} />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* 4. CARTERA VIP (Prioridad) */}
            <section className="bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-gradient-to-br from-brand-navy to-slate-900 text-white rounded-2xl shadow-lg shadow-brand-navy/30">
                        <Crown size={24} fill="currentColor" className="text-amber-400"/>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Clientes Suscritos (VIP)</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Atención prioritaria automática</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                     {dashboardData.vipClients.length > 0 ? (
                        dashboardData.vipClients.map(client => (
                            <ClientCard 
                                key={client.id} 
                                client={client} 
                                serviceFees={serviceFees}
                                onView={(c) => navigate('clients', { clientIdToView: c.id })}
                                onQuickAction={handleQuickAction}
                            />
                        ))
                    ) : (
                        <div className="col-span-full p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                            <p className="text-slate-400 italic text-sm">No hay clientes VIP pendientes bajo este filtro.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. GESTIÓN OPERATIVA (Resto de la Cartera) */}
            <section>
                <div className="flex items-center justify-between mb-6 px-2">
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <AlertCircle size={20} className="text-brand-teal"/>
                        {filter === 'all' ? 'Urgencias y Pendientes' : `Pendientes ${filter}`}
                     </h3>
                     <button onClick={() => navigate('calendar')} className="text-xs font-bold text-brand-teal uppercase tracking-widest hover:underline flex items-center gap-1">
                        Ver Calendario <Calendar size={12}/>
                     </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {dashboardData.urgentPending.length > 0 ? (
                        dashboardData.urgentPending.slice(0, 20).map(client => (
                            <ClientCard 
                                key={client.id} 
                                client={client} 
                                serviceFees={serviceFees}
                                onView={(c) => navigate('clients', { clientIdToView: c.id })}
                                onQuickAction={handleQuickAction}
                            />
                        ))
                    ) : (
                        <div className="col-span-full p-12 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 text-center">
                            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4"/>
                            <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Todo bajo control</h4>
                            <p className="text-emerald-600/80 text-sm mt-1">No hay vencimientos pendientes en esta categoría.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 6. ACCESOS RÁPIDOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                {/* NEW SCANNER BUTTON */}
                <button onClick={() => navigate('scanner')} className="p-6 bg-brand-teal text-white rounded-[2rem] shadow-xl shadow-teal-500/20 hover:scale-[1.02] transition-transform text-left group border border-white/10">
                    <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                        <ScanLine size={24}/>
                    </div>
                    <span className="block font-bold text-lg leading-none mb-1">Importar</span>
                    <span className="block text-xs font-medium opacity-80 uppercase tracking-wider">RUC (PDF/Img)</span>
                </button>

                <button onClick={() => navigate('clients', { initialClientData: {} })} className="p-6 bg-brand-navy rounded-[2rem] text-white shadow-xl shadow-brand-navy/20 hover:scale-[1.02] transition-transform text-left group border border-white/10">
                    <div className="bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-teal group-hover:text-white transition-colors">
                        <Zap size={24}/>
                    </div>
                    <span className="block font-bold text-lg leading-none mb-1">Nuevo</span>
                    <span className="block text-xs font-medium opacity-60 uppercase tracking-wider">Cliente Manual</span>
                </button>

                <button onClick={() => navigate('cobranza')} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 hover:border-green-500 transition-colors text-left group shadow-sm">
                    <div className="bg-slate-100 dark:bg-slate-700 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 group-hover:text-green-500 group-hover:bg-green-500/10 transition-colors">
                        <DollarSign size={24}/>
                    </div>
                    <span className="block font-bold text-slate-700 dark:text-white text-lg leading-none mb-1">Caja</span>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Registrar Pago</span>
                </button>

                <button onClick={() => navigate('reports')} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-colors text-left group shadow-sm">
                    <div className="bg-slate-100 dark:bg-slate-700 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300 group-hover:text-purple-500 group-hover:bg-purple-500/10 transition-colors">
                        <BarChart3 size={24}/>
                    </div>
                    <span className="block font-bold text-slate-700 dark:text-white text-lg leading-none mb-1">Reportes</span>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Análisis IA</span>
                </button>
            </div>

            {/* WORKFLOW MODAL - HANDLES DECLARE & PAY STEPS IN ONE PLACE */}
            {workflowClient && (
                <Modal isOpen={!!workflowClient} onClose={handleCloseWorkflow} title="Gestión Rápida">
                    <div className="space-y-6">
                        {/* HEADER: Client Info */}
                        <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <h4 className="font-bold text-lg text-brand-navy dark:text-white">{workflowClient.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">{workflowClient.ruc}</span>
                                    <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">{workflowClient.regime}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Periodo Gestión</span>
                                <p className="font-bold text-slate-700 dark:text-white">{formatPeriodForDisplay(activePeriod)}</p>
                            </div>
                        </div>

                        {/* STEP 1: DECLARATION */}
                        {workflowStep === 'declare' && (
                            <div className="animate-fade-in space-y-5">
                                <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10 rounded-r-xl">
                                    <h5 className="font-bold text-blue-700 dark:text-blue-300 mb-1">Paso 1: Declaración SRI</h5>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">Copie las credenciales y acceda al portal para realizar la declaración.</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => {navigator.clipboard.writeText(workflowClient.ruc); toast.success("RUC copiado")}} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-teal transition-colors text-left group">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Copiar RUC</span>
                                        <span className="font-mono text-sm font-bold text-slate-700 dark:text-white flex items-center justify-between">
                                            {workflowClient.ruc} <Copy size={14} className="text-slate-300 group-hover:text-brand-teal"/>
                                        </span>
                                    </button>
                                    <button onClick={() => {navigator.clipboard.writeText(workflowClient.sriPassword); toast.success("Clave copiada")}} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-teal transition-colors text-left group">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Copiar Clave</span>
                                        <span className="font-mono text-sm font-bold text-slate-700 dark:text-white flex items-center justify-between">
                                            •••••••• <Copy size={14} className="text-slate-300 group-hover:text-brand-teal"/>
                                        </span>
                                    </button>
                                </div>

                                <button 
                                    onClick={() => window.open("https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT", "_blank")}
                                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={16}/> Abrir SRI en Línea
                                </button>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button 
                                        onClick={handleConfirmDeclaration}
                                        className="w-full py-4 bg-brand-navy text-white font-black rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                                    >
                                        <CheckCircle size={20}/> Confirmar Envío
                                    </button>
                                    <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">Esto actualizará el estado a "ENVIADA" y habilitará el pago.</p>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: PAYMENT */}
                        {workflowStep === 'pay' && (
                            <div className="animate-fade-in space-y-5">
                                 <div className="p-4 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 rounded-r-xl">
                                    <h5 className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">Paso 2: Registro de Pago</h5>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Confirme el pago de honorarios para cerrar el ciclo.</p>
                                </div>

                                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Monto a Cobrar</span>
                                    <p className="text-5xl font-mono font-black text-brand-navy dark:text-white mt-2">
                                        ${getClientServiceFee(workflowClient, serviceFees).toFixed(2)}
                                    </p>
                                </div>

                                <button 
                                    onClick={handleConfirmPayment}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                                >
                                    <DollarSign size={20}/> Confirmar Pago
                                </button>
                                <button 
                                    onClick={handleCloseWorkflow}
                                    className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-sm"
                                >
                                    Omitir por ahora
                                </button>
                            </div>
                        )}

                        {/* STEP 3: RECEIPT */}
                        {workflowStep === 'receipt' && receiptData && (
                            <div className="animate-fade-in text-center space-y-6">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                    <CheckCircle size={32} />
                                </div>
                                
                                <div>
                                    <h3 className="text-2xl font-black text-brand-navy dark:text-white">¡Ciclo Completado!</h3>
                                    <p className="text-slate-500 text-sm mt-1">El pago ha sido registrado exitosamente.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button 
                                        onClick={() => printSalesNote(receiptData, businessProfile)}
                                        className="w-full py-4 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Printer size={20}/> Imprimir Nota de Venta
                                    </button>
                                    
                                    {workflowClient.phones && workflowClient.phones.length > 0 && (
                                        <button 
                                            onClick={() => window.open(`https://wa.me/593${workflowClient.phones![0].substring(1)}?text=${encodeURIComponent(`Estimado ${workflowClient.name}, su pago de $${receiptData.totalAmount} ha sido recibido. Adjuntamos comprobante.`)}`, '_blank')}
                                            className="w-full py-3 bg-green-500 text-white font-bold rounded-xl shadow-md hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle size={18}/> Enviar Confirmación WhatsApp
                                        </button>
                                    )}
                                </div>
                                
                                <button onClick={handleCloseWorkflow} className="text-sm font-bold text-slate-400 hover:text-slate-600 mt-4">Cerrar</button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
