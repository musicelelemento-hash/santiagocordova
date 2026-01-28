
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Task, TaskStatus, Client, TaxRegime, ClientCategory, ServiceFeesConfig } from '../types';
import { Plus, Search, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { getIdentifierSortKey } from '../services/sri';
import { TaskDetailView } from '../components/TaskDetailView';
import { useTranscription } from '../hooks/useTranscription';

interface TasksScreenProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  taskFilter: { clientId?: string; taskId?: string } | null;
  clearTaskFilter: () => void;
  serviceFees: ServiceFeesConfig;
  initialTaskData?: Partial<Task> | null;
  clearInitialTaskData?: () => void;
}

const newClientInitialState: Partial<Client> = {
  regime: TaxRegime.General,
  category: ClientCategory.SuscripcionMensual,
  declarationHistory: [],
  sriPassword: '',
  ruc: '',
  name: '',
  isActive: true,
  phones: [''],
};

export const TasksScreen: React.FC<TasksScreenProps> = ({ tasks, setTasks, clients, setClients, taskFilter, clearTaskFilter, serviceFees, initialTaskData, clearInitialTaskData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNonClient, setIsNonClient] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({ status: TaskStatus.Pendiente, clientId: ''});
  
  // State for the "Add Client" modal within TasksScreen
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>(newClientInitialState);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const phoneInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { isRecording, transcribingField, transcription, error: transcriptionError, startTranscription, stopTranscription } = useTranscription();
  const initialTranscriptionValues = useRef<Partial<Record<string, string>>>({});
  
  const phoneCount = (newClient.phones || []).length;
  useEffect(() => {
    // Focus the new phone input field when it's added
    if (phoneCount > 1 && (newClient.phones || [])[phoneCount - 1] === '' && phoneInputRefs.current[phoneCount - 1]) {
        phoneInputRefs.current[phoneCount - 1]?.focus();
    }
  }, [phoneCount]);
  
    const handleNewTaskTitleChange = (title: string, existingData: Partial<Task> = newTask) => {
        let cost: number | undefined = existingData.cost; // Preserve cost if it comes from HomeScreen

        if (cost === undefined) {
            const lowerTitle = title.toLowerCase();

            if (lowerTitle.includes('devolución iva')) {
                cost = serviceFees.devolucionIva;
            } else if (lowerTitle.includes('devolución renta')) {
                cost = serviceFees.devolucionRenta;
            } else if (lowerTitle.includes('anexo de gastos personales') || lowerTitle.includes('anexo gastos')) {
                cost = serviceFees.anexoGastosPersonales;
            } else {
                const customService = serviceFees.customPunctualServices?.find(s => lowerTitle.includes(s.name.toLowerCase()));
                if (customService) {
                    cost = customService.price;
                }
            }
        }
        
        setNewTask(prev => ({ ...prev, ...existingData, title, cost }));
    };

    const openAndPrepareModal = (baseTaskData?: Partial<Task>) => {
        const defaultTask = {
            status: TaskStatus.Pendiente,
            clientId: '',
            dueDate: addDays(new Date(), 3).toISOString()
        };
        const combinedTask = {...defaultTask, ...baseTaskData};
        
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
            if (task) {
                setSelectedTask(task);
            }
        } else {
            setSelectedTask(null);
        }
    }, [taskFilter, tasks]);

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask); // Keep detail view open with updated data
  };

  const getClientName = (clientId?: string) => clients.find(c => c.id === clientId)?.name || 'N/A';

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const clientName = task.clientId ? getClientName(task.clientId) : (task.nonClientName || 'Externo');
        const searchMatch = searchTerm === '' ||
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.nonClientRuc && task.nonClientRuc.includes(searchTerm));
        
        const filterMatch = !taskFilter?.clientId || task.clientId === taskFilter.clientId;

        return searchMatch && filterMatch;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks, searchTerm, clients, taskFilter]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a,b) => {
        const sortKeyA = getIdentifierSortKey(a.ruc);
        const sortKeyB = getIdentifierSortKey(b.ruc);
        if (sortKeyA !== sortKeyB) {
            return sortKeyA - sortKeyB;
        }
        return a.name.localeCompare(b.name);
    });
  }, [clients]);

    const handleAddTask = () => {
        if (!newTask.title || !newTask.dueDate || (!newTask.clientId && !isNonClient) || (isNonClient && !newTask.nonClientName)) {
            alert("Por favor, complete los campos obligatorios: Descripción, Fecha de Entrega y Cliente/Solicitante.");
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
            ...(isNonClient ? {
                nonClientName: newTask.nonClientName,
                nonClientRuc: newTask.nonClientRuc,
                sriPassword: newTask.sriPassword,
            } : {
                clientId: newTask.clientId,
            })
        };
        setTasks(prev => [...prev, finalTask]);
        setIsModalOpen(false);
        setNewTask({ status: TaskStatus.Pendiente, clientId: '' });
        setIsNonClient(false);
    };
    
    const setDueDateQuick = (days: number) => {
        setNewTask(prev => ({...prev, dueDate: addDays(new Date(), days).toISOString()}));
    };
    
    const handleClientSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'non-client') {
            setIsNonClient(true);
            setNewTask(prev => ({...prev, clientId: undefined}));
        } else {
            setIsNonClient(false);
            setNewTask(prev => ({...prev, clientId: value, nonClientName: '', nonClientRuc: '', sriPassword: ''}));
        }
    };

    if (selectedTask) {
        return <TaskDetailView task={selectedTask} onSave={handleUpdateTask} onBack={() => { setSelectedTask(null); clearTaskFilter(); }} clients={clients} />;
    }

    const saldo = (newTask.cost || 0) - (newTask.advancePayment || 0);

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-display text-gold mb-2 sm:mb-0">Gestión de Tareas</h2>
                <button onClick={() => openAndPrepareModal()} className="flex items-center space-x-2 bg-gold text-black px-4 py-2 rounded-lg shadow-md hover:bg-gold-dark transition-colors">
                    <Plus size={20} />
                    <span>Nueva Tarea</span>
                </button>
            </div>
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por título, cliente o RUC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-gold focus:outline-none transition-colors"
                />
            </div>

            {taskFilter?.clientId && <button onClick={clearTaskFilter} className="mb-4 flex items-center text-sm text-gold hover:underline"> <X size={16} className="mr-1"/> Quitar filtro</button>}

            <div className="space-y-3">
                {filteredTasks.map((task, index) => {
                    const client = task.clientId ? clients.find(c => c.id === task.clientId) : null;
                    const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    let borderColor = 'dark:border-gray-700 border-gray-200';
                    if (task.status !== TaskStatus.Completada && task.status !== TaskStatus.Pagada) {
                         if (daysUntilDue < 0) borderColor = 'border-red-500';
                         else if (daysUntilDue <= 3) borderColor = 'border-yellow-500';
                    }

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)} 
                            className={`p-3 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-px bg-white dark:bg-gray-800 border-l-4 ${borderColor} cursor-pointer animate-slide-up-fade`}
                            style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold dark:text-white">{task.title}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{client ? client.name : task.nonClientName}</p>
                                </div>
                                <div className="text-right text-xs">
                                    <p className={`font-semibold ${daysUntilDue < 0 ? 'text-red-500' : 'dark:text-gray-300'}`}>
                                        Vence: {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                                    </p>
                                    <p className={`px-2 py-1 mt-1 inline-block rounded-full text-xs font-medium ${
                                        task.status === TaskStatus.Completada ? 'bg-green-500/20 text-green-500' : 
                                        task.status === TaskStatus.Pagada ? 'bg-blue-500/20 text-blue-500' :
                                        'bg-gray-400/20 text-gray-500'
                                    }`}>{task.status}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nueva Tarea">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
                        <input type="text" value={newTask.title || ''} onChange={e => handleNewTaskTitleChange(e.target.value)} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded" placeholder="Ej: Devolución IVA 3ra Edad..."/>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Entrega</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <input type="date" value={newTask.dueDate ? format(new Date(newTask.dueDate), 'yyyy-MM-dd') : ''} onChange={e => setNewTask({...newTask, dueDate: new Date(e.target.value).toISOString()})} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded"/>
                            <button onClick={() => setDueDateQuick(3)} className="px-2 py-1 text-xs rounded bg-gold/20 text-gold hover:bg-gold/30">+3d</button>
                            <button onClick={() => setDueDateQuick(7)} className="px-2 py-1 text-xs rounded bg-gold/20 text-gold hover:bg-gold/30">+7d</button>
                            <button onClick={() => setDueDateQuick(15)} className="px-2 py-1 text-xs rounded bg-gold/20 text-gold hover:bg-gold/30">+15d</button>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente / Solicitante</label>
                        <select value={isNonClient ? 'non-client' : (newTask.clientId || '')} onChange={handleClientSelectionChange} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded">
                           <option value="">Seleccione un cliente...</option>
                           {sortedClients.map(client => (
                               <option key={client.id} value={client.id}>{client.name}</option>
                           ))}
                           <option value="non-client" className="font-bold text-blue-500 dark:text-blue-400 mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">+ Agregar Solicitante Externo</option>
                        </select>
                    </div>
                    {isNonClient && (
                        <div className="space-y-3 p-3 border border-dashed border-gold/50 rounded-lg animate-fade-in-down">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Solicitante</label>
                                <input type="text" value={newTask.nonClientName || ''} onChange={e => setNewTask({...newTask, nonClientName: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                            </div>
                             <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">RUC/CI del Solicitante</label>
                                <input type="text" value={newTask.nonClientRuc || ''} onChange={e => setNewTask({...newTask, nonClientRuc: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Clave SRI (opcional)</label>
                                <input type="password" placeholder="••••••••••" value={newTask.sriPassword || ''} onChange={e => setNewTask({...newTask, sriPassword: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor Tarea</label>
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 mt-3">$</span>
                            <input type="number" placeholder="0.00" value={newTask.cost || ''} onChange={e => setNewTask({...newTask, cost: parseFloat(e.target.value) || undefined})} className="w-full p-2 pl-6 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                        </div>
                         <div className="relative">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Abono</label>
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 mt-3">$</span>
                            <input type="number" placeholder="0.00" value={newTask.advancePayment || ''} onChange={e => setNewTask({...newTask, advancePayment: parseFloat(e.target.value) || undefined})} className="w-full p-2 pl-6 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                        </div>
                    </div>

                    {(newTask.cost !== undefined && newTask.cost > 0) && (
                        <div className="mt-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Saldo Pendiente</label>
                            <p className={`w-full p-2 font-bold text-lg ${saldo <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ${saldo.toFixed(2)}
                            </p>
                        </div>
                    )}

                    <button onClick={handleAddTask} className="w-full mt-4 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark transition-colors">
                        Guardar Tarea
                    </button>
                </div>
            </Modal>
        </div>
    );
};
