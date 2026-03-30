
import React, { memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Client, ServiceFeesConfig, DeclarationStatus, TaxRegime } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, getNextPeriod, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';

interface VirtualClientListProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'deactivate') => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
}

// Client Row Component - Optimized for virtualization
const ClientRow = memo(({ data, index, style }: ListChildComponentProps<VirtualClientListProps>) => {
    const { clients, serviceFees, onView, onQuickAction, onUploadReceipt } = data;
    const client = clients[index];

    const fee = getClientServiceFee(client, serviceFees);
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = today.getMonth();

    // SMART PERIOD LOGIC
    const campaignP = getPeriod(client, today);
    const campaignDecl = (client.declarations || []).find(d => d.period === campaignP);
    const isCampaignDone = campaignDecl?.status === DeclarationStatus.Enviada || campaignDecl?.status === DeclarationStatus.Pagada || !!campaignDecl?.proof_file;
    const isCampaignPaid = !!campaignDecl?.is_paid;

    const period = isCampaignDone ? getNextPeriod(campaignP) : campaignP;
    const decl = (client.declarations || []).find(d => d.period === period);
    const isPaid = !!decl?.is_paid;
    const isDeclared = decl?.status === DeclarationStatus.Enviada || decl?.status === DeclarationStatus.Pagada || !!decl?.proof_file;

    const needsRenta = client.taxProfile?.requiresAnnualRenta || client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular;
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = (client.declarations || []).find(d => d.period === rentaPeriod);
    const isRentaPaid = false || !!rentaDecl?.is_paid;
    const isRentaDeclared = (
        rentaDecl?.status === DeclarationStatus.Enviada ||
        rentaDecl?.status === DeclarationStatus.Pagada ||
        !!rentaDecl?.proof_file ||
        undefined === DeclarationStatus.Enviada ||
        undefined === DeclarationStatus.Pagada ||
        false
    );

    const ivaDueDate = getDueDateForPeriod(client, period);
    const frequencyText = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor ? 'IVA Semestral' : (client.taxProfile?.ivaFrequency === 'Ninguno' ? 'Anual' : 'IVA Mensual');

    // MEDAL LOGIC
    const isIvaWorkable = frequencyText === 'IVA Mensual' || (frequencyText === 'IVA Semestral' && (month === 0 || month === 6 || month === 11 || month === 5));
    const isRentaWorkable = needsRenta && (month >= 0 && month <= 4);

    let merit = { label: 'Sin Pendientes', color: 'text-slate-300', icon: LucideIcons.Minus, rank: 4 };
    const isAllDeclared = isCampaignDone && (!needsRenta || isRentaDeclared);
    const isAllPaid = isCampaignPaid && (!needsRenta || isRentaPaid);

    if (isAllDeclared && isAllPaid) {
        merit = { label: 'Oro - Al Día', color: 'text-amber-400', icon: LucideIcons.Trophy, rank: 1 };
    } else if (isAllDeclared && !isAllPaid) {
        merit = { label: 'Plata - Pago Pend.', color: 'text-slate-400', icon: LucideIcons.Award, rank: 2 };
    } else if ((isIvaWorkable && !isCampaignDone) || (isRentaWorkable && !isRentaDeclared)) {
        merit = { label: 'Bronce - Gestión', color: 'text-orange-600', icon: LucideIcons.ShieldAlert, rank: 3 };
    }

    // Visual Styles
    const isVip = true;
    
    // Zenith Card Styles
    const cardBaseStyles = `
        relative overflow-hidden rounded-3xl border transition-all duration-500
        ${isVip 
            ? 'glass-zen border-primary/20 shadow-sm' 
            : 'bg-white/90 dark:bg-slate-900/90 border-slate-100 dark:border-white/5 shadow-sm'}
        ${client.isActive === false ? 'opacity-60 grayscale' : ''}
    `;

    const itemStyle = {
        ...style,
        top: (style.top as number) + 8,
        height: (style.height as number) - 16,
        left: 8,
        right: 8,
        width: "calc(100% - 16px)"
    };

    const hasCurrentProof = !!campaignDecl?.proof_file || false;
    const hasMissingHistoryPdf = client.declarations?.some(d => 
        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
    );

    return (
        <div style={itemStyle}>
            <div 
                onClick={() => onView(client)} 
                className={`${cardBaseStyles} p-4 flex flex-col justify-between h-full backdrop-blur-md active:scale-[0.98]`}
            >
                {/* Zenith Ambient Deco */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
                
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative shrink-0">
                            <div className={`p-2.5 rounded-2xl bg-opacity-10 ${merit.rank === 1 ? 'bg-amber-400' : (merit.rank === 2 ? 'bg-slate-400' : 'bg-orange-600')}`}>
                                <merit.icon size={20} className={merit.color} strokeWidth={2} />
                            </div>
                            {true && (
                                <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-lg">
                                    <LucideIcons.Crown size={8} className="fill-current" />
                                </div>
                            )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-800 dark:text-white text-[15px] tracking-tight mb-1 leading-tight flex items-center gap-2">
                                {hasMissingHistoryPdf && (
                                    <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)] shrink-0" title="Pendiente: Documentación histórica" />
                                )}
                                <span className="truncate">{client.name}</span>
                                {true && <LucideIcons.Crown size={12} className="text-amber-400 shrink-0" />}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {client.isActive === false && (
                                    <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest">Inactivo</span>
                                )}
                                {client.hasElderlyDevolucionIva && (
                                    <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-tight flex items-center gap-1">
                                        <LucideIcons.Heart size={8} strokeWidth={3} /> T.EDAD
                                    </span>
                                )}
                                <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 uppercase tracking-tight truncate max-w-[120px]">
                                    {client.regime}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-mono uppercase tracking-tighter">
                                    {client.ruc}
                                </span>
                                <span className="h-1 w-1 bg-slate-300 dark:bg-white/20 rounded-full shrink-0" />
                                <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 font-mono">
                                    ${fee.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                            <LucideIcons.Calendar size={10} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase font-mono">
                                {formatPeriodForDisplay(period)}
                            </span>
                        </div>
                        <div className={`mt-2 text-[12px] font-bold flex items-center gap-1 ${isPast(ivaDueDate || today) && !isCampaignDone ? 'text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {isPast(ivaDueDate || today) && !isCampaignDone && <LucideIcons.AlertCircle size={12} className="animate-pulse" />}
                            {ivaDueDate ? safeFormat(ivaDueDate, 'dd MMM') : 'N/A'}
                        </div>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center relative z-10">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mb-2">Estado SRI</span>
                        <div className="flex items-center gap-1.5">
                            {hasCurrentProof ? (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 uppercase tracking-tight">
                                    <LucideIcons.Check size={10} strokeWidth={3} /> GESTIÓN OK
                                </div>
                            ) : (
                                isDeclared && (
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 animate-pulse uppercase tracking-tight">
                                        <LucideIcons.FileWarning size={10} /> FALTA PDF
                                    </div>
                                )
                            )}
                            {!isDeclared && (
                                <div className="text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 uppercase tracking-tight">
                                    PENDIENTE
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, period); }}
                            className={`w-11 h-11 flex items-center justify-center rounded-2xl border transition-all active:scale-95 shadow-sm
                                ${hasCurrentProof 
                                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' 
                                    : 'bg-slate-800 text-white border-white/10 hover:bg-slate-700 shadow-lg shadow-slate-900/20'}`}
                        >
                            <LucideIcons.UploadCloud size={20} />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onView(client); }}
                            className="h-11 px-5 rounded-2xl flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] transition-all active:scale-95 bg-primary text-white shadow-xl shadow-primary/20 border border-primary/30"
                        >
                            <LucideIcons.Compass size={14} />
                            Ficha
                        </button>
                    </div>
                </div>

                {/* Zenith Growth Line */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent w-full opacity-40" />
            </div>
        </div>
    );
});

export const VirtualClientList: React.FC<VirtualClientListProps> = (props) => {
    return (
        <div style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={props.clients.length}
                        itemSize={150}
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

