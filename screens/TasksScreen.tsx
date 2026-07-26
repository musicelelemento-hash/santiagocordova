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
        <div className="space-y-6 animate-fade-in relative pb-24 pt-4 sm:pt-0">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                            <span className="text-xs font-semibold text-brand-teal uppercase tracking-widest">Active Operations</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Santiago Cordova Protocol</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-tight sm:leading-[0.85] tracking-tighter mb-2">
                        Tactical <span className="text-brand-teal">Tasks</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium uppercase tracking-widest">
                        <Activity size={12} className="text-brand-teal" />
                        <span>Gestión y Despliegue de Obligaciones</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto animate-fade-in-right">
                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <button 
                            onClick={() => setActiveTab('all')} 
                            className={`px-6 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl ring-1 ring-brand-teal/30 scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            General
                        </button>
                        <button 
                            onClick={() => setActiveTab('orders')} 
                            className={`px-6 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all relative ${activeTab === 'orders' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xl ring-1 ring-brand-teal/30 scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            Work Orders
                            {stats.orders > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg">{stats.orders}</span>}
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => openAndPrepareModal()} 
                        className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-semibold uppercase tracking-[0.2em]"
                    >
                        <Plus size={18} className="text-brand-teal" />
                        NUEVA TAREA
                    </button>
                </div>
            </div>

            {/* ZENITH TASK STRIP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                            <Briefcase size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carga Total</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">{stats.total}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Registradas
                    </span>
                </div>

                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20">
                            <Zap size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Work Orders</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">{stats.orders}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Pendientes PDF
                    </span>
                </div>

                <div className="p-5 rounded-[2rem] bg-surface border border-outline-variant/30 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Vencimientos Próximos</p>
                            <p className="text-2xl font-black text-on-surface font-mono tracking-tight">{stats.urgent}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Urgent (&le; 3d)
                    </span>
                </div>
            </div>

            {/* SEARCH TACTICAL SCANNER */}
            <div className="relative group z-10 px-1 sm:px-0">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-teal transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="IDENTIFICADOR / CLIENTE / RUC..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-14 pr-6 py-4 sm:py-5 bg-white/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl text-[11px] font-semibold uppercase tracking-widest placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal/30 transition-all text-slate-900 dark:text-white"
                />
            </div>

            {taskFilter?.clientId && (
                <button 
                    onClick={clearTaskFilter} 
                    className="flex items-center gap-2 px-6 py-2 bg-rose-400/10 text-rose-400 border border-rose-400/20 rounded-full text-xs font-semibold uppercase tracking-widest hover:bg-rose-400/20 transition-all w-fit"
                > 
                    <X size={14} /> REMOVE CLIENT SECTOR LOCK
                </button>
            )}

            {/* TASK COMMAND LIST */}
            <div className="space-y-6 relative z-10">
                {filteredTasks.length > 0 ? filteredTasks.map((task, index) => {
                    const client = task.clientId ? clients.find(c => c.id === task.clientId) : null;
                    const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isAuto = (task as any).isAutoGenerated;
                    
                    let statusColor = 'bg-slate-500';
                    let statusLabel: string = task.status;
                    let glowColor = 'shadow-slate-500/20';

                    if (isAuto) {
                        statusColor = 'bg-orange-500';
                        statusLabel = 'ORDEN TÁCTICA';
                        glowColor = 'shadow-orange-500/30';
                    } else if (task.status === TaskStatus.Completada || task.status === TaskStatus.Pagada) {
                        statusColor = 'bg-emerald-400';
                        glowColor = 'shadow-emerald-400/20';
                    } else if (daysUntilDue < 0) {
                        statusColor = 'bg-rose-400';
                        glowColor = 'shadow-rose-400/30';
                    } else if (daysUntilDue <= 3) {
                        statusColor = 'bg-amber-400';
                        glowColor = 'shadow-amber-400/30';
                    }

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)} 
                            className={`
                                group relative p-6 sm:p-8 rounded-[1.8rem] sm:rounded-[2.5rem] glass-tactical border-white/5 
                                transition-all duration-500 hover:bg-white/10 hover:border-sky-400/30 
                                cursor-pointer overflow-hidden animate-slide-up-fade
                                ${isAuto ? 'border-l-[12px] border-orange-500' : ''}
                            `}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {!isAuto && (
                                <div className={`absolute top-0 left-0 bottom-0 w-2 ${statusColor} opacity-50 shadow-2xl ${glowColor}`} />
                            )}
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                                <div className="flex items-start gap-6 flex-1 min-w-0">
                                    <div className={`
                                        w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                                        ${isAuto ? 'bg-orange-500 text-white shadow-orange-500/20' : 
                                          task.status === TaskStatus.Completada ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 
                                          'bg-white/5 text-slate-400 border border-white/10'}
                                    `}>
                                        {isAuto ? <Zap size={28} className="animate-pulse" /> : 
                                         task.status === TaskStatus.Completada ? <CheckCircle size={28} /> : 
                                         <FileText size={28} />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full text-white uppercase tracking-widest shadow-lg ${statusColor} ${glowColor}`}>
                                                {statusLabel}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest opacity-50">NODE • {task.id.substring(0, 8)}</span>
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-display font-semibold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-sky-400 transition-colors uppercase">
                                            {task.title}
                                        </h3>
                                        
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <div className="p-1.5 bg-white/5 rounded-lg">
                                                    <User size={14} className="text-sky-400/50" />
                                                </div>
                                                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                                                    {client ? client.name : (task.nonClientName || 'Externo Factor')}
                                                </span>
                                            </div>

                                            {client?.phones && client.phones.length > 0 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); window.open(getWhatsAppUrl(client.phones![0]), '_blank'); }} 
                                                    className="group/wa flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-[0.2em] px-4 py-2 rounded-xl bg-emerald-400/5 hover:bg-emerald-400/10 border border-emerald-400/10 transition-all"
                                                >
                                                    <MessageSquare size={14} className="group-hover/wa:scale-110 transition-transform" /> 
                                                    DIRECT COMMS
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-6 shrink-0">
                                    <div className="flex flex-col items-end px-6 py-3 rounded-2xl bg-white/5 border border-white/5 group-hover:border-sky-400/20 transition-all">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3em] mb-1">DEADLINE</span>
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className={daysUntilDue < 0 && task.status !== TaskStatus.Completada ? 'text-rose-400' : 'text-slate-500'} />
                                            <span className={`text-sm font-semibold tracking-tight ${daysUntilDue < 0 && task.status !== TaskStatus.Completada ? 'text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                                                {safeFormat(task.dueDate, 'dd MMM, yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        {isAuto && (
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setUploadingTask(task); 
                                                    fileInputRef.current?.click(); 
                                                }} 
                                                className="flex items-center gap-3 px-8 py-3.5 bg-sky-500 text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-sky-500/40 hover:scale-105 hover:bg-sky-400 active:scale-95 transition-all"
                                                disabled={isAnalyzingPdf && uploadingTask?.id === task.id}
                                            >
                                                {(isAnalyzingPdf && uploadingTask?.id === task.id) ? (
                                                    <span className="animate-pulse">PROCESANDO...</span>
                                                ) : (
                                                    <><UploadCloud size={16} /> SUBIR PDF</>
                                                )}
                                            </button>
                                        )}
                                        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:border-sky-400/30 transition-all"
                                             onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                                        >
                                            <ArrowRight size={20} className="text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20 text-center animate-pulse">
                        <div className="w-24 h-24 rounded-[3rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10">
                            <Shield size={40} />
                        </div>
                        <p className="text-[12px] font-semibold tracking-[0.5em] uppercase text-slate-400">Security Clearance High • No Pending Tasks</p>
                    </div>
                )}
            </div>

            {/* NEW TASK MODAL OVERALL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="TACTICAL PROTOCOL: NEW TASK" disableBackdropClick={true}>
                <div className="space-y-6 pt-4">
                    <div className="group">
                        <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2 block">Objective Description</label>
                        <input 
                            type="text" 
                            value={newTask.title || ''} 
                            onChange={e => handleNewTaskTitleChange(e.target.value)} 
                            className="w-full h-14 px-6 bg-slate-900/50 dark:bg-black/50 border border-white/10 focus:border-sky-400/50 rounded-2xl text-sm font-medium text-white transition-all outline-none" 
                            placeholder="Ej: Devolución Renta 2024..." 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2 block">Deployment Date</label>
                            <input 
                                type="date" 
                                value={newTask.dueDate ? safeFormat(newTask.dueDate, 'yyyy-MM-dd') : ''} 
                                onChange={e => setNewTask({ ...newTask, dueDate: new Date(e.target.value).toISOString() })} 
                                className="w-full h-14 px-6 bg-slate-900/50 dark:bg-black/50 border border-white/10 focus:border-sky-400/50 rounded-2xl text-sm font-medium text-white transition-all outline-none" 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2 block">Sector Targeting</label>
                            <select 
                                value={isNonClient ? 'non-client' : (newTask.clientId || '')} 
                                onChange={handleClientSelectionChange} 
                                className="w-full h-14 px-6 bg-slate-900/50 dark:bg-black/50 border border-white/10 focus:border-sky-400/50 rounded-2xl text-sm font-medium text-white transition-all outline-none appearance-none"
                            >
                                <option value="">Select Target...</option>
                                {sortedClients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                                <option value="non-client">+ External Operative</option>
                            </select>
                        </div>
                    </div>

                    {isNonClient && (
                        <div className="space-y-4 p-6 bg-sky-400/5 rounded-[1.5rem] border border-sky-400/20 animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 mb-2">
                                <User size={14} className="text-sky-400" />
                                <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">External Data Profile</span>
                            </div>
                            <input type="text" placeholder="Full Name" value={newTask.nonClientName || ''} onChange={e => setNewTask({ ...newTask, nonClientName: e.target.value })} className="w-full h-14 px-6 bg-black/30 border border-white/5 rounded-2xl text-sm font-medium text-white outline-none" />
                            <input type="text" placeholder="RUC / ID Number" value={newTask.nonClientRuc || ''} onChange={e => setNewTask({ ...newTask, nonClientRuc: e.target.value })} className="w-full h-14 px-6 bg-black/30 border border-white/5 rounded-2xl text-sm font-medium text-white outline-none" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1 block">Expected ROI</span>
                            <div className="flex items-center gap-2">
                                <p className="text-xl font-display font-semibold text-white">${(newTask.cost || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1 block">Advance Credit</span>
                            <div className="flex items-center gap-2">
                                <p className="text-xl font-display font-semibold text-emerald-400">${(newTask.advancePayment || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleAddTask} 
                        className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-sky-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        INITIALIZE DEPLOYMENT
                    </button>
                </div>
            </Modal>

            {/* TACTICAL FOOTER LOGO */}
            <div className="fixed bottom-10 right-10 opacity-10 hidden md:block pointer-events-none z-0">
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[12px] font-semibold tracking-[0.5em] text-slate-400 uppercase">Strategic Grid</p>
                        <p className="text-xs font-semibold text-sky-400 tracking-widest uppercase">Encryption Node • SC-OPS</p>
                    </div>
                    <Target size={40} className="text-slate-500" />
                </div>
            </div>

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
