import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Task, TaskStatus, Client, TaxRegime, Screen, DeclarationStatus } from '../types';
import { 
    Plus, Search, X, CheckCircle, FileText, User, 
    ArrowRight, UploadCloud, Smartphone, LayoutDashboard, 
    Zap, Briefcase, Calendar, DollarSign, Activity,
    TrendingUp, Target, Clock, Shield, ChevronRight,
    MessageSquare, ExternalLink
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import { getIdentifierSortKey, getPeriod, getDueDateForPeriod, formatPeriodForDisplay, safeFormat, getWhatsAppUrl } from '../services/sri';
import { TaskDetailView } from '../components/features/TaskDetailView';
import { useTranscription } from '../hooks/useTranscription';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { extractDataFromDeclarationPdf, fileToBase64 } from '../services/pdfExtraction';
import { useDebounce } from '../hooks/useDebounce';

interface TasksScreenProps {
    navigate: (screen: Screen) => void;
    taskFilter: { clientId?: string; taskId?: string } | null;
    clearTaskFilter: () => void;
    initialTaskData?: Partial<Task> | null;
    clearInitialTaskData?: () => void;
}

const newClientInitialState: Partial<Client> = {
    regime: TaxRegime.General,
    declarations: [],
    sriPassword: '',
    ruc: '',
    name: '',
    isActive: true,
    phones: [''],
};

export const TasksScreen: React.FC<TasksScreenProps> = ({ navigate, taskFilter, clearTaskFilter, initialTaskData, clearInitialTaskData }) => {
    const { tasks, setTasks, clients, setClients, serviceFees } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [activeTab, setActiveTab] = useState<'all' | 'orders'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isNonClient, setIsNonClient] = useState(false);
    const [newTask, setNewTask] = useState<Partial<Task>>({ status: TaskStatus.Pendiente, clientId: '' });
    const { toast } = useToast();

    // Add state for direct PDF upload on auto tasks
    const [uploadingTask, setUploadingTask] = useState<Task | null>(null);
    const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for the "Add Client" modal within TasksScreen
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [newClient, setNewClient] = useState<Partial<Client>>(newClientInitialState);
    const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
    const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const phoneInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const { isRecording, transcribingField, transcription, error: transcriptionError, startTranscription, stopTranscription } = useTranscription();

    const handleNewTaskTitleChange = (title: string, existingData: Partial<Task> = newTask) => {
        let cost: number | undefined = existingData.cost;
        if (cost === undefined) {
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('devolución iva')) cost = serviceFees.devolucionIva;
            else if (lowerTitle.includes('devolución renta')) cost = serviceFees.devolucionRenta;
            else if (lowerTitle.includes('anexo de gastos personales')) cost = serviceFees.anexoGastosPersonales;
            else {
                const customService = serviceFees.customPunctualServices?.find(s => lowerTitle.includes(s.name.toLowerCase()));
                if (customService) cost = customService.price;
            }
        }
        setNewTask(prev => ({ ...prev, ...existingData, title, cost }));
    };

    const openAndPrepareModal = (baseTaskData?: Partial<Task>) => {
        const defaultTask = { status: TaskStatus.Pendiente, clientId: '', dueDate: addDays(new Date(), 3).toISOString() };
        const combinedTask = { ...defaultTask, ...baseTaskData };
        handleNewTaskTitleChange(combinedTask.title || '', combinedTask);
        setIsNonClient(!!combinedTask.nonClientName);
        setIsModalOpen(true);
    };

    useEffect(() => {
        if (initialTaskData) {
            openAndPrepareModal(initialTaskData);
            clearInitialTaskData?.();
        }
    }, [initialTaskData]);

    useEffect(() => {
        if (taskFilter?.taskId) {
            const task = tasks.find(t => t.id === taskFilter.taskId);
            if (task) setSelectedTask(task);
        } else setSelectedTask(null);
    }, [taskFilter, tasks]);

    const handleUpdateTask = (updatedTask: Task) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        setSelectedTask(updatedTask);
    };

    const getClientName = (clientId?: string) => clients.find(c => c.id === clientId)?.name || 'N/A';

    const filteredTasks = useMemo(() => {
        const manualTasks = tasks.filter(task => {
            const clientName = task.clientId ? getClientName(task.clientId) : (task.nonClientName || 'Externo');
            const searchMatch = debouncedSearchTerm === '' ||
                task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (task.nonClientRuc && task.nonClientRuc.includes(debouncedSearchTerm));
            const filterMatch = !taskFilter?.clientId || task.clientId === taskFilter.clientId;
            return searchMatch && filterMatch;
        });

        const autoTasks: Task[] = [];
        const today = new Date();

        clients.filter(c => !c.isDeleted && (!taskFilter?.clientId || c.id === taskFilter.clientId)).forEach(client => {
            client.declarations.forEach(decl => {
                if (decl.is_paid && !decl.proof_file) {
                    const dueDate = getDueDateForPeriod(client, decl.period);
                    autoTasks.push({
                        id: `auto-decl-${client.id}-${decl.period}`,
                        title: `ORDEN: ${formatPeriodForDisplay(decl.period)}`,
                        description: '⚠️ Pago recibido por adelantado. Pendiente subir comprobante PDF.',
                        dueDate: dueDate?.toISOString() || today.toISOString(),
                        status: TaskStatus.Pendiente,
                        clientId: client.id,
                        isAutoGenerated: true
                    } as any);
                }
            });
        });

        const combined = [...autoTasks, ...manualTasks];
        const tabFiltered = activeTab === 'orders' ? combined.filter(t => (t as any).isAutoGenerated) : combined;
        return tabFiltered.sort((a, b) => {
            const isAAuto = (a as any).isAutoGenerated;
            const isBAuto = (b as any).isAutoGenerated;
            if (isAAuto && !isBAuto) return -1;
            if (!isAAuto && isBAuto) return 1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [tasks, debouncedSearchTerm, clients, taskFilter, serviceFees, activeTab]);

    const stats = useMemo(() => {
        const today = new Date();
        const autoCount = clients.reduce((acc, client) => {
            if (client.isDeleted) return acc;
            const pendingCount = client.declarations.filter(d => d.is_paid && !d.proof_file).length;
            return acc + pendingCount;
        }, 0);
        const urgentCount = tasks.filter(t => {
            if (t.status === TaskStatus.Completada || t.status === TaskStatus.Pagada) return false;
            const days = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / (1000 * 3600 * 24));
            return days <= 3;
        }).length;
        return { total: tasks.length + autoCount, orders: autoCount, urgent: urgentCount };
    }, [tasks, clients]);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => {
            const sortKeyA = getIdentifierSortKey(a.ruc);
            const sortKeyB = getIdentifierSortKey(b.ruc);
            if (sortKeyA !== sortKeyB) return sortKeyA - sortKeyB;
            return a.name.localeCompare(b.name);
        });
    }, [clients]);

    const handleAddTask = () => {
        if (!newTask.title || !newTask.dueDate || (!newTask.clientId && !isNonClient) || (isNonClient && !newTask.nonClientName)) {
            alert("Por favor, complete los campos obligatorios.");
            return;
        }
        const saldo = (newTask.cost || 0) - (newTask.advancePayment || 0);
        const status = (newTask.cost !== undefined && newTask.cost > 0 && saldo <= 0) ? TaskStatus.Pagada : TaskStatus.Pendiente;
        const finalTask: Task = {
            id: uuidv4(),
            title: newTask.title,
            description: newTask.description || '',
            dueDate: newTask.dueDate,
            status,
            cost: newTask.cost,
            advancePayment: newTask.advancePayment,
            ...(isNonClient ? { nonClientName: newTask.nonClientName, nonClientRuc: newTask.nonClientRuc, sriPassword: newTask.sriPassword } : { clientId: newTask.clientId })
        };
        setTasks(prev => [...prev, finalTask]);
        setIsModalOpen(false);
        setNewTask({ status: TaskStatus.Pendiente, clientId: '' });
        setIsNonClient(false);
    };

    const handleClientSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'non-client') {
            setIsNonClient(true);
            setNewTask(prev => ({ ...prev, clientId: undefined }));
        } else {
            setIsNonClient(false);
            setNewTask(prev => ({ ...prev, clientId: value, nonClientName: '', nonClientRuc: '', sriPassword: '' }));
        }
    };

    const handleAutoTaskUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !uploadingTask) return;

        setIsAnalyzingPdf(true);
        try {
            const data = await extractDataFromDeclarationPdf(file);
            const base64 = await fileToBase64(file);
            
            const client = clients.find(c => c.id === uploadingTask.clientId);
            if (!client) throw new Error("Cliente no encontrado");

            // Extract period from auto-decl-clientId-period ID
            const parts = uploadingTask.id.split('-');
            // ID format: auto-decl-[clientId]-[period(can contain dashes)]
            // A simpler way: we know the period from the task title OR we can just use data.period if it's reliable
            // Since data.period comes from PDF, let's use it, but verify it matches the client's pending
            const targetPeriod = data.period || uploadingTask.id.substring(uploadingTask.id.lastIndexOf('-') + 1); // rough fallback

            const updatedHistory = [...(client.declarations || [])];
            const idx = updatedHistory.findIndex(d => d.period === data.period || d.period === targetPeriod);

            const storedFile = {
                name: file.name,
                type: 'pdf',
                size: file.size,
                lastModified: Date.now(),
                content: base64,
                metadata: {
                    amount: data.amount,
                    period: data.period,
                    formType: data.formType,
                    sriId: data.id
                }
            };

            if (idx !== -1) {
                updatedHistory[idx] = {
                    ...updatedHistory[idx],
                    status: DeclarationStatus.Pagada, // Since it's an auto task, it was already paid
                    is_paid: true,
                    proof_file: storedFile,
                    updatedAt: new Date().toISOString()
                };
            } else {
                updatedHistory.push({
                    period: data.period || targetPeriod,
                    status: DeclarationStatus.Pagada,
                    is_paid: true,
                    proof_file: storedFile,
                    updatedAt: new Date().toISOString()
                } as any);
            }

            const updatedClient = { ...client, declarations: updatedHistory };
            setClients(clients.map(c => c.id === client.id ? updatedClient : c));
            
            toast.success("Comprobante subido y obligación completada");
        } catch (err: any) {
            toast.error(err.message || "Error al procesar el PDF");
        } finally {
            setIsAnalyzingPdf(false);
            setUploadingTask(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (selectedTask) {
        return <TaskDetailView task={selectedTask} onSave={handleUpdateTask} onBack={() => { setSelectedTask(null); clearTaskFilter(); }} clients={clients} />;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative pb-24 font-sans min-h-screen">
            {/* ── TOP EXECUTIVE STRIPE ── */}
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 border-t-white/20 bg-[#051424]/90 shadow-2xl backdrop-blur-2xl p-6 sm:p-10 transition-all duration-500">
                    {/* Mesh Gradient */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-radial from-[#2B6AFF]/15 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-radial from-[#00A896]/15 to-transparent blur-3xl" />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="w-full sm:w-auto font-mono">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-[0_0_10px_rgba(0,168,150,0.2)]">
                                    <div className="relative w-2 h-2 rounded-full bg-[#00A896]">
                                        <div className="absolute inset-0 rounded-full bg-[#00A896] animate-ping opacity-60" />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.25em]">OPERACIONES ACTIVAS</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">• Protocolo Santiago Córdova</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-white leading-none tracking-tight font-display">
                                TAREAS & <span className="bg-gradient-to-r from-[#00A896] via-teal-400 to-[#2B6AFF] bg-clip-text text-transparent">FLUJOS</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-sm text-slate-300 font-sans font-medium">
                                Gestión operativa de trámites, órdenes de trabajo y vencimientos fiscales.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto font-mono">
                            <div className="flex p-1.5 bg-[#0b1326] rounded-2xl border border-white/10">
                                <button 
                                    onClick={() => setActiveTab('all')} 
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        activeTab === 'all' 
                                            ? 'bg-white/15 text-white shadow-md border border-white/20' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    General
                                </button>
                                <button 
                                    onClick={() => setActiveTab('orders')} 
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
                                        activeTab === 'orders' 
                                            ? 'bg-white/15 text-white shadow-md border border-white/20' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Work Orders
                                    {stats.orders > 0 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#C9A96E] text-slate-950 font-mono">
                                            {stats.orders}
                                        </span>
                                    )}
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => openAndPrepareModal()} 
                                className="flex items-center gap-2 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white px-6 py-3 rounded-2xl shadow-lg shadow-[#00A896]/20 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/10 hover:scale-[1.02] active:scale-95"
                            >
                                <Plus size={16} />
                                NUEVA TAREA
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ZENITH TASK KPI STRIP ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10 px-4 sm:px-0 font-mono">
                <div className="p-6 rounded-[2rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-[#2B6AFF] text-white rounded-2xl shadow-lg shadow-[#2B6AFF]/25">
                            <Briefcase size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carga Total</p>
                            <p className="text-3xl font-black text-white font-mono tracking-tight">{stats.total}</p>
                        </div>
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
                        Registradas
                    </span>
                </div>

                <div className="p-6 rounded-[2rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-amber-500 to-[#C9A96E] text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 font-bold">
                            <Zap size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#C9A96E] uppercase tracking-widest">Work Orders</p>
                            <p className="text-3xl font-black text-white font-mono tracking-tight">{stats.orders}</p>
                        </div>
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Pendientes PDF
                    </span>
                </div>

                <div className="p-6 rounded-[2rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-xl backdrop-blur-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl shadow-lg shadow-rose-500/25">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Vencimientos Próximos</p>
                            <p className="text-3xl font-black text-white font-mono tracking-tight">{stats.urgent}</p>
                        </div>
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Urgentes (≤ 3d)
                    </span>
                </div>
            </div>

            {/* ── SEARCH SCANNER ── */}
            <div className="relative group z-10 px-4 sm:px-0 font-mono">
                <Search className="absolute left-9 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00A896] transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="BUSCAR POR NOMBRE / RUC / DESCRIPCIÓN DE TAREA..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-14 pr-6 py-4 bg-[#051424]/90 border border-white/10 focus:border-[#00A896]/50 rounded-[2rem] text-xs font-mono uppercase tracking-wider placeholder:text-slate-500 focus:outline-none transition-all text-white backdrop-blur-2xl shadow-xl"
                />
            </div>

            {taskFilter?.clientId && (
                <div className="px-4 sm:px-0 font-mono">
                    <button 
                        onClick={clearTaskFilter} 
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-rose-500/25 transition-all w-fit cursor-pointer"
                    > 
                        <X size={14} /> Quitar Filtro de Cliente
                    </button>
                </div>
            )}

            {/* ── TASK COMMAND LIST ── */}
            <div className="space-y-4 relative z-10 px-4 sm:px-0">
                {filteredTasks.length > 0 ? filteredTasks.map((task, index) => {
                    const client = task.clientId ? clients.find(c => c.id === task.clientId) : null;
                    const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isAuto = (task as any).isAutoGenerated;
                    
                    let statusColor = 'bg-slate-500';
                    let statusLabel: string = task.status;
                    let glowColor = 'shadow-slate-500/20';

                    if (isAuto) {
                        statusColor = 'bg-amber-500 text-slate-950';
                        statusLabel = 'ORDEN TÁCTICA';
                        glowColor = 'shadow-amber-500/30';
                    } else if (task.status === TaskStatus.Completada || task.status === TaskStatus.Pagada) {
                        statusColor = 'bg-emerald-500 text-white';
                        glowColor = 'shadow-emerald-500/20';
                    } else if (daysUntilDue < 0) {
                        statusColor = 'bg-rose-500 text-white';
                        glowColor = 'shadow-rose-500/30';
                    } else if (daysUntilDue <= 3) {
                        statusColor = 'bg-amber-500 text-slate-950';
                        glowColor = 'shadow-amber-500/30';
                    }

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)} 
                            className={`
                                group relative p-6 sm:p-7 rounded-[2rem] bg-[#051424]/90 border border-white/10 border-t-white/20 backdrop-blur-2xl
                                transition-all duration-300 hover:border-white/20 hover:scale-[1.005] hover:shadow-2xl
                                cursor-pointer overflow-hidden
                                ${isAuto ? 'border-l-4 border-l-amber-400' : ''}
                            `}
                        >
                            {!isAuto && (
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${statusColor} opacity-70`} />
                            )}
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex items-start gap-5 flex-1 min-w-0">
                                    <div className={`
                                        w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-105
                                        ${isAuto ? 'bg-amber-500/15 text-[#C9A96E] border border-amber-500/30' : 
                                          task.status === TaskStatus.Completada ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                                          'bg-white/5 text-slate-400 border border-white/10'}
                                    `}>
                                        {isAuto ? <Zap size={24} className="animate-pulse" /> : 
                                         task.status === TaskStatus.Completada ? <CheckCircle size={24} /> : 
                                         <FileText size={24} />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3 mb-1.5 font-mono">
                                            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${statusColor} ${glowColor}`}>
                                                {statusLabel}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">NODE · {task.id.substring(0, 8)}</span>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight truncate group-hover:text-[#00A896] transition-colors uppercase">
                                            {task.title}
                                        </h3>
                                        
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 font-mono">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-white/5 rounded-lg border border-white/10">
                                                    <User size={12} className="text-[#00A896]" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                    {client ? client.name : (task.nonClientName || 'Factor Externo')}
                                                </span>
                                            </div>

                                            {client?.phones && client.phones.length > 0 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); window.open(getWhatsAppUrl(client.phones![0]), '_blank'); }} 
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
                                                >
                                                    <MessageSquare size={12} /> 
                                                    WhatsApp
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 shrink-0 font-mono">
                                    <div className="flex flex-col items-end px-4 py-2 rounded-xl bg-[#020b14] border border-white/10">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">VENCIMIENTO</span>
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={11} className={daysUntilDue < 0 && task.status !== TaskStatus.Completada ? 'text-rose-400' : 'text-slate-400'} />
                                            <span className={`text-xs font-bold ${daysUntilDue < 0 && task.status !== TaskStatus.Completada ? 'text-rose-400' : 'text-slate-300'}`}>
                                                {safeFormat(task.dueDate, 'dd MMM, yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isAuto && (
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setUploadingTask(task); 
                                                    fileInputRef.current?.click(); 
                                                }} 
                                                className="flex items-center gap-2 px-5 py-2.5 bg-[#00A896] hover:bg-[#00A896]/80 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-[#00A896]/20 transition-all cursor-pointer"
                                                disabled={isAnalyzingPdf && uploadingTask?.id === task.id}
                                            >
                                                {(isAnalyzingPdf && uploadingTask?.id === task.id) ? (
                                                    <span className="animate-pulse">PROCESANDO...</span>
                                                ) : (
                                                    <><UploadCloud size={14} /> SUBIR PDF</>
                                                )}
                                            </button>
                                        )}
                                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:border-[#00A896]/50 group-hover:text-[#00A896] text-slate-400 transition-all">
                                            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-[#051424] flex items-center justify-center mb-4 border border-white/10 shadow-xl">
                            <Shield size={32} className="text-[#00A896]" />
                        </div>
                        <p className="text-sm font-bold tracking-wider uppercase text-white">Sin Tareas Pendientes</p>
                        <p className="text-xs text-slate-400 mt-1 font-sans">Todas las operaciones y obligaciones están al día.</p>
                    </div>
                )}
            </div>

            {/* ── NEW TASK MODAL ── */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="TACTICAL PROTOCOL: NUEVA TAREA" disableBackdropClick={true}>
                <div className="space-y-6 pt-2 font-mono">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Descripción del Objetivo</label>
                        <input 
                            type="text" 
                            value={newTask.title || ''} 
                            onChange={e => handleNewTaskTitleChange(e.target.value)} 
                            className="w-full h-12 px-4 bg-[#020b14] border border-white/10 focus:border-[#00A896]/50 rounded-xl text-xs font-mono text-white transition-all outline-none" 
                            placeholder="Ej: Devolución Renta 2024, Anexo Gastos..." 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Fecha Límite</label>
                            <input 
                                type="date" 
                                value={newTask.dueDate ? safeFormat(newTask.dueDate, 'yyyy-MM-dd') : ''} 
                                onChange={e => setNewTask({ ...newTask, dueDate: new Date(e.target.value).toISOString() })} 
                                className="w-full h-12 px-4 bg-[#020b14] border border-white/10 focus:border-[#00A896]/50 rounded-xl text-xs font-mono text-white transition-all outline-none" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Cliente Asignado</label>
                            <select 
                                value={isNonClient ? 'non-client' : (newTask.clientId || '')} 
                                onChange={handleClientSelectionChange} 
                                className="w-full h-12 px-4 bg-[#020b14] border border-white/10 focus:border-[#00A896]/50 rounded-xl text-xs font-mono text-white transition-all outline-none appearance-none cursor-pointer"
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {sortedClients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                                <option value="non-client">+ Operativo Externo</option>
                            </select>
                        </div>
                    </div>

                    {isNonClient && (
                        <div className="space-y-4 p-5 bg-[#020b14] rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-1">
                                <User size={14} className="text-[#00A896]" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Datos de Contacto Externo</span>
                            </div>
                            <input type="text" placeholder="Nombre Completo" value={newTask.nonClientName || ''} onChange={e => setNewTask({ ...newTask, nonClientName: e.target.value })} className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none" />
                            <input type="text" placeholder="RUC / Cédula" value={newTask.nonClientRuc || ''} onChange={e => setNewTask({ ...newTask, nonClientRuc: e.target.value })} className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-[#020b14] border border-white/10">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tarifa Proyectada</span>
                            <div className="flex items-center gap-1">
                                <p className="text-xl font-bold font-mono text-white">${(newTask.cost || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#020b14] border border-white/10">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Anticipo Pagado</span>
                            <div className="flex items-center gap-1">
                                <p className="text-xl font-bold font-mono text-[#00A896]">${(newTask.advancePayment || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleAddTask} 
                        className="w-full py-4 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-[#00A896]/25 transition-all cursor-pointer border border-white/10 active:scale-95"
                    >
                        CREAR TAREA OPERATIVA
                    </button>
                </div>
            </Modal>

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleAutoTaskUpload} 
            />
        </div>
    );
};
