
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
      client.declarations.forEach(dec => {
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
    <div className="space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0 aurora-premium min-h-screen">
      {/* ELITE TACTICAL HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-8">
        <div className="animate-fade-in-left w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-400/10 border border-sky-400/20 shadow-lg shadow-sky-400/5">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">Temporal Intelligence</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Scheduler v4.0 Alpha</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-2 italic">
            {safeFormat(currentMonth, 'MMMM').toUpperCase()} <span className="text-gradient-sky font-semibold italic">{safeFormat(currentMonth, 'yyyy')}</span>
          </h2>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium uppercase tracking-widest">
            <CalendarIcon size={12} className="text-sky-400" />
            <span>Vencimientos y Tareas Críticas de Operación</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto animate-fade-in-right">
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="flex-1 sm:flex-none px-10 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:scale-[1.05] active:scale-[0.95] shadow-xl hover:shadow-sky-400/10 italic"
          >
            Sincronizar Hoy
          </button>
          <div className="flex p-1 bg-white/5 dark:bg-white/5 rounded-[1.5rem] border border-white/10 backdrop-blur-xl">
            <button onClick={handlePrevMonth} className="p-3.5 rounded-xl hover:bg-sky-400/10 text-slate-400 hover:text-sky-400 transition-all group active:scale-90">
              <ChevronLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <button onClick={handleNextMonth} className="p-3.5 rounded-xl hover:bg-sky-400/10 text-slate-400 hover:text-sky-400 transition-all group active:scale-90">
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-tactical rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col group transition-all duration-700 hover:border-sky-400/20">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-400/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
        
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-white/5 bg-white/5 backdrop-blur-md relative z-10">
          {weekDays.map(day => (
            <div key={day} className="text-center font-semibold text-xs uppercase tracking-[0.3em] py-5 text-slate-500 dark:text-slate-400 italic">
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
                className={`min-h-[140px] p-3 border-b border-r border-white/5 flex flex-col transition-all duration-500 relative group/day
                  ${!isCurrentMonth ? 'bg-black/20 dark:bg-black/40 grayscale opacity-30 shadow-inner' : 'bg-transparent'}
                  ${isCurrentDay ? 'bg-sky-400/[0.03]' : ''}
                  ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`
                }
              >
                {isCurrentDay && (
                  <div className="absolute inset-0 border-2 border-sky-400/20 rounded-[inherit] pointer-events-none animate-pulse"></div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-base font-semibold w-9 h-9 flex items-center justify-center rounded-2xl transition-all duration-500 ${isCurrentDay ? 'bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.4)] scale-110 z-10' : isCurrentMonth ? 'text-slate-900 dark:text-white group-hover/day:text-sky-400' : 'text-slate-600'}`}>
                    {safeFormat(day, 'd')}
                  </span>
                  {sriDigit !== null && isCurrentMonth && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20 uppercase tracking-[0.1em] shadow-lg shadow-rose-400/5 animate-fade-in" title={`Vence 9no dígito: ${sriDigit}`}>
                        DÍGITO {sriDigit}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar-mini pr-1 relative z-10">
                  {dayEvents.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                      className={`group/item relative p-2.5 rounded-xl text-xs cursor-pointer border-l-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl active:scale-95
                        ${event.type === 'task'
                          ? 'bg-sky-400/10 border-sky-400 text-slate-800 dark:text-sky-100 hover:bg-sky-400/20'
                          : 'bg-emerald-400/10 border-emerald-400 text-slate-800 dark:text-emerald-100 hover:bg-emerald-400/20'}`
                      }
                    >
                      <div className="font-semibold truncate uppercase tracking-tight mb-0.5 group-hover/item:text-sky-400 transition-colors">{event.clientName}</div>
                      <div className="flex items-center gap-1.5 opacity-60 font-medium uppercase tracking-widest text-xs">
                        <div className={`w-1 h-1 rounded-full ${event.type === 'task' ? 'bg-sky-400' : 'bg-emerald-400'}`}></div>
                        {event.type === 'task' ? 'OPERATIVO' : 'SRI PROTOCOL'}
                      </div>
                    </div>
                  ))}
                </div>

                {isCurrentMonth && dayEvents.length === 0 && (
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/day:opacity-5 transition-opacity pointer-events-none">
                      <CalendarIcon size={64} className="text-slate-500" />
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 px-8 py-4 glass-tactical border border-white/5 rounded-[2rem] w-fit mx-auto animate-slide-up-fade">
         <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Tareas Operativas</span>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Protocolos Fiscales</span>
         </div>
         <div className="flex items-center gap-3 border-l border-white/10 pl-6 ml-2">
            <Info size={14} className="text-rose-400" />
            <span className="text-xs font-semibold text-rose-400/70 uppercase tracking-widest italic">Alertas SRI Automatizadas</span>
         </div>
      </div>
    </div>
  );
};
