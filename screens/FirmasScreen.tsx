import React, { useMemo, useState, useEffect } from 'react';
import {
    KeyRound, ShieldCheck, ShieldOff, PhoneCall, AlertTriangle,
    CheckCircle2, ArrowRight, Search, FileText, Check, Copy, ExternalLink,
    List, LayoutGrid, UploadCloud, Archive, Eye, EyeOff, UserPlus, Trash2, Laptop, Shield,
    ShoppingBag, Lock, Camera, Globe, RefreshCw, Download, Cloud, Filter
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
import { downloadStoredFile } from '../services/fileService';

interface FirmasScreenProps {
    navigate: (screen: any, options?: any) => void;
}

type FirmasTab = 'vigentes' | 'sin-firma' | 'respaldos-externos' | 'facturadores';
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
    fileContent?: string;
}

export const FirmasScreen: React.FC<FirmasScreenProps> = ({ navigate }) => {
    const { clients, addClient, updateClient } = useAppStore();
    const { toast } = useToast();
    const [tab, setTab] = useState<FirmasTab>('vigentes');
    const [viewMode, setViewMode] = useState<ViewMode>('lineal');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [backupSignatures, setBackupSignatures] = useState<BackupSignatureItem[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('all');

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
            if (selectedProvider !== 'all') {
                const prov = c.signatureProvider?.toLowerCase() || '';
                if (!prov.includes(selectedProvider.toLowerCase())) return false;
            }
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
    }, [clients, searchTerm, selectedProvider]);

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

    const facturadorClients = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return clients.filter(c => {
            if (c.isDeleted || !c.isActive || !c.facturadorConfig) return false;
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || 
                   c.ruc.includes(q) || 
                   (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
                   c.facturadorConfig?.programName?.toLowerCase().includes(q);
        });
    }, [clients, searchTerm]);

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
        <div className="space-y-6 animate-in fade-in duration-300 pb-24 font-sans">

            {/* ── HEADER DE CONTROL DE FIRMAS (Stitch Obsidian Luxury) ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 border-t-white/20 bg-[#051424]/90 shadow-2xl backdrop-blur-2xl p-8 md:p-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#2B6AFF]/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 rounded-3xl bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] shadow-[0_0_15px_rgba(0,168,150,0.3)] shrink-0">
                            <KeyRound size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5 font-mono">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_8px_rgba(0,168,150,0.8)]" />
                                <span className="text-[9px] font-bold text-[#00A896] uppercase tracking-[0.3em]">Auditoría de Certificados Digitales SRI</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Verificación de Firmas Electrónicas (.p12)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium font-sans">
                                Control de vigencia, renovaciones automáticas y Bóveda General de Clientes Esporádicos y Ventas Externas.
                            </p>
                        </div>
                    </div>

                    {/* KPI RESUMEN VITAL (Stitch Obsidian Tokens) */}
                    <div className="flex items-center gap-3 flex-wrap shrink-0 font-mono">
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/30 shadow-sm">
                            <span className="text-2xl font-black text-[#00A896] font-mono">{signatureData.ok.length}</span>
                            <span className="text-[8.5px] font-bold text-[#00A896] uppercase tracking-wider mt-0.5">Válidas / Activas</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 shadow-sm">
                            <span className="text-2xl font-black text-amber-400 font-mono">{signatureData.expiringSoon.length}</span>
                            <span className="text-[8.5px] font-bold text-amber-300 uppercase tracking-wider mt-0.5">Por Vencer (≤30d)</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-purple-500/15 border border-purple-500/30 shadow-sm">
                            <span className="text-2xl font-black text-purple-300 font-mono">{backupSignatures.length}</span>
                            <span className="text-[8.5px] font-bold text-purple-300 uppercase tracking-wider mt-0.5">Bóveda Respaldos</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-[#2B6AFF]/15 border border-[#2B6AFF]/30 shadow-sm">
                            <div className="flex items-center gap-1 text-[#2B6AFF] font-mono font-black text-xl">
                                <Cloud size={16} />
                                <span>Cloud R2</span>
                            </div>
                            <span className="text-[8.5px] font-bold text-[#2B6AFF] uppercase tracking-wider mt-0.5">Cloudflare Synced</span>
                        </div>

                        {/* Botón de Subida Masiva */}
                        <button
                            onClick={() => setIsBulkModalOpen(true)}
                            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/25 active:scale-95 flex items-center gap-2 border border-white/10 cursor-pointer"
                        >
                            <UploadCloud size={16} />
                            <span>📥 Subidor Masivo (.p12)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA, PESTAÑAS Y SWITCHER DE VISTA (Stitch Obsidian Luxury) ── */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 font-mono">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Pestañas de Estado */}
                    <div className="flex items-center gap-1.5 bg-[#0b1326] p-1.5 rounded-2xl border border-white/10 w-fit">
                        <button
                            onClick={() => setTab('vigentes')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                tab === 'vigentes'
                                    ? 'bg-white/15 text-white shadow-lg border border-white/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ShieldCheck size={14} className={tab === 'vigentes' ? 'text-[#00A896]' : ''} />
                            <span>Clientes Activos</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tab === 'vigentes' ? 'bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/30' : 'bg-white/10 text-slate-400'}`}>
                                {signatureData.withSignature.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setTab('sin-firma')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                tab === 'sin-firma'
                                    ? 'bg-rose-500/20 text-rose-300 shadow-lg border border-rose-500/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ShieldOff size={14} />
                            <span>Sin Firma</span>
                            {signatureData.withoutSignature.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tab === 'sin-firma' ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {signatureData.withoutSignature.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setTab('respaldos-externos')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                tab === 'respaldos-externos'
                                    ? 'bg-purple-500/20 text-purple-200 shadow-lg border border-purple-500/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Archive size={14} />
                            <span>Respaldos & Ventas</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tab === 'respaldos-externos' ? 'bg-purple-500 text-white' : 'bg-purple-500/20 text-purple-300'}`}>
                                {filteredBackupSignatures.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setTab('facturadores')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                tab === 'facturadores'
                                    ? 'bg-[#00A896]/20 text-[#00A896] shadow-lg border border-[#00A896]/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <ShoppingBag size={14} />
                            <span>Facturadores y Planes</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tab === 'facturadores' ? 'bg-[#00A896] text-white' : 'bg-[#00A896]/15 text-[#00A896]'}`}>
                                {clients.filter(c => !c.isDeleted && c.isActive && c.facturadorConfig).length}
                            </span>
                        </button>
                    </div>

                    {/* SELECTOR DE MODO DE VISTA */}
                    {(tab !== 'respaldos-externos' && tab !== 'facturadores') && (
                        <div className="flex items-center gap-1 bg-[#0b1326] p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setViewMode('lineal')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'lineal'
                                        ? 'bg-white/15 text-white shadow-md border border-white/20'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Vista Lineal Minimalista (Tabla Limpia)"
                            >
                                <List size={14} />
                                <span>Lineal</span>
                            </button>
                            <button
                                onClick={() => setViewMode('tarjetas')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'tarjetas'
                                        ? 'bg-white/15 text-white shadow-md border border-white/20'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Vista Tarjetas (Cuadros Ejecutivos)"
                            >
                                <LayoutGrid size={14} />
                                <span>Tarjetas</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Filtro por Emisor / Proveedor */}
                    <div className="relative">
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            className="appearance-none pl-8 pr-8 py-2 bg-[#0b1326]/90 border border-white/10 rounded-2xl text-xs text-white focus:border-[#00A896]/50 transition-all outline-none cursor-pointer font-mono"
                        >
                            <option value="all" className="bg-[#051424] text-white">Todos los Emisores</option>
                            <option value="Security Data" className="bg-[#051424] text-white">Security Data</option>
                            <option value="ANF" className="bg-[#051424] text-white">ANF AC</option>
                            <option value="Banco Central" className="bg-[#051424] text-white">Banco Central (BCE)</option>
                            <option value="UANATACA" className="bg-[#051424] text-white">UANATACA</option>
                            <option value="Consejo de la Judicatura" className="bg-[#051424] text-white">Consejo Judicatura</option>
                        </select>
                        <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Buscador de Clientes / RUC / Entidad */}
                    <div className="relative min-w-[220px] sm:w-72">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="BUSCAR TITULAR O RUC..."
                            className="w-full pl-9 pr-4 py-2 bg-[#0b1326]/90 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-[#00A896]/50 transition-all outline-none font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* ── TAB 1: CLIENTES ACTIVOS VIGENTES / POR CADUCIDAD ── */}
            {tab === 'vigentes' && (
                <div className="space-y-6 font-mono">
                    {(signatureData.expired.length > 0 || signatureData.expiringSoon.length > 0) && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 shadow-lg">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-200 font-medium font-sans">
                                {signatureData.expired.length > 0 && <strong className="text-rose-400">{signatureData.expired.length} firma(s) caducada(s). </strong>}
                                {signatureData.expiringSoon.length > 0 && <strong className="text-amber-300">{signatureData.expiringSoon.length} firma(s) vencen en ≤30 días. </strong>}
                                Haz clic en WhatsApp para notificar la renovación al cliente.
                            </p>
                        </div>
                    )}

                    {signatureData.withSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                                <KeyRound size={32} className="text-slate-500" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No se encontraron firmas para esta búsqueda.</p>
                        </div>
                    ) : (
                        viewMode === 'lineal' ? (
                            /* VISTA LINEAL MINIMALISTA (TABLA ULTRA LIMPIA EN OBSIDIANA) */
                            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 border-t-white/20 overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-[#0b1326]/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                                                    <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="py-4 px-5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                        <td className="py-4 px-5">
                                                            <button
                                                                onClick={() => navigate('client-detail', { clientId: client.id, initialTab: 'vault' })}
                                                                className="font-bold text-white hover:text-[#00A896] transition-colors uppercase tracking-tight text-left block font-display text-sm cursor-pointer"
                                                            >
                                                                {client.name}
                                                            </button>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-slate-400 font-bold font-mono">{client.ruc}</span>
                                                                {client.facturadorConfig && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigate('facturadores', { searchTerm: client.ruc });
                                                                        }}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00A896]/15 hover:bg-[#00A896]/25 border border-[#00A896]/30 text-[#00A896] text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                                        title={`Cliente con Facturador: ${client.facturadorConfig.programName}. Clic para ver.`}
                                                                    >
                                                                        <ShoppingBag size={9} /> Facturador
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-5 text-slate-300">
                                                            <span className="truncate max-w-[200px] block" title={client.signatureProvider || 'SRI Standard'}>
                                                                {client.signatureProvider || 'SRI / Entidad Certificadora'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-5">
                                                            {client.electronicSignaturePassword ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-[#020b14] px-2.5 py-1 rounded-xl border border-white/10">
                                                                    <span className="font-bold text-[#00A896] min-w-[70px]">
                                                                        {pwdVisible ? client.electronicSignaturePassword : '••••••••'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => togglePasswordVisibility(client.id)}
                                                                        className="p-1 hover:text-white text-slate-400 transition-colors cursor-pointer"
                                                                        title="Ver / Ocultar"
                                                                    >
                                                                        {pwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopyPassword(client.id, client.electronicSignaturePassword)}
                                                                        className="p-1 hover:text-[#00A896] text-slate-400 transition-colors cursor-pointer"
                                                                        title="Copiar clave"
                                                                    >
                                                                        {isCopied ? <Check size={12} className="text-[#00A896]" /> : <Copy size={12} />}
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
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                                                    Caducada ({Math.abs(daysLeft!)}d)
                                                                </span>
                                                            ) : isExpiringSoon ? (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                                    Vence en {daysLeft}d
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/40 shadow-[0_0_6px_rgba(0,168,150,0.3)]">
                                                                    Válida / Activa
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-5 text-right space-x-2">
                                                            {client.signatureFile && (
                                                                <button
                                                                    onClick={() => downloadStoredFile(client.signatureFile)}
                                                                    className="px-3 py-1.5 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] text-[10px] font-bold uppercase transition-all border border-[#00A896]/30 inline-flex items-center gap-1 shadow-sm cursor-pointer"
                                                                    title="Descargar archivo Firma Electrónica (.p12)"
                                                                >
                                                                    <UploadCloud size={12} className="rotate-180" /> Descargar .p12
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    const pObj = client.phones?.[0];
                                                                    const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
                                                                    const msg = `Estimado(a) *${client.name}*, le saludamos de SantiagoCórdova.com. Le recordamos que su Firma Electrónica (.p12) vence el *${formatExpiry(client.signatureExpirationDate)}*. Por favor comuníquese para renovar su certificado a tiempo.`;
                                                                    setWhatsAppPrompt({ clientName: client.name, phone, message: msg });
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold uppercase transition-all border border-emerald-500/30 inline-flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <PhoneCall size={12} /> WhatsApp
                                                            </button>
                                                            <button
                                                                onClick={() => navigate('clients', { clientIdToView: client.id, initialTab: 'vault' })}
                                                                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold uppercase transition-all inline-flex items-center gap-1 border border-white/10 cursor-pointer"
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
                                            className={`p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between gap-4 bg-[#051424]/90 backdrop-blur-2xl shadow-xl ${
                                                isExpired
                                                    ? 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                                                    : isExpiringSoon
                                                    ? 'border-amber-400/40 shadow-[0_0_25px_rgba(251,191,36,0.15)]'
                                                    : 'border-white/10 hover:border-[#00A896]/40'
                                            }`}
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Verificación .p12</span>
                                                    {isExpired ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">Caducada</span>
                                                    ) : isExpiringSoon ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">Vence en {daysLeft}d</span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/40">Válida / Activa</span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="text-base font-black text-white uppercase tracking-tight font-display line-clamp-1">{client.name}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs font-mono font-bold text-slate-400">{client.ruc}</span>
                                                        {client.facturadorConfig && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate('facturadores', { searchTerm: client.ruc });
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00A896]/15 hover:bg-[#00A896]/25 border border-[#00A896]/30 text-[#00A896] text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                                title={`Cliente con Facturador: ${client.facturadorConfig.programName}. Clic para ver.`}
                                                            >
                                                                <ShoppingBag size={8} /> Facturador
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="p-3 rounded-2xl bg-[#020b14] border border-white/5 space-y-1.5 text-xs font-mono">
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>Caducidad:</span>
                                                        <strong className="text-white">{formatExpiry(client.signatureExpirationDate)}</strong>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>Emisor:</span>
                                                        <strong className="text-[#00A896] truncate max-w-[140px]">{client.signatureProvider || 'SRI Standard'}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                {client.signatureFile && (
                                                    <button
                                                        onClick={() => downloadStoredFile(client.signatureFile)}
                                                        className="py-2 px-3 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] text-xs font-bold uppercase transition-all text-center flex items-center justify-center gap-1.5 border border-[#00A896]/30 shadow-sm cursor-pointer"
                                                        title="Descargar Firma Electrónica (.p12)"
                                                    >
                                                        <UploadCloud size={14} className="rotate-180" /> Descargar .p12
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => navigate('clients', { clientIdToView: client.id, initialTab: 'vault' })}
                                                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase transition-all text-center border border-white/10 cursor-pointer"
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

            {/* ── TAB 2: CLIENTES SIN FIRMA REGISTRADA (Stitch Obsidian Luxury) ── */}
            {tab === 'sin-firma' && (
                <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 border-t-white/20 p-6 md:p-8 space-y-6 font-mono">
                    <p className="text-xs text-slate-300 font-sans">
                        Mostrando <strong className="text-white">{signatureData.withoutSignature.length}</strong> clientes activos sin archivo de Firma Electrónica (.p12) registrado en su bóveda.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {signatureData.withoutSignature.map((client) => (
                            <div key={client.id} className="p-4 rounded-2xl bg-[#0b1326]/80 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 shadow-md">
                                <div>
                                    <p className="text-xs font-bold text-white uppercase tracking-tight font-display">{client.name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">{client.ruc}</p>
                                </div>
                                <button
                                    onClick={() => navigate('clients', { clientIdToView: client.id, initialTab: 'vault' })}
                                    className="px-3 py-1.5 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] border border-[#00A896]/30 text-[10px] font-bold uppercase transition-all cursor-pointer"
                                >
                                    Cargar Firma
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TAB 3: BÓVEDA DE RESPALDOS & CLIENTES EXTERNOS (Stitch Obsidian Luxury) ── */}
            {tab === 'respaldos-externos' && (
                <div className="space-y-6 font-mono">
                    <div className="p-5 rounded-[2.5rem] bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Bóveda General de Clientes Esporádicos y Ventas Externas
                            </span>
                            <h3 className="text-base font-black text-white mt-1 font-display">Firmas de Sistemas, Facturadores y Ventas Ocasionales</h3>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans mt-0.5">
                                Aquí se respaldan las firmas de clientes que no llevan contabilidad mensual contigo (ej: solo venta de sistema Ecuafact o firma ocasional). Puedes convertirlos a cliente activo en 1 clic.
                            </p>
                        </div>
                    </div>

                    {filteredBackupSignatures.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-[#051424]/90 rounded-[2.5rem] border border-white/10">
                            <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                                <Archive size={36} className="text-slate-500" />
                            </div>
                            <p className="text-sm font-bold text-slate-300">No hay firmas guardadas en la Bóveda de Respaldos Externos.</p>
                            <p className="text-xs text-slate-400 max-w-sm font-sans">Al usar el Subidor Masivo, puedes seleccionar "Bóveda de Respaldos" para guardar firmas de clientes ocasionales.</p>
                        </div>
                    ) : (
                        <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 border-t-white/20 overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-[#0b1326]/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-4 px-5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                    <td className="py-4 px-5">
                                                        <span className="font-bold text-white uppercase tracking-tight block text-sm font-display">{item.titular}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold block">{item.ruc || 'Sin RUC registrado'}</span>
                                                        <span className="text-[9px] text-slate-500 block font-mono">{item.fileName}</span>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1">
                                                            <Shield size={12} /> {item.category || 'Venta Esporádica'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        {item.password ? (
                                                            <div className="inline-flex items-center gap-1.5 bg-[#020b14] px-2.5 py-1 rounded-xl border border-white/10">
                                                                <span className="font-bold text-purple-300 min-w-[70px]">
                                                                    {pwdVisible ? item.password : '••••••••'}
                                                                </span>
                                                                <button
                                                                    onClick={() => togglePasswordVisibility(item.id)}
                                                                    className="p-1 hover:text-white text-slate-400 transition-colors cursor-pointer"
                                                                    title="Ver / Ocultar"
                                                                >
                                                                    {pwdVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCopyPassword(item.id, item.password)}
                                                                    className="p-1 hover:text-purple-400 text-slate-400 transition-colors cursor-pointer"
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
                                                        {(item.fileContent || (item as any).signatureFile) && (
                                                            <button
                                                                onClick={() => downloadStoredFile((item as any).signatureFile || { name: item.fileName || `${item.titular}_firma.p12`, content: item.fileContent, type: 'p12' })}
                                                                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold uppercase transition-all border border-purple-500/40 inline-flex items-center gap-1 shadow-sm cursor-pointer"
                                                                title="Descargar archivo Firma Electrónica (.p12)"
                                                            >
                                                                <UploadCloud size={12} className="rotate-180" /> Descargar .p12
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleConvertBackupToActiveClient(item)}
                                                            className="px-3 py-1.5 rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] text-[10px] font-bold uppercase transition-all border border-[#00A896]/30 inline-flex items-center gap-1 cursor-pointer"
                                                            title="Convertir a Cliente Contable Activo"
                                                        >
                                                            <UserPlus size={12} /> Convertir a Cliente
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBackupItem(item.id)}
                                                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer border border-rose-500/20"
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

            {/* ── MODAL WHATSAPP NOTIFICACIÓN (Stitch Obsidian Luxury) ── */}
            {whatsAppPrompt && (
                <Modal isOpen={true} onClose={() => setWhatsAppPrompt(null)} title="💬 Enviar Recordatorio por WhatsApp" size="md">
                    <div className="space-y-4 p-4 text-white font-mono">
                        <p className="text-xs text-slate-300 font-sans">
                            Enviarás un mensaje directo al cliente <strong className="text-white">{whatsAppPrompt.clientName}</strong> sobre la caducidad de su firma electrónica:
                        </p>

                        <div className="p-4 rounded-2xl bg-[#020b14] border border-white/10 text-xs font-mono text-emerald-300 whitespace-pre-wrap">
                            {whatsAppPrompt.message}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer border border-white/10"
                            >
                                Cancelar
                            </button>
                            <a
                                href={`https://wa.me/${whatsAppPrompt.phone ? whatsAppPrompt.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(whatsAppPrompt.message)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 border border-white/10 cursor-pointer"
                            >
                                <PhoneCall size={14} /> Abrir WhatsApp
                            </a>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── DOCK FLOTANTE PRO (Stitch Obsidian Luxury) ── */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#051424]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-3 text-white transition-all duration-300 font-mono">
                {/* Buscador Rápido Flotante */}
                <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="BUSCAR TITULAR O RUC..."
                        className="pl-8 pr-3 py-1.5 bg-[#020b14] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00A896]/50 w-44 sm:w-56 font-mono"
                    />
                </div>

                <div className="h-6 w-px bg-white/10 hidden sm:block" />

                {/* Botón Subida Masiva Rápida */}
                <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#00A896]/25 flex items-center gap-1.5 shrink-0 transition-all active:scale-95 border border-white/10 cursor-pointer"
                >
                    <UploadCloud size={14} />
                    <span className="hidden md:inline">Subida Masiva (.p12)</span>
                    <span className="md:hidden">Subir</span>
                </button>

                <div className="h-6 w-px bg-white/10" />

                {/* Botones de Navegación Rápida Arriba / Abajo */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 transition-all active:scale-90 cursor-pointer border border-white/5"
                        title="Ir arriba de la página"
                    >
                        <ArrowRight size={14} className="-rotate-90" />
                    </button>
                    <button
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 transition-all active:scale-90 cursor-pointer border border-white/5"
                        title="Ir al final de la página"
                    >
                        <ArrowRight size={14} className="rotate-90" />
                    </button>
                </div>
            </div>
        </div>
    );
};
