
import React, { memo, useState } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { isPast, format, differenceInCalendarDays, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, ShieldCheck, Clock, Crown, Check, Copy,
    CreditCard, FileCheck, Send, CheckCircle2, ChevronRight, DollarSign, FileText, Store, Lock,
    TrendingUp, Calendar as CalendarIcon, Printer
} from 'lucide-react';

interface ClientCardProps {
  client: Client;
  serviceFees: ServiceFeesConfig;
  onView: (client: Client) => void;
  onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'receipt') => void;
}

export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction }) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const today = new Date();
  const currentPeriod = getPeriod(client, today);
  const activeDecl = client.declarationHistory.find(d => d.period === currentPeriod);
  
  // --- 1. LÓGICA DE ESTADO PRINCIPAL (Mensual/Semestral) ---
  const isDeclared = activeDecl?.status === DeclarationStatus.Enviada || activeDecl?.status === DeclarationStatus.Pagada;
  const isPaid = activeDecl?.status === DeclarationStatus.Pagada;
  const isAnnual = currentPeriod.length === 4;

  const fee = getClientServiceFee(client, serviceFees);
  const isVip = client.category.includes('Suscripción');
  const dueDate = getDueDateForPeriod(client, currentPeriod);
  
  const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : 99;
  const isOverdue = dueDate && isPast(dueDate) && !isDeclared;

  // --- 2. LÓGICA SECUNDARIA: RENTA ANUAL ---
  const prevYearStr = (getYear(today) - 1).toString();
  const rentaDecl = client.declarationHistory.find(d => d.period === prevYearStr);
  const isRentaPending = 
        !isAnnual && 
        client.regime !== TaxRegime.RimpeNegocioPopular && 
        (!rentaDecl || (rentaDecl.status !== DeclarationStatus.Pagada && rentaDecl.status !== DeclarationStatus.Enviada));


  // --- 3. ESTILOS ---
  let statusColor = 'border-slate-200 dark:border-slate-800'; 
  let statusDot = 'bg-slate-400';
  let cardBg = 'bg-white dark:bg-slate-900';
  
  if (!client.isActive || !client.sriPassword) {
      statusColor = 'border-gray-400 opacity-75'; 
      statusDot = 'bg-gray-500';
  } else if (isOverdue) {
      statusColor = 'border-red-600 ring-2 ring-red-100'; 
      statusDot = 'bg-red-600';
  } else if (isPaid) {
      statusColor = 'border-emerald-500'; 
      statusDot = 'bg-emerald-500';
  } else if (!isPaid) {
      statusColor = 'border-amber-400'; 
      statusDot = 'bg-amber-400';
      if (isAnnual) {
          cardBg = 'bg-indigo-50/50 dark:bg-indigo-900/20';
          statusColor = 'border-indigo-400';
      }
  }

  if (isVip && !isOverdue && !isAnnual) {
      cardBg = 'bg-sky-50/30 dark:bg-sky-900/10';
  }

  const handleCopyRuc = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(client.ruc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActionClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onQuickAction) return;

      if (!isDeclared) {
          onQuickAction(client, 'declare');
      } else if (!isPaid) {
          onQuickAction(client, 'pay');
      } else {
          onQuickAction(client, 'receipt');
      }
  };

  const renderActionButton = () => {
      if (!client.isActive) return null;
      if (!client.sriPassword) {
          return (
             <div className="w-full py-3 rounded-xl bg-gray-100 border border-gray-300 flex items-center justify-center gap-2 text-gray-500 text-xs font-bold cursor-not-allowed">
                  <Lock size={16} />
                  <span>SIN CLAVE SRI</span>
              </div>
          );
      }

      if (isPaid) {
          return (
              <button 
                  onClick={handleActionClick}
                  className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold transition-all"
              >
                  <Printer size={16}/>
                  <span>Ver Comprobante</span>
              </button>
          );
      }

      if (isDeclared) {
          return (
              <button 
                onClick={handleActionClick}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-between px-5 transition-all duration-300 group transform active:scale-[0.98] border border-white/20"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white/20 rounded-lg animate-pulse">
                          <DollarSign size={18} className="text-white" strokeWidth={3} />
                      </div>
                      <div className="text-left leading-none">
                          <span className="block text-[9px] opacity-90 uppercase tracking-widest font-black text-emerald-100">Paso 2/2</span>
                          <span className="block text-sm font-black tracking-wide">REGISTRAR PAGO</span>
                      </div>
                  </div>
                  <span className="text-lg font-bold font-mono bg-black/20 px-2 py-1 rounded-lg border border-white/10 shadow-inner">${fee.toFixed(2)}</span>
              </button>
          );
      }

      const btnBaseColor = isAnnual ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-brand-navy hover:bg-blue-800';
      const btnColor = isOverdue ? 'bg-red-600 hover:bg-red-500' : btnBaseColor;
      const shadowColor = isOverdue ? 'shadow-red-900/20' : (isAnnual ? 'shadow-indigo-500/30' : 'shadow-blue-900/20');
      
      return (
          <button 
            onClick={handleActionClick}
            className={`w-full py-3.5 rounded-xl ${btnColor} text-white shadow-lg ${shadowColor} flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-[0.98] group relative overflow-hidden`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {isAnnual ? <TrendingUp size={18}/> : <FileCheck size={18} />}
              <div className="text-left leading-tight">
                  <span className="block text-[9px] opacity-70 uppercase font-black">Paso 1/2</span>
                  <span className="font-bold text-sm uppercase tracking-wide">
                    {isAnnual ? `Declarar Renta` : `Declarar ${formatPeriodForDisplay(currentPeriod).split(' ')[0]}`}
                  </span>
              </div>
              <ChevronRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform ml-auto"/>
          </button>
      );
  };

  return (
    <div 
        onClick={() => onView(client)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
            relative ${cardBg} rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden
            ${statusColor} hover:shadow-xl
        `}
    >
        {isVip && (
            <div className="absolute top-0 right-0 z-10">
                <div className="bg-gradient-to-bl from-brand-teal to-teal-600 text-white px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                    <Crown size={10} fill="currentColor" /> VIP
                </div>
            </div>
        )}
        {isAnnual && !isVip && !isPaid && (
             <div className="absolute top-0 right-0 z-10">
                <div className="bg-gradient-to-bl from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                    <TrendingUp size={10} /> RENTA
                </div>
            </div>
        )}

        <div className="p-5 flex flex-col h-full gap-4">
            
            <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                    <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm transition-transform duration-300
                        ${isAnnual ? 'bg-indigo-100 text-indigo-700' : (isVip ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}
                        ${isHovered ? 'scale-105' : ''}
                    `}>
                        {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white dark:border-slate-900 rounded-full shadow-sm ${statusDot}`}></div>
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">
                        {client.tradeName || client.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mb-1.5">{client.name}</p>
                    
                    <button 
                        onClick={handleCopyRuc}
                        className={`
                            flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all
                            ${copied 
                                ? 'bg-brand-teal/20 text-brand-teal' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}
                        `}
                    >
                        {client.ruc}
                        {copied ? <CheckCircle2 size={10}/> : <Copy size={10}/>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Obligación</span>
                    <span className={`font-bold ${isAnnual ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {formatPeriodForDisplay(currentPeriod).split(' ')[0]}
                    </span>
                </div>
                <div className="text-right">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Vencimiento</span>
                    <span className={`font-bold ${isOverdue ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {dueDate ? format(dueDate, 'dd MMM', { locale: es }) : 'N/A'}
                    </span>
                </div>
            </div>

            {/* Alerta de Renta Pendiente (Menos Invasiva) */}
            {isRentaPending && (
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-lg px-3 py-2 text-[10px] animate-fade-in">
                     <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <TrendingUp size={12}/> Renta {prevYearStr} Pendiente
                     </span>
                     <span className="text-indigo-500 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onView(client); }}>Ver</span>
                </div>
            )}

            <div className="mt-auto pt-2">
                {renderActionButton()}
            </div>
        </div>
    </div>
  );
});
