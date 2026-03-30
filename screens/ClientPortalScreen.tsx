import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, ServiceFeesConfig } from '../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod, getDaysUntilDue, safeFormat } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { isPast, addDays } from 'date-fns';
import { Logo } from '../components/ui/Logo';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { Declaration } from '../types';

interface ClientPortalScreenProps {
    client: Client;
    onLogout: () => void;
    serviceFees: ServiceFeesConfig;
}

// Sub-components for cleaner code
const StatCard = ({ title, value, status, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 -mr-10 -mt-10 ${colorClass}`}></div>
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-semibold text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-2xl ${status === 'good' ? 'bg-emerald-50 text-emerald-500' : status === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-rose-400'}`}>
                <Icon size={24} />
            </div>
        </div>
        {status === 'good' && <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg w-max"><LucideIcons.CheckCircle2 size={12} /> Al Día</div>}
        {status === 'warning' && <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-500 bg-amber-50 px-2 py-1 rounded-lg w-max"><LucideIcons.Clock size={12} /> Próximo</div>}
        {status === 'bad' && <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-rose-400 bg-red-50 px-2 py-1 rounded-lg w-max"><LucideIcons.AlertTriangle size={12} /> Pendiente</div>}
    </div>
);

const BankInfoCard = () => {
    const [copied, setCopied] = useState(false);
    const account = "220XXXXXXX"; // Mock account

    const handleCopy = () => {
        navigator.clipboard.writeText(account);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gradient-to-br from-[#0B2149] to-[#051135] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-blue-900/20">
            {/* Card Visuals */}
            <div className="absolute top-0 right-0 p-8 opacity-10"><LucideIcons.CreditCard size={120} /></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00A896] rounded-full blur-[100px] opacity-20 -ml-20 -mb-20"></div>

            <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-medium text-slate-300 uppercase tracking-widest mb-1">Cuenta para Depósitos</p>
                        <h4 className="text-xl font-display font-medium">Banco Pichincha</h4>
                    </div>
                    <Logo className="w-8 h-8 text-white opacity-80" />
                </div>

                <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-widest">Cuenta Ahorros</p>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-2xl tracking-widest text-white shadow-sm">220XXXXXXX</span>
                        <button onClick={handleCopy} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                            {copied ? <LucideIcons.CheckCircle2 size={16} /> : <LucideIcons.Copy size={16} />}
                        </button>
                    </div>
                    <p className="text-sm font-medium text-slate-300">Santiago Cordova</p>
                </div>
            </div>
        </div>
    );
};

export const ClientPortalScreen: React.FC<ClientPortalScreenProps> = ({ client, onLogout, serviceFees }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'vault' | 'calendar'>('overview');
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const fee = getClientServiceFee(client, serviceFees);
    const currentPeriod = getPeriod(client, new Date());
    const declaration = client.declarations.find(d => d.period === currentPeriod);

    // Status Logic
    const isPaid = declaration?.status === DeclarationStatus.Pagada;
    const isDeclared = declaration?.status === DeclarationStatus.Enviada || isPaid;
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const daysUntil = getDaysUntilDue(dueDate);

    // Debt Calc
    const pendingDecls = client.declarations.filter(d => d.status !== DeclarationStatus.Pagada);
    const totalDebt = pendingDecls.reduce((acc, curr) => acc + (curr.amount || fee), 0);

    const toggleKeyVisibility = (key: string) => {
        setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copiado al portapapeles");
    };    const handleOpenInNewTab = (decl: Declaration) => {
        if (!decl.proof_file?.content) return;
        
        // Convert base64 to Blob
        const base64Data = decl.proof_file.content.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Create URL and open
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Cleanup after a delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const handlePreviewPdf = (decl: Declaration) => {
        // Now opens in new tab by default per user request
        handleOpenInNewTab(decl);
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
        if (client.rucCertificate) {
            handleOpenInNewTab({
                period: 'RUC',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                proof_file: client.rucCertificate
            } as Declaration);
        } else if (client.rucPdf) {
            handleOpenInNewTab({
                period: 'RUC',
                status: DeclarationStatus.Pagada,
                updatedAt: new Date().toISOString(),
                proof_file: client.rucPdf
            } as Declaration);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFDFD] font-body text-slate-900 selection:bg-[#00A896]/10 selection:text-[#00A896]">
            {/* Top Navigation - Minimalist */}
            <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-8 py-5 border-b border-slate-100/50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
                            <Logo className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xs font-semibold text-slate-900 uppercase tracking-[0.2em] leading-none mb-1">Bóveda Privada</h1>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Santiago Cordova</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-slate-900 tracking-tight">{client.name}</p>
                            <p className="text-[10px] font-mono font-medium text-slate-400">{client.ruc}</p>
                        </div>
                        <button 
                            onClick={onLogout} 
                            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-400 transition-all active:scale-95 border border-slate-100"
                            title="Cerrar Sesión"
                        >
                            <LucideIcons.LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-12">

                {/* Navigation Tabs - More Minimalist */}
                <div className="flex justify-center mb-16">
                    <div className="inline-flex p-1.5 bg-slate-100/50 rounded-3xl border border-slate-200/50 backdrop-blur-sm">
                        {[
                            { id: 'overview', label: 'Resumen', icon: LucideIcons.LayoutDashboard },
                            { id: 'vault', label: 'Bóveda', icon: LucideIcons.Shield },
                            { id: 'calendar', label: 'Calendario', icon: LucideIcons.Calendar },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'bg-white text-slate-900 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-200/60'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <tab.icon size={15} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- DASHBOARD VIEW --- */}
                {activeTab === 'overview' && (
                    <div className="space-y-12 animate-fade-in-up">
                        <section className="relative overflow-hidden p-10 bg-white rounded-[3rem] border border-slate-100 shadow-premium">
                             <div className="absolute top-0 right-0 w-64 h-64 bg-[#00A896]/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                             <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                                <div>
                                    <span className="inline-block px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[9px] font-semibold uppercase tracking-[0.2em] mb-6 border border-slate-100">
                                        {client.regime} • {client.taxProfile?.ivaFrequency || 'Especial'}
                                    </span>
                                    <h2 className="text-4xl sm:text-5xl font-display font-semibold text-slate-900 tracking-tight leading-tight mb-4">
                                        Hola,<br />{client.name.split(' ')[0]}
                                    </h2>
                                    <p className="text-slate-400 font-medium max-w-sm text-sm">
                                        Su patrimonio digital y obligaciones fiscales están seguros y actualizados bajo nuestra supervisión profesional.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50 text-emerald-700 min-w-[160px]">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-60">Estado</p>
                                        <p className="text-xl font-semibold">{isPaid ? "AL DÍA" : "CONTROLADO"}</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-slate-900 min-w-[160px]">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-40">Pendiente</p>
                                        <p className="text-xl font-semibold">${totalDebt.toFixed(2)}</p>
                                    </div>
                                </div>
                             </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <BankInfoCard />
                             <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-premium flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-[#00A896]/10 text-[#00A896] rounded-2xl flex items-center justify-center mb-6">
                                    <LucideIcons.MessageCircle size={28} />
                                </div>
                                <h4 className="text-xl font-medium text-slate-900 mb-2">Asistencia VIP</h4>
                                <p className="text-slate-400 text-sm mb-8 leading-relaxed">¿Dudas sobre su situación fiscal?<br />Su asesor está disponible para ayudarle.</p>
                                <a
                                    href="https://wa.me/593978980722"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-10 py-4 bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    Enviar Mensaje
                                </a>
                             </div>
                        </div>
                    </div>
                )}

                {/* --- VAULT VIEW - REFINED ELEGANCE --- */}
                {activeTab === 'vault' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-fade-in-up">
                        {/* Documents Section */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="bg-white rounded-[3rem] shadow-premium border border-slate-100 overflow-hidden">
                                <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-3">
                                            <LucideIcons.FolderOpen size={20} className="text-[#00A896]" /> Galería de Comprobantes
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Total {client.declarations.length} documentos encontrados</p>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto no-scrollbar">
                                    {client.declarations.length > 0 ? [...client.declarations].reverse().map((decl, idx) => (
                                        <div key={idx} className="px-10 py-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#00A896] group-hover:border-[#00A896]/20 transition-all">
                                                    <LucideIcons.FileText size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{formatPeriodForDisplay(decl.period)}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${decl.status === 'Pagada' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                                                            {decl.status}
                                                        </span>
                                                        <span className="text-[10px] text-slate-300 font-mono">
                                                            {safeFormat(decl.updatedAt, 'dd/MM/yyyy')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {decl.proof_file ? (
                                                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                                    <button 
                                                        onClick={() => handleOpenInNewTab(decl)}
                                                        className="h-11 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-semibold uppercase tracking-widest hover:bg-[#00A896] transition-all active:scale-95 flex items-center gap-2"
                                                    >
                                                        <LucideIcons.ExternalLink size={14} /> Abrir
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDownloadPdf(decl)}
                                                        className="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                                                        title="Descargar Original"
                                                    >
                                                        <LucideIcons.Download size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                                                    <LucideIcons.MoreHorizontal size={14} />
                                                </div>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="py-24 text-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <LucideIcons.Inbox size={32} className="text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-medium italic">No se han cargado documentos aún.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Credentials SidebarSection */}
                        <div className="lg:col-span-4 space-y-10">
                            {/* RUC / Certificado */}
                            <div 
                                className={`p-8 bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center text-center transition-all ${client.rucPdf || client.rucCertificate ? 'hover:border-[#00A896] hover:bg-[#00A896]/5 cursor-pointer group' : ''}`}
                                onClick={() => (client.rucPdf || client.rucCertificate) && handleRucPreview()}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all ${client.rucPdf || client.rucCertificate ? 'bg-[#00A896] text-white shadow-xl shadow-teal-100' : 'bg-slate-50 text-slate-300'}`}>
                                    <LucideIcons.Verified size={24} />
                                </div>
                                <h4 className="font-semibold text-slate-900 uppercase tracking-widest text-xs mb-1">RUC Certificado</h4>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{client.rucCertificate ? 'VIGENTE' : (client.rucPdf ? 'DIGITAL' : 'PENDIENTE')}</p>
                                {(client.rucPdf || client.rucCertificate) && (
                                    <span className="mt-4 text-[9px] font-semibold text-[#00A896] opacity-0 group-hover:opacity-100 transition-opacity">CLIC PARA VER EN LÍNEA</span>
                                )}
                            </div>

                            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
                                <h4 className="font-semibold uppercase tracking-[0.2em] text-[10px] text-teal-400 mb-8 border-b border-white/5 pb-4">Credenciales Digitales</h4>
                                <div className="space-y-8">
                                    {[
                                        { id: 'sri', label: 'Acceso SRI', value: client.sriPassword },
                                        { id: 'firma', label: 'Firma P12', value: client.electronicSignaturePassword || '---' },
                                    ].map(cred => (
                                        <div key={cred.id} className="relative">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-[9px] font-semibold uppercase text-slate-500 tracking-widest">{cred.label}</span>
                                                <button onClick={() => toggleKeyVisibility(cred.id)} className="text-slate-500 hover:text-white transition-colors">
                                                    {visibleKeys[cred.id] ? <LucideIcons.EyeOff size={14} /> : <LucideIcons.Eye size={14} />}
                                                </button>
                                            </div>
                                            <div className="font-mono text-sm tracking-[0.3em] overflow-hidden whitespace-nowrap">
                                                {visibleKeys[cred.id] ? cred.value : '••••••••••••'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CALENDAR VIEW --- */}
                {activeTab === 'calendar' && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up">
                        <section className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-premium">
                            <header className="text-center mb-12">
                                <h3 className="text-3xl font-display font-semibold text-slate-900 tracking-tight">Cronograma Anual</h3>
                                <p className="text-slate-400 text-sm mt-3 font-medium">Vencimientos para RUC terminados en <span className="text-slate-900 font-semibold">{client.ruc[8]}</span></p>
                            </header>

                            <div className="space-y-6">
                                {[1, 2, 3].map(offset => {
                                    const nextDate = addDays(new Date(), offset * 30);
                                    const monthName = safeFormat(nextDate, 'MMMM');
                                    const day = client.ruc[8] === '1' ? 10 : (parseInt(client.ruc[8]) * 2 + 8);

                                    return (
                                        <article key={offset} className="flex items-center gap-8 p-6 rounded-[2rem] bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group">
                                            <div className="w-16 h-16 bg-white rounded-2x border border-slate-100 flex flex-col items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                                <span className="text-[9px] font-semibold text-slate-300 uppercase">{monthName.slice(0, 3)}</span>
                                                <span className="text-xl font-semibold text-slate-900">{day}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-lg">Declaración de IVA</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Periodo Mensual • {monthName}</p>
                                            </div>
                                            <div className="ml-auto opacity-20 group-hover:opacity-100 transition-opacity">
                                                <LucideIcons.CalendarCheck size={24} className="text-[#00A896]" />
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>

                            <footer className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                <LucideIcons.Info size={20} className="text-slate-400" />
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
                                    Las fechas presentadas son referenciales basadas en el calendario general del SRI.
                                </p>
                            </footer>
                        </section>
                    </div>
                )}

            </main>
        </div>
    );
};