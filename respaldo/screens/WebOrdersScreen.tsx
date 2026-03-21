
import React, { useState } from 'react';
import { WebOrder, Screen, Task, TaskStatus } from '../types';
import { ShoppingCart, CheckCircle, Phone, Mail, Clock, Plus, Trash2, MessageSquare, Briefcase } from 'lucide-react';
import format from 'date-fns/format';
import es from 'date-fns/locale/es';
import { v4 as uuidv4 } from 'uuid';

interface WebOrdersScreenProps {
    orders: WebOrder[];
    setOrders: React.Dispatch<React.SetStateAction<WebOrder[]>>;
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    navigate: (screen: Screen) => void;
}

export const WebOrdersScreen: React.FC<WebOrdersScreenProps> = ({ orders, setOrders, setTasks, navigate }) => {
    
    // Use fallback in case props are missing (safety)
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
            dueDate: new Date().toISOString(), // Due today
            status: TaskStatus.Pendiente,
            cost: order.total,
            advancePayment: 0,
            nonClientName: order.clientName,
            nonClientRuc: order.clientRuc,
        };

        setTasks(prev => [...prev, newTask]);
        handleStatusChange(order.id, 'completed');
        alert('Se ha creado una nueva tarea basada en este pedido.');
        navigate('tasks');
    };

    const handleWhatsAppContact = (order: WebOrder) => {
        const message = `Hola ${order.clientName}, le saludamos de Santiago Cordova - Asesoría Tributaria. Hemos recibido su solicitud por valor de $${order.total.toFixed(2)}. Nos gustaría coordinar los detalles.`;
        window.open(`https://wa.me/593${order.clientPhone.substring(1)}?text=${encodeURIComponent(message)}`, '_blank');
        handleStatusChange(order.id, 'contacted');
    };

    // Kanban Columns Configuration
    const columns = [
        { id: 'pending', title: 'Nuevos Pedidos', color: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/10', icon: ShoppingCart },
        { id: 'contacted', title: 'En Gestión', color: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', icon: Phone },
        { id: 'completed', title: 'Procesados', color: 'border-green-500', bg: 'bg-green-50 dark:bg-green-900/10', icon: CheckCircle },
    ];

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col p-2">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-display text-gold flex items-center">
                    <ShoppingCart className="mr-3" />
                    Recepción de Pedidos Web
                </h2>
                <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-bold text-gray-500">Total Pendientes: </span>
                    <span className="text-gold font-bold text-lg">{safeOrders.filter(o => o.status === 'pending').length}</span>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-6 h-full min-w-[1000px]">
                    {columns.map(col => {
                        const colOrders = safeOrders.filter(o => o.status === col.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        
                        return (
                            <div key={col.id} className={`flex-1 flex flex-col min-w-[300px] bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700`}>
                                {/* Column Header */}
                                <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center ${col.bg} rounded-t-xl`}>
                                    <div className="flex items-center gap-2">
                                        <col.icon size={18} className="text-gray-600 dark:text-gray-300"/>
                                        <h3 className="font-bold text-gray-700 dark:text-gray-200">{col.title}</h3>
                                    </div>
                                    <span className="bg-white dark:bg-gray-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                        {colOrders.length}
                                    </span>
                                </div>

                                {/* Orders List */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {colOrders.map(order => (
                                        <div key={order.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 ${col.color} hover:shadow-md transition-all group animate-fade-in-up`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{order.clientName}</h4>
                                                <span className="text-xs text-gray-400">{format(new Date(order.createdAt), 'dd MMM', { locale: es })}</span>
                                            </div>
                                            
                                            <div className="text-xs text-gray-500 space-y-1 mb-3">
                                                <div className="flex items-center gap-1"><Phone size={12}/> {order.clientPhone}</div>
                                                <div className="flex items-center gap-1"><Mail size={12}/> {order.clientEmail || 'N/A'}</div>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg mb-3">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pedido</p>
                                                <ul className="text-xs space-y-1">
                                                    {order.items.map((item, idx) => (
                                                        <li key={idx} className="flex justify-between">
                                                            <span className="truncate">{item.title}</span>
                                                        </li>
                                                    ))}
                                                    {order.items.length > 2 && <li className="text-[10px] italic">+ {order.items.length - 2} más...</li>}
                                                </ul>
                                                <div className="mt-2 pt-1 border-t border-gray-200 dark:border-gray-600 flex justify-between font-bold text-sm">
                                                    <span>Total</span>
                                                    <span className="text-green-600">${order.total.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                {order.status === 'pending' && (
                                                    <button onClick={() => handleWhatsAppContact(order)} className="flex-1 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                                        <MessageSquare size={14}/> WhatsApp
                                                    </button>
                                                )}
                                                
                                                {(order.status === 'pending' || order.status === 'contacted') && (
                                                    <button onClick={() => handleConvertToTask(order)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                                        <Briefcase size={14}/> Tarea
                                                    </button>
                                                )}

                                                <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {colOrders.length === 0 && (
                                        <div className="text-center py-8 opacity-50">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <col.icon size={20} className="text-gray-400"/>
                                            </div>
                                            <p className="text-xs text-gray-400">Sin pedidos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
