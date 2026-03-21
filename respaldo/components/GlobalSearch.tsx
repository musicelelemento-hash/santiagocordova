
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CheckSquare, ArrowRight, Zap, Briefcase } from 'lucide-react';
import { Client, Task, Screen } from '../types';
import { useDebounce } from '../hooks/useDebounce';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    tasks: Task[];
    navigate: (screen: Screen, options?: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, clients, tasks, navigate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSearchTerm(''); // Clear on close
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!isOpen) return null;

    // Use debounced term for filtering
    const filteredClients = debouncedSearchTerm ? clients.filter(c => 
        c.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
        c.ruc.includes(debouncedSearchTerm)
    ).slice(0, 3) : [];

    const filteredTasks = debouncedSearchTerm ? tasks.filter(t => 
        t.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    ).slice(0, 3) : [];

    const handleSelectClient = (client: Client) => {
        navigate('clients', { clientIdToView: client.id });
        onClose();
    };

    const handleSelectTask = (task: Task) => {
        navigate('tasks', { taskFilter: { taskId: task.id } });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all scale-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center p-4 border-b border-slate-100 dark:border-slate-800">
                    <Search className="w-6 h-6 text-slate-400 mr-3" />
                    <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Buscar clientes, tareas o acciones..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent text-xl outline-none text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {/* Quick Actions if empty */}
                    {!debouncedSearchTerm && (
                        <div className="p-2 animate-fade-in">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Acciones Rápidas</p>
                            <button onClick={() => { navigate('tasks', { initialTaskData: {} }); onClose(); }} className="w-full flex items-center p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                                <div className="p-2 bg-brand-teal/10 text-brand-teal rounded-lg mr-3 group-hover:bg-brand-teal group-hover:text-white transition-colors"><Zap size={18}/></div>
                                <span className="font-medium dark:text-gray-200">Nueva Tarea</span>
                            </button>
                            <button onClick={() => { navigate('cobranza'); onClose(); }} className="w-full flex items-center p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg mr-3 group-hover:bg-green-600 group-hover:text-white transition-colors"><Briefcase size={18}/></div>
                                <span className="font-medium dark:text-gray-200">Registrar Pago</span>
                            </button>
                        </div>
                    )}

                    {/* Results */}
                    {debouncedSearchTerm && (
                        <div className="animate-fade-in">
                            {/* Clients */}
                            {filteredClients.length > 0 && (
                                <div className="p-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Clientes</p>
                                    {filteredClients.map(client => (
                                        <button key={client.id} onClick={() => handleSelectClient(client)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold mr-3">
                                                    {client.name.substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{client.name}</p>
                                                    <p className="text-xs text-slate-500">{client.ruc}</p>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-teal opacity-0 group-hover:opacity-100 transition-all"/>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Tasks */}
                            {filteredTasks.length > 0 && (
                                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-2">Tareas</p>
                                    {filteredTasks.map(task => (
                                        <button key={task.id} onClick={() => handleSelectTask(task)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left">
                                            <div className="flex items-center">
                                                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 mr-3">
                                                    <CheckSquare size={16}/>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white line-clamp-1">{task.title}</p>
                                                    <p className="text-xs text-slate-500">{task.status}</p>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-teal opacity-0 group-hover:opacity-100 transition-all"/>
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {filteredClients.length === 0 && filteredTasks.length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    <Search size={32} className="mx-auto mb-2 opacity-30"/>
                                    <p>No se encontraron resultados para "{debouncedSearchTerm}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 px-4 text-xs text-slate-400 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                        <span className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">↑↓</span>
                        <span>Navegar</span>
                        <span className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 ml-2">↵</span>
                        <span>Seleccionar</span>
                    </div>
                    <span>ESC para cerrar</span>
                </div>
            </div>
        </div>
    );
};
