import React, { useMemo, useState, useEffect } from 'react';
import {
    KeyRound, ShieldCheck, ShieldOff, PhoneCall, AlertTriangle,
    CheckCircle2, ArrowRight, Search, FileText, Check, Copy, ExternalLink,
    List, LayoutGrid, UploadCloud, Archive, Eye, EyeOff, UserPlus, Trash2, Laptop, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store/useAppStore';
import { Client, TaxRegime } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { BulkP12UploaderModal } from '../components/features/BulkP12UploaderModal';
import { v4 as uuidv4 } from 'uuid';
import { type Screen } from '../types';

interface FirmasScreenProps {
    navigate: (screen: any, options?: any) => void;
}

type FirmasTab = 'vigentes' | 'sin-firma' | 'respaldos-externos';
type ViewMode = 'lineal' | 'tarjetas';

interface BackupSignatureItem {
    id: string;
    titular: string;
    ruc: string;
    fileName: string;
    password?: string;
    provider?: string;
    expirationDate?: string;
    category?: string;
    savedAt?: string;
}

export const FirmasScreen: React.FC<FirmasScreenProps> = ({ navigate }) => {
    const { clients, addClient } = useAppStore();
    const { toast } = useToast();
    const [tab, setTab] = useState<FirmasTab>('vigentes');
    const [viewMode, setViewMode] = useState<ViewMode>('lineal');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [backupSignatures, setBackupSignatures] = useState<BackupSignatureItem[]>([]);

    // Cargar Bóveda de Respaldos de Clientes Esporádicos / Externos
    useEffect(() => {
        const loadBackups = () => {
            try {
                const stored: BackupSignatureItem[] = JSON.parse(localStorage.getItem('sri_backup_signatures') || '[]');
                // Limpiar automáticamente cualquier firma cuyo RUC pertenezca a un cliente activo del directorio
                const cleaned = stored.filter(b => {
                    if (!b.ruc) return true;
                    return !clients.some(c => !c.isDeleted && c.isActive && c.ruc.trim() === b.ruc.trim());
                });
                if (cleaned.length !== stored.length) {
                    localStorage.setItem('sri_backup_signatures', JSON.stringify(cleaned));
                }
                setBackupSignatures(cleaned);
            } catch (err) {
                console.error("Error loading backup signatures:", err);
            }
        };
        loadBackups();
    }, [isBulkModalOpen, clients]);

    const signatureData = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        const active = clients.filter(c => {
            if (c.isDeleted || !c.isActive) return false;
            if (!q) return true;
            const matchName = c.name.toLowerCase().includes(q) || (c.tradeName && c.tradeName.toLowerCase().includes(q));
            const matchRuc = c.ruc.includes(q);
            const matchProvider = c.signatureProvider && c.signatureProvider.toLowerCase().includes(q);
            return matchName || matchRuc || matchProvider;
        });

        const getDaysLeft = (expirationDate?: string): number | null => {
            if (!expirationDate) return null;
            const exp = new Date(expirationDate);
            exp.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
        };

        const withSignature = active
            .filter(c => c.signatureFile)
            .sort((a, b) => {
                const dA = a.signatureExpirationDate ? new Date(a.signatureExpirationDate).getTime() : Infinity;
                const dB = b.signatureExpirationDate ? new Date(b.signatureExpirationDate).getTime() : Infinity;
                return dA - dB;
            });

        const withoutSignature = active
            .filter(c => !c.signatureFile)
            .sort((a, b) => a.name.localeCompare(b.name));

        const expired = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d !== null && d < 0;
        });
        const expiringSoon = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d !== null && d >= 0 && d <= 30;
        });
        const ok = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d === null || d > 30;
        });

        return { withSignature, withoutSignature, getDaysLeft, expired, expiringSoon, ok };
    }, [clients, searchTerm]);

    const filteredBackupSignatures = useMemo(() => {
        // 1. Desduplicar el arreglo por RUC + Caducidad (o Titular + Nombre de archivo)
        const uniqueMap = new Map<string, BackupSignatureItem>();
        
        backupSignatures.forEach(item => {
            const rucClean = item.ruc ? item.ruc.trim() : '';
            const key = rucClean ? `${rucClean}_${item.expirationDate || ''}` : `${item.titular.toLowerCase().trim()}_${item.fileName}`;
            
            if (!uniqueMap.has(key) || (!uniqueMap.get(key)?.password && item.password)) {
                uniqueMap.set(key, item);
            }
        });

        const uniqueList = Array.from(uniqueMap.values());

        // 2. Excluir estrictamente a cualquier persona que YA SEA UN CLIENTE ACTIVO en el directorio principal
        const externalOnly = uniqueList.filter(b => {
            if (!b.ruc) return true;
            const existsInActive = clients.some(c => !c.isDeleted && c.isActive && c.ruc.trim() === b.ruc.trim());
            return !existsInActive;
        });

        // 3. Aplicar filtro de búsqueda
        const q = searchTerm.toLowerCase().trim();
        if (!q) return externalOnly;
        return externalOnly.filter(b => 
            b.titular.toLowerCase().includes(q) ||
            b.ruc.includes(q) ||
            (b.category && b.category.toLowerCase().includes(q)) ||
            (b.provider && b.provider.toLowerCase().includes(q))
        );
    }, [backupSignatures, clients, searchTerm]);

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopyPassword = (id: string, passwordText?: string) => {
        if (!passwordText) return;
        navigator.clipboard.writeText(passwordText);
        setCopiedId(id);
        toast.success("Contraseña copiada al portapapeles");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDeleteBackupItem = (id: string) => {
        const updated = backupSignatures.filter(b => b.id !== id);
        setBackupSignatures(updated);
        localStorage.setItem('sri_backup_signatures', JSON.stringify(updated));
        toast.success("Firma de respaldo eliminada");
    };

    const handleConvertBackupToActiveClient = async (item: BackupSignatureItem) => {
        const existing = clients.find(c => !c.isDeleted && c.ruc.trim() === item.ruc.trim());
        if (existing) {
            toast.error(`El cliente ${item.titular} ya existe en tu directorio activo.`);
            return;
        }

        const newClient: Client = {
            id: uuidv4(),
            name: item.titular,
            ruc: item.ruc,
            sriPassword: '',
            email: '',
            phones: [],
            declarations: [],
            notes: `Convertido desde Bóveda de Respaldos (${item.category || 'Venta Esporádica'}).\nEmisor: ${item.provider || 'N/A'}`,
            isActive: true,
            regime: TaxRegime.General,
            address: '',
            electronicSignaturePassword: item.password,
            signatureExpirationDate: item.expirationDate,
            signatureProvider: item.provider,
            taxProfile: {
                ivaFrequency: 'Mensual',
                requiresAnnualRenta: true,
                requiresAnexosGastos: false,
                hasActiveDevolucionIva: false,
                hasActiveElderlyDevolucionIva: false,
                requiresIce: false,
                requiresAnexoPvp: false
            }
        };

        await addClient(newClient);
        handleDeleteBackupItem(item.id);
        toast.success(`🎉 ${item.titular} agregado exitosamente al Directorio Activo de Clientes.`);
    };

    const formatExpiry = (date?: string) => {
        if (!date) return '—';
        const d = new Date(date);
        return isNaN(d.getTime()) ? date : format(d, "d MMM yyyy", { locale: es });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-24">

            {/* ── HEADER DE CONTROL DE FIRMAS ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-to-tr from-purple-500/10 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl shadow-teal-500/30 text-white shrink-0">
                            <KeyRound size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
                                <span className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em]">Auditoría de Certificados Digitales</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Verificación de Firmas Electrónicas (.p12)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Control de vigencia, renovaciones automáticas y Bóveda General de Clientes Esporádicos y Ventas Externas.
                            </p>
                        </div>
                    </div>

                    {/* KPI RESUMEN VITAL */}
                    <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-teal-400 font-mono">{signatureData.ok.length}</span>
                            <span className="text-[9px] font-bold text-teal-300 uppercase tracking-widest mt-0.5">Válidas / Activas</span>
                        </div>
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-amber-400 font-mono">{signatureData.expiringSoon.length}</span>
                            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mt-0.5">Por Vencer (≤30d)</span>
                        </div>
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-purple-300 font-mono">{backupSignatures.length}</span>
                            <span className="text-[9px] font-bold text-purple-300 uppercase tracking-widest mt-0.5">Bóveda Respaldos</span>
                        </div>

                        {/* Botón de Subida Masiva */}
                        <button
                            onClick={() => setIsBulkModalOpen(true)}
                            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-teal-500/25 active:scale-95 flex items-center gap-2"
                        >
                            <UploadCloud size={18} />
                            <span>📥 Subidor Masivo (.p12)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA, PESTAÑAS Y SWITCHER DE VISTA ── */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Pestañas de Estado */}
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/10 w-fit">
                        <button
                            onClick={() => setTab('vigentes')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                tab === 'vigentes'
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <ShieldCheck size={14} />
                            <span>Clientes Activos</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${tab === 'vigentes' ? 'bg-white/20 text-white' : 'bg-teal-500/15 text-teal-400'}`}>
                                {signatureData.withSignature.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setTab('sin-firma')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                tab === 'sin-firma'
                                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <ShieldOff size={14} />
                            <span>Sin Firma</span>
                            {signatureData.withoutSignature.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${tab === 'sin-firma' ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-400'}`}>
                                    {signatureData.withoutSignature.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setTab('respaldos-externos')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                tab === 'respaldos-externos'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Archive size={14} />
                            <span>📦 Respaldos & Ventas Externas</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${tab === 'respaldos-externos' ? 'bg-white/20 text-white' : 'bg-purple-500/15 text-purple-300'}`}>
                                {filteredBackupSignatures.length}
                            </span>
                        </button>
                    </div>

                    {/* SELECTOR DE MODO DE VISTA */}
                    {tab !== 'respaldos-externos' && (
                        <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-2xl p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setViewMode('lineal')}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    viewMode === 'lineal'
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Vista Lineal Minimalista (Tabla Limpia)"
                            >
                                <List size={14} />
                                <span>Lineal</span>
                            </button>
                            <button
                                onClick={() => setViewMode('tarjetas')}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    viewMode === 'tarjetas'
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Vista Tarjetas (Cuadros Ejecutivos)"
                            >
                                <LayoutGrid size={14} />
                                <span>Tarjetas</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Buscador de Clientes / RUC / Entidad */}
                <div className="relative min-w-[260px] sm:w-80">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por Nombre, RUC o Categoría..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all outline-none"
                    />
                </div>
            </div>

            {/* ── TAB 1: CLIENTES ACTIVOS VIGENTES / POR CADUCIDAD ── */}
            {tab === 'vigentes' && (
                <div className="space-y-6">
                    {(signatureData.expired.length > 0 || signatureData.expiringSoon.length > 0) && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-400/[0.08] border border-amber-400/25 shadow-lg">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-200 font-medium">
                                {signatureData.expired.length > 0 && <strong className="text-rose-400">{signatureData.expired.length} firma(s) caducada(s). </strong>}
                                {signatureData.expiringSoon.length > 0 && <strong className="text-amber-300">{signatureData.expiringSoon.length} firma(s) vencen en ≤30 días. </strong>}
                                Haz clic en WhatsApp para notificar la renovación al cliente.
                            </p>
                        </div>
                    )}

                    {signatureData.withSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                                <KeyRound size={32} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">No se encontraron firmas para esta búsqueda.</p>
                        </div>
                    ) : (
                        viewMode === 'lineal' ? (
                            /* VISTA LINEAL MINIMALISTA (TABLA ULTRA LIMPIA) */
                            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <th className="py-4 px-5 text-center w-12">#</th>
                                                <th className="py-4 px-5">Titular / RUC</th>
                                                <th className="py-4 px-5">Emisor de Certificado</th>
                                                <th className="py-4 px-5">Contraseña .p12</th>
                                                <th className="py-4 px-5">Caducidad</th>
                                                <th className="py-4 px-5 text-center">Estado</th>
                                                <th className="py-4 px-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-xs font-mono">
                                            {signatureData.withSignature.map((client, idx) => {
                                                const daysLeft = signatureData.getDaysLeft(client.signatureExpirationDate);
                                                const isExpired = daysLeft !== null && daysLeft < 0;
                                                const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                                                const pwdVisible = visiblePasswords[client.id];
                                                const isCopied = copiedId === client.id;

                                                return (
                                                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="py-4 px-5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                        <td className="py-4 px-5">
                                                            <button
                                                                onClick={() => navigate('client-detail', { clientId: client.id, initialTab: 'vault' })}
                                                                className="font-black text-white hover:text-teal-400 transition-colors uppercase tracking-tight text-left block"
                                                            >
                                                                {client.name}
                                                            </button>
                                                            <span className="text-[10px] text-slate-400 font-bold block">{client.ruc}</span>
                                                        </td>
                                                        <td className="py-4 px-5 text-slate-300">
                                                            <span className="truncate max-w-[200px] block" title={client.signatureProvider || 'SRI Standard'}>
                                                                {client.signatureProvider || 'SRI / Entidad Certificadora'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-5">
                                                            {client.electronicSignaturePassword ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/10">
                                                                    <span className="font-bold text-teal-300 min-w-[70px]">
                                                                        {pwdVisible ? client.electronicSignaturePassword : '••••••••'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => togglePasswordVisibility(client.id)}
                                                                        className="p-1 hover:text-white text-slate-400 transition-colors"
                                                                        title="Ver / Ocultar"
                                                                    >
                                                                        {pwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopyPassword(client.id, client.electronicSignaturePassword)}
                                                                        className="p-1 hover:text-teal-400 text-slate-400 transition-colors"
                                                                        title="Copiar clave"
                                                                    >
                                                                        {isCopied ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 italic text-[11px]">Sin clave</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-5 font-bold text-slate-200">
                                                            {formatExpiry(client.signatureExpirationDate)}
                                                        </td>
                                                        <td className="py-4 px-5 text-center">
                                                            {isExpired ? (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                                    Caducada ({Math.abs(daysLeft!)}d)
                                                                </span>
                                                            ) : isExpiringSoon ? (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                                                    Vence en {daysLeft}d
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                                                    Válida / Activa
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-5 text-right space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    const pObj = client.phones?.[0];
                                                                    const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
                                                                    const msg = `Estimado(a) *${client.name}*, le saludamos de SantiagoCórdova.com. Le recordamos que su Firma Electrónica (.p12) vence el *${formatExpiry(client.signatureExpirationDate)}*. Por favor comuníquese para renovar su certificado a tiempo.`;
                                                                    setWhatsAppPrompt({ clientName: client.name, phone, message: msg });
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold uppercase transition-all border border-emerald-500/30 inline-flex items-center gap-1"
                                                            >
                                                                <PhoneCall size={12} /> WhatsApp
                                                            </button>
                                                            <button
                                                                onClick={() => navigate('client-detail', { clientId: client.id, initialTab: 'vault' })}
                                                                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold uppercase transition-all inline-flex items-center gap-1"
                                                            >
                                                                <ExternalLink size={12} /> Bóveda
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            /* VISTA TARJETAS (FORMATO CERTIFICADO OFICIAL) */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {signatureData.withSignature.map((client) => {
                                    const daysLeft = signatureData.getDaysLeft(client.signatureExpirationDate);
                                    const isExpired = daysLeft !== null && daysLeft < 0;
                                    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

                                    return (
                                        <div
                                            key={client.id}
                                            className={`p-6 rounded-[2rem] border transition-all duration-300 flex flex-col justify-between gap-4 bg-slate-900/60 backdrop-blur-2xl ${
                                                isExpired
                                                    ? 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                                                    : isExpiringSoon
                                                    ? 'border-amber-400/40 shadow-[0_0_25px_rgba(251,191,36,0.15)]'
                                                    : 'border-white/10 hover:border-teal-500/40'
                                            }`}
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verificación .p12</span>
                                                    {isExpired ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">Caducada</span>
                                                    ) : isExpiringSoon ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">Vence en {daysLeft}d</span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">Válida / Activa</span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="text-base font-black text-white uppercase tracking-tight font-display line-clamp-1">{client.name}</h3>
                                                    <p className="text-xs font-mono font-bold text-slate-400">{client.ruc}</p>
                                                </div>

                                                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs font-mono">
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>Caducidad:</span>
                                                        <strong className="text-white">{formatExpiry(client.signatureExpirationDate)}</strong>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>Emisor:</span>
                                                        <strong className="text-teal-300 truncate max-w-[140px]">{client.signatureProvider || 'SRI Standard'}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                <button
                                                    onClick={() => navigate('client-detail', { clientId: client.id, initialTab: 'vault' })}
                                                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase transition-all text-center"
                                                >
                                                    Ir a Bóveda
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ── TAB 2: CLIENTES SIN FIRMA REGISTRADA ── */}
            {tab === 'sin-firma' && (
                <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                    <p className="text-xs text-slate-300">
                        Mostrando {signatureData.withoutSignature.length} clientes activos sin archivo de Firma Electrónica (.p12) registrado en su bóveda.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {signatureData.withoutSignature.map((client) => (
                            <div key={client.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-white uppercase tracking-tight">{client.name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">{client.ruc}</p>
                                </div>
                                <button
                                    onClick={() => navigate('client-detail', { clientId: client.id, initialTab: 'vault' })}
                                    className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase transition-all"
                                >
                                    Cargar Firma
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TAB 3: BÓVEDA DE RESPALDOS & CLIENTES EXTERNOS ── */}
            {tab === 'respaldos-externos' && (
                <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Bóveda General de Clientes Esporádicos y Ventas Externas
                            </span>
                            <h3 className="text-base font-black text-white mt-1">Firmas de Sistemas, Facturadores y Ventas Ocasionales</h3>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Aquí se respaldan las firmas de clientes que no llevan contabilidad mensual contigo (ej: solo venta de sistema Ecuafact o firma ocasional). Puedes convertirlos a cliente activo en 1 clic.
                            </p>
                        </div>
                    </div>

                    {filteredBackupSignatures.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-slate-900/40 rounded-[2.5rem] border border-white/10">
                            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                                <Archive size={36} className="text-slate-500" />
                            </div>
                            <p className="text-sm font-bold text-slate-300">No hay firmas guardadas en la Bóveda de Respaldos Externos.</p>
                            <p className="text-xs text-slate-400 max-w-sm">Al usar el Subidor Masivo, puedes seleccionar "Bóveda de Respaldos" para guardar firmas de clientes ocasionales.</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="py-4 px-5 text-center w-12">#</th>
                                            <th className="py-4 px-5">Titular / RUC</th>
                                            <th className="py-4 px-5">Categoría de Servicio</th>
                                            <th className="py-4 px-5">Contraseña .p12</th>
                                            <th className="py-4 px-5">Caducidad</th>
                                            <th className="py-4 px-5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs font-mono">
                                        {filteredBackupSignatures.map((item, idx) => {
                                            const pwdVisible = visiblePasswords[item.id];
                                            const isCopied = copiedId === item.id;

                                            return (
                                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4 px-5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                    <td className="py-4 px-5">
                                                        <span className="font-black text-white uppercase tracking-tight block text-sm">{item.titular}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold block">{item.ruc || 'Sin RUC registrado'}</span>
                                                        <span className="text-[9px] text-slate-500 block font-sans">{item.fileName}</span>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1">
                                                            <Shield size={12} /> {item.category || 'Venta Esporádica'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        {item.password ? (
                                                            <div className="inline-flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/10">
                                                                <span className="font-bold text-purple-300 min-w-[70px]">
                                                                    {pwdVisible ? item.password : '••••••••'}
                                                                </span>
                                                                <button
                                                                    onClick={() => togglePasswordVisibility(item.id)}
                                                                    className="p-1 hover:text-white text-slate-400 transition-colors"
                                                                    title="Ver / Ocultar"
                                                                >
                                                                    {pwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCopyPassword(item.id, item.password)}
                                                                    className="p-1 hover:text-purple-400 text-slate-400 transition-colors"
                                                                    title="Copiar clave"
                                                                >
                                                                    {isCopied ? <Check size={12} className="text-purple-400" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500 italic text-[11px]">Sin clave</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-5 font-bold text-slate-200">
                                                        {formatExpiry(item.expirationDate)}
                                                    </td>
                                                    <td className="py-4 px-5 text-right space-x-2">
                                                        <button
                                                            onClick={() => handleConvertBackupToActiveClient(item)}
                                                            className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-[10px] font-bold uppercase transition-all border border-teal-500/30 inline-flex items-center gap-1"
                                                            title="Convertir a Cliente Contable Activo"
                                                        >
                                                            <UserPlus size={12} /> Convertir a Cliente
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBackupItem(item.id)}
                                                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                                                            title="Eliminar de Bóveda de Respaldos"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL SUBIDOR MASIVO ── */}
            <BulkP12UploaderModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
            />

            {/* ── MODAL WHATSAPP NOTIFICACIÓN ── */}
            {whatsAppPrompt && (
                <Modal isOpen={true} onClose={() => setWhatsAppPrompt(null)} title="💬 Enviar Recordatorio por WhatsApp" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <p className="text-xs text-slate-300">
                            Enviarás un mensaje directo al cliente <strong>{whatsAppPrompt.clientName}</strong> sobre la caducidad de su firma electrónica:
                        </p>

                        <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-emerald-300 whitespace-pre-wrap">
                            {whatsAppPrompt.message}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <a
                                href={`https://wa.me/${whatsAppPrompt.phone ? whatsAppPrompt.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(whatsAppPrompt.message)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                            >
                                <PhoneCall size={14} /> Abrir WhatsApp
                            </a>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
