
import React, { memo } from 'react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxRegime } from '../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay, safeFormat } from '../../services/sri';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, getYear } from 'date-fns';
import { Crown, MessageCircle, Copy, ArrowRight, CheckCircle, Clock, ShieldCheck, Sparkles } from 'lucide-react';

interface VipClientCardProps {
    client: Client;
    serviceFees: ServiceFeesConfig;
    onClick: () => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'deactivate', period?: string) => void;
}

export const VipClientCard: React.FC<VipClientCardProps> = memo(({ client, serviceFees, onClick, onQuickAction }) => {
    const [copied, setCopied] = React.useState(false);
    const currentPeriod = getPeriod(client, new Date());
    const declaration = (client.declarations ?? []).find(d => d.period === currentPeriod);
    const fee = getClientServiceFee(client, serviceFees);

    // Determine Status Logic
    const isPaid = !!declaration?.is_paid;

    // Renta Logic for fully paid check
    const currentYear = getYear(new Date());
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular);
    const rentaPeriod = (currentYear - 1).toString();
    const rentaDecl = (client.declarations ?? []).find(d => d.period === rentaPeriod);
    const isRentaDeclared = !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada;
    const isRentaPaid = !!rentaDecl?.is_paid;
    const isRentaFullyDone = isRentaDeclared && isRentaPaid;

    // ICE & PVP Logic
    const icePeriod = `${currentPeriod}:ICE`;
    const iceAnexoPeriod = `${currentPeriod}:ANEXO_ICE`;
    const iceDecl = (client.declarations ?? []).find(d => d.period === icePeriod);
    const iceAnexoDecl = (client.declarations ?? []).find(d => d.period === iceAnexoPeriod);
    const isIceDeclared = !!iceDecl?.proof_file || iceDecl?.status === DeclarationStatus.Enviada;
    const isIcePaid = !!iceDecl?.is_paid;
    const isIceAnexoDone = !!iceAnexoDecl?.proof_file || iceAnexoDecl?.status === DeclarationStatus.Enviada;
    const isIcePending = client.taxProfile?.requiresIce && (!isIceDeclared || !isIcePaid || !isIceAnexoDone);

    const isFullyPaid = (isPaid || !declaration) && (isRentaPaid || !needsRenta) && (!client.taxProfile?.requiresIce || (isIcePaid && isIceAnexoDone));
    const isFullyAlDia = isFullyPaid && (declaration?.status === DeclarationStatus.Enviada || !!declaration?.proof_file || !declaration) && (isRentaDeclared || !needsRenta);

    let status = declaration?.status || DeclarationStatus.Pendiente;
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const isOverdue = dueDate && isPast(dueDate) && !isPaid;

    const mainName = client.tradeName || client.name;
    const hasWorkOrder = (client.declarations || []).some(d => d.is_paid && d.status === DeclarationStatus.Pendiente);

    const getStatusConfig = (currentStatus: string, overdue: boolean, paid: boolean, fullyPaid: boolean) => {
        if (fullyPaid && (paid || isRentaPaid) && !isIcePending) {
            return { color: 'text-tertiary bg-surface-low shadow-sm', icon: CheckCircle, text: 'AL DÍA' };
        }
        if (hasWorkOrder) {
            return { color: 'text-primary bg-surface-low shadow-sm', icon: Sparkles, text: 'ORDEN TRABAJO' };
        }
        if (paid && !isRentaPaid && needsRenta) {
            return { color: 'text-on-surface-variant bg-surface-low', icon: Clock, text: 'PÉND. RENTA' };
        }
        if (isIcePending) {
            return { color: 'text-on-surface-variant bg-surface-low', icon: Clock, text: 'PÉND. OTROS' };
        }
        if (paid) {
            return { color: 'text-tertiary bg-surface-low', icon: ShieldCheck, text: 'CUOTA PAGADA' };
        }
        if (currentStatus === DeclarationStatus.Enviada || !!declaration?.proof_file) {
            return { color: 'text-tertiary bg-surface-low', icon: CheckCircle, text: 'DECLARADO' };
        }
        if (overdue) {
            return { color: 'text-primary bg-surface-low', icon: Clock, text: 'VENCIDO' };
        }
        return { color: 'text-on-surface-variant bg-surface-low', icon: Clock, text: 'PENDIENTE' };
    };

    const statusConfig = getStatusConfig(status, isOverdue || false, isPaid, isFullyPaid);
    const StatusIcon = statusConfig.icon;

    const handleCopyRuc = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(client.ruc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        if (!client.phones?.length) return;
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        const message = `Estimado/a ${client.name}, le saludamos de Santiago Cordova. Estado actual: ${statusConfig.text} (${formatPeriodForDisplay(currentPeriod)}).`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div
            onClick={onClick}
            className={`
                relative rounded-[2rem] transition-all duration-500 cursor-pointer overflow-hidden group
                bg-surface-lowest hover:bg-surface-low hover:-translate-y-1.5
                shadow-architect border-0
                ${hasWorkOrder ? 'ring-2 ring-primary/30' : ''}
            `}
        >
            {/* Tonal Accent Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[6px] ${isFullyAlDia ? 'bg-tertiary' : (isOverdue ? 'bg-primary' : 'bg-surface-low')}`}></div>
            
            {/* Badge: Work Order */}
            {hasWorkOrder && (
                <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg z-20 flex items-center gap-1.5 animate-pulse">
                    <Sparkles size={10} className="fill-white" />
                    <span className="tracking-[0.1em]">ORDEN DE TRABAJO</span>
                </div>
            )}

            <div className="p-8">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-[1.25rem] bg-primary/5 text-primary flex items-center justify-center font-premium font-bold text-xl shadow-sm">
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -top-2 -right-2 bg-primary text-white p-1.5 rounded-full shadow-md border-4 border-surface-lowest">
                                <Crown size={12} fill="currentColor" />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-premium font-bold text-xl line-clamp-1 leading-tight text-on-surface">
                                {mainName}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                                <button onClick={handleCopyRuc} className="flex items-center gap-2 group/ruc transition-all text-on-surface-variant hover:text-primary">
                                    <span className="font-mono text-[11px] font-bold tracking-[0.2em]">{client.ruc}</span>
                                    {copied ? <CheckCircle size={10} className="text-tertiary" /> : <Copy size={10} className="opacity-40 group-hover/ruc:opacity-100 transition-opacity" />}
                                </button>
                                {needsRenta && isRentaFullyDone && (
                                    <span className="text-[9px] px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full font-bold tracking-[0.1em] flex items-center gap-1.5 uppercase font-premium ring-1 ring-tertiary/20">
                                        <ShieldCheck size={10} /> ANUAL OK
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`px-4 py-2 rounded-2xl text-[10px] font-bold tracking-[0.15em] flex items-center gap-2 uppercase font-premium bg-surface-low shadow-sm ${statusConfig.text === 'AL DÍA' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                        <StatusIcon size={14} strokeWidth={2.5} />
                        {statusConfig.text}
                    </div>
                </div>

                {/* Content Section: Frequency Specific */}
                <div className="bg-surface-low/50 rounded-[1.5rem] p-5 mb-8">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-[0.2em] mb-2 px-1">
                                {client.taxProfile?.ivaFrequency === 'Semestral' ? 'SITUACIÓN SEMESTRAL' : `PERIODO ${formatPeriodForDisplay(currentPeriod)}`}
                            </p>
                            
                            {client.taxProfile?.ivaFrequency === 'Semestral' ? (
                                <div className="flex gap-3">
                                    {[
                                        { label: 'ENE-JUN', status: (client.declarations ?? []).find(d => d.period.endsWith('-S1')) },
                                        { label: 'JUL-DIC', status: (client.declarations ?? []).find(d => d.period.endsWith('-S2')) }
                                    ].map((sem, i) => (
                                        <div key={i} className="flex flex-col items-center gap-1 px-3 py-2 bg-surface-lowest rounded-xl shadow-sm min-w-[80px]">
                                            <span className="text-[9px] font-bold text-on-surface-variant">{sem.label}</span>
                                            <span className={`text-[11px] font-bold ${sem.status?.is_paid ? 'text-tertiary' : 'text-on-surface'}`}>
                                                {sem.status?.is_paid ? 'AL DÍA' : (sem.status?.status || 'PEND')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 px-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isFullyAlDia ? 'bg-tertiary' : 'bg-primary animate-pulse'}`}></div>
                                        <span className="font-premium font-bold text-lg text-on-surface">
                                            {isPaid ? 'Cuota Pagada' : (declaration?.status === DeclarationStatus.Enviada ? 'Declarado' : 'Pendiente Pago')}
                                        </span>
                                    </div>
                                    <div className="h-4 w-px bg-on-surface-variant/10"></div>
                                    <span className="text-xs font-bold text-on-surface-variant">
                                        {dueDate ? safeFormat(dueDate, 'dd MMM') : 'N/A'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="text-right px-1">
                            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-[0.2em] mb-1">SERVICIO</p>
                            <p className="text-xl font-mono font-bold text-primary">
                                ${fee.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }}
                        className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-surface-low hover:bg-primary/5 text-on-surface font-premium font-bold text-xs tracking-[0.1em] transition-all group/btn shadow-sm active:scale-95"
                    >
                        <MessageCircle size={16} className="text-tertiary group-hover/btn:scale-110 transition-transform" />
                        CONTACTAR
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-primary text-white font-premium font-bold text-xs tracking-[0.1em] shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        DETALLES
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
});