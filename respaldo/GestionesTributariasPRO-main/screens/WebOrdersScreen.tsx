
import React, { useState } from 'react';
import { WebOrder, Screen, Task, TaskStatus } from '../types';
import { ShoppingCart, CheckCircle, XCircle, Phone, Mail, Clock, Plus, Trash2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

interface WebOrdersScreenProps {
    orders: WebOrder[];
    setOrders: React.Dispatch<React.SetStateAction<WebOrder[]>>;
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    navigate: (screen: Screen) => void;
}

export const WebOrdersScreen: React.FC<WebOrdersScreenProps> = ({ orders, setOrders, setTasks, navigate }) => {
    
    const handleStatusChange = (orderId: string, newStatus: WebOrder['status']) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    };

    const handleDeleteOrder = (orderId: string) => {
        if (window.confirm('¿Está seguro de eliminar esta solicitud?')) {
            setOrders(prev => prev.filter(o => o.id !== orderId));
        }
    };

    const handleConvertToTask = (order: WebOrder) => {
        const description = `Solicitud Web:\nCliente: ${order.clientName}\nRUC: ${order.clientRuc}\nEmail: ${order.clientEmail}\nTeléfono: ${order.clientPhone}\n\nServicios:\n${order.items.map(i => `- ${i.title} ($${i.price.toFixed(2)})`).join('\n')}`;
        
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
        const message = `Hola ${order.clientName}, le saludamos de Gestiones Tributarias. Hemos recibido su solicitud por valor de $${order.total.toFixed(2)}. Nos gustaría coordinar los detalles.`;
        window.open(`https://wa.me/593${order.clientPhone.substring(1)}?text=${encodeURIComponent(message)}`, '_blank');
        handleStatusChange(order.id, 'contacted');
    };

    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="p-2 sm:p-4">
            <h2 className="text-3xl font-display text-gold mb-6 flex items-center">
                <ShoppingCart className="mr-3" />
                Solicitudes Web
            </h2>

            {orders.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">No hay solicitudes pendientes</h3>
                    <p className="text-gray-500 dark:text-gray-400">Las órdenes realizadas en la página web aparecerán aquí.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sortedOrders.map(order => (
                        <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 overflow-hidden ${
                            order.status === 'pending' ? 'border-yellow-500' : 
                            order.status === 'completed' ? 'border-green-500' : 
                            order.status === 'contacted' ? 'border-blue-500' : 'border-red-500'
                        }`}>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">{order.clientName}</h3>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-col space-y-1 mt-1">
                                            <span className="flex items-center"><Clock size={14} className="mr-1"/> {format(new Date(order.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}</span>
                                            <span className="flex items-center"><Phone size={14} className="mr-1"/> {order.clientPhone}</span>
                                            <span className="flex items-center"><Mail size={14} className="mr-1"/> {order.clientEmail}</span>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                        order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                        order.status === 'contacted' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {order.status === 'pending' ? 'Pendiente' : 
                                         order.status === 'completed' ? 'Procesado' : 
                                         order.status === 'contacted' ? 'Contactado' : 'Rechazado'}
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Detalle del Pedido</h4>
                                    <ul className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-200">
                                                <span>{item.title}</span>
                                                <span className="font-mono font-bold text-gold">${item.price.toFixed(2)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                        <span className="font-bold text-gray-800 dark:text-white">Total</span>
                                        <span className="font-bold text-xl text-green-500">${order.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleWhatsAppContact(order)} className="flex items-center justify-center space-x-2 p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium">
                                        <MessageSquare size={16}/> <span>Contactar</span>
                                    </button>
                                    <button onClick={() => handleConvertToTask(order)} disabled={order.status === 'completed'} className="flex items-center justify-center space-x-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        <Plus size={16}/> <span>Crear Tarea</span>
                                    </button>
                                    {order.status !== 'completed' && (
                                         <button onClick={() => handleStatusChange(order.id, 'completed')} className="flex items-center justify-center space-x-2 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium">
                                            <CheckCircle size={16}/> <span>Marcar Listo</span>
                                        </button>
                                    )}
                                     <button onClick={() => handleDeleteOrder(order.id)} className="flex items-center justify-center space-x-2 p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors text-sm font-medium">
                                        <Trash2 size={16}/> <span>Eliminar</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
