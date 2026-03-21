import React, { useState } from 'react';
import { WebOrder, Screen, Task, TaskStatus } from '../types';
import { 
    ShoppingCart, CheckCircle, Phone, Mail, 
    Clock, Plus, Trash2, MessageSquare, 
    Briefcase, Calendar, DollarSign, ExternalLink,
    Zap, Shield, Target, TrendingUp, ChevronRight,
    Activity, ArrowRight
} from 'lucide-react';
import { safeFormat, getWhatsAppUrl } from '../services/sri';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/useAppStore';

interface WebOrdersScreenProps {
    navigate: (screen: Screen) => void;
}

export const WebOrdersScreen: React.FC<WebOrdersScreenProps> = ({ navigate }) => {
    const { webOrders: orders, setWebOrders: setOrders, setTasks } = useAppStore();
    const safeOrders = orders || [];

    const handleStatusChange = (orderId: string, newStatus: WebOrder['status']) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    };

    const handleDeleteOrder = (orderId: string) => {
        if (window.confirm('¿Está seguro de eliminar esta solicitud?')) {
            setOrders(prev => prev.filter(o => o.id !== orderId));
        }
    };

    const handleConvertToTask = (order: WebOrder) => {
        const description = `Solicitud Web:\nCliente: ${order.clientName}\nRUC: ${order.clientRuc || 'N/A'}\nEmail: ${order.clientEmail || 'N/A'}\nTeléfono: ${order.clientPhone}\n\nServicios Solicitados:\n${order.items.map(i => `- ${i.title} ($${i.price.toFixed(2)})`).join('\n')}`;

        const newTask: Task = {
            id: uuidv4(),
            title: `Pedido Web: ${order.clientName}`,
            description: description,
            dueDate: new Date().toISOString(),
            status: TaskStatus.Pendiente,
            cost: order.total,
            advancePayment: 0,
            nonClientName: order.clientName,
            nonClientRuc: order.clientRuc,
        };

        setTasks(prev => [...prev, newTask]);
        handleStatusChange(order.id, 'completed');
        navigate('tasks');
    };

    const handleWhatsAppContact = (order: WebOrder) => {
        const message = `Hola ${order.clientName}, le saludamos de Santiago Cordova - Asesoría Tributaria. Hemos recibido su solicitud por valor de $${order.total.toFixed(2)}. Nos gustaría coordinar los detalles.`;
        window.open(getWhatsAppUrl(order.clientPhone, message), '_blank');
        handleStatusChange(order.id, 'contacted');
    };

    const columns = [
        { id: 'pending', title: 'Frontera de Entrada', color: '#F59E0B', icon: ShoppingCart, shadow: 'shadow-amber-500/20', badge: 'New Request' },
        { id: 'contacted', title: 'Operación Activa', color: '#0EA5E9', icon: Phone, shadow: 'shadow-sky-500/20', badge: 'Contacted' },
        { id: 'completed', title: 'Archivo Final', color: '#10B981', icon: CheckCircle, shadow: 'shadow-emerald-500/20', badge: 'Processed' },
    ];

    return (
        <div className="space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0">
            {/* ELITE TACTICAL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-10">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-3 mb-3">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 border border-brand-teal/20 backdrop-blur-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                            <span className="text-[10px] font-black text-brand-teal uppercase tracking-[0.2em]">Inbound Lead Protocol</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-40 sm:block hidden">• Santiago Cordova Protocol v2.5</span>
                    </div>
                    <div className="relative">
                        <h2 className="text-4xl sm:text-6xl font-display font-black text-slate-900 dark:text-white leading-none tracking-tighter mb-3">
                            Web <span className="text-brand-teal">Orders</span>
                            <span className="text-brand-teal/20 ml-2">Grid</span>
                        </h2>
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-transparent rounded-full opacity-50"></div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em]">
                        <Zap size={14} className="text-brand-teal" />
                        <span>Gestión de Prospectos Digitales de Alto Nivel</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto animate-fade-in-right">
                    <div className="group relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-brand-teal/20 to-brand-navy/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                        <div className="relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl px-10 py-5 rounded-[2.5rem] border border-white/20 dark:border-white/5 flex items-center gap-8 shadow-2xl overflow-hidden glass-elite">
                            <div className="absolute top-0 right-0 p-2 opacity-5">
                                <Activity size={80} className="text-brand-teal" />
                            </div>
                            <div className="flex flex-col items-end relative z-10">
                                <p className="text-[10px] uppercase font-black text-brand-teal tracking-[0.3em] mb-1">Incoming Stream</p>
                                <p className="text-4xl font-display font-black text-slate-900 dark:text-white leading-none tracking-tighter">
                                    {safeOrders.filter(o => o.status === 'pending').length}
                                </p>
                            </div>
                            <div className="p-4 bg-brand-teal/10 rounded-2xl border border-brand-teal/20 relative z-10 shadow-inner">
                                <Activity size={28} className="text-brand-teal animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="relative z-10 flex flex-col md:flex-row gap-8 h-[calc(100vh-320px)] overflow-x-auto pb-6 scrollbar-hide">
                {columns.map(col => {
                    const colOrders = safeOrders.filter(o => o.status === col.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    return (
                        <div key={col.id} className="flex-1 min-w-[380px] flex flex-col group h-full">
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-8 px-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl backdrop-blur-md">
                                        <col.icon size={22} style={{ color: col.color }} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-[11px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400 leading-none mb-1.5">{col.title}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }}></div>
                                            <p className="text-[9px] font-black text-slate-400/60 uppercase tracking-widest">{col.badge}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black bg-slate-100 dark:bg-white/5 px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 shadow-lg">
                                        {colOrders.length}
                                    </span>
                                </div>
                            </div>

                            {/* Column Body */}
                            <div className="flex-1 overflow-y-auto space-y-6 p-4 rounded-[2.5rem] bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 scrollbar-hide pb-20 shadow-inner">
                                {colOrders.length > 0 ? colOrders.map(order => (
                                    <div 
                                        key={order.id} 
                                        className="p-6 rounded-[2rem] bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-white/5 hover:border-brand-teal/30 transition-all duration-500 group/card relative overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-brand-teal/5 animate-slide-up-fade"
                                    >
                                        <div className="absolute top-0 left-0 bottom-0 w-1.5 opacity-30 group-hover/card:opacity-100 transition-opacity" style={{ backgroundColor: col.color }} />
                                        
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h4 className="font-black text-lg text-slate-900 dark:text-white group-hover/card:text-brand-teal transition-colors uppercase tracking-tighter leading-none">{order.clientName}</h4>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Calendar size={12} className="text-brand-teal/60" />
                                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">REG: {safeFormat(order.createdAt, 'dd MMM yyyy • HH:mm')}</p>
                                                </div>
                                            </div>
                                            <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 group-hover/card:border-brand-teal/30 transition-colors">
                                                <ExternalLink size={16} className="text-slate-400 group-hover/card:text-brand-teal" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 mb-8">
                                            <div className="flex items-center gap-4 text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                                <div className="p-1.5 rounded-lg bg-brand-teal/10 text-brand-teal">
                                                    <Phone size={14} />
                                                </div>
                                                {order.clientPhone}
                                            </div>
                                            {order.clientEmail && (
                                                <div className="flex items-center gap-4 text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest truncate bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                                    <div className="p-1.5 rounded-lg bg-brand-teal/10 text-brand-teal">
                                                        <Mail size={14} />
                                                    </div>
                                                    <span className="truncate">{order.clientEmail}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-900/5 dark:bg-black/40 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 mb-8">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2">
                                                    <ShoppingCart size={14} className="text-brand-teal" />
                                                    <p className="text-[10px] font-black text-brand-teal uppercase tracking-[0.3em]">Servicios Pack</p>
                                                </div>
                                                <span className="text-[9px] font-black bg-brand-teal/10 text-brand-teal px-3 py-1 rounded-full border border-brand-teal/20 uppercase tracking-widest">{order.items.length} ITEMS</span>
                                            </div>
                                            <ul className="space-y-3 mb-5">
                                                {order.items.map((item, idx) => (
                                                    <li key={idx} className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between items-center group/item">
                                                        <span className="truncate group-hover/item:text-slate-900 dark:group-hover/item:text-slate-200 transition-colors">{item.title}</span>
                                                        <span className="font-black text-slate-900 dark:text-slate-500 ml-3">${item.price.toFixed(0)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-200 dark:border-white/10">
                                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em]">Total Inversión</span>
                                                <span className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tighter">${order.total.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-4 relative z-10">
                                            {order.status === 'pending' && (
                                                <button 
                                                    onClick={() => handleWhatsAppContact(order)} 
                                                    className="flex-1 py-4.5 bg-brand-teal text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-brand-teal/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    <MessageSquare size={16} /> CONTACTAR
                                                </button>
                                            )}

                                            {(order.status === 'pending' || order.status === 'contacted') && (
                                                <button 
                                                    onClick={() => handleConvertToTask(order)} 
                                                    className={`
                                                        flex-1 py-4.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] border
                                                        ${order.status === 'contacted' 
                                                            ? 'bg-brand-navy text-white shadow-xl shadow-brand-navy/20 border-brand-navy' 
                                                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-black/10 border-slate-900 dark:border-white'}
                                                    `}
                                                >
                                                    <Briefcase size={16} /> CREAR TAREA
                                                </button>
                                            )}

                                            <button 
                                                onClick={() => handleDeleteOrder(order.id)} 
                                                className="p-4.5 bg-slate-50 dark:bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-[1.25rem] transition-all border border-slate-100 dark:border-white/5 hover:border-rose-500/20"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-24 opacity-20 text-center">
                                        <div className="w-24 h-24 rounded-[3rem] bg-slate-200 dark:bg-white/5 flex items-center justify-center mb-8 animate-pulse border border-slate-300 dark:border-white/10">
                                            <col.icon size={40} className="text-slate-400" />
                                        </div>
                                        <p className="text-[11px] font-black tracking-[0.5em] uppercase text-slate-500">Sector Limpio</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Protocolo de Silencio Activo</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tactical Footer */}
            <div className="fixed bottom-10 right-10 opacity-30 hidden md:block pointer-events-none z-0">
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[14px] font-black tracking-[0.5em] text-slate-400 uppercase">Operational Pipeline</p>
                        <p className="text-[10px] font-black text-brand-teal tracking-[0.3em] uppercase opacity-60">Encrypted Node • Santiago Cordova Protocol</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl">
                        <Target size={32} className="text-brand-teal animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
};
