import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, ServiceFeesConfig, ReceiptData, StoredFile } from '../types';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod } from '../services/sri';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { calculateTaxDeadlines, TaxDeadline } from '../services/taxLogic';
import { getClientServiceFee } from '../services/clientService';
import { format, isPast, subMonths, subYears, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, 
    ShieldCheck, FileText, Zap, UserCheck, UserX, UserCheck2, 
    MoreHorizontal, Printer, Clipboard, CheckCircle, Send, Loader, ArrowDownToLine, 
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download, CalendarRange
} from 'lucide-react';
import { Modal } from './Modal';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';

// Helper functions
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
    const [isActive, setIsActive] = useState(client.isActive ?? true);

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Future Deadlines
    const [taxDeadlines, setTaxDeadlines] = useState<TaxDeadline[]>([]);

    // Modals & Actions
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState('');
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => { 
        if (!isEditing) {
            setEditedClient(client); 
            setObligation(getObligationFromCategory(client.category)); 
            setIsVip(isVipCategory(client.category));
            setIsActive(client.isActive ?? true);
            setTaxDeadlines(calculateTaxDeadlines(client));
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
        const updated = { 
            ...editedClient, 
            category: newCategory,
            isActive: isActive
        };
        onSave(updated);
        setIsEditing(false);
        setIsMenuOpen(false);
        toast.success("Cliente actualizado");
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
            declaredAt: action === 'declare' ? now : (updatedHistory[existingIndex]?.declaredAt || now),
            paidAt: action === 'pay' ? now : undefined,
            amount: updatedHistory[existingIndex]?.amount 
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
    
    const handleQuickPay = (period: string) => {
        setConfirmation({ action: 'pay', period });
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
    
    const handlePrintReceipt = () => {
        if (receiptRef.current) {
            const printWindow = window.open('', '_blank', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>Comprobante</title>');
            printWindow?.document.write(receiptRef.current.innerHTML);
            printWindow?.document.close();
            printWindow?.print();
        }
    };

    const copyReceiptToClipboard = () => {
        if (receiptData) {
            const text = `
COMPROBANTE DE PAGO
-------------------
ID Transacción: ${receiptData.transactionId}
Fecha: ${receiptData.paymentDate}
Cliente: ${receiptData.clientName}
RUC: ${receiptData.clientRuc}
Total: $${receiptData.totalAmount.toFixed(2)}
            `.trim();
            navigator.clipboard.writeText(text);
            toast.success('Comprobante copiado al portapeles.');
        }
    };

    const handleWhatsApp = () => {
        if (!client.phones || client.phones.length === 0) return;
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        window.open(`https://wa.me/${fullPhone}`, '_blank');
    };

    const handleEmail = () => {
        if (!client.email) return;
        window.open(`mailto:${client.email}`, '_blank');
    };

    const handleOpenSRI = () => {
        window.open("https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT", "_blank");
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
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                                    <Edit size={16}/> Editar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="py-6 flex flex-col md:flex-row gap-6 items-start justify-between">
                        <div className="flex gap-5 items-center w-full">
                            <div className="relative shrink-0">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-navy to-slate-900 text-white flex items-center justify-center text-3xl font-display font-bold shadow-2xl border-[3px] border-white dark:border-slate-800">
                                    {client.name.substring(0, 2).toUpperCase()}
                                </div>
                                {isVip && <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-300 to-amber-500 p-2 rounded-full text-white border-[3px] border-white dark:border-slate-800 shadow-sm"><Crown size={14} fill="currentColor"/></div>}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight font-display truncate">{client.name}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <CreditCard size={14} className="text-slate-400"/>
                                        <span className="font-mono font-bold text-slate-600 dark:text-slate-300 text-sm">{client.ruc}</span>
                                        <button onClick={() => {navigator.clipboard.writeText(client.ruc); toast.success("Copiado")}} className="hover:text-brand-teal ml-1"><Copy size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                        {[
                            { id: 'profile', label: 'Datos & Gestión', icon: ShieldCheck },
                            { id: 'history', label: 'Historial', icon: History },
                            { id: 'notes', label: 'Notas', icon: Lock }
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
             <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-5xl mx-auto w-full">
                
                {/* TAB: PROFILE (MAIN MANAGEMENT) */}
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in-up">
                        
                        {/* 1. CONTROL BAR (SWITCHES) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div 
                                onClick={() => setIsVip(!isVip)} 
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${isVip ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isVip ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                        <Crown size={20} fill={isVip ? "currentColor" : "none"}/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Suscripción VIP</h4>
                                        <p className="text-xs opacity-70">{isVip ? 'Cliente Preferencial' : 'Cliente Estándar'}</p>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isVip ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isVip ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </div>

                            <div 
                                onClick={() => setIsActive(!isActive)} 
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${isActive ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isActive ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                                        <ShieldCheck size={20}/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Estado del Cliente</h4>
                                        <p className="text-xs opacity-70">{isActive ? 'Cuenta Activa' : 'Cuenta Inactiva'}</p>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isActive ? 'bg-emerald-500' : 'bg-red-400'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isActive ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </div>
                        </div>

                        {/* 2. DATA GRID (3 COLS) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* COL 1: TRIBUTARIO */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Información Fiscal</h3>
                                
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Régimen</label>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                        {isEditing ? (
                                            <select value={editedClient.regime} onChange={e => setEditedClient({...editedClient, regime: e.target.value as any})} className="w-full bg-transparent font-bold text-sm text-slate-700 outline-none">
                                                {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        ) : (
                                            <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-200">
                                                <Briefcase size={16} className="text-slate-400"/> {editedClient.regime}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Obligación / Categoría</label>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                        {isEditing ? (
                                            <select value={editedClient.category} onChange={e => setEditedClient({...editedClient, category: e.target.value as any})} className="w-full bg-transparent font-bold text-sm text-slate-700 outline-none">
                                                 <option value="Suscripción Mensual IVA">Suscripción Mensual</option>
                                                 <option value="Interno Mensual">Interno Mensual</option>
                                                 <option value="Suscripción Semestral">Suscripción Semestral</option>
                                                 <option value="Interno Semestral">Interno Semestral</option>
                                                 <option value="Impuesto a la Renta (Negocio Popular)">Renta Popular</option>
                                            </select>
                                        ) : (
                                            <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-200">
                                                <FileText size={16} className="text-slate-400"/> {editedClient.category}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Tarifa de Servicio</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</div>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                value={editedClient.customServiceFee ?? ''} 
                                                placeholder={getClientServiceFee(editedClient, serviceFees).toString()}
                                                onChange={e => setEditedClient({...editedClient, customServiceFee: parseFloat(e.target.value)})}
                                                className="w-full pl-7 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-brand-teal"
                                            />
                                        ) : (
                                            <div className="w-full pl-7 p-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-lg text-slate-800">
                                                {getClientServiceFee(editedClient, serviceFees).toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* COL 2: CONTACTO */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Contacto Directo</h3>
                                
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Celular / WhatsApp</label>
                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <input 
                                                type="text" 
                                                value={(editedClient.phones || [''])[0]} 
                                                onChange={e => setEditedClient({...editedClient, phones: [e.target.value]})}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
                                            />
                                        ) : (
                                            <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono font-bold text-slate-700 flex items-center">
                                                <Phone size={14} className="mr-2 text-slate-400"/>
                                                {(editedClient.phones && editedClient.phones[0]) || 'No registrado'}
                                            </div>
                                        )}
                                        {!isEditing && editedClient.phones?.[0] && (
                                            <button onClick={() => window.open(`https://wa.me/593${editedClient.phones[0].substring(1)}`, '_blank')} className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-colors">
                                                <MessageCircle size={20}/>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Correo Electrónico</label>
                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <input 
                                                type="email" 
                                                value={editedClient.email || ''} 
                                                onChange={e => setEditedClient({...editedClient, email: e.target.value})}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
                                            />
                                        ) : (
                                            <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-sm text-slate-700 flex items-center overflow-hidden">
                                                <Mail size={14} className="mr-2 text-slate-400 flex-shrink-0"/>
                                                <span className="truncate">{editedClient.email || 'No registrado'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                             {/* COL 3: UBICACIÓN */}
                             <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Ubicación</h3>
                                
                                <div className="h-full flex flex-col">
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">Dirección Completa (Ref. & Parroquia)</label>
                                    {isEditing ? (
                                        <textarea 
                                            value={editedClient.address || ''} 
                                            onChange={e => setEditedClient({...editedClient, address: e.target.value})}
                                            className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                                            rows={6}
                                            placeholder="Calle Principal, Secundaria, Referencia, Parroquia..."
                                        />
                                    ) : (
                                        <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed overflow-y-auto max-h-[140px]">
                                            {editedClient.address ? (
                                                <div className="flex gap-2">
                                                    <MapPin size={16} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                                                    <p>{editedClient.address}</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">No registrada</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* 3. ACTION BAR */}
                        <div className="sticky bottom-4 z-10">
                            <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-800 rounded-lg">
                                        <CalendarRange size={24} className="text-white"/>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión Actual</p>
                                        <p className="text-white font-bold">{formatPeriodForDisplay(getPeriod(client, new Date()))}</p>
                                    </div>
                                </div>

                                <div className="flex w-full sm:w-auto gap-3">
                                    <button 
                                        onClick={() => handleQuickDeclare(getPeriod(client, new Date()))}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Send size={18}/> Declarar Ahora
                                    </button>
                                    
                                    <button 
                                        onClick={() => setConfirmation({ action: 'pay', period: getPeriod(client, new Date()) })}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <DollarSign size={18}/> Cobrar / Cancelado
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* TAB: HISTORY */}
                {activeTab === 'history' && (
                    <div className="space-y-6 animate-fade-in-up">
                         <PaymentHistoryChart client={client} />
                         <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4">Historial Completo</h3>
                            <div className="space-y-2">
                                {editedClient.declarationHistory.sort((a,b) => b.period.localeCompare(a.period)).map((decl, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <div>
                                            <p className="font-bold text-sm text-slate-700 dark:text-white">{formatPeriodForDisplay(decl.period)}</p>
                                            <p className="text-xs text-slate-500">{decl.status}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {decl.status === DeclarationStatus.Pagada && (
                                                <button onClick={() => handleShowReceipt(decl)} className="p-2 text-slate-400 hover:text-brand-teal"><FileText size={18}/></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </div>
                    </div>
                )}
                
                {/* TAB: NOTES (Keep essential notes) */}
                {activeTab === 'notes' && (
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-full animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white">Notas Internas</h3>
                            <button onClick={handleSummarize} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100"><Sparkles size={18}/></button>
                        </div>
                        <textarea 
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none resize-none focus:ring-1 focus:ring-brand-teal"
                            placeholder="Escriba notas importantes..."
                            value={editedClient.notes || ''}
                            onChange={(e) => setEditedClient({...editedClient, notes: e.target.value})}
                        />
                         {summary && (
                            <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                                <strong>Resumen IA:</strong> {summary}
                            </div>
                        )}
                        <div className="mt-4 text-right">
                             <button onClick={handleSave} className="px-6 py-3 bg-brand-navy text-white rounded-xl font-bold">Guardar Notas</button>
                        </div>
                    </div>
                )}
                </div>
             </div>

             {/* Modals */}
             {confirmation && (
                <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                    <div className="text-center p-4">
                        <p className="mb-6 text-slate-600 dark:text-slate-300">¿Confirmar acción sobre el período <strong className="text-brand-navy dark:text-white">{formatPeriodForDisplay(confirmation.period)}</strong>?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => handleConfirmAction()} disabled={isProcessingAction} className="w-full py-3.5 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-transform active:scale-95">
                                {isProcessingAction ? <Loader className="animate-spin mx-auto"/> : (confirmation.action === 'declare' ? 'Confirmar Envío' : 'Confirmar Pago/Cancelado')}
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

             <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Comprobante">
                 {receiptData && (
                    <div className="p-4 bg-white rounded-xl">
                        <div ref={receiptRef} className="text-center font-mono text-sm space-y-3 mb-6 border-b border-dashed border-slate-300 pb-6">
                            <h3 className="font-bold text-xl mb-1">COMPROBANTE DE PAGO</h3>
                            <p className="text-slate-500 text-xs uppercase tracking-widest mb-4">Soluciones Contables Pro</p>
                            <p className="text-xs text-slate-400">{receiptData.paymentDate}</p>
                            <div className="flex justify-between items-center text-left bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Cliente</p>
                                    <p className="font-bold text-slate-800">{receiptData.clientName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">RUC</p>
                                    <p className="font-mono text-slate-600">{receiptData.clientRuc}</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-xl font-bold pt-2">
                                <span>Total</span>
                                <span>${receiptData.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handlePrintReceipt} className="flex-1 bg-brand-navy text-white py-3 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"><Printer size={18}/> Imprimir</button>
                            <button onClick={copyReceiptToClipboard} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"><Clipboard size={18}/> Copiar</button>
                        </div>
                    </div>
                 )}
             </Modal>
        </div>
    );
});