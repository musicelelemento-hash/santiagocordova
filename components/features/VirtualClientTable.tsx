
import React, { memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Client, ServiceFeesConfig, DeclarationStatus, TaxRegime } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, getNextPeriod, safeFormat, requiresIva } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';

interface VirtualClientTableProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client) => void;
    onQuickAction: (client: Client, action: 'declare' | 'pay' | 'deactivate') => void;
    onUploadReceipt: (client: Client, period?: string) => void;
}

const TableRow = memo(({ data, index, style }: ListChildComponentProps<VirtualClientTableProps>) => {
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

    const needsIva = requiresIva(client);
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
    const rentaDueDate = getDueDateForPeriod(client, rentaPeriod);

    // ICE & PVP
    const icePeriod = `${getPeriod(client, today)}:ICE`;
    const pvpPeriod = `${currentYear}:PVP`;
    const iceDecl = (client.declarations || []).find(d => d.period === icePeriod);
    const pvpDecl = (client.declarations || []).find(d => d.period === pvpPeriod);
    const isIceDone = !!iceDecl?.proof_file || iceDecl?.status === DeclarationStatus.Enviada || false;
    const isPvpDone = !!pvpDecl?.proof_file || pvpDecl?.status === DeclarationStatus.Enviada || false;
    const hasMissingHistoryPdf = client.declarations?.some(d => 
        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
    );

    const frequencyText = client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor ? 'IVA Semestral' : (client.taxProfile?.ivaFrequency === 'Ninguno' ? 'Anual' : 'IVA Mensual');

    // MEDAL LOGIC
    const isIvaWorkable = frequencyText === 'IVA Mensual' || (frequencyText === 'IVA Semestral' && (month === 0 || month === 6 || month === 11 || month === 5));
    const isRentaWorkable = needsRenta && (month >= 0 && month <= 4);

    let merit = { label: 'Sin Pendientes', color: 'text-slate-300', icon: LucideIcons.Minus, rank: 4 };
    const isAllDeclared = (!needsIva || isCampaignDone) && (!needsRenta || isRentaDeclared);
    const isAllPaid = (!needsIva || isCampaignPaid) && (!needsRenta || isRentaPaid);

    if (isAllDeclared && isAllPaid) {
        merit = { label: 'Oro - Al Día', color: 'text-amber-400', icon: LucideIcons.Trophy, rank: 1 };
    } else if (isAllDeclared && !isAllPaid) {
        merit = { label: 'Plata - Pago Pend.', color: 'text-slate-400', icon: LucideIcons.Award, rank: 2 };
    } else if ((needsIva && isIvaWorkable && !isCampaignDone) || (isRentaWorkable && !isRentaDeclared)) {
        merit = { label: 'Bronce - Gestión', color: 'text-orange-600', icon: LucideIcons.ShieldAlert, rank: 3 };
    }

    const isRefundAlertActive = 
        (client.rentaRefundStatus === 'Solicitado' && client.rentaRefundRequestedAt && differenceInHours(today, new Date(client.rentaRefundRequestedAt)) >= 6) ||
        (client.rentaRefundStatus === 'Esperando Confirmación');

    const [copied, setCopied] = React.useState(false);

    const handleCopyRuc = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={style} className={`flex border-b border-slate-100 dark:border-white/5 hover:bg-sky-400/[0.02] dark:hover:bg-sky-400/[0.05] transition-all items-center px-4 group/row hover:shadow-[inset_4px_0_0_0_#0ea5e9] ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-inset ring-sky-400/50' : ''}`}>
            {/* Medalla Elite */}
            <div className="w-16 shrink-0 flex flex-col items-center group cursor-help relative" title={merit.label}>
                <div className={`p-2 rounded-xl bg-opacity-10 ${merit.rank === 1 ? 'bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : (merit.rank === 2 ? 'bg-slate-400' : 'bg-orange-600')} transition-transform group-hover/row:scale-110`}>
                    <merit.icon size={22} className={`${merit.color}`} strokeWidth={merit.rank === 1 ? 3 : 2} />
                </div>
                <span className={`text-[7px] font-semibold uppercase mt-1.5 px-1.5 py-0.5 rounded border ${merit.color} ${merit.rank === 1 ? 'border-amber-400/30' : 'border-slate-500/20'}`}>{merit.label.split(' - ')[0]}</span>
            </div>

            {/* Cliente Detail - Unit Identity */}
            <div className="flex-1 min-w-0 px-4">
                <div className="flex items-center gap-2">
                    {hasMissingHistoryPdf && (
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)] shrink-0" title="Falta documentación histórica" />
                    )}
                    <span 
                        className="font-semibold text-slate-800 dark:text-white text-[13px] truncate group-hover/row:text-sky-500 transition-colors uppercase tracking-tight" 
                        title={client.name}
                    >
                        {client.tradeName || client.name}
                    </span>
                    {client.isActive === false && (
                        <span className="text-[7px] font-semibold bg-rose-400 text-white px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <LucideIcons.UserX size={8} strokeWidth={4} />
                            Desactivado
                        </span>
                    )}
                    {true && (
                        <div className="flex items-center gap-1 text-[7px] font-semibold bg-amber-400 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter ring-2 ring-amber-400/20">
                            <LucideIcons.Crown size={8} fill="currentColor" />
                            VIP UNIT
                        </div>
                    )}
                    {(client.hasElderlyDevolucionIva || (client as any).hasElderlyIvaRefund) && (
                        <div className="flex items-center gap-1 text-[7px] font-semibold bg-emerald-400 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter ring-2 ring-emerald-400/20">
                            <LucideIcons.Heart size={8} fill="currentColor" />
                            T. EDAD
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 truncate uppercase tracking-wider" title={client.name}>
                        {client.tradeName ? client.name : client.ruc}
                    </span>
                    {client.tradeName && (
                        <button 
                            onClick={handleCopyRuc}
                            className={`font-mono text-[8px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 uppercase tracking-widest ${copied ? 'bg-emerald-400 text-white border-emerald-400' : 'text-slate-400 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-sky-400 hover:text-sky-400'}`}
                            title="Copiar RUC"
                        >
                            {client.ruc}
                            {copied ? <LucideIcons.Check size={8} /> : <LucideIcons.Copy size={8} />}
                        </button>
                    )}
                    {!client.tradeName && (
                         <button 
                            onClick={handleCopyRuc}
                            className={`font-mono text-[8px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 uppercase tracking-widest ${copied ? 'bg-emerald-400 text-white border-emerald-400' : 'text-slate-400 border-transparent hover:border-sky-400 hover:text-sky-400'}`}
                            title="Copiar RUC"
                        >
                            <LucideIcons.Copy size={8} />
                        </button>
                    )}
                    <span className="text-[8px] font-semibold text-sky-500/70 uppercase tracking-wider font-mono">{client.regime}</span>
                </div>
            </div>

            {/* Perfil Táctico */}
            <div className="w-40 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex flex-col justify-center">
                <div className="flex flex-wrap gap-1.5">
                    {needsIva && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${isCampaignDone ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-500' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'}`}>
                            {isCampaignDone ? <LucideIcons.ShieldCheck size={10} strokeWidth={3} /> : <LucideIcons.Loader2 size={10} className="animate-spin" />}
                            <span className="text-[9px] font-semibold uppercase tracking-widest">{frequencyText.replace('IVA ', '')}</span>
                        </div>
                    )}
                    {needsRenta && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${isRentaDeclared ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-600'}`}>
                            {isRentaDeclared ? <LucideIcons.Award size={10} strokeWidth={3} /> : <LucideIcons.Target size={10} />}
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-inherit">RENTA</span>
                        </div>
                    )}
                    {client.hasRentaRefund && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${client.rentaRefundStatus === 'Completado' ? 'bg-sky-400/10 border-sky-400/20 text-sky-500' : 'bg-rose-400/10 border-rose-400/20 text-rose-400 animate-pulse'}`}>
                            <LucideIcons.HandCoins size={10} />
                            <span className="text-[9px] font-semibold uppercase tracking-widest">DEV. RENTA</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Cronómetro SRI */}
            <div className="w-44 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex items-center">
                <div className={`flex items-center gap-3 p-2 rounded-xl border w-full transition-all ${isCampaignDone ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCampaignDone ? 'bg-emerald-400 text-white' : (needsIva && ivaDueDate && isPast(ivaDueDate) ? 'bg-rose-400 text-white animate-pulse' : 'bg-sky-400 text-white')}`}>
                        <LucideIcons.Clock size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-semibold uppercase tracking-tighter ${(needsIva ? isCampaignDone : isRentaDeclared) ? 'text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {formatPeriodForDisplay(needsIva ? period : rentaPeriod)}
                        </span>
                        <span className={`text-[8px] font-semibold font-mono tracking-widest ${(needsIva ? isCampaignDone : isRentaDeclared) ? ((((needsIva ? campaignDecl : rentaDecl)?.proof_file) || (needsIva ? decl : rentaDecl)?.proof_file) ? 'text-emerald-400/70' : 'text-rose-400 animate-pulse') : (needsIva && ivaDueDate && isPast(ivaDueDate) ? 'text-rose-400/70' : 'text-sky-400/70')}`}>
                            {(needsIva ? isCampaignDone : isRentaDeclared) ? 
                                ((((needsIva ? campaignDecl : rentaDecl)?.proof_file) || (needsIva ? decl : rentaDecl)?.proof_file) ? 'TARGET OK' : 'FALTA PDF') 
                                : (needsIva ? (ivaDueDate ? safeFormat(ivaDueDate, 'dd MMM') : 'N/A') : (rentaDueDate ? safeFormat(rentaDueDate, 'dd MMM') : 'N/A'))}
                        </span>
                    </div>
                    {(campaignDecl?.proof_file || decl?.proof_file) && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                const file = campaignDecl?.proof_file || decl?.proof_file;
                                if (file?.content) {
                                    // Abrir PDF en nueva pestaña si es base64
                                    const win = window.open();
                                    win?.document.write(`<iframe src="${file.content}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                } else {
                                    onView(client); // Fallback a la ficha
                                }
                            }}
                            className="ml-auto p-1.5 rounded-lg bg-sky-400/10 text-sky-400 hover:bg-sky-400 hover:text-white transition-all border border-sky-400/20" 
                            title="Ver Comprobante SRI Online"
                        >
                            <LucideIcons.Eye size={12} strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>

            {/* Logistics - Fee */}
            <div className="w-28 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex flex-col justify-center">
                <span className="font-semibold text-emerald-500 dark:text-emerald-400 text-base font-mono leading-none tracking-tighter">${fee.toFixed(2)}</span>
                <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-widest mt-1">Recurrencia</span>
            </div>

            {/* Operaciones Críticas */}
            <div className="w-52 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex flex-col justify-center gap-1.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onView(client); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all border
                    ${isCampaignPaid ? 'bg-emerald-400 text-white border-emerald-400 shadow-lg shadow-emerald-400/20' : 'bg-[#0B2149] text-white border-white/10 hover:bg-sky-900 active:scale-95'}`}>
                    <span>{isCampaignPaid ? 'LOGÍSTICA OK' : 'REGISTRAR PAGO'}</span>
                    {isCampaignPaid ? <LucideIcons.ShieldCheck size={12} /> : <LucideIcons.Zap size={12} />}
                </button>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, period); }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all border
                    ${isCampaignDone ? 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10' : 'bg-sky-400 text-white border-sky-400 hover:bg-sky-500 shadow-lg shadow-sky-400/20'}`}>
                    {isCampaignDone ? <LucideIcons.Target size={12} strokeWidth={3} /> : <LucideIcons.Upload size={12} />}
                    {isCampaignDone ? 'MISIÓN CUMPLIDA' : 'DESPLEGAR SRI'}
                </button>
            </div>

            {/* Tactical Switch */}
            <div className="w-32 shrink-0 px-4 flex items-center justify-end gap-2">
                <button 
                    onClick={() => onView(client)}
                    className="flex items-center justify-center gap-2 text-white font-semibold text-[10px] bg-slate-800 dark:bg-white/5 hover:bg-sky-400 dark:hover:bg-sky-400 px-4 py-2.5 rounded-xl transition-all border border-white/5 uppercase tracking-widest"
                >
                    Ficha
                    <LucideIcons.ArrowRight size={14} />
                </button>
                <div className="h-8 w-[1px] bg-slate-100 dark:bg-white/5"></div>
                <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`¿Desactivar a ${client.name}?`)) onQuickAction(client, 'deactivate'); }}
                    className="p-2 text-slate-300 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                    title="Dar de baja de la unidad"
                >
                    <LucideIcons.ShieldX size={18} />
                </button>
            </div>
        </div>
    );
});

export const VirtualClientTable: React.FC<VirtualClientTableProps> = (props) => {
    return (
        <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-[24px] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 420px)', minHeight: '550px' }}>
            <div className="flex bg-slate-100/50 dark:bg-black/20 text-[10px] font-semibold uppercase text-slate-500 py-4 px-4 border-b border-slate-200 dark:border-white/5 active:select-none tracking-widest">
                <div className="w-16 shrink-0 text-center">Rank</div>
                <div className="flex-1 px-4">Identificador de Unidad</div>
                <div className="w-40 shrink-0 px-4">Perfil Táctico</div>
                <div className="w-44 shrink-0 px-4">Fase SRI</div>
                <div className="w-28 shrink-0 px-4">Logística</div>
                <div className="w-52 shrink-0 px-4">Operaciones</div>
                <div className="w-32 shrink-0 text-right pr-4">Acciones</div>
            </div>
            <div className="flex-1">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            height={height}
                            itemCount={props.clients.length}
                            itemSize={78} // Slightly taller for elite spacing
                            width={width}
                            itemData={props}
                            className="no-scrollbar"
                        >
                            {TableRow}
                        </List>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
};
