
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Client } from '../types';
import { Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskDetailViewProps {
    task: Task;
    onSave: (updatedTask: Task) => void;
    onBack: () => void;
    clients: Client[];
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task, onSave, onBack, clients }) => {
    const [editedTask, setEditedTask] = useState(task);
    const [isEditing, setIsEditing] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [isNonClient, setIsNonClient] = useState(!task.clientId);

    useEffect(() => {
        setEditedTask(task);
        setIsNonClient(!task.clientId);
    }, [task]);

    const getClientName = (clientId?: string) => clients.find(c => c.id === clientId)?.name || 'N/A';

    const handleSave = () => {
        onSave(editedTask);
        setIsEditing(false);
    };

    const handleCompleteTask = () => {
        onSave({ ...editedTask, status: TaskStatus.Completada });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg animate-slide-up-fade relative" style={{opacity: 0}}>
            {showConfetti && (
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-50 overflow-hidden">
                    {Array.from({ length: 100 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-4"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: '-10px',
                                backgroundColor: ['#FFD700', '#D4AF37', '#00C49F', '#0088FE', '#FF8042'][Math.floor(Math.random() * 5)],
                                animation: `confetti-fall ${1.5 + Math.random()}s ease-out ${Math.random()}s forwards`,
                                transform: `rotate(${Math.random() * 360}deg)`
                            }}
                        />
                    ))}
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="text-gold hover:underline">&larr; Volver a Tareas</button>
                <button onClick={() => setIsEditing(!isEditing)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <Edit size={20} />
                </button>
            </div>
            <h3 className="text-2xl font-display text-gold mb-4">{task.title}</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-500">Título</label>
                    {isEditing ? (
                        <input type="text" value={editedTask.title} onChange={e => setEditedTask({...editedTask, title: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded"/>
                    ) : (
                        <p className="dark:text-white">{editedTask.title}</p>
                    )}
                </div>
                 <div>
                    <label className="text-sm font-bold text-gray-500">Descripción</label>
                    {isEditing ? (
                        <textarea rows={3} value={editedTask.description} onChange={e => setEditedTask({...editedTask, description: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded"/>
                    ) : (
                        <p className="dark:text-white whitespace-pre-wrap">{editedTask.description}</p>
                    )}
                </div>

                <div>
                    <label className="text-sm font-bold text-gray-500">Solicitante</label>
                    {isEditing ? (
                        <>
                            <select 
                                value={isNonClient ? 'non-client' : (editedTask.clientId || '')} 
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'non-client') {
                                        setIsNonClient(true);
                                        setEditedTask(prev => ({ ...prev, clientId: undefined }));
                                    } else {
                                        setIsNonClient(false);
                                        setEditedTask(prev => ({
                                            ...prev, 
                                            clientId: value,
                                            nonClientName: undefined,
                                            nonClientRuc: undefined,
                                            sriPassword: undefined
                                        }));
                                    }
                                }}
                                className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                            >
                                <option value="">Seleccione un cliente...</option>
                                {clients.map(client => (
                                   <option key={client.id} value={client.id}>{client.name}</option>
                               ))}
                               <option value="non-client" className="font-bold text-blue-500">Solicitante Externo</option>
                            </select>
                            {isNonClient && (
                                <div className="space-y-3 p-3 mt-2 border border-dashed border-gold/50 rounded-lg animate-fade-in-down">
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Nombre del Solicitante</label>
                                        <input type="text" value={editedTask.nonClientName || ''} onChange={e => setEditedTask({...editedTask, nonClientName: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                                    </div>
                                     <div>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">RUC/CI del Solicitante</label>
                                        <input type="text" value={editedTask.nonClientRuc || ''} onChange={e => setEditedTask({...editedTask, nonClientRuc: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Clave SRI (opcional)</label>
                                        <input type="password" placeholder="••••••••••" value={editedTask.sriPassword || ''} onChange={e => setEditedTask({...editedTask, sriPassword: e.target.value})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"/>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="dark:text-white">{task.clientId ? getClientName(task.clientId) : task.nonClientName || 'Externo'}</p>
                    )}
                </div>

                {isEditing ? (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="relative">
                            <label className="text-sm font-bold text-gray-500">Valor Tarea</label>
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 mt-3">$</span>
                            <input 
                                type="number" 
                                placeholder="Min $5.00" 
                                value={editedTask.cost || ''} 
                                onChange={e => setEditedTask({...editedTask, cost: parseFloat(e.target.value) || undefined})} 
                                className="w-full p-2 pl-6 mt-1 bg-gray-100 dark:bg-gray-800 rounded"
                                min="5"
                                step="0.01"
                            />
                        </div>
                        <div className="relative">
                            <label className="text-sm font-bold text-gray-500">Abono</label>
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 mt-3">$</span>
                            <input type="number" placeholder="0.00" value={editedTask.advancePayment || ''} onChange={e => setEditedTask({...editedTask, advancePayment: parseFloat(e.target.value) || undefined})} className="w-full p-2 pl-6 mt-1 bg-gray-100 dark:bg-gray-800 rounded"/>
                        </div>
                    </div>
                ) : (
                    (editedTask.cost !== undefined && editedTask.cost > 0) && (
                        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mt-2">
                            <div>
                                <label className="text-sm font-bold text-gray-500">Valor</label>
                                <p className="dark:text-white">${editedTask.cost.toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-500">Abono</label>
                                <p className="dark:text-white">${(editedTask.advancePayment || 0).toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-500">Saldo</label>
                                <p className="font-bold text-gold">${(editedTask.cost - (editedTask.advancePayment || 0)).toFixed(2)}</p>
                            </div>
                        </div>
                    )
                )}

                 <div>
                    <label className="text-sm font-bold text-gray-500">Fecha de Entrega</label>
                    {isEditing ? (
                        <input type="date" value={format(new Date(editedTask.dueDate), 'yyyy-MM-dd')} onChange={e => setEditedTask({...editedTask, dueDate: new Date(e.target.value).toISOString()})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded"/>
                    ) : (
                        <p className="dark:text-white">{format(new Date(editedTask.dueDate), 'eeee, d MMMM yyyy', { locale: es })}</p>
                    )}
                </div>
                 <div>
                    <label className="text-sm font-bold text-gray-500">Estado</label>
                     {isEditing ? (
                        <select value={editedTask.status} onChange={e => setEditedTask({...editedTask, status: e.target.value as TaskStatus})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-800 rounded">
                           {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     ) : (
                        <p className="dark:text-white mt-1">{editedTask.status}</p>
                     )}
                </div>

                {!isEditing && editedTask.status !== TaskStatus.Completada && editedTask.status !== TaskStatus.Pagada && (
                     <div className="mt-6">
                        <button 
                            onClick={handleCompleteTask} 
                            className="w-full p-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-transform transform hover:scale-105"
                        >
                            Marcar como Completada
                        </button>
                    </div>
                )}
                
                {isEditing && <button onClick={handleSave} className="w-full mt-4 p-3 bg-gold text-black font-bold rounded-lg hover:bg-gold-dark transition-colors">Guardar Tarea</button>}
            </div>
        </div>
    );
};
