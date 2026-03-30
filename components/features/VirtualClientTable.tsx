
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
        <div style={style} className={`flex border-b border-slate-100 dark:border-white/5 hover:bg-primary/[0.03] dark:hover:bg-primary/[0.08] transition-all items-center px-4 group/row hover:shadow-[inset_4px_0_0_0_theme(colors.primary.DEFAULT)] ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-inset ring-primary/30' : ''}`}>
            {/* Estatus Zen */}
            <div className="w-16 shrink-0 flex flex-col items-center group cursor-help relative" title={merit.label}>
                <div className={`p-2 rounded-xl bg-opacity-10 ${merit.rank === 1 ? 'bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : (merit.rank === 2 ? 'bg-slate-400' : 'bg-orange-600')} transition-transform group-hover/row:scale-110`}>
                    <merit.icon size={20} className={`${merit.color}`} strokeWidth={2} />
                </div>
                <span className={`text-[11px] font-bold uppercase mt-1.5 px-1.5 py-0.5 rounded-md border ${merit.color} ${merit.rank === 1 ? 'border-amber-400/30' : 'border-slate-500/20'}`}>{merit.label.split(' - ')[0]}</span>
            </div>

            <div className="flex-1 min-w-0 px-4">
                <div className="flex items-center gap-2">
                    {hasMissingHistoryPdf && (
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)] shrink-0" title="Pendiente: Documentación histórica" />
                    )}
                    <span 
                        className="font-semibold text-slate-800 dark:text-white text-[13.5px] truncate group-hover/row:text-primary transition-colors tracking-tight" 
                        title={client.name}
                    >
                        {client.tradeName || client.name}
                    </span>
                    {client.isActive === false && (
                        <span className="text-[11px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-md uppercase flex items-center gap-1">
                            <LucideIcons.UserX size={8} strokeWidth={3} />
                            Inactivo
                        </span>
                    )}
                    {true && (
                        <div className="flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200/50 px-2 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">
                            <LucideIcons.Crown size={8} className="fill-current" />
                            Protocolo VIP
                        </div>
                    )}
                    {(client.hasElderlyDevolucionIva || (client as any).hasElderlyIvaRefund) && (
                        <div className="flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">
                            <LucideIcons.Heart size={8} className="fill-current" />
                            T. EDAD
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate tracking-wide" title={client.name}>
                        {client.tradeName ? client.name : client.ruc}
                    </span>
                    {client.tradeName && (
                        <button 
                            onClick={handleCopyRuc}
                            className={`font-mono text-xs px-2 py-0.5 rounded-md border transition-all flex items-center gap-1.5 uppercase tracking-widest ${copied ? 'bg-primary text-white border-primary' : 'text-slate-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-primary/50 hover:text-primary'}`}
                            title="Copiar RUC"
                        >
                            {client.ruc}
                            {copied ? <LucideIcons.Check size={8} /> : <LucideIcons.Copy size={8} />}
                        </button>
                    )}
                    {!client.tradeName && (
                         <button 
                            onClick={handleCopyRuc}
                            className={`font-mono text-xs px-2 py-0.5 rounded-md border transition-all flex items-center gap-1.5 uppercase tracking-widest ${copied ? 'bg-primary text-white border-primary' : 'text-slate-400 border-transparent hover:border-primary/50 hover:text-primary'}`}
                            title="Copiar RUC"
                        >
                            <LucideIcons.Copy size={8} />
                        </button>
                    )}
                    <span className="text-xs font-bold text-primary/70 uppercase tracking-widest font-mono opacity-80">{client.regime}</span>
                </div>
            </div>

            {/* Perfil Táctico */}
            <div className="w-40 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex flex-col justify-center">
                <div className="flex flex-wrap gap-1.5">
                    {needsIva && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${isCampaignDone ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-500' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'}`}>
                            {isCampaignDone ? <LucideIcons.ShieldCheck size={10} strokeWidth={3} /> : <LucideIcons.Loader2 size={10} className="animate-spin" />}
                            <span className="text-[11px] font-semibold uppercase tracking-widest">{frequencyText.replace('IVA ', '')}</span>
                        </div>
                    )}
                    {needsRenta && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${isRentaDeclared ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-600'}`}>
                            {isRentaDeclared ? <LucideIcons.Award size={10} strokeWidth={3} /> : <LucideIcons.Target size={10} />}
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-inherit">RENTA</span>
                        </div>
                    )}
                    {client.hasRentaRefund && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${client.rentaRefundStatus === 'Completado' ? 'bg-sky-400/10 border-sky-400/20 text-sky-500' : 'bg-rose-400/10 border-rose-400/20 text-rose-400 animate-pulse'}`}>
                            <LucideIcons.HandCoins size={10} />
                            <span className="text-[11px] font-semibold uppercase tracking-widest">DEV. RENTA</span>
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
                        <span className={`text-xs font-semibold uppercase tracking-tighter ${(needsIva ? isCampaignDone : isRentaDeclared) ? 'text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {formatPeriodForDisplay(needsIva ? period : rentaPeriod)}
                        </span>
                        <span className={`text-xs font-semibold font-mono tracking-widest ${(needsIva ? isCampaignDone : isRentaDeclared) ? ((((needsIva ? campaignDecl : rentaDecl)?.proof_file) || (needsIva ? decl : rentaDecl)?.proof_file) ? 'text-emerald-400/70' : 'text-rose-400 animate-pulse') : (needsIva && ivaDueDate && isPast(ivaDueDate) ? 'text-rose-400/70' : 'text-sky-400/70')}`}>
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
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest mt-1">Recurrencia</span>
            </div>

            {/* Operaciones Zen */}
            <div className="w-52 shrink-0 px-4 border-l border-slate-100 dark:border-white/5 h-full flex flex-col justify-center gap-1.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onView(client); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border
                    ${isCampaignPaid ? 'bg-primary/20 text-primary border-primary/30 shadow-none' : 'bg-slate-800 text-white border-white/10 hover:bg-slate-700 active:scale-95'}`}>
                    <span>{isCampaignPaid ? 'LOGÍSTICA COMPLETA' : 'GESTIONAR PAGO'}</span>
                    {isCampaignPaid ? <LucideIcons.ShieldCheck size={12} /> : <LucideIcons.ChevronRight size={12} />}
                </button>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, period); }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border
                    ${isCampaignDone ? 'bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10' : 'bg-primary text-white border-primary hover:scale-[1.02] shadow-lg shadow-primary/20'}`}>
                    {isCampaignDone ? <LucideIcons.Check size={12} strokeWidth={3} /> : <LucideIcons.Upload size={12} />}
                    {isCampaignDone ? 'GESTIÓN FINALIZADA' : 'INICIAR TRÁMITE'}
                </button>
            </div>

            {/* Tactical Switch */}
            <div className="w-32 shrink-0 px-4 flex items-center justify-end gap-2">
                <button 
                    onClick={() => onView(client)}
                    className="flex items-center justify-center gap-2 text-white font-semibold text-xs bg-slate-800 dark:bg-white/5 hover:bg-sky-400 dark:hover:bg-sky-400 px-4 py-2.5 rounded-xl transition-all border border-white/5 uppercase tracking-widest"
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
        <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 425px)', minHeight: '550px' }}>
            <div className="flex bg-slate-50 dark:bg-white/5 text-[11px] font-bold uppercase text-slate-500 py-4 px-4 border-b border-slate-200 dark:border-white/5 active:select-none tracking-[0.2em]">
                <div className="w-16 shrink-0 text-center">Protocolo</div>
                <div className="flex-1 px-4">Titular / RUC</div>
                <div className="w-40 shrink-0 px-4">Configuración Fiscal</div>
                <div className="w-44 shrink-0 px-4">Estado SRI</div>
                <div className="w-28 shrink-0 px-4">Honorarios</div>
                <div className="w-52 shrink-0 px-4">Acciones de Gestión</div>
                <div className="w-32 shrink-0 text-right pr-4">Opciones</div>
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
