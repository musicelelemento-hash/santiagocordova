
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { Task, Client, Screen } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationBellProps {
    tasks: Task[];
    clients: Client[];
    navigate: (screen: Screen, options?: { taskFilter?: { taskId?: string } }) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ tasks, clients, navigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const getClientNameForTask = (task: Task): string => {
        if (!Array.isArray(clients)) return 'Cargando...'; // CORRECCIÓN: Evita crash si clients es undefined
        
        if (task.clientId) {
            const found = clients.find(c => c.id === task.clientId);
            return found ? found.name : 'Cliente no encontrado';
        }
        return task.nonClientName || 'Solicitante Externo';
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTaskClick = (taskId?: string) => {
        navigate('tasks', taskId ? { taskFilter: { taskId } } : undefined);
        setIsOpen(false);
    }

    // Filtrar solo tareas de los próximos 3 días que no estén completadas
    const activeNotifications = (tasks || []).filter(t => t.status !== 'Completada' && t.status !== 'Pagada');

    return (
        <div className="relative" ref={notificationRef}>
            <button onClick={() => setIsOpen(prev => !prev)} className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <Bell className="w-5 h-5" />
                {activeNotifications.length > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                        {activeNotifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 border border-gray-100 dark:border-gray-700 animate-fade-in-down overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Notificaciones de Tareas</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {activeNotifications.length > 0 ? (
                            <ul>
                                {activeNotifications.map(task => (
                                    <li key={task.id} onClick={() => handleTaskClick(task.id)} className="border-b border-gray-50 dark:border-gray-700 last:border-b-0 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors p-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                               <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getClientNameForTask(task)}</p>
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-bold uppercase">
                                                    Vence {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true, locale: es })}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full inline-block mb-3">
                                    <Bell size={24} className="text-slate-400" />
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">No tienes tareas pendientes por vencer.</p>
                            </div>
                        )}
                    </div>
                     {activeNotifications.length > 0 && (
                        <div className="p-3 border-t border-gray-100 dark:border-gray-700 text-center">
                           <button onClick={() => handleTaskClick()} className="text-xs font-bold text-brand-teal hover:underline">
                               Ver todo el tablero
                           </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
