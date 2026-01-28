
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, ServiceFeesConfig, ReceiptData, StoredFile } from '../types';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod } from '../services/sri';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { getClientServiceFee } from '../services/clientService';
import format from 'date-fns/format';
import isPast from 'date-fns/isPast';
import subMonths from 'date-fns/subMonths';
import subYears from 'date-fns/subYears';
import es from 'date-fns/locale/es';
import { 
    X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, 
    ShieldCheck, FileText, Zap, UserCheck, UserX, UserCheck2, 
    MoreHorizontal, Printer, Clipboard, CheckCircle, Send, Loader, ArrowDownToLine, 
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download
} from 'lucide-react';
import { Modal } from './Modal';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppStore } from '../store/useAppStore';

// ... (Existing Helpers like getRecentPeriods, getObligationFromCategory, PaymentHistoryChart - NO CHANGES NEEDED) ...
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

// Componente para copiar texto con feedback visual
const CopyButton: React.FC<{ text: string, label?: string, obscured?: boolean, onCopy?: () => void }> = ({ text, label, obscured, onCopy }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        if (onCopy) onCopy();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button 
            onClick={handleCopy}
            className={`group relative flex items-center justify-between w-full p-3 rounded-xl border transition-all duration-200 ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-teal/50 hover:shadow-sm'}`}
        >
            <div className="flex flex-col items-start truncate pr-2">
                {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>}
                <span className={`font-mono text-sm font-bold truncate w-full text-left ${copied ? 'text-green-700' : 'text-slate-700 dark:text-slate-200'}`}>
                    {obscured ? '••••••••' : text}
                </span>
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
    const { whatsappTemplates } = useAppStore();
    const [editedClient, setEditedClient] = useState(client);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'notes'>('profile');
    
    // UI Logic for Editing
    const [obligation, setObligation] = useState(getObligationFromCategory(client.category));
    const [isVip, setIsVip] = useState(isVipCategory(client.category));
    
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [signaturePasswordVisible, setSignaturePasswordVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Modals
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState('');
    
    // File inputs
    const p12InputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        if (!isEditing) {
            setEditedClient(client); 
            setObligation(getObligationFromCategory(client.category)); 
            setIsVip(isVipCategory(client.category));
        }
    }, [client, isEditing]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { totalDebt, nextDeadline, lastActivityDate, pendingDeclaration } = useMemo(() => {
        const pending = (editedClient.declarationHistory || []).filter(d => d.status !== DeclarationStatus.Pagada);
        const debt = pending.reduce((sum, d) => sum + (d.amount ?? getClientServiceFee(editedClient, serviceFees)), 0);
        
        const periods = getRecentPeriods(editedClient, 1);
        const currentPeriod = periods[0] || getPeriod(editedClient, new Date());
        
        // Find the most urgent pending declaration (Priority: Pendiente > Enviada)
        const pendingDecl = editedClient.declarationHistory.find(d => d.period === currentPeriod && d.status === DeclarationStatus.Pendiente);

        const nextPeriod = periods[0] ? getNextPeriod(periods[0]) : getPeriod(editedClient, new Date());
        const deadline = getDueDateForPeriod(editedClient, nextPeriod);
        
        const lastActivity = editedClient.declarationHistory.length > 0 
            ? new Date(Math.max(...editedClient.declarationHistory.map(d => new Date(d.updatedAt).getTime())))
            : null;

        return { 
            totalDebt: debt, 
            nextDeadline: deadline, 
            lastActivityDate: lastActivity,
            pendingDeclaration: pendingDecl
        };
    }, [editedClient, serviceFees]);

    const handleSave = () => {
        let newCategory = editedClient.category;
        if (editedClient.regime !== TaxRegime.RimpeNegocioPopular) {
             newCategory = buildCategory(obligation, isVip);
        }
        
        const toSave = { ...editedClient, category: newCategory };
        onSave(toSave);
        setIsEditing(false);
        setIsMenuOpen(false);
    };

    const handleCopy = (text: string) => navigator.clipboard.writeText(text);

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
        const updatedHistory = editedClient.declarationHistory.map(d => {
            if (d.period === period) {
                if (action === 'declare') { return { ...d, status: DeclarationStatus.Enviada, declaredAt: now, updatedAt: now }; }
                if (action === 'pay') { return { ...d, status: DeclarationStatus.Pagada, paidAt: now, updatedAt: now }; }
            }
            return d;
        });
        const updatedClient = { ...editedClient, declarationHistory: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);
        setTimeout(() => {
            if (action === 'pay') {
                const updatedDeclaration = updatedHistory.find(d => d.period === period);
                if (updatedDeclaration) handleShowReceipt(updatedDeclaration);
            }
            setIsProcessingAction(false);
            setConfirmation(null);
        }, 500);
    };

    const handleQuickDeclare = (period: string) => {
        // Quick version of handleConfirmAction for the workflow card
        const now = new Date().toISOString();
        const updatedHistory = editedClient.declarationHistory.map(d => {
            if (d.period === period) {
                return { ...d, status: DeclarationStatus.Enviada, declaredAt: now, updatedAt: now };
            }
            return d;
        });
        const updatedClient = { ...editedClient, declarationHistory: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);
    };

    const handleShowReceipt = (declaration: Declaration) => {
        const fee = declaration.amount ?? getClientServiceFee(client, serviceFees);
        const data: ReceiptData = {
            transactionId: declaration.transactionId || `MAN-${declaration.period.replace('-', '')}`,
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

    const handleRevertPayment = (periodToRevert: string) => {
        const updatedHistory = editedClient.declarationHistory.map(dec => 
            dec.period === periodToRevert && dec.status === DeclarationStatus.Pagada
                ? { ...dec, status: DeclarationStatus.Enviada, paidAt: undefined, updatedAt: new Date().toISOString() }
                : dec
        );
        onSave({ ...editedClient, declarationHistory: updatedHistory });
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
            navigator.clipboard.writeText(`COMPROBANTE ${receiptData.transactionId} - $${receiptData.totalAmount}`);
            alert('Copiado');
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

    // VAULT LOGIC
    const handleGenerateSharedLink = () => {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const updated = { ...editedClient, sharedAccessKey: token };
        setEditedClient(updated);
        onSave(updated);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'p12' | 'pdf') => {
        const file = e.target.files?.[0];
        if (file) {
            const storedFile: StoredFile = {
                name: file.name,
                type: type,
                size: file.size,
                lastModified: file.lastModified
            };
            
            const updated = type === 'p12' 
                ? { ...editedClient, signatureFile: storedFile }
                : { ...editedClient, rucPdf: storedFile };
            
            setEditedClient(updated);
            onSave(updated);
        }
    };

    const handleShareViaWhatsApp = () => {
        if (!client.phones?.length || !client.sharedAccessKey) return;
        const phone = client.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        
        const message = `Estimado/a ${client.name}, aquí tiene el enlace seguro a su Bóveda Digital con sus credenciales y documentos:
https://portal.santiagocordova.com/client/${client.id}?token=${client.sharedAccessKey}

Nota: Este enlace es personal y seguro.`;
        
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    // --- RENDER ---
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
                                    <button onClick={() => handleCopy(client.ruc)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        <CreditCard size={12}/> {client.ruc} <Copy size={10} className="opacity-50"/>
                                    </button>
                                    <span className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5">
                                        <Briefcase size={12}/> {client.regime}
                                    </span>
                                    {client.isArtisan && (
                                        <span className="px-3 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5">
                                            <Hammer size={12}/> Artesano
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <div className={`flex flex-col p-3 rounded-2xl border min-w-[120px] ${totalDebt > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50' : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50'}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${totalDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Deuda Total</span>
                                <span className={`text-xl font-mono font-bold ${totalDebt > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>${totalDebt.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 min-w-[140px]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Próx. Vencimiento</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                    <CalendarIcon size={14} className="text-brand-teal"/> 
                                    {nextDeadline ? format(nextDeadline, 'dd MMM', { locale: es }) : 'N/A'}
                                </span>
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
                                    {/* Abstract Decoration */}
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
                                                        onClick={handleOpenSRI}
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
                            {/* Card: RUC Data */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <FileText size={16} className="text-brand-teal"/> Datos del Certificado RUC
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-6">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-colors hover:border-brand-teal/30">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Artesano Calificado</label>
                                            {isEditing ? (
                                                <select 
                                                    value={editedClient.isArtisan ? 'yes' : 'no'} 
                                                    onChange={e => setEditedClient({...editedClient, isArtisan: e.target.value === 'yes'})} 
                                                    className="w-full p-2 bg-white dark:bg-slate-700 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                                >
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
                                                <select 
                                                    value={editedClient.establishmentCount || 1} 
                                                    onChange={e => setEditedClient({...editedClient, establishmentCount: parseInt(e.target.value)})} 
                                                    className="w-full p-2 bg-white dark:bg-slate-700 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
                                                >
                                                    {Array.from({length: 10}, (_, i) => i + 1).map(num => (
                                                        <option key={num} value={num}>{num}</option>
                                                    ))}
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
                                            <textarea 
                                                rows={4}
                                                value={editedClient.jurisdiction || ''} 
                                                onChange={e => setEditedClient({...editedClient, jurisdiction: e.target.value})} 
                                                className="w-full p-3 bg-white dark:bg-slate-700 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-teal resize-none"
                                                placeholder="Dirección exacta según RUC"
                                            />
                                        ) : (
                                            <div className="flex items-start gap-3">
                                                <MapPin size={20} className="text-slate-400 mt-0.5 flex-shrink-0"/>
                                                <p className="font-medium text-slate-800 dark:text-white text-sm leading-relaxed">
                                                    {editedClient.jurisdiction || 'No registrada'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* ... Column 2: Contact Info ... */}
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <User size={16} className="text-brand-teal"/> Contacto Directo
                                </h3>

                                <div className="space-y-6">
                                    <div className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Celular</label>
                                            <button onClick={handleWhatsApp} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Abrir WhatsApp">
                                                <MessageCircle size={14}/>
                                            </button>
                                        </div>
                                        {isEditing ? (
                                            <input 
                                                type="text" 
                                                value={(editedClient.phones || [''])[0]} 
                                                onChange={e => setEditedClient(prev => ({...prev, phones: [e.target.value]}))} 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-slate-800 dark:text-white break-all">
                                                {(editedClient.phones && editedClient.phones.length > 0) ? editedClient.phones[0] : 'No registrado'}
                                            </p>
                                        )}
                                    </div>

                                    <div className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                                            <button onClick={handleEmail} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Enviar Correo">
                                                <Mail size={14}/>
                                            </button>
                                        </div>
                                        {isEditing ? (
                                            <input 
                                                type="email" 
                                                value={editedClient.email || ''} 
                                                onChange={e => setEditedClient({...editedClient, email: e.target.value})} 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-slate-800 dark:text-white break-all">
                                                {editedClient.email || 'No registrado'}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {!isEditing && (
                                        <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                                            <button onClick={handleWhatsApp} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2">
                                                <MessageCircle size={18}/> Contactar por WhatsApp
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: HISTORY (Styled) - Same as before */}
                {activeTab === 'history' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                         {/* Chart Column */}
                        <div className="lg:col-span-1 h-64 lg:h-auto">
                             <PaymentHistoryChart client={client} />
                        </div>
                        {/* Timeline Column */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-0 border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                             <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <History size={18} className="text-brand-teal"/> Línea de Tiempo
                                </h3>
                                <span className="text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                    {editedClient.declarationHistory.length} Registros
                                </span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 max-h-[500px]">
                                <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-8">
                                    {[...editedClient.declarationHistory].sort((a,b) => b.period.localeCompare(a.period)).map((decl, idx) => {
                                        // Dynamic Logic
                                        const isPaid = decl.status === DeclarationStatus.Pagada;
                                        const isPending = decl.status === DeclarationStatus.Pendiente;
                                        const dateLabel = decl.paidAt ? format(new Date(decl.paidAt), 'dd MMM yyyy', {locale: es}) : (decl.declaredAt ? format(new Date(decl.declaredAt), 'dd MMM yyyy', {locale: es}) : 'Pendiente');
                                        
                                        return (
                                            <div key={idx} className="relative group">
                                                {/* Connector Dot */}
                                                <div className={`absolute -left-[21px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-colors ${isPaid ? 'bg-emerald-500' : (isPending ? 'bg-amber-400' : 'bg-blue-500')}`}></div>
                                                
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-slate-800 dark:text-white text-sm">{formatPeriodForDisplay(decl.period)}</span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isPaid ? 'bg-emerald-100 text-emerald-700' : (isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}`}>
                                                                {decl.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Clock size={10}/> {dateLabel}
                                                        </p>
                                                    </div>

                                                    {/* Actions Row */}
                                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        {decl.status === DeclarationStatus.Pendiente && (
                                                            <button onClick={() => setConfirmation({action: 'declare', period: decl.period})} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm">Declarar</button>
                                                        )}
                                                        {decl.status === DeclarationStatus.Enviada && (
                                                            <button onClick={() => setConfirmation({action: 'pay', period: decl.period})} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm flex items-center gap-1"><DollarSign size={12}/> Pagar</button>
                                                        )}
                                                        {isPaid && (
                                                            <button onClick={() => handleShowReceipt(decl)} className="p-2 text-slate-500 hover:text-brand-teal hover:bg-white rounded-lg transition-colors" title="Ver Recibo"><FileText size={16}/></button>
                                                        )}
                                                        {isPaid && (
                                                            <button onClick={() => handleRevertPayment(decl.period)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors" title="Revertir"><RotateCcw size={16}/></button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: VAULT & NOTES (Redesigned) */}
                {activeTab === 'notes' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
                        {/* Section 1: Credentials & Files */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Lock size={16} className="text-brand-teal"/> Credenciales Críticas
                                </h3>

                                <div className="space-y-4">
                                    {/* Clave SRI */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand-teal/30 transition-colors group">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <Key size={14} className="text-brand-teal"/> Clave SRI
                                            </span>
                                            {sriCredentials && sriCredentials[client.ruc] === editedClient.sriPassword && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                    <CheckCircle size={10}/> Sincronizada
                                                </span>
                                            )}
                                        </div>
                                        
                                        {isEditing ? (
                                            <div className="relative">
                                                <input 
                                                    type={passwordVisible ? "text" : "password"} 
                                                    value={editedClient.sriPassword} 
                                                    onChange={e => setEditedClient({...editedClient, sriPassword: e.target.value})}
                                                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-brand-teal outline-none"
                                                    placeholder="Ingrese clave SRI"
                                                />
                                                 <button 
                                                    onClick={() => setPasswordVisible(!passwordVisible)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-teal"
                                                >
                                                    {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between bg-white dark:bg-slate-700 rounded-xl p-3 border border-slate-200 dark:border-slate-600">
                                                <span className="font-mono text-lg tracking-widest text-slate-800 dark:text-white">
                                                    {passwordVisible ? editedClient.sriPassword : '••••••••'}
                                                </span>
                                                 <div className="flex gap-2">
                                                    <button onClick={() => setPasswordVisible(!passwordVisible)} className="p-1.5 text-slate-400 hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                                        {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                                    </button>
                                                    <button onClick={() => {navigator.clipboard.writeText(editedClient.sriPassword); alert("Clave copiada")}} className="p-1.5 text-slate-400 hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                                        <Copy size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Firma Electrónica */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand-teal/30 transition-colors group">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <FileKey size={14} className="text-purple-500"/> Firma Electrónica (.p12)
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${editedClient.signatureFile ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {editedClient.signatureFile ? 'Activa' : 'Pendiente'}
                                            </span>
                                        </div>
                                        
                                        {isEditing ? (
                                            <div className="space-y-3">
                                                    <div className="relative">
                                                    <input 
                                                        type={signaturePasswordVisible ? "text" : "password"} 
                                                        placeholder="Clave de Firma"
                                                        value={editedClient.electronicSignaturePassword || ''} 
                                                        onChange={e => setEditedClient({...editedClient, electronicSignaturePassword: e.target.value})} 
                                                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                                    />
                                                    <button 
                                                        onClick={() => setSignaturePasswordVisible(!signaturePasswordVisible)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-500"
                                                    >
                                                        {signaturePasswordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="file" 
                                                        accept=".p12,.pfx"
                                                        className="hidden"
                                                        ref={p12InputRef}
                                                        onChange={(e) => handleFileUpload(e, 'p12')}
                                                    />
                                                    <button onClick={() => p12InputRef.current?.click()} className="flex-1 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-500 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all flex items-center justify-center gap-2">
                                                        <UploadCloud size={16}/> {editedClient.signatureFile ? 'Actualizar Archivo' : 'Subir Archivo .P12'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white dark:bg-slate-700 rounded-xl p-3 border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                                                 <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${editedClient.signatureFile ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <FileKey size={20}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-white">
                                                            {editedClient.signatureFile ? editedClient.signatureFile.name : 'Sin archivo'}
                                                        </p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[10px] text-slate-400">Clave:</span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">
                                                                {editedClient.electronicSignaturePassword ? (signaturePasswordVisible ? editedClient.electronicSignaturePassword : '••••') : 'N/A'}
                                                            </span>
                                                             {editedClient.electronicSignaturePassword && (
                                                                <button onClick={() => setSignaturePasswordVisible(!signaturePasswordVisible)} className="ml-1 text-slate-400 hover:text-purple-500">
                                                                    {signaturePasswordVisible ? <EyeOff size={10}/> : <Eye size={10}/>}
                                                                </button>
                                                             )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* RUC Digital */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand-teal/30 transition-colors group">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <FileText size={14} className="text-blue-500"/> RUC Digital
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${editedClient.rucPdf ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {editedClient.rucPdf ? 'Disponible' : 'Faltante'}
                                            </span>
                                        </div>
                                         {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="file" 
                                                    accept=".pdf"
                                                    className="hidden"
                                                    ref={pdfInputRef}
                                                    onChange={(e) => handleFileUpload(e, 'pdf')}
                                                />
                                                <button onClick={() => pdfInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2">
                                                    <UploadCloud size={16}/> {editedClient.rucPdf ? 'Actualizar PDF' : 'Subir PDF RUC'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-white dark:bg-slate-700 rounded-xl p-3 border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                                                 <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${editedClient.rucPdf ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <FileText size={20}/>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-white">
                                                            {editedClient.rucPdf ? editedClient.rucPdf.name : 'Documento no cargado'}
                                                        </p>
                                                        {editedClient.rucPdf && <p className="text-[10px] text-slate-400">PDF • {Math.round(editedClient.rucPdf.size / 1024)} KB</p>}
                                                    </div>
                                                </div>
                                                {editedClient.rucPdf && (
                                                     <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                                        <Download size={18}/>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                            
                            {/* Share Section */}
                            <div className="bg-gradient-to-br from-brand-navy to-slate-900 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Share2 size={100}/></div>
                                <h3 className="text-sm font-bold uppercase tracking-wider mb-2 relative z-10 flex items-center gap-2"><Share2 size={16}/> Acceso Cliente</h3>
                                <p className="text-xs text-slate-300 mb-6 relative z-10 max-w-xs">
                                    Comparta un enlace seguro para que su cliente acceda a sus documentos y claves desde cualquier lugar.
                                </p>
                                
                                {editedClient.sharedAccessKey ? (
                                    <div className="relative z-10 space-y-3">
                                        <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Enlace Privado</p>
                                            <p className="text-xs font-mono truncate text-brand-teal">portal.santiagocordova.com/client/...</p>
                                        </div>
                                        <button onClick={handleShareViaWhatsApp} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                            <MessageCircle size={18}/> Enviar por WhatsApp
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={handleGenerateSharedLink} className="w-full py-3 bg-white text-brand-navy font-bold rounded-xl shadow-lg hover:bg-slate-100 transition-all relative z-10 flex items-center justify-center gap-2">
                                        <Key size={18}/> Generar Llave de Acceso
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Internal Notes (Existing) */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-6 rounded-3xl border border-yellow-200 dark:border-yellow-800/50 shadow-sm h-full flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2 text-lg">
                                    <FileText size={20}/> Notas Internas
                                </h3>
                                <button onClick={handleSummarize} disabled={isSummarizing || !editedClient.notes} className="p-2 bg-white/50 text-yellow-700 rounded-xl hover:bg-white hover:text-yellow-900 transition-colors disabled:opacity-50 shadow-sm">
                                    {isSummarizing ? <Loader size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                                </button>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedClient.notes}
                                    onChange={e => setEditedClient({...editedClient, notes: e.target.value})}
                                    className="w-full flex-1 bg-white/50 p-4 rounded-xl text-sm border-none focus:ring-2 focus:ring-yellow-400 resize-none leading-relaxed min-h-[200px]"
                                    placeholder="Escriba notas importantes sobre el cliente aquí..."
                                />
                            ) : (
                                <div className="prose prose-sm prose-yellow max-w-none text-yellow-900 dark:text-yellow-100/80 leading-relaxed whitespace-pre-wrap flex-1">
                                    {editedClient.notes || 'No hay notas registradas para este cliente.'}
                                </div>
                            )}
                            {summary && (
                                <div className="mt-4 bg-white/50 p-4 rounded-xl border border-yellow-200/50">
                                    <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-2"><BrainCircuit size={14}/> Resumen IA</h4>
                                    <p className="text-xs text-yellow-900 leading-relaxed">{summary}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </div>
             </div>

             {/* Modals (Confirmation & Receipt - No Changes) */}
             {confirmation && (
                <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                    <div className="text-center p-4">
                        <p className="mb-6 text-slate-600 dark:text-slate-300">¿Confirmar acción sobre el período <strong className="text-brand-navy dark:text-white">{formatPeriodForDisplay(confirmation.period)}</strong>?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => handleConfirmAction()} disabled={isProcessingAction} className="w-full py-3.5 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-transform active:scale-95">
                                {isProcessingAction ? <Loader className="animate-spin mx-auto"/> : 'Solo Confirmar'}
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
