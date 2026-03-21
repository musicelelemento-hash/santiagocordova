
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
        merit = { label: 'Oro - Al Día', color: 'text-amber-500', icon: LucideIcons.Trophy, rank: 1 };
    } else if (isAllDeclared && !isAllPaid) {
        merit = { label: 'Plata - Pago Pend.', color: 'text-slate-400', icon: LucideIcons.Award, rank: 2 };
    } else if ((isIvaWorkable && !isCampaignDone) || (isRentaWorkable && !isRentaDeclared)) {
        merit = { label: 'Bronce - Gestión', color: 'text-orange-600', icon: LucideIcons.ShieldAlert, rank: 3 };
    }

    // Visual Styles
    const isVip = true;
    
    // Elite Tactical Card Styles
    const cardBaseStyles = `
        relative overflow-hidden rounded-[24px] border transition-all duration-300
        ${isVip 
            ? 'bg-gradient-to-br from-sky-500/10 to-indigo-500/5 border-sky-400/30 shadow-[0_8px_32px_rgba(14,165,233,0.1)]' 
            : 'bg-white/80 dark:bg-slate-900/80 border-slate-100 dark:border-white/10 shadow-sm'}
        ${client.isActive === false ? 'opacity-50 grayscale' : ''}
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
                {/* Tactical Header Background Deco */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-500/5 to-transparent -mr-8 -mt-8 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative shrink-0">
                            <div className={`p-2 rounded-xl bg-${merit.rank === 1 ? 'amber' : (merit.rank === 2 ? 'slate' : 'orange')}-500/10`}>
                                <merit.icon size={20} className={merit.color} strokeWidth={2.5} />
                            </div>
                            {true && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-lg">
                                    <LucideIcons.Crown size={8} className="fill-current" />
                                </div>
                            )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                            <h3 className="font-black text-slate-800 dark:text-white text-[14px] uppercase tracking-tight mb-1 leading-tight flex items-center gap-2">
                                {hasMissingHistoryPdf && (
                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)] shrink-0" title="Falta documentación histórica" />
                                )}
                                <span className="truncate">{client.name}</span>
                                {true && <LucideIcons.Crown size={12} className="text-amber-500 shrink-0" />}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {client.isActive === false && (
                                    <span className="text-[7px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm bg-opacity-90">Offline</span>
                                )}
                                {client.hasElderlyDevolucionIva && (
                                    <span className="text-[7px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md uppercase tracking-tighter flex items-center gap-0.5">
                                        <LucideIcons.Heart size={6} strokeWidth={3} /> T.EDAD
                                    </span>
                                )}
                                <span className="text-[8px] font-black text-sky-500 bg-sky-500/5 px-1.5 py-0.5 rounded border border-sky-500/10 uppercase tracking-tighter truncate max-w-[100px]">
                                    {client.regime}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">
                                    {client.ruc}
                                </span>
                                <span className="h-1 w-1 bg-slate-300 dark:bg-white/20 rounded-full shrink-0" />
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    ${fee.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                            <LucideIcons.Calendar size={10} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase font-mono">
                                {formatPeriodForDisplay(period)}
                            </span>
                        </div>
                        <div className={`mt-1.5 text-[11px] font-black flex items-center gap-1 ${isPast(ivaDueDate || today) && !isCampaignDone ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            {isPast(ivaDueDate || today) && !isCampaignDone && <LucideIcons.AlertCircle size={10} className="animate-pulse" />}
                            {ivaDueDate ? safeFormat(ivaDueDate, 'dd MMM') : 'N/A'}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estatus Tributario</span>
                        <div className="flex items-center gap-1.5">
                            {hasCurrentProof ? (
                                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 uppercase tracking-tighter">
                                    <LucideIcons.Check size={10} /> PROBANTE OK
                                </div>
                            ) : (
                                isDeclared && (
                                    <div className="flex items-center gap-1 text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20 animate-pulse uppercase tracking-tighter shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                        <LucideIcons.FileWarning size={10} /> FALTA PDF
                                    </div>
                                )
                            )}
                            {!isDeclared && (
                                <div className="text-[8px] font-black text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 uppercase tracking-tighter">
                                    PENDIENTE
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, period); }}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-90 shadow-sm
                                ${hasCurrentProof 
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                    : 'bg-sky-500/10 text-sky-500 border-sky-500/30 hover:bg-sky-500 hover:text-white'}`}
                        >
                            <LucideIcons.UploadCloud size={20} />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onView(client); }}
                            className="h-10 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-lg bg-slate-900 dark:bg-sky-600 text-white shadow-slate-900/20 dark:shadow-sky-600/30 border-slate-800 dark:border-sky-500"
                        >
                            <LucideIcons.FileText size={14} />
                            FICHA
                        </button>
                    </div>
                </div>

                {/* Rank Badge Indicator */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent w-full opacity-50" />
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

