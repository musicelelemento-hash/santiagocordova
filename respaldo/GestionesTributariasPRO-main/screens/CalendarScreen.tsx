
import React, { useState, useMemo } from 'react';
import { Client, Task, Screen, DeclarationStatus, TaskStatus } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckSquare, User } from 'lucide-react';

interface CalendarEvent {
  id: string; // client or task id
  type: 'task' | 'declaration';
  title: string;
  clientName?: string; // for tasks
}

interface CalendarScreenProps {
  clients: Client[];
  tasks: Task[];
  navigate: (screen: Screen, options?: { taskFilter?: { taskId?: string }, clientIdToView?: string }) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ clients, tasks, navigate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const eventsByDate = useMemo(() => {
    const events = new Map<string, CalendarEvent[]>();

    // Process tasks
    tasks.forEach(task => {
      if (task.status === TaskStatus.Completada || task.status === TaskStatus.Pagada) return;
      const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
      const client = clients.find(c => c.id === task.clientId);
      const event: CalendarEvent = {
        id: task.id,
        type: 'task',
        title: task.title,
        clientName: client?.name || task.nonClientName || 'Externo',
      };
      if (!events.has(dateKey)) {
        events.set(dateKey, []);
      }
      events.get(dateKey)!.push(event);
    });

    // Process client declaration deadlines
    clients.forEach(client => {
      if (!(client.isActive ?? true)) return;
      client.declarationHistory.forEach(dec => {
        if (dec.status === DeclarationStatus.Pendiente || dec.status === DeclarationStatus.Enviada) {
          const dueDate = getDueDateForPeriod(client, dec.period);
          if (dueDate) {
            const dateKey = format(dueDate, 'yyyy-MM-dd');
            const event: CalendarEvent = {
              id: client.id,
              type: 'declaration',
              title: formatPeriodForDisplay(dec.period),
            };
            if (!events.has(dateKey)) {
              events.set(dateKey, []);
            }
            events.get(dateKey)!.push(event);
          }
        }
      });
    });

    return events;
  }, [clients, tasks]);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'task') {
      navigate('tasks', { taskFilter: { taskId: event.id } });
    } else {
      navigate('clients', { clientIdToView: event.id });
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="p-2 sm:p-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-display text-gold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex space-x-2">
          <button onClick={handlePrevMonth} className="p-2 rounded-full text-gold-dark dark:text-gold-light hover:bg-gold/10 transition-colors duration-200" aria-label="Mes anterior">
            <ChevronLeft size={24} />
          </button>
          <button onClick={handleNextMonth} className="p-2 rounded-full text-gold-dark dark:text-gold-light hover:bg-gold/10 transition-colors duration-200" aria-label="Mes siguiente">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 midnight:bg-slate-800 rounded-lg shadow-lg">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map(day => (
            <div key={day} className="text-center font-bold text-sm py-3 text-gray-600 dark:text-gray-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            return (
              <div
                key={day.toString()}
                className={`h-28 sm:h-32 p-1.5 border-b border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-colors duration-300
                  ${!isSameMonth(day, currentMonth) ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                  ${isToday(day) ? 'bg-gold/10' : ''}`
                }
              >
                <time
                  dateTime={format(day, 'yyyy-MM-dd')}
                  className={`text-xs sm:text-sm font-semibold ${isToday(day) ? 'text-gold' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  {format(day, 'd')}
                </time>
                <div className="mt-1 flex-grow overflow-y-auto space-y-1 pr-1">
                  {dayEvents.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      onClick={() => handleEventClick(event)}
                      className={`p-1 rounded-md text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-start space-x-1
                        ${event.type === 'task' ? 'bg-blue-500/80 text-white' : 'bg-gold/80 text-black'}`
                      }
                    >
                      {event.type === 'task' ? <CheckSquare size={12} className="flex-shrink-0 mt-0.5"/> : <User size={12} className="flex-shrink-0 mt-0.5"/>}
                      <span className="truncate" title={event.type === 'task' ? `${event.title} (${event.clientName})` : `${event.title} (${clients.find(c => c.id === event.id)?.name})`}>
                        {event.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
