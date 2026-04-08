import React from 'react';
import { Client, TaxRegime, ServiceFeesConfig, Declaration } from '../../../../types';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../../../../services/sri';
import { getClientServiceFee } from '../../../../services/clientService';
import * as LucideIcons from 'lucide-react';
import { DynamicStatusIndicator } from '../DynamicStatusIndicator';
import { DeclarationProgressBar } from '../DeclarationProgressBar';
import { TaxObligationCard } from '../TaxObligationCard';
import { PaymentHistoryChart } from '../PaymentHistoryChart';
import { FacturadorCard } from '../FacturadorCard';
import { ClientNotes } from '../ClientNotes';
import { SidebarAction } from '../SidebarAction';

interface ProfileTabProps {
    client: Client;
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    isEditing: boolean;
    isFullyAlDia: boolean;
    complianceStats: any;
    serviceFees: ServiceFeesConfig;
    setConfirmation: (conf: { action: 'declare' | 'pay'; period: string } | null) => void;
    handleQuickPay: (period: string) => void;
    setUploadingTarget: (target: { type: string; period?: string } | null) => void;
    proofInputRef: React.RefObject<HTMLInputElement>;
    setActiveTab: (tab: 'profile' | 'history' | 'vault' | 'settings') => void;
    handleWhatsApp: () => void;
    handleOpenSRI: () => void;
    handleShareViaWhatsApp: () => void;
    passwordVisible: boolean;
    setPasswordVisible: (visible: boolean) => void;
    handleExtraAction: (type: 'renta' | 'anexo' | 'devolucion', action: 'declare' | 'pay') => void;
    handleRentaRefundAction: (action: any) => void;
    handleElderlyRefundAction: (action: any) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing,
    isFullyAlDia,
    complianceStats,
    serviceFees,
    setConfirmation,
    handleQuickPay,
    setUploadingTarget,
    proofInputRef,
    setActiveTab,
    handleWhatsApp,
    handleOpenSRI,
    handleShareViaWhatsApp,
    passwordVisible,
    setPasswordVisible,
    handleRentaRefundAction,
    handleElderlyRefundAction
}) => {
    return (
        <div className="space-y-6 sm:space-y-16 animate-in fade-in slide-in-from-bottom-10 h-full duration-1000">
            {/* The Tactical Main View: Grid Architecture (Alpha + Beta) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-16">
                
                {/* Sector Alfa: Compliance Intelligence (8/12) */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-16">
                    
                    {/* High-Impact Compliance Score - THE KPI HERO */}
                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-16 relative overflow-hidden shadow-architect border border-surface-low dark:border-white/10 group">
                        {/* Dynamic Background Mesh */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary-rgb),0.08),transparent_70%)]"></div>
                        <div className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8 sm:gap-12">
                            <div className="space-y-8 sm:space-y-10 group-hover:translate-x-3 transition-transform duration-1000">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4">
                                                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                                <h2 className="text-sm font-black text-on-surface uppercase tracking-[0.5em] font-premium">DIRECTIVA DE CUMPLIMIENTO</h2>
                                            </div>
                                            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium opacity-40">FISCAL SCORE & RISK CONTROL v2.1</p>
                                        </div>
                                        <DynamicStatusIndicator client={editedClient} />
                                    </div>
                                <div className="flex flex-col gap-8">
                                    <div className="flex items-baseline gap-4">
                                        <span className="text-4xl sm:text-6xl font-black text-primary tracking-tighter transition-all duration-700 font-premium group-hover:scale-105 active:opacity-40 select-none">
                                            {isFullyAlDia ? 100 : 88}<span className="text-2xl sm:text-4xl ml-1 sm:ml-2">%</span>
                                        </span>
                                        <div className="h-0.5 flex-grow max-w-[60px] sm:max-w-[80px] bg-primary/20 rounded-full mb-3 sm:mb-8"></div>
                                    </div>
                                    
                                    <DeclarationProgressBar client={editedClient} className="mt-4" />
                                </div>
                                <p className="text-[9px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-[0.3em] sm:tracking-[0.4em] font-premium">REPUTACIÓN FISCAL ÓPTIMA</p>
                            </div>

                            <div className="relative flex justify-center text-center">
                                <span className={`absolute -top-10 sm:-top-20 left-1/2 -translate-x-1/2 text-[80px] sm:text-[150px] lg:text-[200px] font-black leading-none tracking-tighter transition-all duration-1000 group-hover:scale-125 select-none font-premium ${isFullyAlDia ? 'text-tertiary opacity-10 dark:opacity-20' : 'text-primary opacity-5 dark:opacity-15'}`}>
                                    {isFullyAlDia ? 'A+' : 'A'}
                                </span>
                                <div className="relative z-10 space-y-4">
                                    <div className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-0 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl font-premium backdrop-blur-xl transition-all duration-500 ${isFullyAlDia ? 'bg-tertiary/10 text-tertiary shadow-tertiary/20 border border-tertiary/30' : 'bg-primary text-on-primary shadow-primary/40'}`}>
                                        {isFullyAlDia ? 'COMPLIANCE VERIFIED' : 'ACTION REQUIRED'}
                                    </div>
                                    <div className="flex items-center justify-center gap-3 text-on-surface-variant/90">
                                        <LucideIcons.TrendingUp size={16} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest font-premium">PROYECCIÓN POSITIVA</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tactical Executive Dashboard */}
                    <div className="space-y-6 sm:space-y-10 group/executive">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-[0.25em] sm:tracking-[0.3em] font-premium relative flex items-center gap-3 sm:gap-4">
                                OBLIGACIONES EJECUTIVAS
                                <div className="h-[1px] w-8 sm:w-12 bg-on-surface-variant/10"></div>
                            </h3>
                            <button onClick={() => setActiveTab('history')} className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-[0.15em] hover:tracking-[0.25em] transition-all font-premium">HISTORIAL</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                            {/* IVA Obligation Vector */}
                            {complianceStats?.iva.needed && (
                                <TaxObligationCard
                                    type="iva"
                                    title="IMPUESTO AL VALOR AGREGADO (IVA)"
                                    period={complianceStats.iva.period}
                                    isDeclared={complianceStats.iva.isDeclared}
                                    isPaid={complianceStats.iva.is_paid}
                                    amount={getClientServiceFee(client, serviceFees, complianceStats.iva.period)}
                                    dueDate={getDueDateForPeriod(client, complianceStats.iva.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.iva.period })}
                                    onPay={() => handleQuickPay(complianceStats.iva.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'iva', period: complianceStats.iva.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* RENTA Obligation Vector */}
                            {complianceStats?.renta.needed && (
                                <TaxObligationCard
                                    type="renta"
                                    title="IMPUESTO A LA RENTA (ANUAL)"
                                    period={complianceStats.renta.period}
                                    isDeclared={complianceStats.renta.isDeclared}
                                    isPaid={complianceStats.renta.is_paid}
                                    amount={editedClient.fee_structure?.annual ?? 10}
                                    dueDate={getDueDateForPeriod(client, complianceStats.renta.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.renta.period })}
                                    onPay={() => handleQuickPay(complianceStats.renta.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'renta', period: complianceStats.renta.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* Special Vectors: Refunds */}
                            {editedClient.taxProfile?.hasActiveDevolucionIva && (
                                <TaxObligationCard
                                    type="refund"
                                    title="DEVOLUCIÓN IVA (TERCERA EDAD)"
                                    status={editedClient.elderlyDevolucionIvaStatus as any}
                                    resolutionFile={editedClient.elderlyDevolucionIvaResolutionFile}
                                    onAction={handleElderlyRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionIvaTerceraEdad' }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {editedClient.taxProfile?.requiresAnnualRenta && editedClient.rentaRefundStatus && (
                                <TaxObligationCard
                                    type="renta_refund"
                                    title="DEVOLUCIÓN IMPUESTO RENTA"
                                    status={editedClient.rentaRefundStatus as any}
                                    isPaid={editedClient.rentaRefundPaid}
                                    onAction={handleRentaRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionRenta' }); proofInputRef.current?.click(); }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Analytics Integration */}
                    <div className="bg-surface-lowest dark:bg-surface/30 rounded-[3rem] sm:rounded-[3.5rem] p-6 sm:p-10 border border-surface-low dark:border-white/5 shadow-architect overflow-hidden relative group backdrop-blur-2xl">
                        <div className="absolute top-0 right-0 p-4 sm:p-8">
                            <LucideIcons.Activity size={24} className="text-primary/20" />
                        </div>
                        <div className="flex items-center gap-4 mb-6 sm:mb-10">
                            <h3 className="text-[9px] sm:text-[10px] font-black text-on-surface-variant dark:text-slate-300 uppercase tracking-[0.3em] font-premium">ANALÍTICA DE HONORARIOS</h3>
                        </div>
                        <PaymentHistoryChart client={client} />
                    </div>
                </div>

                {/* Sector Beta: Tactical Vault & Data (4/12) */}
                <div className="lg:col-span-4 space-y-6 sm:space-y-12">
                    
                    {/* Tactical Access Card */}
                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low dark:border-white/10 shadow-architect relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:opacity-40 transition-all duration-1000 group-hover:scale-110 group-hover:-rotate-12">
                            <LucideIcons.Key size={48} className="text-secondary" />
                        </div>
                        
                        <div className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-12 relative z-10">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[1.2rem] sm:rounded-[1.5rem] bg-secondary-fixed/10 flex items-center justify-center text-secondary dark:text-secondary-fixed shadow-inner">
                                <LucideIcons.Lock size={20} className="sm:w-[24px] sm:h-[24px]" />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black text-on-surface uppercase tracking-[0.2em] font-premium">BÓVEDA TÁCTICA</h3>
                                <p className="text-[8px] sm:text-[9px] font-black text-on-surface-variant/70 uppercase tracking-[0.3em] mt-1 font-premium">CREDENTIAL SECURITY MGR</p>
                            </div>
                        </div>

                        <div className="space-y-5 sm:space-y-6 relative z-10">
                            <div className="p-6 sm:p-8 bg-surface dark:bg-surface-low/50 rounded-[1.5rem] sm:rounded-[2rem] border border-surface-low dark:border-white/5 group/pass shadow-sm hover:border-primary/30 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-[8px] sm:text-[9px] font-black text-on-surface-variant dark:text-slate-400 uppercase tracking-[0.3em] font-premium">CLAVE PORTAL SRI</div>
                                    <div className="p-1 px-2.5 bg-primary/10 rounded-full text-[8px] font-black text-primary uppercase tracking-widest font-premium animate-pulse">ENCRIPTADO</div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <code className="text-base sm:text-lg font-black tracking-[0.2em] sm:tracking-[0.3em] text-primary font-premium selection:bg-primary selection:text-white truncate pr-4">
                                        {passwordVisible ? client.sriPassword : '••••••••••••'}
                                    </code>
                                    <button 
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-2 sm:p-3 hover:bg-primary/10 rounded-xl text-on-surface-variant dark:text-slate-400 hover:text-primary transition-all active:scale-90"
                                        title={passwordVisible ? "Ocultar" : "Mostrar"}
                                    >
                                        {passwordVisible ? <LucideIcons.EyeOff size={16} /> : <LucideIcons.Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:gap-5">
                                <button 
                                    onClick={handleOpenSRI}
                                    className="flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 bg-surface dark:bg-surface-low/50 hover:bg-primary/5 dark:hover:bg-primary/10 border border-surface-low dark:border-white/5 hover:border-primary/20 rounded-[2rem] sm:rounded-[2.5rem] transition-all group/btn shadow-sm active:scale-95"
                                >
                                    <LucideIcons.Globe size={20} className="sm:w-[24px] sm:h-[24px] text-primary group-hover/btn:scale-125 transition-all duration-700" />
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-variant dark:text-slate-400 group-hover/btn:text-primary uppercase tracking-[0.2em] font-premium">LOG-IN SRI</span>
                                </button>
                                <button 
                                    onClick={handleShareViaWhatsApp}
                                    className="flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 bg-surface dark:bg-surface-low/50 hover:bg-tertiary-fixed/10 dark:hover:bg-tertiary/10 border border-surface-low dark:border-white/5 hover:border-tertiary/20 rounded-[2rem] sm:rounded-[2.5rem] transition-all group/btn shadow-sm active:scale-95"
                                >
                                    <LucideIcons.Share2 size={20} className="sm:w-[24px] sm:h-[24px] text-tertiary group-hover/btn:scale-125 transition-all duration-700" />
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-variant dark:text-slate-400 group-hover/btn:text-tertiary uppercase tracking-[0.2em] font-premium">DIFUNDIR</span>
                                </button>
                            </div>
                        </div>
                    </div>



                    {/* Operational Commands */}
                    <div className="bg-surface-lowest dark:bg-surface/40 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low dark:border-white/10 shadow-architect space-y-6 sm:space-y-10 group overflow-hidden relative">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                        <h3 className="text-[9px] sm:text-[10px] font-black text-on-surface-variant dark:text-slate-300 uppercase tracking-[0.4em] font-premium relative z-10">COMANDOS OPERACIONALES</h3>
                        
                        <div className="space-y-3 sm:space-y-5 relative z-10">
                            <button onClick={handleWhatsApp} className="w-full flex items-center justify-between p-4 sm:p-7 bg-surface dark:bg-surface-low/50 hover:bg-primary/5 border border-surface-low dark:border-white/5 hover:border-primary/10 rounded-2xl sm:rounded-[2rem] transition-all group/opt shadow-sm active:scale-[0.98]">
                                <div className="flex items-center gap-3 sm:gap-5">
                                    <div className="p-2 sm:p-4 bg-primary/10 rounded-xl sm:rounded-2xl text-primary group-hover/opt:rotate-12 transition-transform">
                                        <LucideIcons.MessageCircle size={18} className="sm:w-[20px] sm:h-[20px]" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] sm:text-xs font-black text-on-surface dark:text-slate-200 uppercase tracking-widest font-premium">ENLACE WHATSAPP</div>
                                        <div className="text-[7px] sm:text-[9px] text-on-surface-variant dark:text-slate-400 font-bold uppercase tracking-widest mt-1 sm:mt-1.5 font-premium opacity-60">COMUNICACIÓN DIRECTA</div>
                                    </div>
                                </div>
                                <LucideIcons.ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] text-on-surface-variant/40 group-hover/opt:translate-x-3 group-hover/opt:text-primary transition-all duration-500" />
                            </button>

                            <button onClick={() => setActiveTab('settings')} className="w-full flex items-center justify-between p-4 sm:p-7 bg-surface dark:bg-surface-low/50 hover:bg-secondary/5 border border-surface-low dark:border-white/5 hover:border-secondary/10 rounded-2xl sm:rounded-[2rem] transition-all group/opt shadow-sm active:scale-[0.98]">
                                <div className="flex items-center gap-3 sm:gap-5">
                                    <div className="p-2 sm:p-4 bg-secondary/10 rounded-xl sm:rounded-2xl text-secondary group-hover/opt:rotate-[30deg] transition-transform">
                                        <LucideIcons.Settings size={18} className="sm:w-[20px] sm:h-[20px]" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] sm:text-xs font-black text-on-surface dark:text-slate-200 uppercase tracking-widest font-premium">PARAMETRÍA TÉCNICA</div>
                                        <div className="text-[7px] sm:text-[9px] text-on-surface-variant dark:text-slate-400 font-bold uppercase tracking-widest mt-1 sm:mt-1.5 font-premium opacity-60">ESTRUCTURACIÓN FISCAL</div>
                                    </div>
                                </div>
                                <LucideIcons.ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] text-on-surface-variant/40 group-hover/opt:translate-x-3 group-hover/opt:text-secondary transition-all duration-500" />
                            </button>
                        </div>
                    </div>

                    {/* Executive Notes */}
                    <ClientNotes 
                        clientId={client.id} 
                        notes={client.structuredNotes || []} 
                    />
                </div>
            </div>
        </div>
    );
};
