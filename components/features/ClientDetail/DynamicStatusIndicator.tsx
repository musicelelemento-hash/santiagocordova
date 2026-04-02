import React, { useMemo } from 'react';
import { Client, DeclarationStatus } from '../../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../services/sri';
import { isPast, differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';

interface DynamicStatusIndicatorProps {
    client: Client;
    className?: string;
}

/**
 * DynamicStatusIndicator: Provides text-based intelligence on current tax obligations.
 * Migrated from legacy ClientsScreen for architectural consolidation (Zen v3.1).
 */
export const DynamicStatusIndicator: React.FC<DynamicStatusIndicatorProps> = ({ client, className = "" }) => {
    const today = useMemo(() => new Date(), []);
    const currentPeriod = useMemo(() => getPeriod(client, today), [client, today]);
    const dueDate = useMemo(() => getDueDateForPeriod(client, currentPeriod), [client, currentPeriod]);
    
    const activeDecl = useMemo(() => 
        client.declarations?.find(d => d.period === currentPeriod), 
    [client, currentPeriod]);

    const isDeclared = !!activeDecl?.proof_file || activeDecl?.status === DeclarationStatus.Enviada;
    const isPaid = !!activeDecl?.is_paid;
    
    // Status Logic
    const statusInfo = useMemo(() => {
        if (!dueDate) return { text: "No hay obligaciones activas", color: "text-on-surface-variant", icon: LucideIcons.Info };
        
        const days = differenceInCalendarDays(dueDate, today);
        const isOverdue = days < 0 && !isDeclared;

        if (isDeclared) {
            if (isPaid) return { text: "Todo al día", color: "text-tertiary", icon: LucideIcons.CheckCircle2 };
            return { text: "Declarado (Pendiente de pago)", color: "text-tertiary", icon: LucideIcons.CreditCard };
        }

        if (isOverdue) {
            const absDays = Math.abs(days);
            return { 
                text: `Venció hace ${absDays} ${absDays === 1 ? 'día' : 'días'}`, 
                color: "text-primary", 
                icon: LucideIcons.AlertTriangle 
            };
        }

        if (days === 0) return { text: "Vence HOY", color: "text-primary animate-pulse", icon: LucideIcons.Zap };
        
        if (days <= 3) return { text: `Vence en ${days} días`, color: "text-primary font-bold", icon: LucideIcons.Timer };

        return { 
            text: `Próximo vencimiento: ${format(dueDate, 'dd MMM', { locale: es })}`, 
            color: "text-on-surface-variant", 
            icon: LucideIcons.Clock 
        };
    }, [dueDate, today, isDeclared, isPaid]);

    return (
        <div className={`flex items-center gap-2 group ${className}`}>
            <div className={`p-1.5 rounded-lg bg-surface-low border border-outline-variant/5 transition-transform group-hover:scale-110`}>
                <statusInfo.icon size={12} className={statusInfo.color} />
            </div>
            <span className={`text-[11px] font-premium tracking-tight ${statusInfo.color}`}>
                {statusInfo.text}
            </span>
        </div>
    );
};
