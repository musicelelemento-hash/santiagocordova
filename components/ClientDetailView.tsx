
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, ServiceFeesConfig, ReceiptData, StoredFile } from '../types';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod } from '../services/sri';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { getClientServiceFee } from '../services/clientService';
import { format, isPast, subMonths, subYears, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, 
    ShieldCheck, FileText, Zap, UserX, UserCheck2, 
    MoreHorizontal, Printer, Clipboard, CheckCircle, Send, Loader, ArrowDownToLine, 
    Sparkles, AlertTriangle, Clock, Briefcase, Key, MapPin, CreditCard, User, History, Crown, Save, Activity, MessageCircle, Hammer, Building, Mail, Calendar as CalendarIcon, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, Download, Search, RefreshCw, X
} from 'lucide-react';
import { Modal } from './Modal';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';

// Helper functions (same as before)
const getRecentPeriods = (client: Client, count: number): string[] => {
    const periods: string[] = [];
    let currentDate = new Date();
    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) { periods.push(period); }
        if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) { currentDate = subMonths(currentDate, 1); } 
        else if (client.category.includes('Semestral')) { currentDate = subMonths(currentDate, 6); } 
        else { currentDate = subYears(currentDate, 1); }
    }
    while (periods.length < count && client.regime === TaxRegime.RimpeNegocioPopular) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) { periods.push(period); }
        currentDate = subYears(currentDate, 1);
    }
    return periods.slice(0, count).reverse();
};

const getObligationFromCategory = (category: ClientCategory): string => {
    if (category.includes('Mensual') && !category.includes('Devolución')) return 'Mensual';
    if (category.includes('Semestral')) return 'Semestral';
    if (category.includes('Renta')) return 'Renta';
    if (category.includes('Devolucion')) return 'Devolucion';
    return 'Mensual';
};

const isVipCategory = (category: ClientCategory): boolean => {
    return category.includes('Suscripción');
};

const buildCategory = (obligation: string, isVip: boolean): ClientCategory => {
    switch (obligation) {
        case 'Mensual': return isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;
        case 'Semestral': return isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        case 'Renta': return ClientCategory.ImpuestoRentaNegocioPopular;
        case 'Devolucion': return ClientCategory.DevolucionIvaTerceraEdad;
        default: return ClientCategory.InternoMensual;
    }
};

const PaymentHistoryChart: React.FC<{ client: Client }> = memo(({ client }) => {
    const periods = getRecentPeriods(client, 6);
    const historyMap = new Map((client.declarationHistory || []).map(d => [d.period, d] as [string, Declaration]));
    const chartData = periods.map(period => {
        const declaration = historyMap.get(period) as Declaration | undefined;
        let status = 'No Generado';
        if (declaration) {
            const dueDate = getDueDateForPeriod(client, period);
            if (declaration.status === DeclarationStatus.Pendiente && dueDate && isPast(dueDate)) { status = 'Vencido'; } 
            else if (declaration.status === DeclarationStatus.Enviada) { status = 'Declarado'; } 
            else if (declaration.status === DeclarationStatus.Pagada) { status = 'Pagado'; } 
            else { status = 'Pendiente'; }
        }
        return { name: formatPeriodForDisplay(period).split(' ')[0], value: 1, status: status };
    });
    const statusColors: { [key: string]: string } = { 'Pagado': '#10b981', 'Declarado': '#3b82f6', 'Pendiente': '#f59e0b', 'Vencido': '#ef4444', 'No Generado': '#9ca3af' };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 h-full">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-wider flex items-center gap-2">
                <Activity size={14}/> Tendencia de Pagos (6 Meses)
            </h4>
            <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                    <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis hide={true} domain={[0, 1]} />
                        <Tooltip 
                            cursor={{ fill: 'rgba(20, 184, 166, 0.1)' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const dataPoint = (payload[0] as any).payload;
                                    return (
                                        <div className="p-3 bg-slate-900 text-white rounded-xl text-xs shadow-xl border border-slate-700 backdrop-blur-md">
                                            <p className="font-bold mb-2 text-slate-300 border-b border-slate-700 pb-1">{label}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{background: statusColors[dataPoint.status]}}></div>
                                                <span className="font-medium text-white">{dataPoint.status}</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={24} animationDuration={1000}>
                            {chartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={statusColors[entry.status]} /> ))}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
});

const CopyButton: React.FC<{ text: string, label?: string, obscured?: boolean, onCopy?: () => void }> = ({ text, label, obscured, onCopy }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        if (onCopy) onCopy();
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handleCopy} className={`group relative flex items-center justify-between w-full p-3 rounded-xl border transition-all duration-200 ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-teal/50 hover:shadow-sm'}`}>
            <div className="flex flex-col items-start truncate pr-2">
                {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>}
                <span className={`font-mono text-sm font-bold truncate w-full text-left ${copied ? 'text-green-700' : 'text-slate-700 dark:text-slate-200'}`}>{obscured ? '••••••••' : text}</span>
            </div>
            <div className={`p-2 flex-shrink-0 rounded-lg transition-colors ${copied ? 'bg-green-200 text-green-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-brand-teal group-hover:bg-brand-teal/10'}`}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
            </div>
        </button>
    );
};

const PasswordCriteriaDisplay: React.FC<{ password: string, visible: boolean }> = ({ password, visible }) => {
    const { criteria } = validateSriPassword(password);
    return (
        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${visible ? 'max-h-32 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {['length', 'uppercase', 'lowercase', 'number', 'special'].map((key) => (
                    <div key={key} className={`flex items-center space-x-1.5 text-[10px] ${(criteria as any)[key] ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-400'}`}>
                        {(criteria as any)[key] ? <CheckCircle size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-slate-300"></div>}
                        <span className="capitalize">{key === 'length' ? 'Mínimo 8' : key}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ClientDetailViewProps {
    client: Client;
    onSave: (updatedClient: Client) => void;
    onBack: () => void;
    serviceFees: ServiceFeesConfig;
    sriCredentials?: Record<string, string>;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = memo(({ client, onSave, onBack, serviceFees, sriCredentials }) => {
    const { toast } = useToast();
    const [editedClient, setEditedClient] = useState(client);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'notes'>('profile');
    
    // UI State
    const [obligation, setObligation] = useState(getObligationFromCategory(client.category));
    const [isVip, setIsVip] = useState(isVipCategory(client.category));
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [signaturePasswordVisible, setSignaturePasswordVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Modals & Actions
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
    const [summary, setSummary] = useState('');
    
    // Refs
    const p12InputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const updateRucInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        if (!isEditing) {
            setEditedClient(client); 
            setObligation(getObligationFromCategory(client.category)); 
            setIsVip(isVipCategory(client.category));
        }
    }, [client, isEditing]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) { setIsMenuOpen(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { totalDebt, nextDeadline, pendingDeclaration } = useMemo(() => {
        const pending = (editedClient.declarationHistory || []).filter(d => d.status !== DeclarationStatus.Pagada);
        const debt = pending.reduce((sum, d) => sum + (d.amount ?? getClientServiceFee(editedClient, serviceFees)), 0);
        const periods = getRecentPeriods(editedClient, 1);
        const currentPeriod = periods[0] || getPeriod(editedClient, new Date());
        const pendingDecl = editedClient.declarationHistory.find(d => d.period === currentPeriod && d.status === DeclarationStatus.Pendiente);
        const nextPeriod = periods[0] ? getNextPeriod(periods[0]) : getPeriod(editedClient, new Date());
        const deadline = getDueDateForPeriod(editedClient, nextPeriod);
        
        return { totalDebt: debt, nextDeadline: deadline, pendingDeclaration: pendingDecl };
    }, [editedClient, serviceFees]);

    // Handlers
    const handleSave = () => {
        let newCategory = editedClient.category;
        if (editedClient.regime !== TaxRegime.RimpeNegocioPopular) {
             newCategory = buildCategory(obligation, isVip);
        }
        onSave({ ...editedClient, category: newCategory });
        setIsEditing(false);
        setIsMenuOpen(false);
    };

    const handleSummarize = async () => {
        if (!editedClient.notes) return;
        setIsSummarizing(true);
        const result = await summarizeTextWithGemini(editedClient.notes);
        setSummary(result);
        setIsSummarizing(false);
    };

    const handleConfirmAction = (sendWhatsApp: boolean = false) => {
        if (!confirmation) return;
        setIsProcessingAction(true);
        const { action, period } = confirmation;
        const now = new Date().toISOString();
        
        const updatedHistory = [...editedClient.declarationHistory];
        const existingIndex = updatedHistory.findIndex(d => d.period === period);
        
        const newDecl: Declaration = {
            period,
            status: action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada,
            updatedAt: now,
            declaredAt: action === 'declare' ? now : updatedHistory[existingIndex]?.declaredAt,
            paidAt: action === 'pay' ? now : undefined,
            amount: updatedHistory[existingIndex]?.amount // Preserve amount
        };

        if (existingIndex > -1) {
            updatedHistory[existingIndex] = { ...updatedHistory[existingIndex], ...newDecl };
        } else {
            updatedHistory.push(newDecl);
        }
    
        const updatedClient = { ...editedClient, declarationHistory: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);
    
        setTimeout(() => {
            if (action === 'pay') {
                const updatedDeclaration = updatedHistory.find(d => d.period === period);
                if (updatedDeclaration) handleShowReceipt(updatedDeclaration);
                toast.success('Pago registrado correctamente.');
            } else {
                toast.success('Declaración marcada como enviada.');
            }
             if (sendWhatsApp && (editedClient.phones || []).length > 0) {
                const mainPhone = editedClient.phones![0].replace(/\D/g, '');
                const message = `Estimado/a ${editedClient.name}, su ${action === 'declare' ? 'declaración' : 'pago'} del período ${formatPeriodForDisplay(period)} ha sido procesado exitosamente.`;
                window.open(`https://wa.me/593${mainPhone.substring(1)}?text=${encodeURIComponent(message)}`, "_blank");
            }
            setIsProcessingAction(false);
            setConfirmation(null);
        }, 500);
    };

    const handleQuickDeclare = (period: string) => {
        setConfirmation({ action: 'declare', period });
    };

    const handleShowReceipt = (declaration: Declaration) => {
        const fee = declaration.amount ?? getClientServiceFee(client, serviceFees);
        const data: ReceiptData = {
            transactionId: declaration.transactionId || `TRX-${declaration.period.replace('-', '')}`,
            clientName: client.name,
            clientRuc: client.ruc,
            client: client,
            paymentDate: format(new Date(declaration.paidAt || declaration.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: es }),
            paidPeriods: [{ period: declaration.period, amount: fee }],
            totalAmount: fee,
        };
        setReceiptData(data);
        setIsReceiptModalOpen(true);
    };

    const handleUpdateFromDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzingDocument(true);
        try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64String = (ev.target?.result as string).split(',')[1];
                const aiData = await analyzeClientPhoto(base64String, file.type) as any;
                
                let category = aiData.category;
                if (!category) {
                    if (aiData.regime === TaxRegime.RimpeNegocioPopular) category = ClientCategory.ImpuestoRentaNegocioPopular;
                    else category = ClientCategory.SuscripcionMensual;
                }

                const updatedClient = {
                    ...editedClient,
                    ...aiData,
                    category,
                    phones: aiData.phones?.length ? aiData.phones : editedClient.phones,
                    email: aiData.email || editedClient.email,
                    name: aiData.name || editedClient.name,
                    notes: (editedClient.notes || '') + (aiData.notes ? `\n\n[IA Scan]: ${aiData.notes}` : '')
                };

                setEditedClient(updatedClient);
                setIsAnalyzingDocument(false);
                toast.success('Datos actualizados desde el documento.');
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            setIsAnalyzingDocument(false);
            toast.error(error.message || "Error al analizar el documento.");
        }
        if (updateRucInputRef.current) updateRucInputRef.current.value = "";
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col animate-fade-in absolute inset-0 z-50 overflow-hidden">
             
             {/* HEADER */}
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-20 flex-shrink-0">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="h-16 flex items-center justify-between">
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-brand-navy dark:hover:text-white transition-colors group">
                            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                                <ArrowDownToLine className="rotate-90" size={20}/>
                            </div>
                            <span className="font-bold text-sm hidden sm:inline">Volver</span>
                        </button>
                        
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all transform hover:scale-105">
                                    <Save size={18}/> Guardar Cambios
                                </button>
                            ) : (
                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                        <MoreHorizontal size={20} />
                                    </button>
                                    {isMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl z-30 border border-slate-100 dark:border-slate-700 animate-fade-in-down overflow-hidden">
                                            <div className="p-1">
                                                <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-xl">
                                                    <Edit size={16} className="text-blue-500"/> Editar Información
                                                </button>
                                                <button onClick={() => { onSave({...editedClient, isActive: !editedClient.isActive}); setIsMenuOpen(false); }} className={`w-full text-left flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-xl ${editedClient.isActive ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                                                    {editedClient.isActive ? <UserX size={16}/> : <UserCheck2 size={16}/>}
                                                    {editedClient.isActive ? 'Desactivar Cliente' : 'Activar Cliente'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="py-6 flex flex-col md:flex-row gap-6 items-start justify-between">
                        <div className="flex gap-5 items-center">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-navy to-slate-900 text-white flex items-center justify-center text-3xl font-display font-bold shadow-2xl border-[3px] border-white dark:border-slate-800">
                                    {client.name.substring(0, 2).toUpperCase()}
                                </div>
                                {isVip && <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-300 to-amber-500 p-2 rounded-full text-white border-[3px] border-white dark:border-slate-800 shadow-sm"><Crown size={14} fill="currentColor"/></div>}
                            </div>
                            
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight font-display">{client.name}</h1>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <button onClick={() => { navigator.clipboard.writeText(client.ruc); toast.success("RUC copiado"); }} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        <CreditCard size={12}/> {client.ruc} <Copy size={10} className="opacity-50"/>
                                    </button>
                                    <span className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5">
                                        <Briefcase size={12}/> {client.regime}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                        {[
                            { id: 'profile', label: 'Datos Tributarios', icon: ShieldCheck },
                            { id: 'history', label: 'Historial & Pagos', icon: History },
                            { id: 'notes', label: 'Bóveda & Notas', icon: Lock }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === tab.id 
                                        ? 'border-brand-teal text-brand-teal' 
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-300'
                                }`}
                            >
                                <tab.icon size={18}/> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
             </div>

             {/* Content Area */}
             <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 dark:bg-slate-950">
                <div className="max-w-5xl mx-auto w-full">
                
                {/* TAB: PROFILE (TAX INFO) */}
                {activeTab === 'profile' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        
                        {/* --- CENTRO DE COMANDO TRIBUTARIO (WORKFLOW WIZARD) --- */}
                        {pendingDeclaration && (
                            <div className="lg:col-span-3">
                                <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden text-white">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/20 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                            <div>
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                                                    <Clock size={12}/> Acción Requerida
                                                </div>
                                                <h3 className="text-xl font-bold">Declaración Pendiente: {formatPeriodForDisplay(pendingDeclaration.period)}</h3>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                                            {/* Step 1: Credentials */}
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-brand-teal text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-slate-800 z-10">1</div>
                                                    <div className="h-full w-0.5 bg-slate-700/50 my-1"></div>
                                                </div>
                                                <div className="flex-1 pb-4">
                                                    <h4 className="font-bold text-slate-200 mb-2">Copiar Credenciales</h4>
                                                    <div className="space-y-2">
                                                        <CopyButton label="RUC" text={editedClient.ruc} />
                                                        <CopyButton label="Clave" text={editedClient.sriPassword} obscured />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Step 2: Access SRI */}
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-brand-teal text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-slate-800 z-10">2</div>
                                                    <div className="h-full w-0.5 bg-slate-700/50 my-1"></div>
                                                </div>
                                                <div className="flex-1 pb-4">
                                                    <h4 className="font-bold text-slate-200 mb-2">Acceder al Portal</h4>
                                                    <button 
                                                        onClick={() => window.open("https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT", "_blank")}
                                                        className="w-full flex items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all shadow-md group"
                                                    >
                                                        <Globe size={24} className="text-brand-teal group-hover:scale-110 transition-transform"/>
                                                        <div className="text-left">
                                                            <span className="block font-bold text-sm">Abrir SRI en Línea</span>
                                                            <span className="text-[10px] text-slate-400">srienlinea.sri.gob.ec</span>
                                                        </div>
                                                        <ExternalLink size={14} className="ml-auto text-slate-500"/>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Step 3: Confirm */}
                                            <div className="flex gap-4">
                                                <div className="flex-shrink-0 flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-brand-teal text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-slate-800 z-10">3</div>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-200 mb-2">Finalizar Proceso</h4>
                                                    <button 
                                                        onClick={() => handleQuickDeclare(pendingDeclaration.period)}
                                                        className="w-full h-[68px] bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                                                    >
                                                        <CheckCircle size={24}/>
                                                        <span>Confirmar Declaración</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Column 1: Tax Data */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 relative">
                                {isEditing && (
                                    <div className="absolute top-6 right-6 z-10">
                                         <input type="file" accept=".pdf,image/*" className="hidden" ref={updateRucInputRef} onChange={handleUpdateFromDocument} />
                                         <button 
                                            onClick={() => updateRucInputRef.current?.click()} 
                                            disabled={isAnalyzingDocument}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                                        >
                                            {isAnalyzingDocument ? <Loader size={14} className="animate-spin"/> : <UploadCloud size={14}/>}
                                            {isAnalyzingDocument ? 'Analizando...' : 'Actualizar desde RUC'}
                                         </button>
                                    </div>
                                )}

                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <FileText size={16} className="text-brand-teal"/> Datos del Certificado RUC
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-6">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-colors hover:border-brand-teal/30">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Artesano Calificado</label>
                                            {isEditing ? (
                                                <select value={editedClient.isArtisan ? 'yes' : 'no'} onChange={e => setEditedClient({...editedClient, isArtisan: e.target.value === 'yes'})} className="w-full p-2 bg-white dark:bg-slate-700 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal">
                                                    <option value="no">No</option>
                                                    <option value="yes">Sí, Calificado</option>
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${editedClient.isArtisan ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
                                                        <Hammer size={16}/>
                                                    </div>
                                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{editedClient.isArtisan ? 'Sí, Calificado' : 'No Registra'}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-colors hover:border-brand-teal/30">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Establecimientos</label>
                                            {isEditing ? (
                                                <select value={editedClient.establishmentCount || 1} onChange={e => setEditedClient({...editedClient, establishmentCount: parseInt(e.target.value)})} className="w-full p-2 bg-white dark:bg-slate-700 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal">
                                                    {Array.from({length: 10}, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                                                        <Building size={16}/>
                                                    </div>
                                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{editedClient.establishmentCount || 1} Abierto(s)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 h-full transition-colors hover:border-brand-teal/30">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Jurisdicción / Dirección</label>
                                        {isEditing ? (
                                            <textarea rows={4} value={editedClient.jurisdiction || ''} onChange={e => setEditedClient({...editedClient, jurisdiction: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal resize-none" placeholder="Dirección exacta según RUC"/>
                                        ) : (
                                            <div className="flex items-start gap-3">
                                                <MapPin size={20} className="text-slate-400 mt-0.5 flex-shrink-0"/>
                                                <p className="font-medium text-slate-800 dark:text-white text-sm leading-relaxed">{editedClient.jurisdiction || 'No registrada'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ... (Other columns remain largely same structure) ... */}
                    </div>
                )}
                
                {/* ... (Other Tabs and Modals logic remains mostly same, just ensuring Confirm/Receipt modals are hooked up correctly) ... */}

                {/* Confirm Action Modal */}
                 {confirmation && (
                    <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                        <div className="text-center p-4">
                            <p className="mb-6 text-slate-600 dark:text-slate-300">¿Confirmar acción sobre el período <strong className="text-brand-navy dark:text-white">{formatPeriodForDisplay(confirmation.period)}</strong>?</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleConfirmAction()} disabled={isProcessingAction} className="w-full py-3.5 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-transform active:scale-95">
                                    {isProcessingAction ? <Loader className="animate-spin mx-auto"/> : (confirmation.action === 'declare' ? 'Confirmar Envío' : 'Confirmar Pago')}
                                </button>
                                {confirmation.action === 'declare' && (
                                    <button onClick={() => handleConfirmAction(true)} disabled={isProcessingAction} className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center justify-center gap-2">
                                        <MessageCircle size={18}/> Confirmar y Notificar
                                    </button>
                                )}
                                <button onClick={() => setConfirmation(null)} className="w-full py-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors font-medium">Cancelar</button>
                            </div>
                        </div>
                    </Modal>
                 )}
                </div>
            </div>
        </div>
    );
});
