
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { isPast, format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, ShieldCheck, Clock, Crown, Copy,
    CheckCircle2, ChevronRight, DollarSign, FileCheck, Send, Lock, TrendingUp, Store
} from 'lucide-react';

interface ClientCardProps {
  client: Client;
  serviceFees: ServiceFeesConfig;
  onView: (client: Client) => void;
  onQuickAction?: (client: Client, action: 'declare' | 'pay') => void;
}

export const ClientCard: React.FC<ClientCardProps> = memo(({ client, serviceFees, onView, onQuickAction }) => {
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  
  const today = new Date();
  const currentPeriod = getPeriod(client, today);
  const activeDecl = client.declarationHistory.find(d => d.period === currentPeriod);
  
  // Lógica de Estado
  const isDeclared = activeDecl?.status === DeclarationStatus.Enviada || activeDecl?.status === DeclarationStatus.Pagada;
  const isPaid = activeDecl?.status === DeclarationStatus.Pagada;
  const fee = getClientServiceFee(client, serviceFees);
  const isVip = client.category.includes('Suscripción');
  const dueDate = getDueDateForPeriod(client, currentPeriod);
  
  // Cálculos de Tiempo
  const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, today) : 99;
  const isOverdue = dueDate && isPast(dueDate) && !isDeclared;
  const isUrgent = daysUntilDue <= 3 && !isDeclared;

  // Lógica de Diseño (VIP vs Normal)
  const cardBg = isVip 
    ? 'bg-gradient-to-br from-[#0B2149] to-[#1a2e5a] text-white border-amber-500/30' 
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';

  const textColor = isVip ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400';
  const titleColor = isVip ? 'text-white' : 'text-slate-800 dark:text-white';
  const iconColor = isVip ? 'text-amber-400' : 'text-brand-teal';

  // Indicador de Estado (Semáforo)
  let statusBadge = { color: 'bg-slate-100 text-slate-500', text: 'Pendiente', icon: Clock };
  if (!client.isActive) statusBadge = { color: 'bg-gray-100 text-gray-400', text: 'Inactivo', icon: Lock };
  else if (isPaid) statusBadge = { color: 'bg-emerald-100 text-emerald-700', text: 'Al Día', icon: ShieldCheck };
  else if (isDeclared) statusBadge = { color: 'bg-blue-100 text-blue-700', text: 'Declarado', icon: Send };
  else if (isOverdue) statusBadge = { color: 'bg-red-100 text-red-700', text: 'Vencido', icon: AlertTriangle };
  else if (isUrgent) statusBadge = { color: 'bg-amber-100 text-amber-700', text: 'Vence Pronto', icon: AlertTriangle };

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(client.ruc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (e: React.MouseEvent, action: 'declare' | 'pay') => {
      e.stopPropagation();
      if(onQuickAction) onQuickAction(client, action);
  };

  return (
    <div 
        onClick={() => onView(client)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
            relative rounded-[1.5rem] border shadow-sm transition-all duration-300 cursor-pointer overflow-hidden group
            ${cardBg} ${isHovered ? 'shadow-xl -translate-y-1' : ''}
            ${isOverdue && !isVip ? 'border-red-300 ring-1 ring-red-100' : ''}
        `}
    >
        {isVip && (
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Crown size={80} />
            </div>
        )}
        
        <div className="p-5 relative z-10">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${isVip ? 'bg-amber-500 text-brand-navy' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {client.name.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm leading-tight line-clamp-1 ${titleColor}`}>
                            {client.tradeName || client.name}
                        </h3>
                        <div className={`flex items-center gap-1 text-[10px] font-medium ${textColor}`}>
                            <span className="font-mono">{client.ruc}</span>
                            <button onClick={handleCopy} className="hover:text-amber-400 transition-colors">
                                {copied ? <CheckCircle2 size={10}/> : <Copy size={10}/>}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${statusBadge.color}`}>
                    <statusBadge.icon size={12}/>
                    {statusBadge.text}
                </div>
            </div>

            {/* Info Body */}
            <div className={`rounded-xl p-3 mb-3 flex justify-between items-center ${isVip ? 'bg-white/10 border border-white/10' : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700'}`}>
                <div>
                    <p className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${isVip ? 'text-slate-300' : 'text-slate-400'}`}>
                        Próxima Obligación
                    </p>
                    <p className={`text-xs font-bold ${titleColor} flex items-center gap-1`}>
                        {client.regime === TaxRegime.RimpeNegocioPopular ? <TrendingUp size={12}/> : <FileCheck size={12}/>}
                        {formatPeriodForDisplay(currentPeriod).split(' ')[0]}
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${isVip ? 'text-slate-300' : 'text-slate-400'}`}>
                        Vencimiento
                    </p>
                    <p className={`text-xs font-bold ${isOverdue ? 'text-red-500' : (isUrgent ? 'text-amber-500' : titleColor)}`}>
                        {dueDate ? format(dueDate, 'dd MMM', {locale: es}) : 'N/A'}
                    </p>
                </div>
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 dark:border-slate-700/50">
                <div className={`text-[10px] font-medium flex items-center gap-1 ${textColor}`}>
                    {client.category}
                </div>
                
                {client.isActive && !isPaid && (
                    <div className="flex gap-2">
                        {!isDeclared && (
                            <button 
                                onClick={(e) => handleAction(e, 'declare')}
                                className={`p-2 rounded-lg transition-all ${isVip ? 'bg-amber-500 text-brand-navy hover:bg-amber-400' : 'bg-brand-navy text-white hover:bg-slate-700'}`}
                                title="Declarar"
                            >
                                <FileCheck size={14}/>
                            </button>
                        )}
                        {isDeclared && (
                            <button 
                                onClick={(e) => handleAction(e, 'pay')}
                                className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-1"
                                title="Registrar Pago"
                            >
                                <DollarSign size={14}/> 
                                <span className="text-xs font-bold">${fee}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
});
