
import React, { useState, useMemo } from 'react';
import { Client, Task, Screen, DeclarationStatus, TaskStatus } from '../types';
import { getDueDateForPeriod, formatPeriodForDisplay, safeFormat } from '../services/sri';
import {
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
      const dateKey = safeFormat(task.dueDate, 'yyyy-MM-dd');
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
      (client.declarations ?? []).forEach(dec => {
        if (dec.status === DeclarationStatus.Pendiente || dec.status === DeclarationStatus.Enviada) {
          const dueDate = getDueDateForPeriod(client, dec.period);
          if (dueDate) {
            const dateKey = safeFormat(dueDate, 'yyyy-MM-dd');
            const event: CalendarEvent = {
              id: client.id,
              type: 'declaration',
              title: formatPeriodForDisplay(dec.period),
              clientName: client.name,
              details: dec.status,
              ninthDigit: parseInt(client.ruc[8] || '0')
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
    <div className="space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0">
      {/* ELITE TACTICAL HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-8">
        <div className="animate-fade-in-left w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/20">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
              <span className="text-xs font-semibold text-brand-teal uppercase tracking-widest">Temporal Intelligence</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Scheduler v4.0</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-2">
            {safeFormat(currentMonth, 'MMMM').toUpperCase()} <span className="text-brand-teal font-semibold">{safeFormat(currentMonth, 'yyyy')}</span>
          </h2>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium uppercase tracking-widest">
            <CalendarIcon size={12} className="text-brand-teal" />
            <span>Vencimientos y Tareas Críticas de Operación</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto animate-fade-in-right">
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="flex-1 sm:flex-none px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl"
          >
            Sincronizar Hoy
          </button>
          <div className="flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="p-3 rounded-xl hover:bg-brand-teal/10 text-slate-400 hover:text-brand-teal transition-all group active:scale-90">
              <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button onClick={handleNextMonth} className="p-3 rounded-xl hover:bg-brand-teal/10 text-slate-400 hover:text-brand-teal transition-all group active:scale-90">
              <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-tactical rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden flex flex-col group transition-all duration-700 hover:border-brand-teal/20">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-teal/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
        
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 relative z-10">
          {weekDays.map(day => (
            <div key={day} className="text-center font-bold text-[11px] uppercase tracking-[0.2em] py-4 text-slate-400 dark:text-slate-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-fr relative z-10">
          {days.map((day, dayIdx) => {
            const dateKey = safeFormat(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const sriDigit = getSRIDeadlineDigit(day);

            return (
              <div
                key={day.toString()}
                className={`min-h-[130px] p-3 border-b border-r border-slate-200 dark:border-slate-800/60 flex flex-col transition-all duration-500 relative group/day
                  ${!isCurrentMonth ? 'bg-slate-100/40 dark:bg-black/30 opacity-40' : 'bg-transparent'}
                  ${isCurrentDay ? 'bg-brand-teal/[0.04]' : ''}
                  ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`
                }
              >
                {isCurrentDay && (
                  <div className="absolute inset-0 border-2 border-brand-teal/30 rounded-[inherit] pointer-events-none animate-pulse"></div>
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-sm font-bold font-mono w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-300 ${isCurrentDay ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/30 scale-110 z-10' : isCurrentMonth ? 'text-slate-900 dark:text-white group-hover/day:text-brand-teal' : 'text-slate-400'}`}>
                    {safeFormat(day, 'd')}
                  </span>
                  {sriDigit !== null && isCurrentMonth && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-widest font-mono" title={`Vence 9no dígito: ${sriDigit}`}>
                        DÍGITO {sriDigit}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar-mini pr-1 relative z-10">
                  {dayEvents.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                      className={`group/item relative p-2 rounded-xl text-[11px] cursor-pointer border-l-4 transition-all duration-300 hover:scale-[1.02] active:scale-95
                        ${event.type === 'task'
                          ? 'bg-sky-500/10 border-sky-500 text-slate-800 dark:text-sky-100 hover:bg-sky-500/20'
                          : 'bg-emerald-500/10 border-emerald-500 text-slate-800 dark:text-emerald-100 hover:bg-emerald-500/20'}`
                      }
                    >
                      <div className="font-bold truncate uppercase tracking-tight mb-0.5 group-hover/item:text-brand-teal transition-colors">{event.clientName}</div>
                      <div className="flex items-center gap-1.5 opacity-70 font-semibold uppercase tracking-wider text-[10px]">
                        <div className={`w-1.5 h-1.5 rounded-full ${event.type === 'task' ? 'bg-sky-500' : 'bg-emerald-500'}`}></div>
                        {event.type === 'task' ? 'OPERATIVO' : 'SRI PROTOCOL'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 px-8 py-3.5 glass-tactical border border-slate-200 dark:border-slate-800 rounded-full w-fit mx-auto shadow-md">
         <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-sm"></div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tareas Operativas</span>
         </div>
         <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Protocolos Fiscales</span>
         </div>
         <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-800 pl-6">
            <Info size={14} className="text-rose-500" />
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest">Alertas SRI Automatizadas</span>
         </div>
      </div>
    </div>
  );
};
