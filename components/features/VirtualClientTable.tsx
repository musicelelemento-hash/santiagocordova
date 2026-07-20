
import React, { memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Client, ServiceFeesConfig, DeclarationStatus, TaxRegime } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, getNextPeriod, safeFormat, requiresIva } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { TaxFrequency, getClientDebtSummary } from '../../services/complianceEngine';
import { isPast, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';

interface VirtualClientTableProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client) => void;
    onQuickAction: (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge') => void;
    onUploadReceipt: (client: Client, period?: string) => void;
    frequency?: TaxFrequency | 'all';
    isTrashView?: boolean;
    isCobrosView?: boolean;
}

const TableRow = memo(({ data, index, style }: ListChildComponentProps<VirtualClientTableProps>) => {
    const { clients, serviceFees, onView, onQuickAction, onUploadReceipt, frequency, isTrashView, isCobrosView } = data;
    const client = clients[index];
    
    const fee = getClientServiceFee(client, serviceFees);
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = today.getMonth();

    // SMART PERIOD LOGIC
    const campaignP = getPeriod(client, today, (frequency === 'all' || frequency === 'Anual') ? undefined : frequency);
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
    const isRentaPaid = !!rentaDecl?.is_paid;
    const isRentaDeclared = (
        rentaDecl?.status === DeclarationStatus.Enviada ||
        rentaDecl?.status === DeclarationStatus.Pagada ||
        !!rentaDecl?.proof_file
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

    const debtSummary = getClientDebtSummary(client, serviceFees, today);

    return (
        <div style={style} className={`flex border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all items-center px-4 group/row hover:shadow-[inset_4px_0_0_0_theme(colors.primary.DEFAULT)] ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-inset ring-primary/30' : ''} ${isCobrosView && debtSummary.totalDebt > 0 ? 'bg-rose-50/20 dark:bg-rose-950/20 hover:bg-rose-50/40 dark:hover:bg-rose-950/40' : ''}`}>
            {/* Estatus Zen */}
            <div className="w-20 shrink-0 flex flex-col items-center group cursor-help relative px-2" title={merit.label}>
                <div className={`p-2.5 rounded-2xl ${merit.rank === 1 ? 'bg-tertiary/10 text-tertiary shadow-sm' : (merit.rank === 2 ? 'bg-on-surface-variant/10 text-on-surface-variant' : 'bg-primary/10 text-primary')} transition-all group-hover:scale-110`}>
                    <merit.icon size={22} strokeWidth={2.5} />
                </div>
                <span className={`text-[9px] font-bold uppercase mt-2 px-2 py-0.5 rounded-full tracking-wider ${merit.rank === 1 ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-low text-on-surface-variant'}`}>{merit.label.split(' - ')[0]}</span>
            </div>

            <div className="flex-1 min-w-0 px-6">
                <div className="flex items-center gap-3">
                    {hasMissingHistoryPdf && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)] shrink-0" title="Pendiente: Documentación histórica" />
                    )}
                    <span 
                        className="font-premium font-bold text-on-surface text-[15px] truncate group-hover/row:text-primary transition-colors tracking-tight" 
                        title={client.name}
                    >
                        {client.tradeName || client.name}
                    </span>
                    {client.isActive === false && (
                        <span className="text-[10px] font-bold bg-surface-low text-on-surface-variant px-2 py-0.5 rounded-full uppercase flex items-center gap-1.5">
                            <LucideIcons.UserX size={10} strokeWidth={3} />
                            Inactivo
                        </span>
                    )}
                    {true && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold bg-primary/5 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm ring-1 ring-primary/10">
                            <LucideIcons.Crown size={10} className="fill-current" />
                            VIP
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] font-bold text-on-surface-variant/60 truncate tracking-widest font-mono" title={client.name}>
                        {client.ruc}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-on-surface-variant/20"></div>
                    <span className="text-[10px] font-bold text-primary/70 uppercase tracking-[0.2em] font-premium">{client.regime}</span>
                </div>
            </div>

            {/* Perfil Táctico */}
            <div className="w-48 shrink-0 px-6 h-full flex flex-col justify-center">
                <div className="flex flex-wrap gap-2">
                    {needsIva && (
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all shadow-sm ${isCampaignDone ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-low text-on-surface-variant'}`}>
                            {isCampaignDone ? <LucideIcons.ShieldCheck size={12} strokeWidth={3} /> : <LucideIcons.Loader2 size={12} className="animate-spin" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">{frequencyText.replace('IVA ', '')}</span>
                        </div>
                    )}
                    {needsRenta && (
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all shadow-sm ${isRentaDeclared ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                            {isRentaDeclared ? <LucideIcons.Award size={12} strokeWidth={3} /> : <LucideIcons.Target size={12} />}
                            <span className="text-[10px] font-bold uppercase tracking-wider">RENTA</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Cronómetro SRI */}
            <div className="w-52 shrink-0 px-6 h-full flex items-center">
                <div className={`flex items-center gap-4 p-2.5 rounded-2xl w-full transition-all bg-surface-low/50`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${isCampaignDone ? 'bg-tertiary text-white' : (needsIva && ivaDueDate && isPast(ivaDueDate) ? 'bg-primary text-white animate-pulse' : 'bg-surface-lowest text-on-surface-variant')}`}>
                        <LucideIcons.Clock size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isCampaignDone || (needsRenta && isRentaDeclared) ? 'text-tertiary' : 'text-on-surface'}`}>
                            {formatPeriodForDisplay(needsIva ? period : rentaPeriod)}
                        </span>
                        <span className={`text-[10px] font-bold font-mono tracking-widest ${isCampaignDone || (needsRenta && isRentaDeclared) ? 'text-tertiary/70' : 'text-on-surface-variant'}`}>
                            {isCampaignDone || (needsRenta && isRentaDeclared) ? 'OK' : (needsIva ? (ivaDueDate ? safeFormat(ivaDueDate, 'dd MMM') : 'N/A') : (rentaDueDate ? safeFormat(rentaDueDate, 'dd MMM') : 'N/A'))}
                        </span>
                    </div>
                </div>
            </div>

            {/* Honorarios / Cobros */}
            <div className="w-48 shrink-0 px-6 h-full flex flex-col justify-center">
                {isCobrosView ? (
                    debtSummary.totalDebt > 0 ? (
                        <div className="flex flex-col">
                            <span className="font-black text-rose-600 dark:text-rose-500 text-2xl font-mono tracking-tighter leading-none">${debtSummary.totalDebt.toFixed(2)}</span>
                            <span className="text-[9px] text-rose-500/70 font-bold uppercase tracking-[0.2em] mt-1">{debtSummary.unpaidPeriodsCount} Periodos</span>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <span className="font-bold text-emerald-500 text-lg font-mono tracking-tighter leading-none">$0.00</span>
                            <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-[0.2em] mt-1">AL DÍA</span>
                        </div>
                    )
                ) : (
                    <>
                        <span className="font-bold text-on-surface text-lg font-mono tracking-tighter leading-none">${fee.toFixed(2)}</span>
                        <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-2">MENSUAL</span>
                    </>
                )}
            </div>

            {/* Operaciones */}
            <div className="w-64 shrink-0 px-6 flex items-center gap-3">
                {isTrashView ? (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'restore'); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-premium font-bold text-[10px] uppercase tracking-wider transition-all bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm"
                        >
                            <LucideIcons.RotateCcw size={14} />
                            RESTAURAR
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'purge'); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-premium font-bold text-[10px] uppercase tracking-wider transition-all bg-rose-500 hover:bg-rose-600 text-white border-0 shadow-sm"
                        >
                            <LucideIcons.Trash2 size={14} />
                            ELIMINAR
                        </button>
                    </>
                ) : isCobrosView ? (
                    <div className="flex flex-col gap-1.5 w-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const msg = encodeURIComponent(`Estimado/a ${client.tradeName || client.name}, le recordamos cordialmente que tiene un saldo pendiente de $${debtSummary.totalDebt.toFixed(2)} correspondiente a sus honorarios contables. Agradecemos su pronto pago.`);
                                const phone = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                if (phone) {
                                    window.open(`https://wa.me/593${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`, '_blank');
                                } else {
                                    alert('El cliente no tiene teléfono registrado.');
                                }
                            }}
                            disabled={debtSummary.totalDebt === 0}
                            className={`flex items-center justify-center gap-2 py-1.5 rounded-lg font-premium font-bold text-[9px] uppercase tracking-wider transition-all ${debtSummary.totalDebt > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            <LucideIcons.MessageCircle size={12} />
                            R. Amistoso
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const msg = encodeURIComponent(`Aviso Urgente: Estimado/a ${client.tradeName || client.name}, sus servicios contables y declaraciones al SRI se encuentran suspendidos debido a un saldo pendiente de $${debtSummary.totalDebt.toFixed(2)}. Por favor regularizar su pago de inmediato.`);
                                const phone = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                if (phone) {
                                    window.open(`https://wa.me/593${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`, '_blank');
                                } else {
                                    alert('El cliente no tiene teléfono registrado.');
                                }
                            }}
                            disabled={debtSummary.totalDebt === 0}
                            className={`flex items-center justify-center gap-2 py-1.5 rounded-lg font-premium font-bold text-[9px] uppercase tracking-wider transition-all ${debtSummary.totalDebt > 0 ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            <LucideIcons.AlertTriangle size={12} />
                            Suspensión
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); onView(client); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-premium font-bold text-[10px] uppercase tracking-wider transition-all bg-surface-low text-on-surface hover:bg-surface-lowest border-0 shadow-sm"
                        >
                            DETALLES
                            <LucideIcons.ArrowRight size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUploadReceipt(client, period); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-premium font-bold text-[10px] uppercase tracking-wider transition-all shadow-md ${isCampaignDone ? 'bg-surface-low text-on-surface-variant' : 'bg-primary text-white shadow-primary/20 hover:shadow-primary/40'}`}
                        >
                            {isCampaignDone ? <LucideIcons.Check size={14} strokeWidth={3} /> : <LucideIcons.Upload size={14} />}
                            {isCampaignDone ? 'LISTO' : 'CARGAR'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

export const VirtualClientTable: React.FC<VirtualClientTableProps> = (props) => {
    return (
        <div className="bg-surface-lowest rounded-[2.5rem] shadow-architect border-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 425px)', minHeight: '550px' }}>
            <div className="flex bg-surface-low text-[10px] font-bold uppercase text-on-surface-variant/60 py-5 px-6 active:select-none tracking-[0.2em]">
                <div className="w-20 shrink-0 text-center">Status</div>
                <div className="flex-1 px-6">Titular y Regimen</div>
                <div className="w-48 shrink-0 px-6">Configuración</div>
                <div className="w-52 shrink-0 px-6">Vencimientos</div>
                <div className="w-48 shrink-0 px-6">{props.isCobrosView ? 'Total Adeudado' : 'Honorarios'}</div>
                <div className="w-64 shrink-0 px-6">{props.isCobrosView ? 'Gestión de Cobro' : 'Gestión'}</div>
            </div>
            <div className="flex-1">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            height={height}
                            itemCount={props.clients.length}
                            itemSize={96} // Taller for high-end padding
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
