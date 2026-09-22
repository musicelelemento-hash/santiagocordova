
import React, { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Client, ServiceFeesConfig, DeclarationStatus, TaxRegime } from '../../types';
import { getDueDateForPeriod, getPeriod, formatPeriodForDisplay, getNextPeriod, safeFormat, requiresIva, getWhatsAppUrl, isSriPasswordUpdated } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { TaxFrequency, getClientDebtSummary } from '../../services/complianceEngine';
import { isPast, differenceInHours } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import { openClientInNewWindow } from '../../utils/windowManager';

interface VirtualClientTableProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction: (client: Client, action: 'declare' | 'pay' | 'deactivate' | 'activate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt: (client: Client, period?: string) => void;
    frequency?: TaxFrequency | 'all';
    isTrashView?: boolean;
    isCobrosView?: boolean;
    onNavigate?: (screen: any, options?: any) => void;
    onEditClient?: (client: Client) => void;
}

interface TableRowProps {
    index: number;
    style?: React.CSSProperties;
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction: (client: Client, action: 'declare' | 'pay' | 'deactivate' | 'activate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt: (client: Client, period?: string) => void;
    frequency?: TaxFrequency | 'all';
    isTrashView?: boolean;
    isCobrosView?: boolean;
    onNavigate?: (screen: any, options?: any) => void;
    onEditClient?: (client: Client) => void;
}

const TableRow = memo(({ index, style, clients, serviceFees, onView, onQuickAction, onUploadReceipt, frequency, isTrashView, isCobrosView, onNavigate, onEditClient }: TableRowProps) => {
    const client = clients[index];
    const [copiedRuc, setCopiedRuc] = React.useState(false);
    const [copiedPass, setCopiedPass] = React.useState(false);

    const handleCopyRuc = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopiedRuc(true);
        setTimeout(() => setCopiedRuc(false), 1800);
    };

    const handleCopyPass = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!client.sriPassword) return;
        navigator.clipboard.writeText(client.sriPassword);
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 1800);
    };
    
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

    const debtSummary = getClientDebtSummary(client, serviceFees, today);

    return (
        <div style={style} className={`flex border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all items-center px-4 group/row hover:shadow-[inset_4px_0_0_0_theme(colors.primary)] ${isRefundAlertActive ? 'animate-heartbeat ring-2 ring-inset ring-primary/30' : ''} ${isCobrosView && debtSummary.totalDebt > 0 ? 'bg-rose-50/20 dark:bg-rose-950/20 hover:bg-rose-50/40 dark:hover:bg-rose-950/40' : ''}`}>
            {/* Estatus Zen */}
            <div className="w-16 shrink-0 flex flex-col items-center group cursor-help relative px-2" title={merit.label}>
                <div className={`p-2.5 rounded-2xl ${merit.rank === 1 ? 'bg-tertiary/10 text-tertiary shadow-sm' : (merit.rank === 2 ? 'bg-on-surface-variant/10 text-on-surface-variant' : 'bg-primary/10 text-primary')} transition-all group-hover:scale-110`}>
                    <merit.icon size={22} strokeWidth={2.5} />
                </div>
                <span className={`text-[9px] font-bold uppercase mt-2 px-2 py-0.5 rounded-full tracking-wider ${merit.rank === 1 ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-low text-on-surface-variant'}`}>{merit.label.split(' - ')[0]}</span>
            </div>

            <div className="flex-1 min-w-[260px] px-4">
                <div className="flex items-center gap-3">
                    {hasMissingHistoryPdf && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)] shrink-0" title="Pendiente: Documentación histórica" />
                    )}
                    <span 
                        className="font-premium font-bold text-on-surface text-[15px] truncate group-hover/row:text-primary transition-colors tracking-tight" 
                        title={client.name}
                    >
                        {client.name}
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            openClientInNewWindow(client.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-[#00A896] hover:bg-[#00A896]/15 transition-all opacity-60 group-hover/row:opacity-100 cursor-pointer shrink-0"
                        title="Abrir expediente en ventana aparte"
                    >
                        <LucideIcons.ExternalLink size={12} />
                    </button>
                    {(client.taxProfile?.alias || client.tradeName) && (
                        <span className="text-[11px] font-bold text-[#00A896] bg-[#00A896]/10 border border-[#00A896]/30 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1 font-display" title="Alias / Reconocimiento">
                            <LucideIcons.Tag size={10} />
                            <span>"{client.taxProfile?.alias || client.tradeName}"</span>
                        </span>
                    )}
                    {client.isActive === false && (
                        <span className="text-[10px] font-bold bg-surface-low text-on-surface-variant px-2 py-0.5 rounded-full uppercase flex items-center gap-1.5">
                            <LucideIcons.UserX size={10} strokeWidth={3} />
                            Inactivo
                        </span>
                    )}
                    {(client.requiresDeclarations === false || client.clientType === 'solo_plan') && (
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <LucideIcons.Zap size={10} />
                            Solo Plan
                        </span>
                    )}
                    {true && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold bg-primary/5 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm ring-1 ring-primary/10">
                            <LucideIcons.Crown size={10} className="fill-current" />
                            VIP
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {/* RUC con botón de copia instantánea */}
                    <button
                        type="button"
                        onClick={handleCopyRuc}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface-low/80 hover:bg-surface-low text-[11px] font-bold text-on-surface tracking-wider font-mono border border-outline-variant/30 transition-all cursor-pointer group/ruc shadow-xs"
                        title={copiedRuc ? "¡RUC Copiado!" : "Clic para copiar RUC"}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A896]"></span>
                        <span>{client.ruc}</span>
                        <span className="text-[9px] text-slate-400 font-normal">DÍG {client.ruc[8]}</span>
                        {copiedRuc ? (
                            <LucideIcons.Check size={11} className="text-emerald-500" />
                        ) : (
                            <LucideIcons.Copy size={11} className="text-slate-400 group-hover/ruc:text-primary transition-colors" />
                        )}
                    </button>

                    <div className="w-1 h-1 rounded-full bg-outline-variant/50"></div>
                    
                    {/* Régimen */}
                    <span className="text-[9px] font-bold text-primary/80 uppercase tracking-[0.15em] font-premium px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                        {client.regime || 'General'}
                    </span>

                    {/* Clave SRI con copia de 1 clic */}
                    {client.sriPassword && (
                        <button
                            type="button"
                            onClick={handleCopyPass}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-300 border border-amber-500/25 transition-all cursor-pointer shadow-xs"
                            title={copiedPass ? "¡Clave copiada al portapapeles!" : `Copiar Clave SRI (${client.sriPassword.slice(0, 2)}••••)`}
                        >
                            <LucideIcons.Key size={10} className="text-amber-500" />
                            <span>{copiedPass ? "¡Copiada!" : "Clave SRI"}</span>
                            {copiedPass && <LucideIcons.Check size={10} className="text-emerald-400" />}
                        </button>
                    )}

                    {/* Telemetría Clave SRI */}
                    {(() => {
                        const statusInfo = isSriPasswordUpdated(client);
                        if (!client.sriPassword) return null;
                        return (
                            <span title={statusInfo.tooltip} className={`inline-flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 border ${
                                statusInfo.isUpdated
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.isUpdated ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                <span>{statusInfo.label}</span>
                            </span>
                        );
                    })()}

                    {/* Firma .P12 Badge */}
                    {(() => {
                        if (!client.signatureExpirationDate) return null;
                        const expDate = new Date(client.signatureExpirationDate);
                        const dToday = new Date();
                        expDate.setHours(0, 0, 0, 0);
                        dToday.setHours(0, 0, 0, 0);
                        const daysLeft = Math.ceil((expDate.getTime() - dToday.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = daysLeft <= 0;
                        const isNear = daysLeft > 0 && daysLeft <= 30;

                        return (
                            <span
                                title={`Firma .P12 vence el ${new Date(client.signatureExpirationDate + 'T12:00:00').toLocaleDateString()}`}
                                className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border inline-flex items-center gap-1 shrink-0 ${
                                    isExpired
                                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                                        : isNear
                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                }`}
                            >
                                <LucideIcons.FileKey size={9} />
                                <span>{isExpired ? 'Firma Caducada' : `${daysLeft}d Firma`}</span>
                            </span>
                        );
                    })()}
                </div>
            </div>

            {/* Perfil Táctico */}
            <div className="w-40 shrink-0 px-3 h-full flex flex-col justify-center">
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
            <div className="w-44 shrink-0 px-3 h-full flex items-center">
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
            <div className="w-36 shrink-0 px-3 h-full flex flex-col justify-center">
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
            <div className="w-80 shrink-0 px-3 flex items-center justify-end gap-1.5">
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
                                const msg = `Estimado/a *${client.tradeName || client.name}*, le recordamos cordialmente que tiene un saldo pendiente de *$${debtSummary.totalDebt.toFixed(2)}* correspondiente a sus honorarios contables. Agradecemos su pronto pago.`;
                                const phone = client.phones && client.phones.length > 0 ? client.phones[0] : '';
                                if (phone) {
                                    window.open(getWhatsAppUrl(phone, msg), '_blank');
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
                                const msg = `Aviso Urgente: Estimado/a *${client.tradeName || client.name}*, sus servicios contables y declaraciones al SRI se encuentran suspendidos debido a un saldo pendiente de *$${debtSummary.totalDebt.toFixed(2)}*. Por favor regularizar su pago de inmediato.`;
                                const phone = client.phones && client.phones.length > 0 ? client.phones[0] : '';
                                if (phone) {
                                    window.open(getWhatsAppUrl(phone, msg), '_blank');
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
                    <div className="flex items-center justify-end gap-1.5 w-full">
                        {/* WhatsApp Directo */}
                        {client.phones && client.phones.length > 0 && client.phones[0] ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const phone = client.phones![0];
                                    const msg = `Estimado/a *${client.tradeName || client.name}*, un cordial saludo desde el Estudio Contable Santiago Córdova.`;
                                    window.open(getWhatsAppUrl(phone, msg), '_blank');
                                }}
                                className="p-2 rounded-xl transition-all bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs active:scale-90"
                                title={`WhatsApp directo a ${client.phones[0]}`}
                            >
                                <LucideIcons.MessageCircle size={13} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="p-2 rounded-xl bg-surface-low text-on-surface-variant/30 border border-outline-variant/10 cursor-not-allowed opacity-40"
                                title="Sin teléfono registrado"
                            >
                                <LucideIcons.MessageCircle size={13} />
                            </button>
                        )}

                        {/* Bóveda de Claves y Firma */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onView(client, 'vault'); }}
                            className="p-2 rounded-xl transition-all bg-purple-500/10 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs active:scale-90"
                            title="Abrir Bóveda de Claves y Firma .P12"
                        >
                            <LucideIcons.KeyRound size={13} />
                        </button>

                        {/* Facturación SRI / Cobro */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigate) {
                                    onNavigate('sri_facturacion', {
                                        clientId: client.id,
                                        ruc: client.ruc,
                                        name: client.name,
                                        tradeName: client.tradeName,
                                        email: client.email,
                                        phones: client.phones,
                                        amount: fee,
                                        description: `HONORARIOS CONTABLES - DECLARACION IVA ${formatPeriodForDisplay(period)}`
                                    });
                                }
                            }}
                            className="p-2 rounded-xl transition-all bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs active:scale-90"
                            title={`Emitir Factura Electrónica SRI ($${fee.toFixed(2)})`}
                        >
                            <LucideIcons.Receipt size={13} />
                        </button>

                        {/* Editar Cliente */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEditClient) {
                                    onEditClient(client);
                                } else {
                                    onView(client, 'profile');
                                }
                            }}
                            className="p-2 rounded-xl transition-all bg-blue-500/10 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs active:scale-90"
                            title="Editar datos del cliente"
                        >
                            <LucideIcons.Edit3 size={13} />
                        </button>

                        {/* Pausar / Reactivar */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onQuickAction(client, (client.isActive ?? true) ? 'deactivate' : 'activate');
                            }}
                            className={`p-2 rounded-xl transition-all border shadow-xs active:scale-90 ${
                                (client.isActive ?? true)
                                    ? 'bg-slate-500/10 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 border-slate-500/20 hover:border-rose-500/30'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border-emerald-500/30'
                            }`}
                            title={(client.isActive ?? true) ? "Pausar cliente temporalmente" : "Reactivar cliente"}
                        >
                            {(client.isActive ?? true) ? <LucideIcons.Pause size={13} /> : <LucideIcons.Play size={13} />}
                        </button>

                        {/* Declarar SRI */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigate) {
                                    onNavigate('declaraciones', { clientFilter: client.ruc, clientId: client.id });
                                } else {
                                    onQuickAction(client, 'declare', period);
                                }
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-premium font-bold text-[9px] uppercase tracking-wider transition-all shadow-xs active:scale-95 ${
                                isCampaignDone
                                    ? 'bg-surface-low text-on-surface-variant hover:bg-surface-medium'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                            }`}
                            title="Declarar en Matriz de Cumplimiento SRI"
                        >
                            <LucideIcons.Zap size={11} className={isCampaignDone ? '' : 'fill-current'} />
                            <span>Declarar</span>
                        </button>

                        {/* Ver Expediente */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onView(client); }}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl font-premium font-bold text-[9px] uppercase tracking-wider transition-all bg-surface-low text-on-surface hover:bg-surface-medium border border-outline-variant/30 shadow-xs active:scale-95"
                            title="Abrir expediente completo"
                        >
                            <span>VER</span>
                            <LucideIcons.ArrowRight size={11} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

export const VirtualClientTable: React.FC<VirtualClientTableProps> = (props) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: props.clients.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 96,
        overscan: 5,
    });

    return (
        <div className="bg-surface-lowest rounded-[2.5rem] shadow-architect border-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 425px)', minHeight: '550px' }}>
            <div className="flex bg-surface-low text-[10px] font-bold uppercase text-on-surface-variant/60 py-5 px-6 active:select-none tracking-[0.2em]">
                <div className="w-16 shrink-0 text-center">Status</div>
                <div className="flex-1 min-w-[260px] px-4">Titular, RUC y Credenciales</div>
                <div className="w-40 shrink-0 px-3">Configuración</div>
                <div className="w-44 shrink-0 px-3">Vencimientos</div>
                <div className="w-36 shrink-0 px-3">{props.isCobrosView ? 'Total Adeudado' : 'Honorarios'}</div>
                <div className="w-80 shrink-0 px-3 text-center">{props.isCobrosView ? 'Gestión de Cobro' : 'Operaciones Tácticas'}</div>
            </div>
            <div ref={parentRef} className="flex-1 overflow-auto no-scrollbar">
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <TableRow
                                index={virtualRow.index}
                                clients={props.clients}
                                serviceFees={props.serviceFees}
                                onView={props.onView}
                                onQuickAction={props.onQuickAction}
                                onUploadReceipt={props.onUploadReceipt}
                                frequency={props.frequency}
                                isTrashView={props.isTrashView}
                                isCobrosView={props.isCobrosView}
                                onNavigate={props.onNavigate}
                                onEditClient={props.onEditClient}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
