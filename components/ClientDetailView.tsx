
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Client, ClientCategory, DeclarationStatus, Declaration, TaxRegime, ServiceFeesConfig, ReceiptData, StoredFile } from '../types';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod } from '../services/sri';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../services/geminiService';
import { getClientServiceFee } from '../services/clientService';
import { format, isPast, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy, 
    ShieldCheck, FileText, Zap, UserCheck, UserX, UserCheck2, 
    MoreHorizontal, Printer, Clipboard, CheckCircle, Send, Loader, ArrowDownToLine, 
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download, CalendarRange, Share
} from 'lucide-react';
import { Modal } from './Modal';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';

// Helper functions (getRecentPeriods, getObligation, buildCategory, PaymentHistoryChart) remains same...
// ... (omitted for brevity, assume standard implementations as before) ...
const getRecentPeriods = (client: Client, count: number): string[] => {
    const periods: string[] = [];
    let currentDate = new Date();
    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) periods.push(period);
        if (client.category.includes('Mensual') || client.category === ClientCategory.DevolucionIvaTerceraEdad) currentDate = subMonths(currentDate, 1);
        else if (client.category.includes('Semestral')) currentDate = subMonths(currentDate, 6);
        else currentDate = subYears(currentDate, 1);
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

// Main Component
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
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'vault'>('profile'); // NEW: Vault tab
    
    // UI State
    const [obligation, setObligation] = useState(getObligationFromCategory(client.category));
    const [isVip, setIsVip] = useState(isVipCategory(client.category));
    const [isActive, setIsActive] = useState(client.isActive ?? true);
    const [isVaultPublic, setIsVaultPublic] = useState(!!client.sharedAccessKey); // Logic for public vault

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Modals
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => { 
        if (!isEditing) {
            setEditedClient(client); 
            setObligation(getObligationFromCategory(client.category)); 
            setIsVip(isVipCategory(client.category));
            setIsActive(client.isActive ?? true);
            setIsVaultPublic(!!client.sharedAccessKey);
        }
    }, [client, isEditing]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) { setIsMenuOpen(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = () => {
        let newCategory = editedClient.category;
        if (editedClient.regime !== TaxRegime.RimpeNegocioPopular) {
             newCategory = buildCategory(obligation, isVip);
        }
        const updated = { 
            ...editedClient, 
            category: newCategory,
            isActive: isActive,
            // If vault toggled OFF, verify logic (maybe clear key? or just UI state)
            // For now, we assume key generation happens on button click
        };
        onSave(updated);
        setIsEditing(false);
        setIsMenuOpen(false);
        toast.success("Cliente actualizado");
    };

    const handleGenerateSharedLink = () => {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const updated = { ...editedClient, sharedAccessKey: token };
        setEditedClient(updated);
        onSave(updated);
        setIsVaultPublic(true);
        toast.success("Bóveda activada. Link generado.");
    };

    const handleToggleVault = () => {
        if (isVaultPublic) {
            // Deactivate
            if (window.confirm("¿Desactivar el acceso público a la bóveda? El cliente ya no podrá entrar.")) {
                const updated = { ...editedClient, sharedAccessKey: '' };
                setEditedClient(updated);
                onSave(updated);
                setIsVaultPublic(false);
            }
        } else {
            handleGenerateSharedLink();
        }
    };

    const handleShareViaWhatsApp = () => {
        if (!editedClient.phones?.length || !editedClient.sharedAccessKey) return;
        const phone = editedClient.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;
        
        const message = `Estimado/a ${editedClient.name}, aquí tiene el enlace seguro a su Bóveda Digital con sus credenciales y documentos:
https://portal.santiagocordova.com/client/${editedClient.id}?token=${editedClient.sharedAccessKey}

Nota: Este enlace es personal y seguro.`;
        
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleConfirmAction = (sendWhatsApp: boolean = false) => {
        if (!confirmation) return;
        setIsProcessingAction(true);
        const { action, period } = confirmation;
        const now = new Date().toISOString();
        
        // Upsert Declaration Logic
        const updatedHistory = [...editedClient.declarationHistory];
        const idx = updatedHistory.findIndex(d => d.period === period);
        
        const newDecl: Declaration = {
            period,
            status: action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada,
            updatedAt: now,
            declaredAt: action === 'declare' ? now : (idx > -1 ? updatedHistory[idx].declaredAt || now : now),
            paidAt: action === 'pay' ? now : undefined,
            amount: idx > -1 ? updatedHistory[idx].amount : undefined 
        };

        if (idx > -1) updatedHistory[idx] = { ...updatedHistory[idx], ...newDecl };
        else updatedHistory.push(newDecl);

        const updatedClient = { ...editedClient, declarationHistory: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);

        setTimeout(() => {
            if (action === 'pay') {
                const updatedDeclaration = updatedHistory.find(d => d.period === period);
                if (updatedDeclaration) handleShowReceipt(updatedDeclaration);
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

    // Styling based on VIP
    const bgHeader = isVip 
        ? "bg-gradient-to-r from-slate-900 to-[#0B2149] text-white" 
        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800";
    
    const vipAccent = isVip ? "text-amber-400" : "text-brand-teal";

    return (
        <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col animate-fade-in absolute inset-0 z-50 overflow-hidden">
            
            {/* HEADER */}
            <div className={`p-6 shadow-sm z-20 flex-shrink-0 ${bgHeader}`}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-start mb-6">
                        <button onClick={onBack} className={`flex items-center gap-2 font-bold text-sm transition-colors ${isVip ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                            <ArrowDownToLine className="rotate-90" size={20}/> Volver
                        </button>
                        
                        <div className="flex gap-2">
                            {isEditing ? (
                                <button onClick={handleSave} className="px-4 py-2 bg-brand-teal text-white rounded-lg font-bold text-xs hover:bg-teal-600 transition-all flex items-center gap-2">
                                    <Save size={16}/> Guardar
                                </button>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${isVip ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                    <Edit size={16}/> Editar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                         <div className="relative shrink-0">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-display font-bold shadow-2xl border-[3px] ${isVip ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white border-white/20' : 'bg-slate-100 text-slate-600 border-white'}`}>
                                {client.name.substring(0, 2).toUpperCase()}
                            </div>
                            {isVip && <div className="absolute -top-2 -right-2 bg-black text-amber-400 p-2 rounded-full border-[3px] border-slate-900 shadow-sm"><Crown size={14} fill="currentColor"/></div>}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h1 className={`text-3xl font-bold leading-tight font-display truncate ${isVip ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{client.name}</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`font-mono font-bold text-sm ${isVip ? 'text-slate-300' : 'text-slate-500'}`}>{client.ruc}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${isVip ? 'bg-white/10 border-white/20 text-amber-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                    {client.regime}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* TABS */}
                    <div className="flex mt-8 gap-6 border-b border-white/10 overflow-x-auto">
                        {[
                            { id: 'profile', label: 'Datos & Gestión', icon: ShieldCheck },
                            { id: 'history', label: 'Historial', icon: History },
                            { id: 'vault', label: 'Bóveda Cliente', icon: Lock }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === tab.id 
                                        ? `${vipAccent} border-current` 
                                        : `border-transparent ${isVip ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`
                                }`}
                            >
                                <tab.icon size={18}/> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-5xl mx-auto w-full">
                    
                    {/* --- TAB: PROFILE (Main Data) --- */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Switches Bar */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div onClick={() => setIsVip(!isVip)} className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center justify-between transition-all ${isVip ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:border-amber-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${isVip ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-400'}`}><Crown size={20} fill={isVip ? "currentColor" : "none"}/></div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800">Suscripción VIP</h4>
                                            <p className="text-xs text-slate-500">Diseño exclusivo y atención prioritaria</p>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isVip ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isVip ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                </div>
                                <div onClick={() => setIsActive(!isActive)} className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center justify-between transition-all ${isActive ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${isActive ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}><Zap size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800">Estado Activo</h4>
                                            <p className="text-xs text-slate-500">Habilita generación de obligaciones</p>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isActive ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Data Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Información Fiscal</h3>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Régimen</label>
                                        {isEditing ? (
                                            <select value={editedClient.regime} onChange={e => setEditedClient({...editedClient, regime: e.target.value as any})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 outline-none">{Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}</select>
                                        ) : <p className="font-bold text-slate-700">{editedClient.regime}</p>}
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Categoría</label>
                                        {isEditing ? (
                                            <select value={editedClient.category} onChange={e => setEditedClient({...editedClient, category: e.target.value as any})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-700 outline-none"><option value="Suscripción Mensual IVA">Suscripción Mensual</option><option value="Interno Mensual">Interno Mensual</option><option value="Impuesto a la Renta (Negocio Popular)">Renta Popular</option></select>
                                        ) : <p className="font-bold text-slate-700">{editedClient.category}</p>}
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Email</label>
                                        {isEditing ? <input value={editedClient.email || ''} onChange={e => setEditedClient({...editedClient, email: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl text-sm" /> : <p className="font-bold text-slate-700">{editedClient.email || '-'}</p>}
                                     </div>
                                </div>
                                
                                {/* Contact & Notes */}
                                <div className="space-y-6">
                                     <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Contacto</h3>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">Celular</label>
                                        {isEditing ? (
                                            <input value={(editedClient.phones||[])[0]} onChange={e => setEditedClient({...editedClient, phones: [e.target.value]})} className="w-full p-3 bg-slate-50 rounded-xl text-sm" />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-700">{(editedClient.phones||[])[0] || '-'}</p>
                                                {editedClient.phones?.[0] && <button onClick={() => window.open(`https://wa.me/593${editedClient.phones![0].substring(1)}`, '_blank')} className="p-1 bg-green-100 text-green-600 rounded-lg"><MessageCircle size={14}/></button>}
                                            </div>
                                        )}
                                     </div>
                                     <div className="bg-yellow-50 dark:bg-yellow-900/10 p-6 rounded-[2rem] border border-yellow-200">
                                         <h3 className="text-xs font-black text-yellow-700 uppercase tracking-widest mb-2">Notas</h3>
                                         {isEditing ? (
                                             <textarea value={editedClient.notes} onChange={e => setEditedClient({...editedClient, notes: e.target.value})} className="w-full p-3 bg-white/50 rounded-xl text-sm h-24 resize-none"/>
                                         ) : <p className="text-sm text-yellow-900">{editedClient.notes || 'Sin notas.'}</p>}
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: VAULT (BÓVEDA) */}
                    {activeTab === 'vault' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
                            {/* Vault Control */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-10 opacity-10"><Lock size={120}/></div>
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-display font-bold mb-2">Bóveda Digital</h3>
                                    <p className="text-slate-400 text-sm mb-8">Comparta documentos y credenciales de forma segura con su cliente.</p>
                                    
                                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${isVaultPublic ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                                {isVaultPublic ? <CheckCircle size={20}/> : <Lock size={20}/>}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">Acceso Cliente</p>
                                                <p className="text-[10px] text-slate-400">{isVaultPublic ? 'Habilitado' : 'Deshabilitado'}</p>
                                            </div>
                                        </div>
                                        <div 
                                            onClick={handleToggleVault}
                                            className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${isVaultPublic ? 'bg-green-500' : 'bg-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isVaultPublic ? 'translate-x-5' : ''}`}></div>
                                        </div>
                                    </div>

                                    {isVaultPublic && (
                                        <div className="space-y-3">
                                            <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm flex items-center justify-between">
                                                <span className="text-xs font-mono text-brand-teal truncate mr-2">portal.santiagocordova.com/client/...</span>
                                                <button onClick={() => {navigator.clipboard.writeText(`.../client/${client.id}?token=${client.sharedAccessKey}`); toast.success('Link copiado')}} className="text-white hover:text-brand-teal"><Copy size={16}/></button>
                                            </div>
                                            <button onClick={handleShareViaWhatsApp} className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                                <MessageCircle size={18}/> Enviar Link por WhatsApp
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Credentials List */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <h3 className="font-bold text-brand-navy dark:text-white mb-6 flex items-center gap-2"><Key size={18}/> Credenciales</h3>
                                <div className="space-y-4">
                                     <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clave SRI</p>
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-white">{passwordVisible ? editedClient.sriPassword : '••••••••'}</span>
                                            <button onClick={() => setPasswordVisible(!passwordVisible)} className="text-slate-400 hover:text-brand-teal"><Eye size={16}/></button>
                                        </div>
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: HISTORY */}
                    {activeTab === 'history' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <PaymentHistoryChart client={client} />
                            
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="font-bold text-brand-navy">Historial de Ciclo Tributario</h3>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {[...editedClient.declarationHistory].sort((a,b) => b.period.localeCompare(a.period)).map((decl, idx) => (
                                        <div key={idx} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                {decl.period.split('-')[1] || 'AN'}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-800 text-sm uppercase">{formatPeriodForDisplay(decl.period)}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${decl.status === 'Pagada' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {decl.status}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{decl.updatedAt.split('T')[0]}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {decl.status === DeclarationStatus.Pagada && (
                                                    <button onClick={() => handleShowReceipt(decl)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:border-brand-teal hover:text-brand-teal transition-all shadow-sm flex items-center gap-1">
                                                        <FileText size={12}/> Ver Recibo
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
             </div>

             {/* Modals */}
             {confirmation && (
                <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                    <div className="text-center p-4">
                         <p>Confirmar {confirmation.action} para {confirmation.period}</p>
                         <button onClick={() => handleConfirmAction()} className="mt-4 px-6 py-3 bg-brand-navy text-white rounded-xl font-bold w-full">Confirmar</button>
                    </div>
                </Modal>
             )}
             
             <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Comprobante">
                 {receiptData && (
                     <div className="p-4 bg-white rounded-xl text-center">
                         <CheckCircle size={48} className="mx-auto text-green-500 mb-4"/>
                         <h3 className="font-bold text-lg mb-2">Pago Registrado</h3>
                         <p className="text-sm text-slate-500 mb-4">{receiptData.transactionId}</p>
                         <p className="text-2xl font-mono font-black text-brand-navy">${receiptData.totalAmount.toFixed(2)}</p>
                     </div>
                 )}
             </Modal>
        </div>
    );
});
