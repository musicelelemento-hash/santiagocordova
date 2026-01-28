
import React, { memo, useState } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { isPast, format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, ShieldCheck, Clock, Crown, Check, Copy,
    CreditCard, FileCheck, Send, CheckCircle2, ChevronRight, DollarSign, FileText, Store, Lock,
    TrendingUp
} from 'lucide-react';

interface ClientCardProps {
  client: Client;
  serviceFees: ServiceFeesConfig;
  onView: (client: Client) => void;
  onQuickAction?: (client: Client, action: 'declare' | 'pay') => void;
}

export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction }) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const today = new Date();
  const currentPeriod = getPeriod(client, today);
  const activeDecl = client.declarationHistory.find(d => d.period === currentPeriod);
  
  // --- 1. LÓGICA DE ESTADO MAESTRA (Workflow) ---
  const isDeclared = activeDecl?.status === DeclarationStatus.Enviada || activeDecl?.status === DeclarationStatus.Pagada;
  const isPaid = activeDecl?.status === DeclarationStatus.Pagada;
  
  // Detectar si es obligación anual (Renta)
  const isAnnual = currentPeriod.length === 4;

  const fee = getClientServiceFee(client, serviceFees);
  const isVip = client.category.includes('Suscripción');
  const dueDate = getDueDateForPeriod(client, currentPeriod);
  
  const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : 99;
  const isOverdue = dueDate && isPast(dueDate) && !isDeclared;

  // --- 2. LÓGICA DE SEMÁFORO (Visual Indicators) ---
  let statusColor = 'border-slate-200 dark:border-slate-800'; // Default
  let statusDot = 'bg-slate-400';
  let cardBg = 'bg-white dark:bg-slate-900';
  
  if (!client.isActive || !client.sriPassword) {
      statusColor = 'border-gray-400 opacity-75'; // ⚫ Gris (Inactivo/Sin Clave)
      statusDot = 'bg-gray-500';
  } else if (isOverdue) {
      statusColor = 'border-red-600 ring-2 ring-red-100'; // 🔴 Rojo (Vencido)
      statusDot = 'bg-red-600';
  } else if (isPaid) {
      statusColor = 'border-emerald-500'; // 🟢 Verde (Al día)
      statusDot = 'bg-emerald-500';
  } else if (!isPaid) {
      statusColor = 'border-amber-400'; // 🟡 Amarillo (Pendiente)
      statusDot = 'bg-amber-400';
      if (isAnnual) {
          // Estilo Especial para Temporada de Renta Pendiente
          cardBg = 'bg-indigo-50/50 dark:bg-indigo-900/20';
          statusColor = 'border-indigo-400';
      }
  }

  // Estilo VIP
  if (isVip && !isOverdue && !isAnnual) {
      cardBg = 'bg-sky-50/30 dark:bg-sky-900/10';
  }

  // Manejador de Copiado Rápido de RUC
  const handleCopyRuc = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(client.ruc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manejador de Acciones Secuenciales
  const handleActionClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onQuickAction) return;

      if (!isDeclared) {
          // PASO 1: COPIAR RUC Y DECLARAR (Abre SRI)
          navigator.clipboard.writeText(client.ruc);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          
          window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
          onQuickAction(client, 'declare');
      } else if (!isPaid) {
          // PASO 2: PAGAR (Genera Recibo)
          onQuickAction(client, 'pay');
      }
  };

  // Renderizado Condicional del Botón Principal
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

      // CASO 1: YA PAGADO (Ciclo Cerrado)
      if (isPaid) {
          return (
              <div className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold cursor-default opacity-80">
                  <ShieldCheck size={16} className="text-brand-teal"/>
                  <span>CICLO CERRADO</span>
              </div>
          );
      }

      // CASO 2: DECLARADO PERO NO PAGADO (Muestra Botón de Cobro)
      // * PRIORIDAD ABSOLUTA EN EL PROYECTO: BOTON PAGO *
      if (isDeclared) {
          return (
              <button 
                onClick={handleActionClick}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-between px-5 transition-all duration-300 group transform active:scale-[0.98] border border-white/20 animate-pulse-slow"
              >
                  <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white/20 rounded-lg">
                          <DollarSign size={18} className="text-white" strokeWidth={3} />
                      </div>
                      <div className="text-left leading-none">
                          <span className="block text-[10px] opacity-90 uppercase tracking-widest font-black text-emerald-100">Trabajo Realizado</span>
                          <span className="block text-sm font-black tracking-wide">REGISTRAR PAGO</span>
                      </div>
                  </div>
                  <span className="text-lg font-bold font-mono bg-black/20 px-2 py-1 rounded-lg border border-white/10 shadow-inner">${fee.toFixed(2)}</span>
              </button>
          );
      }

      // CASO 3: PENDIENTE (Muestra Botón de Declarar)
      // Si es Renta Anual, el botón es Morado/Indigo para destacar
      const btnBaseColor = isAnnual ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-brand-navy hover:bg-blue-900';
      const btnColor = isOverdue ? 'bg-red-600 hover:bg-red-500' : btnBaseColor;
      const shadowColor = isOverdue ? 'shadow-red-900/20' : (isAnnual ? 'shadow-indigo-500/30' : 'shadow-blue-900/20');
      
      return (
          <button 
            onClick={handleActionClick}
            className={`w-full py-3 rounded-xl ${btnColor} text-white shadow-lg ${shadowColor} flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-[0.98] group relative overflow-hidden`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {isAnnual ? <TrendingUp size={18}/> : <FileCheck size={18} />}
              <span className="font-bold text-sm uppercase tracking-wide">
                  {isAnnual ? `Declarar Renta ${currentPeriod}` : `Declarar ${formatPeriodForDisplay(currentPeriod).split(' ')[0]}`}
              </span>
              <ChevronRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform"/>
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
        {/* Banner Superior VIP o RENTA */}
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
            
            {/* Header: Avatar e Info Principal */}
            <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                    <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm transition-transform duration-300
                        ${isAnnual ? 'bg-indigo-100 text-indigo-700' : (isVip ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}
                        ${isHovered ? 'scale-105' : ''}
                    `}>
                        {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    {/* Traffic Light Dot */}
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

            {/* Info Grid */}
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

            {/* ACTION BUTTON AREA */}
            <div className="mt-auto pt-2">
                {renderActionButton()}
            </div>
        </div>
    </div>
  );
});
