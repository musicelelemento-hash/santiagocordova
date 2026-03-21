import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, AlertTriangle, Radio } from 'lucide-react';
import { Task, Client, Screen, DeclarationStatus } from '../../types';
import { getPeriod, getDueDateForPeriod } from '../../services/sri';
import { isPast, isToday, isTomorrow, format } from 'date-fns';

interface NotificationBellProps {
    clients: Client[];
    navigate: (screen: Screen, options?: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ clients, navigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const getClientNameForTask = (task: Task): string => {
        if (task.clientId) {
            return clients.find(c => c.id === task.clientId)?.name || 'Cliente no encontrado';
        }
        return task.nonClientName || 'Solicitante Externo';
    };


    const alerts = useMemo(() => {
        const today = new Date();
        const currentAlerts: { id: string, type: 'danger' | 'warning', title: string, description: string, clientId?: string }[] = [];

        clients.forEach(c => {
            if (!c.isActive || c.isDeleted) return;
            const p = getPeriod(c, today);
            const decl = (c.declarationHistory || []).find(dh => dh.period === p);
            const isDeclared = !!decl?.proofFile || decl?.status === DeclarationStatus.Enviada || decl?.status === DeclarationStatus.Pagada;
            const dueDate = getDueDateForPeriod(c, p);

            // 1. Missing PDF (Red Dot equivalent)
            if (decl && !decl.proofFile && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada)) {
                currentAlerts.push({
                    id: `pdf-${c.id}-${p}`,
                    type: 'danger',
                    title: `Falta comprobante: ${c.name}`,
                    description: `Declaración ${p} realizada pero sin archivo de respaldo.`,
                    clientId: c.id
                });
            }

            // 2. Urgent/Overdue SRI
            if (!isDeclared && dueDate) {
                if (isPast(dueDate) || isToday(dueDate)) {
                    currentAlerts.push({
                        id: `sri-${c.id}-${p}`,
                        type: 'danger',
                        title: `VENCIDO SRI: ${c.name}`,
                        description: `Plazo vencido (${format(dueDate, 'dd MMM')}). Requiere atención inmediata.`,
                        clientId: c.id
                    });
                } else if (isTomorrow(dueDate)) {
                    currentAlerts.push({
                        id: `sri-soon-${c.id}-${p}`,
                        type: 'warning',
                        title: `Vence Mañana: ${c.name}`,
                        description: `Último día para declarar periodo ${p}.`,
                        clientId: c.id
                    });
                }
            }
        });

        return currentAlerts;
    }, [clients]);

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
            <button 
                onClick={() => setIsOpen(prev => !prev)} 
                className={`relative p-3 rounded-2xl transition-all duration-300 border border-white/10 ${
                    isOpen ? 'bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'bg-white/5 hover:bg-white/10 text-slate-400 group'
                } ${alerts.length > 0 && !isOpen ? 'animate-radar-pulse' : ''}`}
            >
                <Bell className={`w-5 h-5 ${isOpen ? 'animate-pulse' : 'group-hover:text-sky-400'}`} />
                {alerts.length > 0 && (
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"></div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-4 w-80 sm:w-96 glass-elite dark:dark-glass rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 border border-white/10 overflow-hidden animate-fade-in-down">
                    <div className="p-4 bg-white/5 dark:bg-slate-900/50 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.5)]"></div>
                            <h4 className="font-black text-[10px] uppercase tracking-[0.3em] text-white">TACTICAL FEED: ALPHA-1</h4>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Estado: En línea</span>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {alerts.length > 0 ? (
                            <div className="p-2 space-y-1">
                                {alerts.map(alert => (
                                    <div 
                                        key={alert.id}
                                        onClick={() => {
                                            if (alert.clientId) navigate('home', { search: alert.clientId });
                                            setIsOpen(false);
                                        }}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl cursor-pointer transition-all border border-white/5 group"
                                    >
                                        <div className="flex gap-3">
                                            <div className={`p-2 rounded-lg ${alert.type === 'danger' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                                <AlertTriangle size={14} />
                                            </div>
                                            <div className="flex-1">
                                                <h5 className={`text-[11px] font-black uppercase tracking-wider mb-0.5 ${alert.type === 'danger' ? 'text-rose-400' : 'text-amber-400'}`}>
                                                    {alert.title}
                                                </h5>
                                                <p className="text-[10px] text-slate-400 leading-relaxed capitalize">
                                                    {alert.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center bg-black/20">
                                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-white/5 relative">
                                    <Radio size={24} className="text-slate-600 animate-pulse" />
                                    <div className="absolute inset-0 border border-sky-500/20 rounded-full animate-ping"></div>
                                </div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Sin Comunicaciones</p>
                                <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Escaneando sectores de red...</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white/5 border-t border-white/10">
                        <button 
                            className="w-full py-2 bg-slate-800/80 hover:bg-slate-700/80 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] rounded-xl transition-all border border-white/5"
                            onClick={() => setIsOpen(false)}
                        >
                            {alerts.length > 0 ? 'MARCAR TODOS COMO LEÍDOS' : 'SILENCIAR CANALES'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
