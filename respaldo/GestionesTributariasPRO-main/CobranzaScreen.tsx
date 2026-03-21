
import React, { useMemo } from 'react';
import { Client, ServiceFeesConfig, Declaration, DeclarationStatus, ReminderConfig, ReminderType } from './types';
import { getDueDateForPeriod, formatPeriodForDisplay } from './sri';
import { getClientServiceFee } from './clientService';
import { differenceInCalendarDays, isToday, format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { AlertTriangle, CheckCircle, MessageSquare, Mail, Info } from 'lucide-react';

interface CobranzaScreenProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    serviceFees: ServiceFeesConfig;
    reminderConfig: ReminderConfig;
}

interface Reminder {
    client: Client;
    declaration: Declaration;
    type: ReminderType;
    daysDiff: number;
}

const getReminderInfo = (reminder: Reminder): { title: string, description: string, colorClass: string } => {
    switch (reminder.type) {
        case 'upcoming':
            return {
                title: 'Vencimiento Próximo',
                description: `Vence en ${reminder.daysDiff} días`,
                colorClass: 'border-yellow-500 bg-yellow-500/5'
            };
        case 'due_date':
            return {
                title: 'Vence Hoy',
                description: 'La declaración vence hoy',
                colorClass: 'border-orange-500 bg-orange-500/5'
            };
        case 'overdue':
             return {
                title: 'Vencido',
                description: `Venció hace ${Math.abs(reminder.daysDiff)} días`,
                colorClass: 'border-red-500 bg-red-500/5'
            };
        default:
            return {
                title: 'Estado Desconocido',
                description: '',
                colorClass: 'border-gray-500 bg-gray-500/5'
            }
    }
}

export const CobranzaScreen: React.FC<CobranzaScreenProps> = ({ clients, setClients, serviceFees, reminderConfig }) => {

    const remindersToSend = useMemo((): Reminder[] => {
        if (!reminderConfig.isEnabled) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const allReminders: Reminder[] = [];

        clients.forEach(client => {
            if (!(client.isActive ?? true) || (!client.email && (!client.phones || client.phones.length === 0))) {
                return; // Skip inactive clients or those with no contact info
            }

            client.declarationHistory.forEach(declaration => {
                if (declaration.status === DeclarationStatus.Pagada) return;

                const dueDate = getDueDateForPeriod(client, declaration.period);
                if (!dueDate) return;
                dueDate.setHours(0, 0, 0, 0);

                const daysDiff = differenceInCalendarDays(dueDate, today);

                const lastReminderDate = declaration.reminders?.[declaration.reminders.length - 1]?.date;
                const reminderSentToday = lastReminderDate ? isToday(new Date(lastReminderDate)) : false;

                if (reminderSentToday) return;

                // 1. Upcoming reminder
                if (reminderConfig.daysBefore > 0 && daysDiff === reminderConfig.daysBefore) {
                    const alreadySent = declaration.reminders?.some(r => r.type === 'upcoming');
                    if (!alreadySent) {
                        allReminders.push({ client, declaration, type: 'upcoming', daysDiff });
                    }
                }
                // 2. Due date reminder
                else if (reminderConfig.onDueDate && daysDiff === 0) {
                     const alreadySent = declaration.reminders?.some(r => r.type === 'due_date');
                     if (!alreadySent) {
                        allReminders.push({ client, declaration, type: 'due_date', daysDiff });
                     }
                }
                // 3. Overdue reminder
                else if (daysDiff < 0 && reminderConfig.overdueInterval > 0) {
                    const lastOverdueReminder = declaration.reminders?.filter(r => r.type === 'overdue').pop();
                    if (!lastOverdueReminder) {
                        // First overdue reminder should be sent on day 1 (if interval is > 0) or based on interval
                         if (Math.abs(daysDiff) % reminderConfig.overdueInterval === 0 || Math.abs(daysDiff) === 1) {
                           allReminders.push({ client, declaration, type: 'overdue', daysDiff });
                        }
                    } else {
                        const lastDate = new Date(lastOverdueReminder.date);
                        const daysSinceLastReminder = differenceInCalendarDays(today, lastDate);
                        if (daysSinceLastReminder >= reminderConfig.overdueInterval) {
                            allReminders.push({ client, declaration, type: 'overdue', daysDiff });
                        }
                    }
                }
            });
        });

        return allReminders.sort((a,b) => a.daysDiff - b.daysDiff);
    }, [clients, reminderConfig]);

    const handleSendReminder = (client: Client, declaration: Declaration, channel: 'email' | 'whatsapp', type: ReminderType) => {
        const fee = getClientServiceFee(client, serviceFees);
        const dueDate = getDueDateForPeriod(client, declaration.period);
        const message = reminderConfig.template
            .replace(/{clientName}/g, client.name)
            .replace(/{period}/g, formatPeriodForDisplay(declaration.period))
            .replace(/{amount}/g, fee.toFixed(2))
            .replace(/{dueDate}/g, dueDate ? format(dueDate, 'PPP', { locale: es }) : 'N/A');

        if (channel === 'whatsapp' && client.phones && client.phones.length > 0) {
            const phone = client.phones[0].replace(/\D/g, '');
            const internationalPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
            window.open(`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else if (channel === 'email' && client.email) {
            window.open(`mailto:${client.email}?subject=Recordatorio de Pago - Soluciones Contables Pro&body=${encodeURIComponent(message)}`, '_blank');
        } else {
            alert(`No hay ${channel === 'email' ? 'email' : 'teléfono'} registrado para este cliente.`);
            return;
        }

        const newReminder = { date: new Date().toISOString(), channel, type };
        const updatedClient = {
            ...client,
            declarationHistory: client.declarationHistory.map(d => {
                if (d.period === declaration.period) {
                    return {
                        ...d,
                        reminders: [...(d.reminders || []), newReminder]
                    };
                }
                return d;
            })
        };
        setClients(prevClients => prevClients.map(c => c.id === client.id ? updatedClient : c));
    };

    return (
        <div>
            <h2 className="text-3xl lg:text-4xl font-display text-gold mb-6 tracking-wide">Gestión de Cobranza</h2>

            {!reminderConfig.isEnabled && (
                <div className="p-4 mb-6 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg flex items-center space-x-3 text-sm">
                    <Info size={20} />
                    <span>Los recordatorios automáticos están desactivados. Puede activarlos en la pantalla de Ajustes.</span>
                </div>
            )}

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h3 className="font-bold text-xl dark:text-white">Recordatorios para Hoy</h3>
                <p className="text-2xl font-display mt-2 text-gold">{remindersToSend.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Recordatorios de pago que deben ser enviados hoy según su configuración.</p>
            </div>

            <div className="space-y-4">
                {remindersToSend.length > 0 ? (
                    remindersToSend.map(({ client, declaration, type, daysDiff }, index) => {
                        const { title, description, colorClass } = getReminderInfo({ client, declaration, type, daysDiff });
                        const fee = getClientServiceFee(client, serviceFees);
                        
                        return (
                             <div key={`${client.id}-${declaration.period}`} className={`p-4 rounded-lg shadow-md border-l-4 ${colorClass} animate-slide-up-fade`} style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                    <div>
                                        <p className="font-bold text-lg dark:text-white">{client.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatPeriodForDisplay(declaration.period)} - <span className="font-semibold">${fee.toFixed(2)}</span></p>
                                    </div>
                                    <div className="text-right mt-2 sm:mt-0">
                                        <p className="font-semibold text-sm">{title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700/50 flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                                    <button
                                        onClick={() => handleSendReminder(client, declaration, 'whatsapp', type)}
                                        disabled={!client.phones || client.phones.length === 0}
                                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <MessageSquare size={16} />
                                        <span>Enviar por WhatsApp</span>
                                    </button>
                                     <button
                                        onClick={() => handleSendReminder(client, declaration, 'email', type)}
                                        disabled={!client.email}
                                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Mail size={16} />
                                        <span>Enviar por Email</span>
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="text-center py-12">
                         <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                         <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">Todo en Orden</h3>
                         <p className="text-gray-500 dark:text-gray-400">No hay recordatorios de pago para enviar hoy.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
