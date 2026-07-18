import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, TaxRegime, Declaration } from '../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay, generateDeclarationWhatsAppMessage } from '../../services/sri';
import { useAppStore } from '../../store/useAppStore';
import { getClientServiceFee } from '../../services/clientService';
import { TaxObligationCard } from './ClientDetail/TaxObligationCard';
import { useToast } from '../../context/ToastContext';
import { fileToBase64 } from '../../services/pdfExtraction';
import { Modal } from '../ui/Modal';

interface ClientWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    initialPeriod?: string;
}

export const ClientWorkspaceModal: React.FC<ClientWorkspaceModalProps> = ({
    isOpen,
    onClose,
    client,
    initialPeriod
}) => {
    const { toast } = useToast();
    const { serviceFees, updateClient } = useAppStore();
    
    const [activePeriod, setActivePeriod] = useState<string>('');
    const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
    const [uploadingTarget, setUploadingTarget] = useState<{ type: string; period?: string } | null>(null);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const proofInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (client) {
            setActivePeriod(initialPeriod || getPeriod(client, new Date()));
        }
    }, [initialPeriod, client]);

    if (!isOpen || !client) return null;

    const ivaFrequency = client.taxProfile?.ivaFrequency || (client.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : (client.regime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual'));
    const needsIva = ivaFrequency !== 'Ninguno';
    const needsRenta = client.taxProfile?.requiresAnnualRenta ?? (client.regime === TaxRegime.RimpeEmprendedor || client.regime === TaxRegime.RimpeNegocioPopular || client.regime === TaxRegime.General);

    const currentYear = new Date().getFullYear();
    const rentaPeriod = (currentYear - 1).toString();

    const ivaDecl = (client.declarations || []).find(d => d.period === activePeriod);
    const rentaDecl = (client.declarations || []).find(d => d.period === rentaPeriod);

    // --- ACCIONES ---

    const handleAction = (action: 'declare' | 'pay' | 'cancel' | 'revert' | 'revert_declare', period: string, type: 'iva' | 'renta') => {
        const nowIso = new Date().toISOString();
        const updatedHistory = [...(client.declarations || [])];
        const idx = updatedHistory.findIndex(d => d.period === period);
        
        let newStatus: DeclarationStatus = DeclarationStatus.Pendiente;
        let updates: Partial<Declaration> = { updatedAt: nowIso };

        switch (action) {
            case 'declare':
                newStatus = DeclarationStatus.Enviada;
                updates.declaredAt = nowIso;
                break;
            case 'pay':
                newStatus = DeclarationStatus.Pagada;
                updates.paidAt = nowIso;
                updates.is_paid = true;
                updates.transactionId = `Q-${Date.now().toString().slice(-4)}`;
                break;
            case 'cancel':
                newStatus = DeclarationStatus.Cancelada;
                break;
            case 'revert_declare':
                newStatus = DeclarationStatus.Pendiente;
                updates.declaredAt = undefined;
                updates.proof_file = undefined;
                break;
            case 'revert':
                newStatus = DeclarationStatus.Enviada;
                updates.is_paid = false;
                updates.paidAt = undefined;
                updates.transactionId = undefined;
                break;
        }

        const newEntry = {
            period,
            status: idx > -1 && action === 'revert' ? DeclarationStatus.Enviada : newStatus,
            ...updates
        };

        if (idx > -1) {
            updatedHistory[idx] = { ...updatedHistory[idx], ...newEntry };
        } else {
            updatedHistory.push(newEntry as Declaration);
        }

        updateClient(client.id, { declarations: updatedHistory });
        toast.success(`Acción procesada (${action})`);
    };

    const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !uploadingTarget) return;

        setIsAnalyzingPdf(true);
        try {
            const base64 = await fileToBase64(file);
            const storedFile = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: Date.now(),
                content: base64
            };

            const updatedHistory = [...(client.declarations || [])];
            const targetPeriod = uploadingTarget.period!;
            const idx = updatedHistory.findIndex(d => d.period === targetPeriod);
            
            if (idx !== -1) {
                updatedHistory[idx] = {
                    ...updatedHistory[idx],
                    proof_file: storedFile,
                    status: DeclarationStatus.Enviada,
                    updatedAt: new Date().toISOString()
                };
            } else {
                updatedHistory.push({
                    period: targetPeriod,
                    status: DeclarationStatus.Enviada,
                    is_paid: false,
                    updatedAt: new Date().toISOString(),
                    proof_file: storedFile
                });
            }

            updateClient(client.id, { declarations: updatedHistory });
            toast.success("Comprobante guardado correctamente.");

            const feeNum = getClientServiceFee(client, serviceFees, targetPeriod);
            const generatedMsg = generateDeclarationWhatsAppMessage(
                client.name,
                uploadingTarget.type === 'iva' ? 'IVA' : 'Impuesto a la Renta',
                targetPeriod,
                feeNum,
                false
            );

            if (client.phones?.length) {
                setWhatsAppPrompt({
                    clientName: client.name,
                    phone: client.phones[0].replace(/\D/g, ''),
                    message: generatedMsg
                });
            }
        } catch (error) {
            toast.error("Error al procesar el documento.");
        } finally {
            setIsAnalyzingPdf(false);
            setUploadingTarget(null);
            if (proofInputRef.current) proofInputRef.current.value = '';
        }
    };

    const handleWhatsApp = (period: string, type: string) => {
        const fee = getClientServiceFee(client, serviceFees, period);
        const greeting = new Date().getHours() < 12 ? 'Buenos días' : 'Buenas tardes';
        const name = client.name.split(' ')[0];
        const formattedPeriod = formatPeriodForDisplay(period);
        const message = `${greeting} ${name} 👋. Le saludo de SantiagoCordova.com. Le informo que su obligación de ${type} correspondiente a ${formattedPeriod} ya ha sido procesada con éxito en el SRI.\n\nEl valor total de honorarios es de $${fee.toFixed(2)}. Puede realizar el pago por transferencia o depósito.\n\n¡Muchas gracias!`;
        
        if (client.phones?.length) {
            window.open(`https://wa.me/${client.phones[0].replace(/\D/g,'')}?text=${encodeURIComponent(message)}`, "_blank");
        } else {
            toast.warning("El cliente no tiene un teléfono configurado.");
        }
    };

    // --- CÁLCULO DE DEUDA ---
    const pendingCount = (client.declarations || []).filter(d => !d.is_paid && d.status === DeclarationStatus.Enviada).length;
    const totalDebt = (client.declarations || []).filter(d => !d.is_paid && d.status === DeclarationStatus.Enviada).reduce((sum, d) => sum + (d.amount ?? getClientServiceFee(client, serviceFees, d.period)), 0);

    return (
        <div className="fixed inset-0 z-[200] flex animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            
            {/* Panel Lateral (Drawer) */}
            <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[500px] bg-slate-50 dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden">
                
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 border-b border-slate-200 dark:border-white/10 flex-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <LucideIcons.X size={20} />
                    </button>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
                            <span className="text-2xl font-black">{client.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">{client.name}</h2>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{client.ruc}</p>
                        </div>
                    </div>

                    {/* Quick Stats & Quick Actions */}
                    <div className="flex gap-4 mt-6">
                        <div className={`flex-1 p-4 rounded-2xl border ${pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Deuda Pendiente</p>
                            <p className={`text-xl font-black ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                ${totalDebt.toFixed(2)}
                            </p>
                        </div>
                        <div className="flex-1 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Obligaciones</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {needsIva ? `IVA ${ivaFrequency}` : 'Sin IVA'}<br />
                                {needsRenta ? 'Renta Anual' : 'Sin Renta'}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                onClose();
                                // Evento custom para abrir Vault (requerirá capturarlo en AdminDashboardScreen -> navigate)
                                window.dispatchEvent(new CustomEvent('open-client-vault', { detail: { clientId: client.id } }));
                            }}
                            className="flex flex-col items-center justify-center gap-2 flex-1 p-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-800 dark:border-white/10 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/20 group"
                        >
                            <LucideIcons.Lock size={20} className="group-hover:-translate-y-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Bóveda</span>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 no-scrollbar">

                    {/* Historial de Confianza (Últimos periodos) */}
                    {client.declarations && client.declarations.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                <LucideIcons.History size={14} className="text-blue-500" /> Historial Reciente
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {client.declarations
                                    .filter(d => d.period.length > 4) // Solo IVA (YYYY-MM o YYYY-S1)
                                    .sort((a, b) => b.period.localeCompare(a.period))
                                    .slice(0, 6) // Últimos 6
                                    .map(d => {
                                        const hasPdf = !!d.proof_file;
                                        const isPaid = d.is_paid;
                                        return (
                                            <div key={d.period} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isPaid && hasPdf ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-slate-50 border-slate-100 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'}`} title={`Estado: ${d.status}`}>
                                                <span className="text-[10px] font-bold tracking-widest uppercase">{formatPeriodForDisplay(d.period).split(' ')[0]}</span>
                                                <div className="flex items-center gap-1">
                                                    {isPaid ? <LucideIcons.CheckCircle2 size={12} className="text-emerald-500" /> : <LucideIcons.CircleDashed size={12} className="text-slate-300" />}
                                                    {hasPdf ? <LucideIcons.Paperclip size={12} className="text-blue-500" /> : <LucideIcons.FileWarning size={12} className="text-amber-500" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                    
                    {needsIva && activePeriod && (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Espacio de Trabajo IVA</h3>
                                <select 
                                    value={activePeriod}
                                    onChange={(e) => setActivePeriod(e.target.value)}
                                    className="glass-card-premium rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200  outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                >
                                    <option value={getPeriod(client, new Date())}>{formatPeriodForDisplay(getPeriod(client, new Date()))} (Actual)</option>
                                    {Array.from(new Set(client.declarations?.filter(d => d.period.length > 4 && d.period !== getPeriod(client, new Date())).map(d => d.period) || [])).map(p => (
                                        <option key={p} value={p}>{formatPeriodForDisplay(p)}</option>
                                    ))}
                                </select>
                            </div>
                            <TaxObligationCard
                                type="iva"
                                title={`IVA ${formatPeriodForDisplay(activePeriod)}`}
                                period={activePeriod}
                                status={ivaDecl?.status}
                                isDeclared={ivaDecl?.status === DeclarationStatus.Enviada || ivaDecl?.status === DeclarationStatus.Pagada}
                                isPaid={ivaDecl?.is_paid}
                                hasProofFile={!!ivaDecl?.proof_file}
                                amount={ivaDecl?.amount ?? getClientServiceFee(client, serviceFees, activePeriod)}
                                dueDate={getDueDateForPeriod(client, activePeriod) || undefined}
                                onDeclare={() => handleAction('declare', activePeriod, 'iva')}
                                onPay={() => handleAction('pay', activePeriod, 'iva')}
                                onUpload={() => { setUploadingTarget({ type: 'iva', period: activePeriod }); proofInputRef.current?.click(); }}
                                onWhatsApp={() => handleWhatsApp(activePeriod, 'IVA')}
                                onRevertPayment={() => handleAction('revert', activePeriod, 'iva')}
                                onRevertDeclaration={() => handleAction('revert_declare', activePeriod, 'iva')}
                            />
                        </>
                    )}

                    {needsRenta && (
                        <>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 pt-4 border-t border-slate-200 dark:border-white/10">Espacio de Trabajo Renta</h3>
                            <TaxObligationCard
                                type="renta"
                                title={`Renta ${rentaPeriod}`}
                                period={rentaPeriod}
                                status={rentaDecl?.status}
                                isDeclared={rentaDecl?.status === DeclarationStatus.Enviada || rentaDecl?.status === DeclarationStatus.Pagada}
                                isPaid={rentaDecl?.is_paid}
                                hasProofFile={!!rentaDecl?.proof_file}
                                amount={client.fee_structure?.annual ?? 10}
                                dueDate={getDueDateForPeriod(client, rentaPeriod) || undefined}
                                onDeclare={() => handleAction('declare', rentaPeriod, 'renta')}
                                onPay={() => handleAction('pay', rentaPeriod, 'renta')}
                                onUpload={() => { setUploadingTarget({ type: 'renta', period: rentaPeriod }); proofInputRef.current?.click(); }}
                                onWhatsApp={() => handleWhatsApp(rentaPeriod, 'Impuesto a la Renta')}
                                onRevertPayment={() => handleAction('revert', rentaPeriod, 'renta')}
                                onRevertDeclaration={() => handleAction('revert_declare', rentaPeriod, 'renta')}
                            />
                        </>
                    )}
                </div>
            </div>
            {isAnalyzingPdf && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <LucideIcons.Loader2 size={40} className="text-white animate-spin mb-4" />
                    <p className="text-white font-bold tracking-widest uppercase">Procesando Documento...</p>
                </div>
            )}
            <input type="file" ref={proofInputRef} className="sr-only" onChange={handleProofUpload} accept=".pdf,image/*" />

            <Modal isOpen={!!whatsAppPrompt} onClose={() => setWhatsAppPrompt(null)} title="🚀 Notificar por WhatsApp" size="2xl">
                {whatsAppPrompt && (
                    <div className="space-y-6 p-4">
                        <div className="p-4 bg-slate-50 dark:bg-surface-low rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                <span>Destinatario</span>
                                <span className="text-emerald-500 font-black">Cliente Activo</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {whatsAppPrompt.clientName} ({whatsAppPrompt.phone})
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">
                                Mensaje Personalizable
                            </label>
                            <textarea
                                value={whatsAppPrompt.message}
                                onChange={(e) => setWhatsAppPrompt({ ...whatsAppPrompt, message: e.target.value })}
                                className="w-full h-40 px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-slate-100 text-sm font-medium leading-relaxed resize-none shadow-inner"
                                placeholder="Escribe el mensaje aquí..."
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95"
                            >
                                Omitir
                            </button>
                            <button
                                onClick={() => {
                                    window.open(`https://wa.me/${whatsAppPrompt.phone}?text=${encodeURIComponent(whatsAppPrompt.message)}`, "_blank");
                                    setWhatsAppPrompt(null);
                                }}
                                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                            >
                                <LucideIcons.MessageCircle size={14} strokeWidth={2.5} />
                                Enviar WhatsApp
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
