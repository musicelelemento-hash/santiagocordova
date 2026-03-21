
import React, { memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Client, ServiceFeesConfig, DeclarationStatus } from '../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, getDaysUntilDue } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    AlertTriangle, ShieldCheck, Clock, Crown, Copy,
    CheckCircle2, ChevronRight, DollarSign, FileCheck, Send, Lock, TrendingUp, Store
} from 'lucide-react';

interface VirtualClientListProps {
  clients: Client[];
  serviceFees: ServiceFeesConfig;
  onView: (client: Client) => void;
  onQuickAction?: (client: Client, action: 'declare' | 'pay') => void;
}

// Client Row Component - Optimized for virtualization
const ClientRow = memo(({ data, index, style }: ListChildComponentProps<VirtualClientListProps>) => {
    const { clients, serviceFees, onView, onQuickAction } = data;
    const client = clients[index];
    
    // Status Logic duplicated from ClientCard but simplified for performance
    const today = new Date();
    const currentPeriod = getPeriod(client, today);
    const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
    const isDeclared = declaration?.status === DeclarationStatus.Enviada || declaration?.status === DeclarationStatus.Pagada;
    const isPaid = declaration?.status === DeclarationStatus.Pagada;
    const fee = getClientServiceFee(client, serviceFees);
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const isOverdue = dueDate && isPast(dueDate) && !isDeclared;
    const isVip = client.category.includes('Suscripción');

    // Visual Styles
    let borderClass = 'border-l-4 border-slate-200 dark:border-slate-700';
    let bgClass = 'bg-white dark:bg-gray-800';
    
    if (client.isActive === false) borderClass = 'border-l-4 border-gray-400 opacity-60';
    else if (isOverdue) borderClass = 'border-l-4 border-red-500';
    else if (declaration?.status === DeclarationStatus.Pendiente) borderClass = 'border-l-4 border-yellow-500';
    else if (isPaid) borderClass = 'border-l-4 border-emerald-500';

    if (isVip) bgClass = 'bg-sky-50 dark:bg-sky-900/10';

    const handleAction = (e: React.MouseEvent, action: 'declare' | 'pay') => {
        e.stopPropagation();
        onQuickAction?.(client, action);
    };

    // Row specific style adjustments
    const itemStyle = {
        ...style,
        top: (style.top as number) + 4,
        height: (style.height as number) - 8,
        left: 4,
        right: 4,
        width: "calc(100% - 8px)"
    };

    return (
        <div style={itemStyle} onClick={() => onView(client)} className={`
            ${bgClass} ${borderClass}
            rounded-xl shadow-sm border-t border-r border-b border-slate-100 dark:border-slate-700
            hover:shadow-md transition-all cursor-pointer flex flex-col justify-between p-4 group
        `}>
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-slate-800 dark:text-white truncate">{client.name}</h3>
                        {client.isActive === false && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 rounded uppercase">Inactivo</span>}
                        {isVip && <Crown size={12} className="text-amber-500 fill-current"/>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        {client.ruc}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">{client.regime}</span>
                    </p>
                </div>

                <div className="flex-shrink-0 text-right">
                    {isPaid ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg"><ShieldCheck size={12}/> Al Día</span>
                    ) : (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{formatPeriodForDisplay(currentPeriod).split(' ')[0]}</span>
                            <span className={`text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {dueDate ? format(dueDate, 'dd MMM', { locale: es }) : 'N/A'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Footer */}
            {client.isActive !== false && !isPaid && onQuickAction && (
                 <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     {!isDeclared && (
                         <button onClick={(e) => handleAction(e, 'declare')} className="px-3 py-1 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">Declarar</button>
                     )}
                     {isDeclared && !isPaid && (
                         <button onClick={(e) => handleAction(e, 'pay')} className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1">
                             <DollarSign size={12}/> Pagar ${fee}
                         </button>
                     )}
                 </div>
            )}
        </div>
    );
});

export const VirtualClientList: React.FC<VirtualClientListProps> = (props) => {
    return (
        <div style={{ height: '100%', minHeight: '400px' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={props.clients.length}
                        itemSize={120}
                        width={width}
                        itemData={props}
                        className="no-scrollbar"
                    >
                        {ClientRow}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
};
