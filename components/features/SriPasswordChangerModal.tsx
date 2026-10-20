import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Key, Copy, Check, ExternalLink, RefreshCw, Zap, Search, 
    ShieldCheck, Lock, ArrowRight, X, Sparkles, Upload, Eye, EyeOff, FileText, ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { transformPasswordForSri, sendSRIPasswordChangeToExtension, openSRIPortal } from '../../services/extensionBridge';
import { parseCredentialsCSV } from '../../services/csv';

interface SriPasswordChangerModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientToFocus?: Client;
}

export const SriPasswordChangerModal: React.FC<SriPasswordChangerModalProps> = ({ isOpen, onClose, clientToFocus }) => {
    const { clients, updateClient } = useAppStore();
    const { toast } = useToast();

    // Mode state: 'focus' (single client) | 'directory' (search list) | 'csv' (bulk Chrome passwords)
    const [activeTab, setActiveTab] = useState<'focus' | 'directory' | 'csv'>('focus');
    const [selectedClient, setSelectedClient] = useState<Client | null>(clientToFocus || null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(true);
    const [copiedField, setCopiedField] = useState<'ruc' | 'oldPass' | 'newPass' | null>(null);

    // Form state for current selected client
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // CSV Import refs and state
    const csvInputRef = useRef<HTMLInputElement>(null);
    const clavesRef = useRef<Record<string, string>>({});
    const [propuesta, setPropuesta] = useState<{
        leidas: number;
        cambian: { id: string; ruc: string; name: string; teniaClave: boolean }[];
        sinCambio: number;
        noEstan: string[];
    } | null>(null);

    // Sync focused client on open or prop change
    useEffect(() => {
        if (isOpen) {
            if (clientToFocus) {
                setSelectedClient(clientToFocus);
                setActiveTab('focus');
                const old = clientToFocus.sriPassword || '';
                setNewPasswordValue(transformPasswordForSri(old));
            } else {
                // If no specific client focused, default to directory or first client
                const active = clients.filter(c => !c.isDeleted && (c.isActive ?? true));
                if (active.length > 0 && !selectedClient) {
                    setSelectedClient(active[0]);
                    const old = active[0].sriPassword || '';
                    setNewPasswordValue(transformPasswordForSri(old));
                }
                setActiveTab(clientToFocus ? 'focus' : 'directory');
            }
        }
    }, [isOpen, clientToFocus, clients]);

    // Handle switching client
    const handleSelectClient = (c: Client) => {
        setSelectedClient(c);
        const old = c.sriPassword || '';
        setNewPasswordValue(transformPasswordForSri(old));
        setActiveTab('focus');
    };

    const activeClients = useMemo(() => {
        return clients.filter(c => !c.isDeleted && (c.isActive ?? true));
    }, [clients]);

    const filteredClients = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return activeClients.slice(0, 30);
        return activeClients.filter(c => 
            c.name.toLowerCase().includes(q) || 
            c.ruc.includes(q) || 
            (c.tradeName && c.tradeName.toLowerCase().includes(q))
        ).slice(0, 50);
    }, [activeClients, searchTerm]);

    // Copy to clipboard helper with micro-feedback
    const handleCopy = (text: string, field: 'ruc' | 'oldPass' | 'newPass') => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success(`Copiado al portapapeles: ${text}`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Password transformers
    const handleApplyRotationRule = () => {
        if (!selectedClient) return;
        const current = selectedClient.sriPassword || '';
        const rotated = transformPasswordForSri(current);
        setNewPasswordValue(rotated);
        toast.info(`Regla SRI aplicada: ${rotated}`);
    };

    const handleGenerateRandomPass = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let pass = '';
        for (let i = 0; i < 8; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        pass += '@2026';
        setNewPasswordValue(pass);
        toast.info(`Clave segura generada: ${pass}`);
    };

    // Save password in system
    const handleSavePassword = async () => {
        if (!selectedClient) return;
        const oldPass = selectedClient.sriPassword || '';
        const cleanNew = newPasswordValue.trim();

        if (!cleanNew) {
            toast.warning("Por favor ingresa una clave válida.");
            return;
        }

        setIsSaving(true);
        try {
            const nowIso = new Date().toISOString();
            await updateClient(selectedClient.id, {
                sriPassword: cleanNew,
                sriPasswordUpdatedAt: nowIso,
                taxProfile: {
                    ...(selectedClient.taxProfile as any),
                    sriCredencial: {
                        estado: 'ok',
                        motivo: 'Clave actualizada manualmente',
                        ultimo_ingreso: nowIso
                    }
                }
            });

            // Update local selection
            setSelectedClient({
                ...selectedClient,
                sriPassword: cleanNew,
                sriPasswordUpdatedAt: nowIso
            });

            // Sync with extension bridge
            sendSRIPasswordChangeToExtension(selectedClient.ruc, oldPass, cleanNew);
            toast.success(`✅ Clave SRI de ${selectedClient.name.split(' ')[0]} actualizada con éxito.`);
        } catch (e: any) {
            toast.error(`Error guardando contraseña: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Open SRI portal with new credentials on clipboard
    const handleOpenSriPortal = () => {
        if (!selectedClient) return;
        const passToCopy = newPasswordValue.trim() || selectedClient.sriPassword || '';
        
        if (passToCopy) {
            navigator.clipboard.writeText(passToCopy);
        }

        // Bridge notification
        sendSRIPasswordChangeToExtension(selectedClient.ruc, selectedClient.sriPassword || '', passToCopy);

        // Open SRI URL
        openSRIPortal('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT');
        toast.success(`🚀 Abriendo SRI. Clave (${passToCopy}) copiada al portapapeles.`);
    };

    // CSV Import from Chrome
    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            if (!content) return;
            const creds = parseCredentialsCSV(content);
            clavesRef.current = creds;
            const credKeys = Object.keys(creds);
            if (credKeys.length === 0) {
                toast.error("No se encontraron claves de usuario/RUC válidas en el archivo CSV.");
                return;
            }

            const cambian: { id: string; ruc: string; name: string; teniaClave: boolean }[] = [];
            let sinCambio = 0;
            const rucsUsados = new Set<string>();

            clients.forEach(c => {
                const clave = creds[c.ruc] || creds[c.ruc.slice(0, 10)];
                if (!clave) return;
                rucsUsados.add(c.ruc);
                rucsUsados.add(c.ruc.slice(0, 10));
                if (c.sriPassword === clave) { sinCambio++; return; }
                cambian.push({ id: c.id, ruc: c.ruc, name: c.name, teniaClave: !!c.sriPassword });
            });

            const noEstan = credKeys.filter(k => !rucsUsados.has(k));
            setPropuesta({ leidas: credKeys.length, cambian, sinCambio, noEstan });
            setActiveTab('csv');
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    const aplicarPropuestaCsv = () => {
        if (!propuesta) return;
        const cuando = new Date().toISOString();
        propuesta.cambian.forEach(c => {
            const clave = clavesRef.current[c.ruc] || clavesRef.current[c.ruc.slice(0, 10)];
            if (clave) {
                updateClient(c.id, { sriPassword: clave, sriPasswordUpdatedAt: cuando });
            }
        });
        toast.success(`✅ ${propuesta.cambian.length} clave(s) sincronizadas desde Chrome.`);
        setPropuesta(null);
        clavesRef.current = {};
        setActiveTab('focus');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-xl bg-[#030712] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white font-sans">
                
                {/* Header Obsidian & Liquid Gold */}
                <div className="px-5 py-4 bg-slate-900/60 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
                            <Key size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono">Bóveda SRI</span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                                    AES-256 Cloud Sync
                                </span>
                            </div>
                            <h2 className="text-sm font-black text-white tracking-tight">
                                Gestión de Claves del Portal SRI
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Sub-bar Navigation Pills */}
                <div className="px-5 py-2.5 bg-slate-950/80 border-b border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('focus')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'focus'
                                    ? 'bg-[#00A896] text-white shadow-sm font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Cliente Actual
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('directory')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'directory'
                                    ? 'bg-[#00A896] text-white shadow-sm font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Explorar Cartera ({activeClients.length})
                        </button>
                    </div>

                    {/* CSV Button Discreet */}
                    <div>
                        <input 
                            type="file" 
                            ref={csvInputRef} 
                            onChange={handleCsvImport} 
                            accept=".csv" 
                            className="hidden" 
                        />
                        <button 
                            type="button"
                            onClick={() => csvInputRef.current?.click()} 
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Importar CSV exportado desde Google Chrome"
                        >
                            <Upload size={12} className="text-amber-400" />
                            <span>CSV Chrome</span>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">

                    {/* MODE 1: FOCUSED CLIENT VIEW */}
                    {activeTab === 'focus' && selectedClient && (
                        <div className="space-y-4">
                            {/* Client Summary Hero */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-white/10 shadow-sm flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase text-[#C9A96E] tracking-wider font-mono">
                                        {selectedClient.regime || 'Régimen General'} • {selectedClient.taxProfile?.ivaFrequency || 'Mensual'}
                                    </div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight leading-snug">
                                        {selectedClient.tradeName || selectedClient.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                        <span>RUC: {selectedClient.ruc}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(selectedClient.ruc, 'ruc')}
                                            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                                            title="Copiar RUC"
                                        >
                                            {copiedField === 'ruc' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('directory')}
                                    className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
                                >
                                    Cambiar Cliente ➔
                                </button>
                            </div>

                            {/* Current Password Field */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                                    Contraseña Actual Registrada
                                </label>
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-white/10">
                                    <Lock size={14} className="text-slate-500 shrink-0 ml-1" />
                                    <span className="flex-1 font-mono text-xs font-bold text-slate-200 tracking-wider truncate">
                                        {selectedClient.sriPassword ? (
                                            showCurrentPass ? selectedClient.sriPassword : '••••••••••••'
                                        ) : (
                                            <span className="text-slate-500 italic font-normal">Sin clave registrada</span>
                                        )}
                                    </span>
                                    {selectedClient.sriPassword && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPass(!showCurrentPass)}
                                                className="p-1 rounded text-slate-400 hover:text-white"
                                                title={showCurrentPass ? 'Ocultar' : 'Mostrar'}
                                            >
                                                {showCurrentPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(selectedClient.sriPassword || '', 'oldPass')}
                                                className="p-1 rounded text-slate-400 hover:text-amber-400"
                                                title="Copiar Clave Actual"
                                            >
                                                {copiedField === 'oldPass' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* New Password / Transformer Section */}
                            <div className="space-y-2 p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                                        <Sparkles size={12} />
                                        <span>Nueva Contraseña Propuesta</span>
                                    </label>
                                    
                                    {/* Action Chips */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handleApplyRotationRule}
                                            className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold font-mono transition-all"
                                            title="Reemplaza * con @ (o agrega @ al final)"
                                        >
                                            ⚡ Rotar (* ➔ @)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGenerateRandomPass}
                                            className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold font-mono transition-all"
                                            title="Generar contraseña segura aleatoria"
                                        >
                                            🎲 Aleatoria
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 focus-within:border-amber-400">
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={newPasswordValue}
                                        onChange={(e) => setNewPasswordValue(e.target.value)}
                                        placeholder="Ingresa o edita la nueva clave..."
                                        className="flex-1 bg-transparent border-0 outline-none font-mono text-xs font-bold text-amber-300 placeholder-slate-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        className="p-1 rounded text-slate-400 hover:text-white"
                                        title={showNewPass ? 'Ocultar' : 'Mostrar'}
                                    >
                                        {showNewPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(newPasswordValue, 'newPass')}
                                        className="p-1 rounded text-slate-400 hover:text-amber-400"
                                        title="Copiar Nueva Clave"
                                    >
                                        {copiedField === 'newPass' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>

                            {/* Primary Action Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSavePassword}
                                    disabled={isSaving || !newPasswordValue.trim()}
                                    className="py-3 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider font-mono shadow-md shadow-[#00A896]/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                >
                                    <Check size={14} />
                                    <span>Guardar en Sistema</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleOpenSriPortal}
                                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-xs font-black uppercase tracking-wider font-mono shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                                    title="Copia la nueva clave y abre el portal SRI en línea"
                                >
                                    <ExternalLink size={14} />
                                    <span>Copiar & Abrir SRI</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODE 2: DIRECTORY SEARCH LIST */}
                    {activeTab === 'directory' && (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente o RUC..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                                    autoFocus
                                />
                            </div>

                            <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-slate-950/40 max-h-[50vh] overflow-y-auto">
                                {filteredClients.map(c => {
                                    const hasPass = !!c.sriPassword;
                                    const isSelected = selectedClient?.id === c.id;

                                    return (
                                        <div 
                                            key={c.id}
                                            onClick={() => handleSelectClient(c)}
                                            className={`p-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                                                isSelected ? 'bg-amber-500/5 border-l-2 border-amber-500' : ''
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-xs text-white uppercase truncate group-hover:text-amber-300 transition-colors">
                                                    {c.tradeName || c.name}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                    RUC: {c.ruc} • {c.taxProfile?.ivaFrequency || 'Mensual'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                                    hasPass ? 'bg-slate-900 text-slate-300 border border-white/10' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                    {hasPass ? c.sriPassword : 'Sin Clave'}
                                                </span>
                                                <ChevronRight size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* MODE 3: CSV IMPORT AUDIT */}
                    {activeTab === 'csv' && propuesta && (
                        <div className="space-y-4 p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/30">
                            <div>
                                <h4 className="text-sm font-black text-amber-200 flex items-center gap-2">
                                    <FileText size={16} />
                                    <span>Auditoría de Claves Chrome ({propuesta.leidas} leídas)</span>
                                </h4>
                                <p className="text-xs text-slate-300 mt-1">
                                    Se identificaron <strong>{propuesta.cambian.length} clientes</strong> con credencial a actualizar en Supabase.
                                </p>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-white/5">
                                {propuesta.cambian.map(c => (
                                    <div key={c.id} className="pt-1.5 flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-200 truncate">{c.name}</span>
                                        <span className="font-mono text-[10px] text-amber-400 shrink-0 ml-2">{c.ruc}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                                <button
                                    type="button"
                                    onClick={aplicarPropuestaCsv}
                                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Confirmar y Aplicar ({propuesta.cambian.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setPropuesta(null); setActiveTab('focus'); }}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Micro-Status */}
                <div className="px-5 py-2.5 bg-slate-950 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Nueva Luz 3.0 • Bridge Automático</span>
                    <span>SRI Ecuador 2026</span>
                </div>
            </div>
        </div>
    );
};
