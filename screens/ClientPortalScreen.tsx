import React, { useState, useMemo } from 'react';
import { 
    LayoutDashboard, Lock, FileText, Download, 
    MessageCircle, Eye, EyeOff, CheckCircle2, 
    ArrowRight, LogOut, Copy, CreditCard,
    ShieldCheck, AlertTriangle, Calendar,
    TrendingUp, Banknote, Briefcase, FileCheck, Info,
    Clock, Key
} from 'lucide-react';
import { Client, DeclarationStatus, ServiceFeesConfig } from '../types';
import { formatPeriodForDisplay, getPeriod, getDueDateForPeriod, getDaysUntilDue } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { format, isPast, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Logo } from '../components/Logo';

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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-2xl ${status === 'good' ? 'bg-emerald-50 text-emerald-600' : status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                <Icon size={24} />
            </div>
        </div>
        {status === 'good' && <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max"><CheckCircle2 size={12}/> Al Día</div>}
        {status === 'warning' && <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-max"><Clock size={12}/> Próximo</div>}
        {status === 'bad' && <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg w-max"><AlertTriangle size={12}/> Pendiente</div>}
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
            <div className="absolute top-0 right-0 p-8 opacity-10"><CreditCard size={120} /></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00A896] rounded-full blur-[100px] opacity-20 -ml-20 -mb-20"></div>

            <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-medium text-slate-300 uppercase tracking-widest mb-1">Cuenta para Depósitos</p>
                        <h4 className="text-xl font-display font-bold">Banco Pichincha</h4>
                    </div>
                    <Logo className="w-8 h-8 text-white opacity-80" />
                </div>

                <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Cuenta Ahorros</p>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-2xl tracking-widest text-white shadow-sm">220XXXXXXX</span>
                        <button onClick={handleCopy} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                            {copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>}
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

    const fee = getClientServiceFee(client, serviceFees);
    const currentPeriod = getPeriod(client, new Date());
    const declaration = client.declarationHistory.find(d => d.period === currentPeriod);
    
    // Status Logic
    const isPaid = declaration?.status === DeclarationStatus.Pagada;
    const isDeclared = declaration?.status === DeclarationStatus.Enviada || isPaid;
    const dueDate = getDueDateForPeriod(client, currentPeriod);
    const daysUntil = getDaysUntilDue(dueDate);

    // Debt Calc
    const pendingDecls = client.declarationHistory.filter(d => d.status !== DeclarationStatus.Pagada);
    const totalDebt = pendingDecls.reduce((acc, curr) => acc + (curr.amount || fee), 0);

    const toggleKeyVisibility = (key: string) => {
        setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copiado al portapapeles");
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-body text-slate-800">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#0B2149] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <Logo className="w-6 h-6" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm font-black text-[#0B2149] uppercase tracking-wide leading-none">Portal Privado</h1>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Santiago Cordova</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-700">{client.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{client.ruc}</p>
                        </div>
                        <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <LogOut size={18}/>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                
                {/* Desktop Tabs */}
                <div className="flex justify-center mb-10">
                    <div className="flex p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
                        {[
                            { id: 'overview', label: 'Mi Resumen', icon: LayoutDashboard },
                            { id: 'vault', label: 'Bóveda & Claves', icon: Lock },
                            { id: 'calendar', label: 'Agenda Fiscal', icon: Calendar },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                    activeTab === tab.id 
                                        ? 'bg-[#0B2149] text-white shadow-lg' 
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- DASHBOARD VIEW --- */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
                        {/* Welcome Banner */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-10 opacity-[0.03]"><Briefcase size={200}/></div>
                                <div className="relative z-10">
                                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                                        {client.category}
                                    </span>
                                    <h2 className="text-3xl sm:text-4xl font-display font-black text-[#0B2149] mb-2">
                                        Hola, {client.name.split(' ')[0]}
                                    </h2>
                                    <p className="text-slate-500 font-medium max-w-lg">
                                        Bienvenido a su espacio fiscal. Aquí tiene el control total de sus obligaciones tributarias en tiempo real.
                                    </p>
                                </div>
                            </div>

                            {/* Status Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <StatCard 
                                    title="Estado Declaración"
                                    value={isDeclared ? (isPaid ? "Ciclo Cerrado" : "Declarado") : "Pendiente"}
                                    status={isPaid ? 'good' : (isDeclared ? 'warning' : 'bad')}
                                    icon={isPaid ? ShieldCheck : FileText}
                                    colorClass={isPaid ? "bg-emerald-500" : "bg-blue-500"}
                                />
                                <StatCard 
                                    title="Saldo Pendiente"
                                    value={`$${totalDebt.toFixed(2)}`}
                                    status={totalDebt === 0 ? 'good' : 'bad'}
                                    icon={Banknote}
                                    colorClass={totalDebt === 0 ? "bg-emerald-500" : "bg-red-500"}
                                />
                            </div>

                            {/* Last Declaration */}
                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-bold text-[#0B2149]">Última Actividad</h3>
                                    <button onClick={() => setActiveTab('vault')} className="text-xs font-bold text-[#00A896] hover:underline">Ver Historial</button>
                                </div>
                                {client.declarationHistory.length > 0 ? (
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#00A896] shadow-sm">
                                            <FileCheck size={24}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{formatPeriodForDisplay(client.declarationHistory[client.declarationHistory.length - 1].period)}</p>
                                            <p className="text-xs text-slate-500 font-medium capitalize">{client.declarationHistory[client.declarationHistory.length - 1].status.toLowerCase()}</p>
                                        </div>
                                        <div className="ml-auto">
                                            <span className="text-xs font-mono font-bold text-slate-400">
                                                {format(new Date(client.declarationHistory[client.declarationHistory.length - 1].updatedAt), 'dd MMM yyyy', {locale: es})}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-sm">No hay actividad reciente registrada.</p>
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar: Payment Info */}
                        <div className="lg:col-span-1 space-y-8">
                            <BankInfoCard />
                            
                            <div className="bg-[#00A896]/5 border border-[#00A896]/20 rounded-[2.5rem] p-8 text-center">
                                <MessageCircle size={32} className="mx-auto text-[#00A896] mb-4"/>
                                <h4 className="font-bold text-[#0B2149] mb-2">¿Dudas Contables?</h4>
                                <p className="text-sm text-slate-500 mb-6">Contacte directamente a su asesor personal vía WhatsApp.</p>
                                <a 
                                    href="https://wa.me/593978980722" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center w-full py-4 bg-[#00A896] text-white font-bold rounded-xl shadow-lg shadow-teal-900/10 hover:bg-teal-600 transition-all"
                                >
                                    Chat Soporte VIP
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VAULT VIEW --- */}
                {activeTab === 'vault' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
                        {/* Credentials Column */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b border-slate-100">
                                    <h3 className="font-bold text-[#0B2149] flex items-center gap-2">
                                        <Lock size={18} className="text-[#00A896]"/> Mis Claves
                                    </h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {[
                                        { id: 'sri', label: 'SRI en Línea', value: client.sriPassword },
                                        { id: 'firma', label: 'Firma Electrónica', value: client.electronicSignaturePassword || 'No registrada' },
                                        { id: 'iess', label: 'IESS', value: client.iessPassword || 'No registrada' },
                                    ].map(cred => (
                                        <div key={cred.id} className="p-6">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">{cred.label}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => toggleKeyVisibility(cred.id)} className="text-slate-400 hover:text-[#0B2149]">
                                                        {visibleKeys[cred.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                    </button>
                                                    <button onClick={() => copyToClipboard(cred.value)} className="text-slate-400 hover:text-[#00A896]">
                                                        <Copy size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="font-mono text-sm bg-slate-50 p-3 rounded-lg text-slate-700 border border-slate-100">
                                                {visibleKeys[cred.id] ? cred.value : '••••••••••••'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Documents Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-[#0B2149] flex items-center gap-2">
                                        <FileText size={18} className="text-[#00A896]"/> Documentos Digitales
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{client.declarationHistory.length} Archivos</span>
                                </div>
                                
                                <div className="p-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                                    {client.declarationHistory.length > 0 ? [...client.declarationHistory].reverse().map((decl, idx) => (
                                        <div key={idx} className="p-4 hover:bg-slate-50 rounded-2xl transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${decl.status === 'Pagada' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <FileCheck size={20}/>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[#0B2149]">{formatPeriodForDisplay(decl.period)}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{decl.status}</p>
                                                </div>
                                            </div>
                                            
                                            {decl.status === DeclarationStatus.Pagada ? (
                                                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#0B2149] hover:border-[#00A896] hover:text-[#00A896] transition-all shadow-sm flex items-center gap-2">
                                                    <Download size={14}/> PDF
                                                </button>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-300 italic">No disponible</span>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="p-10 text-center">
                                            <FileText size={48} className="mx-auto text-slate-200 mb-4"/>
                                            <p className="text-slate-400 font-medium">Aún no hay documentos generados.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Important Docs (RUC/Firma) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${client.rucPdf ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <FileText size={20}/>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-[#0B2149]">RUC Digital</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.rucPdf ? 'PDF Disponible' : 'No cargado'}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${client.signatureFile ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Key size={20}/>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-[#0B2149]">Firma Elec.</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.signatureFile ? 'Archivo .P12' : 'No cargado'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CALENDAR VIEW --- */}
                {activeTab === 'calendar' && (
                    <div className="max-w-2xl mx-auto animate-fade-in-up">
                         <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-display font-black text-[#0B2149]">Agenda Fiscal</h3>
                                <p className="text-slate-500 text-sm mt-1">Próximos vencimientos según su noveno dígito: <strong className="text-[#00A896]">{client.ruc[8]}</strong></p>
                            </div>

                            <div className="space-y-4">
                                {[1, 2, 3].map(offset => {
                                    // Calculate simplistic next 3 dates logic based on period
                                    // This is a visualization, real date logic is in sri service
                                    const nextDate = addDays(new Date(), offset * 30);
                                    // Mock upcoming dates
                                    const monthName = format(nextDate, 'MMMM', {locale: es});
                                    const day = client.ruc[8] === '1' ? 10 : (parseInt(client.ruc[8]) * 2 + 8); // simplified logic

                                    return (
                                        <div key={offset} className="flex items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden">
                                            <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm z-10">
                                                <span className="text-xs font-bold text-slate-400 uppercase">{monthName.slice(0,3)}</span>
                                                <span className="text-xl font-black text-[#0B2149]">{day}</span>
                                            </div>
                                            <div className="z-10">
                                                <p className="font-bold text-[#0B2149]">Declaración {monthName}</p>
                                                <p className="text-xs text-slate-500">Estimado a pagar: <span className="font-mono font-bold text-slate-700">$??.??</span></p>
                                            </div>
                                            {/* Decorative line */}
                                            <div className="absolute right-0 top-0 h-full w-1 bg-[#00A896]"></div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs text-center font-medium">
                                <Info size={16} className="inline mb-1 mr-1"/>
                                Las fechas pueden variar si caen en fin de semana o feriado.
                            </div>
                         </div>
                    </div>
                )}

            </main>
        </div>
    );
};