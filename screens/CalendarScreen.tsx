
import React, { useState, useMemo } from 'react';
import { Screen, DeclarationStatus, TaskStatus } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SRI_DUE_DATES } from '../constants';

interface CalendarEvent {
  id: string; // client or task id
  type: 'task' | 'declaration';
  title: string;
  clientName?: string;
  details?: string;
  ninthDigit?: number;
}

interface CalendarScreenProps {
  navigate: (screen: Screen, options?: { taskFilter?: { taskId?: string }, clientIdToView?: string }) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ navigate }) => {
  const { clients, tasks } = useAppStore();
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
        details: `${task.status}`
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
              clientName: client.name,
              details: dec.status,
              ninthDigit: parseInt(client.ruc[8])
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

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  
  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'task') {
      navigate('tasks', { taskFilter: { taskId: event.id } });
    } else {
      navigate('clients', { clientIdToView: event.id });
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Check if a day is an SRI deadline day
  const getSRIDeadlineDigit = (day: Date) => {
      const dayNum = day.getDate();
      const digit = Object.keys(SRI_DUE_DATES).find(key => SRI_DUE_DATES[parseInt(key)] === dayNum);
      return digit ? parseInt(digit) : null;
  };

  return (
    <div className="h-full flex flex-col pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-3xl font-display font-bold text-gold dark:text-white capitalize flex items-center gap-2">
                <CalendarIcon className="text-gold"/>
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                <Info size={14}/> Los días marcados con <span className="w-2 h-2 rounded-full bg-red-100 border border-red-200 inline-block"></span> indican vencimientos SRI.
            </p>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setCurrentMonth(new Date())} 
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
            >
                Hoy
            </button>
            <div className="flex bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-1">
                <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={20}/></button>
                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={20}/></button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 flex-1 flex flex-col overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          {weekDays.map(day => (
            <div key={day} className="text-center font-black text-[10px] uppercase tracking-widest py-4 text-slate-400 dark:text-slate-500">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const sriDigit = getSRIDeadlineDigit(day);

            return (
              <div
                key={day.toString()}
                className={`min-h-[100px] p-2 border-b border-r border-slate-100 dark:border-slate-800 flex flex-col transition-colors group relative
                  ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-900'}
                  ${isCurrentDay ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`
                }
              >
                <div className="flex justify-between items-start mb-2">
                     <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isCurrentDay ? 'bg-gold text-white shadow-md' : isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300'}`}>
                        {format(day, 'd')}
                    </span>
                    {sriDigit !== null && isCurrentMonth && (
                        <span className="text-[9px] font-black text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30" title={`Vence 9no dígito: ${sriDigit}`}>
                            Dígito {sriDigit}
                        </span>
                    )}
                </div>
                
                <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {dayEvents.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                      className={`group/item relative p-2 rounded-lg text-xs cursor-pointer border-l-[3px] transition-all hover:shadow-md hover:translate-x-1
                        ${event.type === 'task' 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300' 
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-300'}`
                      }
                    >
                        <div className="font-bold truncate leading-tight">{event.clientName}</div>
                        <div className="truncate opacity-80 text-[10px]">{event.type === 'task' ? 'Tarea' : 'Declaración'}</div>
                        
                        {/* Hover Popup */}
                        <div className="absolute left-0 top-full mt-1 w-48 bg-slate-800 text-white p-3 rounded-xl shadow-xl opacity-0 group-hover/item:opacity-100 pointer-events-none transition-opacity z-50 text-xs scale-95 group-hover/item:scale-100 origin-top-left border border-slate-700">
                             <p className="font-bold mb-1 text-gold uppercase tracking-wider">{event.type === 'task' ? 'Detalle Tarea' : 'Vencimiento Fiscal'}</p>
                             <p className="font-semibold text-white text-sm mb-1">{event.clientName}</p>
                             <p className="text-slate-300 leading-tight">{event.title}</p>
                             <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between">
                                <span className="opacity-60">{event.details}</span>
                                {event.ninthDigit !== undefined && <span className="font-mono bg-slate-700 px-1 rounded">RUC: ...{event.ninthDigit}</span>}
                             </div>
                        </div>
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
