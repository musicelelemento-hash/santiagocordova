
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { Task, Client, Screen } from './types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface NotificationBellProps {
    tasks: Task[];
    clients: Client[];
    navigate: (screen: Screen, options?: { taskFilter?: { taskId?: string } }) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ tasks, clients, navigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const getClientNameForTask = (task: Task): string => {
        if (task.clientId) {
            return clients.find(c => c.id === task.clientId)?.name || 'Cliente no encontrado';
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
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleTaskClick = (taskId?: string) => {
        navigate('tasks', taskId ? { taskFilter: { taskId } } : undefined);
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={notificationRef}>
            <button onClick={() => setIsOpen(prev => !prev)} className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <Bell className="w-5 h-5" />
                {tasks.length > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                        {tasks.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 border border-gray-200 dark:border-gray-700 animate-fade-in-down">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <h4 className="font-bold text-gray-800 dark:text-gray-100">Tareas Próximas a Vencer</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {tasks.length > 0 ? (
                            <ul>
                                {tasks.map(task => (
                                    <li key={task.id} onClick={() => handleTaskClick(task.id)} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                        <div className="p-3 flex items-start space-x-3">
                                            <div className="mt-1">
                                               <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{task.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{getClientNameForTask(task)}</p>
                                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-medium">
                                                    {/* FIX: Removed 'locale' option as it's not present in the FormatDistanceOptions type definition for this project's date-fns version. */}
                                                    Vence {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No hay tareas próximas a vencer.</p>
                            </div>
                        )}
                    </div>
                     {tasks.length > 0 && (
                        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                           <button onClick={() => handleTaskClick()} className="w-full text-center text-sm font-medium text-gold hover:underline">
                               Ver todas las tareas
                           </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
