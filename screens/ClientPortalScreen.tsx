import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxObligationType, Declaration } from '../types';
import { formatPeriodForDisplay, safeFormat } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { getClientCompliance, COMPLIANCE_COLORS } from '../services/complianceEngine';
import { Logo } from '../components/ui/Logo';

// ─────────────────────────────────────────────────────────
// UI SUB-COMPONENTS (Elite Zen v3.1)
// ─────────────────────────────────────────────────────────

const HealthGauge = ({ score, color }: { score: number, color: string }) => {
    const config = COMPLIANCE_COLORS[color as any] || COMPLIANCE_COLORS.gray;
    return (
        <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800"
                />
                <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={364.4}
                    strokeDashoffset={364.4 - (364.4 * score) / 100}
                    strokeLinecap="round"
                    className={`${config.text} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-slate-900">{score}%</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Salud</span>
            </div>
        </div>
    );
};

const BankCardPremium = ({ clientName }: { clientName: string }) => {
    const [copied, setCopied] = useState(false);
    const account = "220XXXXXXX";

    const handleCopy = () => {
        navigator.clipboard.writeText(account);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group perspective-1000">
            <div className="bg-gradient-to-br from-[#0B2149] via-[#051135] to-[#010614] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-blue-900/30 border border-white/5 transition-all duration-500 hover:rotate-y-2 hover:scale-[1.02]">
                {/* Visual Artifacts */}
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform"><LucideIcons.ShieldCheck size={100} /></div>
                <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-[80px]"></div>
                <div className="absolute top-10 left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[60px]"></div>

                <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                                <LucideIcons.CreditCard size={12} className="text-teal-400" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Canal de Pago Directo</span>
                            </div>
                            <h4 className="text-2xl font-display font-medium tracking-tight">Banco Pichincha</h4>
                        </div>
                        <Logo className="w-10 h-10 text-white opacity-40" />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Número de Cuenta</p>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-2xl tracking-[0.2em] text-white/90 drop-shadow-lg">2200XXXXXX</span>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white border border-white/10"
                                >
                                    {copied ? <LucideIcons.Check size={14} className="text-teal-400" /> : <LucideIcons.Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Titular</p>
                                <p className="text-sm font-medium text-slate-200 tracking-wider">Santiago A. Cordova</p>
                            </div>
                            <div className="w-12 h-8 bg-gradient-to-r from-amber-400/20 to-amber-600/20 rounded-md border border-amber-500/30 flex items-center justify-center">
                                <div className="w-6 h-4 bg-amber-500/40 rounded-sm"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimelineItem = ({ ob }: { ob: any }) => {
    const config = COMPLIANCE_COLORS[ob.color] || COMPLIANCE_COLORS.gray;
    const isDeclared = ob.isDeclared;

    return (
        <div className="relative flex gap-6 pb-10 last:pb-0 group">
            <div className="absolute top-10 left-[1.125rem] bottom-0 w-[2px] bg-slate-100 group-last:hidden"></div>
            <div className={`relative z-10 w-9 h-9 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-all group-hover:scale-110 ${isDeclared ? 'bg-emerald-500 text-white' : config.dot}`}>
                {isDeclared ? <LucideIcons.Check size={14} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-white/50"></div>}
            </div>
            <div className="flex-1 pt-1">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-100 group-hover:border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1 block">{formatPeriodForDisplay(ob.period)}</span>
                            <h4 className="text-base font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">{ob.label}</h4>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${config.bg} ${config.text} border ${config.border}`}>
                            {config.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <LucideIcons.Calendar size={13} className="text-slate-300" />
                            Vence el {ob.dueDate ? safeFormat(ob.dueDate, 'dd/MM/yyyy') : '---'}
                        </div>
                        {ob.daysRemaining !== null && !isDeclared && (
                            <div className={`flex items-center gap-1.5 ${ob.daysRemaining < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                <LucideIcons.Clock size={13} />
                                {ob.daysRemaining < 0 ? 'Vencido' : `${ob.daysRemaining} días restantes`}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ClientPortalScreenProps {
    client: Client;
    onLogout: () => void;
    serviceFees: ServiceFeesConfig;
}

export const ClientPortalScreen: React.FC<ClientPortalScreenProps> = ({ client, onLogout, serviceFees }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'vault' | 'timeline'>('overview');
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    
    const compliance = useMemo(() => getClientCompliance(client, new Date()), [client]);
    const healthConfig = COMPLIANCE_COLORS[compliance.overallColor] || COMPLIANCE_COLORS.gray;
    
    const fee = getClientServiceFee(client, serviceFees);
    const totalDebt = useMemo(() => {
        const pending = client.declarations?.filter(d => !d.is_paid && d.status !== 'Pendiente') || [];
        return pending.length * fee;
    }, [client.declarations, fee]);

    const toggleKeyVisibility = (key: string) => {
        setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleOpenInNewTab = (decl: Declaration) => {
        if (!decl.proof_file?.content) return;
        const base64Data = decl.proof_file.content.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const handleDownloadPdf = (decl: Declaration) => {
        if (!decl.proof_file?.content) return;
        const link = document.createElement('a');
        link.href = decl.proof_file.content;
        link.download = decl.proof_file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRucPreview = () => {
        const file = client.rucCertificate || client.rucPdf;
        if (file) {
            handleOpenInNewTab({
                period: 'Expediente',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                proof_file: file
            } as Declaration);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFDFD] font-body text-slate-900 selection:bg-teal-500/10 selection:text-teal-600">
            {/* 💎 Elite Top Navigation */}
            <nav className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-8 py-5 border-b border-slate-100/50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-slate-900 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl shadow-slate-300 transform transition-transform hover:rotate-6">
                            <Logo className="w-7 h-7" />
                        </div>
                        <div className="border-l border-slate-200 pl-5">
                            <h1 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.3em] leading-none mb-1.5">Bóveda Privada</h1>
                            <p className="text-xs text-teal-600 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <LucideIcons.Shield size={10} strokeWidth={3} />
                                Santiago Cordova
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800 tracking-tight leading-tight">{client.name}</p>
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-0.5">{client.ruc}</p>
                        </div>
                        <button 
                            onClick={onLogout} 
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95 border border-slate-100"
                        >
                            <LucideIcons.LogOut size={20} />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-12">
                {/* 🎚️ Zen Navigation Tabs */}
                <div className="flex justify-center mb-20">
                    <div className="inline-flex p-1.5 bg-slate-100/40 rounded-[2rem] border border-slate-200/50 backdrop-blur-md shadow-inner">
                        {[
                            { id: 'overview', label: 'Centro de Mando', icon: LucideIcons.LayoutDashboard },
                            { id: 'vault', label: 'Expedientes', icon: LucideIcons.Layers },
                            { id: 'timeline', label: 'Cronograma', icon: LucideIcons.Activity },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 px-10 py-4 rounded-3xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                                    }`}
                            >
                                <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────
                    CENTRO DE MANDO (OVERVIEW) 
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-16 animate-fade-in-up">
                        <section className="relative overflow-hidden p-12 bg-white rounded-[4rem] border border-slate-100 shadow-premium group">
                             <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
                             <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -ml-20 -mb-20"></div>

                             <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
                                <div className="space-y-8">
                                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] border border-slate-100/60 transition-colors hover:border-teal-200">
                                        <div className={`w-2 h-2 rounded-full ${healthConfig.dot}`}></div>
                                        {client.regime}
                                    </div>
                                    <h2 className="text-5xl sm:text-7xl font-display font-medium text-slate-900 tracking-tighter leading-[1.05] mb-2">
                                        Estatus<br /><span className="text-slate-400">Garantizado.</span>
                                    </h2>
                                    <p className="text-slate-500 font-medium max-w-md text-lg leading-relaxed antialiased">
                                        Gestionamos su cumplimiento fiscal con precisión quirúrgica para garantizar su tranquilidad patrimonial.
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-8 bg-slate-50/50 p-10 rounded-[3.5rem] border border-slate-100 backdrop-blur-sm">
                                    <HealthGauge score={compliance.score} color={compliance.overallColor} />
                                    <div className="text-center">
                                        <p className={`text-xs font-bold uppercase tracking-[0.3em] mb-1 ${healthConfig.text}`}>{healthConfig.label}</p>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cumplimiento Global</p>
                                    </div>
                                </div>
                             </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                             <BankCardPremium clientName={client.name} />
                             
                             <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-premium flex flex-col items-center justify-center text-center group">
                                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 shadow-lg shadow-teal-100/20">
                                    <LucideIcons.MessageSquareQuote size={32} />
                                </div>
                                <h4 className="text-3xl font-display font-medium text-slate-900 mb-3 tracking-tight">Comunicación Directa</h4>
                                <p className="text-slate-500 text-base mb-10 leading-relaxed max-w-xs">
                                    Su asesor personal está a un clic de distancia para cualquier consulta técnica.
                                </p>
                                <a
                                    href="https://wa.me/593978980722"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-[2rem] hover:bg-teal-600 transition-all active:scale-95 shadow-2xl shadow-slate-200"
                                >
                                    Abrir WhatsApp Ejecutivo
                                </a>
                             </div>
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    EXPEDIENTES (VAULT)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'vault' && (
                    <div className="space-y-12 animate-fade-in-up">
                        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                            <div>
                                <h3 className="text-4xl font-display font-medium tracking-tight text-slate-900 mb-2">Bóveda de Documentos</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">Total {client.declarations.length} Registros Certificados</p>
                            </div>
                            
                            <div className="flex gap-4">
                                <div 
                                    onClick={() => (client.rucCertificate || client.rucPdf) && handleRucPreview()}
                                    className={`px-8 py-4 rounded-2xl border flex items-center gap-4 transition-all group ${client.rucCertificate || client.rucPdf ? 'bg-white border-slate-200 cursor-pointer hover:border-teal-500 hover:shadow-xl hover:shadow-teal-100/20' : 'bg-slate-50 border-slate-100 opacity-50'}`}
                                >
                                    <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                                        <LucideIcons.FileUp size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Certificado RUC</p>
                                        <p className="text-xs font-bold text-slate-900">Visualizar Digital</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {client.declarations.length > 0 ? [...client.declarations].reverse().map((decl, idx) => {
                                const isPaid = decl.status === 'Pagada' || !!decl.is_paid;
                                return (
                                    <div key={idx} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-premium transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-200/50 group">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                                                <LucideIcons.FileCheck size={28} />
                                            </div>
                                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {decl.status}
                                            </div>
                                        </div>

                                        <div className="space-y-1 mb-8">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{decl.type || 'IVA'}</p>
                                            <h4 className="text-2xl font-display font-medium text-slate-900">{formatPeriodForDisplay(decl.period)}</h4>
                                            <p className="text-xs text-slate-400 font-medium">{safeFormat(decl.updatedAt, 'MMMM dd, yyyy')}</p>
                                        </div>

                                        <div className="flex gap-3 pt-6 border-t border-slate-50">
                                            <button 
                                                onClick={() => handleOpenInNewTab(decl)}
                                                className="flex-1 h-12 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-teal-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <LucideIcons.ExternalLink size={14} /> Abrir
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadPdf(decl)}
                                                className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-white hover:text-slate-900 hover:border-slate-200 border border-transparent transition-all"
                                            >
                                                <LucideIcons.Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-200">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-slate-200/50">
                                        <LucideIcons.CloudOff size={36} className="text-slate-200" />
                                    </div>
                                    <h4 className="text-2xl font-display font-medium text-slate-900 mb-2">Bóveda Vacía</h4>
                                    <p className="text-slate-400 font-medium">No se han sincronizado expedientes para este ejercicio fiscal.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    CRONOGRAMA (TIMELINE)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'timeline' && (
                    <div className="max-w-3xl mx-auto animate-fade-in-up">
                        <section className="bg-white rounded-[4rem] p-16 border border-slate-100 shadow-premium">
                            <header className="text-center mb-16">
                                <span className="inline-block px-4 py-1.5 bg-teal-50 text-teal-600 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-4 border border-teal-100">Planificación 2024</span>
                                <h3 className="text-5xl font-display font-medium text-slate-900 tracking-tight">Timeline Fiscal</h3>
                                <p className="text-slate-400 text-sm mt-5 font-medium leading-relaxed max-w-sm mx-auto">
                                    Próximos hitos obligatorios según el calendario regulatorio para su terminación de RUC (<span className="text-slate-900 font-bold">{client.ruc[8]}</span>).
                                </p>
                            </header>

                            <div className="relative pl-4 overflow-hidden">
                                {compliance.obligations.filter(ob => ob.color !== 'gray').map((ob, idx) => (
                                    <TimelineItem key={idx} ob={ob} />
                                ))}
                                
                                {compliance.obligations.filter(ob => ob.color === 'gray').length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center mb-8">Periodos Completados o Futuros</p>
                                        <div className="opacity-40 grayscale pointer-events-none">
                                            {compliance.obligations.filter(ob => ob.color === 'gray').slice(0, 2).map((ob, idx) => (
                                                <TimelineItem key={`gray-${idx}`} ob={ob} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <footer className="mt-16 p-8 bg-slate-50/80 rounded-[2.5rem] border border-slate-100 flex items-start gap-5">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm">
                                    <LucideIcons.ShieldAlert size={20} />
                                </div>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed antialiased">
                                    <strong className="text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">Nota de Seguridad:</strong>
                                    Baku monitorea su calendario diariamente. Las fechas mostradas consideran feriados locales y ajustes proactivos para evitar multas.
                                </p>
                            </footer>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
};