import React, { useMemo, useRef, useState, useEffect } from 'react';
import { BakuEstadoPanel } from '../components/features/BakuEstadoPanel';
import {
    Bot, Send, Key, CheckCircle2, Copy, ExternalLink,
    RefreshCw, Search, Eye, EyeOff, Save, Sparkles, Layers,
    Terminal, Users, AlertCircle, FileText, Check, AlertTriangle,
    Plus, Trash2, Sliders,
    Edit3, X, Activity
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { cargarBotonesBaku, guardarBotonesBaku, motivoDeSupabase } from '../services/botWebConfig';

interface TelegramBotScreenProps {
    navigate: (screen: any, options?: any) => void;
    theme?: 'light' | 'dark';
}

type TabType = 'estado' | 'mapa' | 'claves' | 'incompletos' | 'auditoria';

export interface CustomBotButton {
    id: string;
    label: string;
    action: string;
    category: 'Tributario' | 'Cobranzas' | 'Gestión' | 'Accesos' | 'Personalizado';
    isActive: boolean;
}

export const DEFAULT_CUSTOM_BUTTONS: CustomBotButton[] = [
    { id: 'btn_1', label: '🔑 Resolver Clave', action: '/claves', category: 'Accesos', isActive: true },
    { id: 'btn_2', label: '💰 Deudores & Cobro', action: '/cobranza', category: 'Cobranzas', isActive: true },
    { id: 'btn_3', label: '📊 Resumen Financiero', action: '/reporte', category: 'Gestión', isActive: true },
    { id: 'btn_4', label: '📅 Vencimientos SRI', action: '/vencimientos', category: 'Tributario', isActive: true },
    { id: 'btn_5', label: '🧾 Bajar Comprobantes', action: '/comprobantes', category: 'Tributario', isActive: true },
];

// Los comandos que Baku publica. Mantener igual que telegram-bot/src/comandos.ts.
export const BAKU_COMMANDS = [
    '/menu', '/cierre', '/cobranza', '/lunes', '/vencimientos', '/claves', '/comprobantes', '/firmas',
    '/gestion', '/reporte', '/resumen', '/facturar', '/facturadores', '/credenciales',
    '/llenado', '/renovaciones', '/status', '/clear',
];

/** Un comando (empieza con "/") que Baku no tiene. Un pedido en palabras nunca es desconocido. */
const accionDesconocida = (action: string): boolean => {
    const a = action.trim();
    return a.startsWith('/') && !BAKU_COMMANDS.includes(a.split(/\s+/)[0].toLowerCase());
};

export const TelegramBotScreen: React.FC<TelegramBotScreenProps> = ({ navigate, theme = 'dark' }) => {
    const { clients, updateClient } = useAppStore();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<TabType>('estado');
    const [searchTerm, setSearchTerm] = useState('');
    // 🚫 Chrome/gestores de contraseñas rellenaban este buscador con el correo
    // del admin (autofill) y el filtro no encontraba nada. Se fuerza a vacío.
    const busquedaRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const limpiar = () => {
            const el = busquedaRef.current;
            if (el && /@/.test(el.value)) {
                el.value = '';
                setSearchTerm('');
            }
        };
        limpiar();
        const t1 = window.setTimeout(limpiar, 350);
        const t2 = window.setTimeout(limpiar, 1200);
        return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    }, []);
    const [filterKeyStatus, setFilterKeyStatus] = useState<'all' | 'missing' | 'short' | 'ok'>('missing');
    const [editingPasswords, setEditingPasswords] = useState<{ [id: string]: string }>({});
    const [showPassword, setShowPassword] = useState<{ [id: string]: boolean }>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // Auditoría & Simulador State

    // Custom Buttons State with LocalStorage
    const [customButtons, setCustomButtons] = useState<CustomBotButton[]>(() => {
        try {
            const saved = localStorage.getItem('baku_custom_buttons');
            return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_BUTTONS;
        } catch {
            return DEFAULT_CUSTOM_BUTTONS;
        }
    });

    const [newBtnLabel, setNewBtnLabel] = useState('');
    const [newBtnAction, setNewBtnAction] = useState('');
    const [newBtnCategory, setNewBtnCategory] = useState<'Tributario' | 'Cobranzas' | 'Gestión' | 'Accesos' | 'Personalizado'>('Tributario');
    const [showAddBtnModal, setShowAddBtnModal] = useState(false);

    // Los botones viven en Supabase (bot_web_config): es de donde los lee Baku.
    // localStorage queda sólo como copia para pintar al instante.
    const [syncEstado, setSyncEstado] = useState<{ tipo: 'cargando' | 'ok' | 'local'; detalle?: string }>({ tipo: 'cargando' });

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const remotos = await cargarBotonesBaku<CustomBotButton>();
                if (remotos) {
                    if (!vivo) return;
                    setCustomButtons(remotos);
                    localStorage.setItem('baku_custom_buttons', JSON.stringify(remotos));
                } else {
                    await guardarBotonesBaku(customButtons);
                }
                if (vivo) setSyncEstado({ tipo: 'ok' });
            } catch (e) {
                if (vivo) setSyncEstado({ tipo: 'local', detalle: motivoDeSupabase(e) });
            }
        })();
        return () => { vivo = false; };
    }, []);

    const persistButtons = async (updated: CustomBotButton[]) => {
        localStorage.setItem('baku_custom_buttons', JSON.stringify(updated));
        setCustomButtons(updated);
        try {
            await guardarBotonesBaku(updated);
            setSyncEstado({ tipo: 'ok' });
        } catch (e) {
            const detalle = motivoDeSupabase(e);
            setSyncEstado({ tipo: 'local', detalle });
            toast.warning(`Guardado sólo en este navegador: Baku no lo ve. ${detalle}`);
        }
    };

    // Active clients
    const activeClients = useMemo(() => {
        return clients.filter(c => !c.isDeleted && c.isActive);
    }, [clients]);

    // Missing or invalid key clients
    const clientsWithKeyIssues = useMemo(() => {
        return activeClients.filter(c => {
            const pass = (c.sriPassword || '').trim();
            if (!pass) return true;
            if (pass.length < 6) return true;
            const credState = c.taxProfile?.sriCredencial?.estado;
            if (credState === 'incorrecta' || credState === 'caducada' || credState === 'bloqueada') return true;
            return false;
        });
    }, [activeClients]);

    // Incomplete client profiles (missing phone or email or regime)
    const incompleteClients = useMemo(() => {
        return activeClients.filter(c => {
            const phone = c.phones?.[0] || '';
            const email = (c.email || '').trim();
            const regime = (c.regime || '').trim();
            return !phone || !email || !regime;
        });
    }, [activeClients]);

    // Filtered clients for the Claves table
    const displayedClients = useMemo(() => {
        let list = activeClients;

        if (filterKeyStatus === 'missing') {
            list = list.filter(c => !(c.sriPassword || '').trim());
        } else if (filterKeyStatus === 'short') {
            list = list.filter(c => {
                const p = (c.sriPassword || '').trim();
                return p.length > 0 && p.length < 6;
            });
        } else if (filterKeyStatus === 'ok') {
            list = list.filter(c => {
                const p = (c.sriPassword || '').trim();
                return p.length >= 6;
            });
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.ruc.includes(q)
            );
        }

        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [activeClients, filterKeyStatus, searchTerm]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(id);
        toast.info(`"${text}" copiado para pegar en Telegram`);
        setTimeout(() => setCopiedText(null), 2000);
    };

    const handleSavePassword = async (clientId: string, clientName: string) => {
        const newPass = editingPasswords[clientId];
        if (newPass === undefined) return;

        if (newPass.trim() && newPass.trim().length < 6) {
            toast.warning('El SRI exige un mínimo de 6 caracteres para contraseñas.');
            return;
        }

        setSavingId(clientId);
        try {
            await updateClient(clientId, {
                sriPassword: newPass.trim(),
                sriPasswordUpdatedAt: new Date().toISOString()
            });

            toast.success(`Clave SRI guardada en Supabase para ${clientName}`);

            setEditingPasswords(prev => {
                const next = { ...prev };
                delete next[clientId];
                return next;
            });
        } catch (e: any) {
            toast.error(e?.message || 'No se pudo actualizar la clave en la base de datos');
        } finally {
            setSavingId(null);
        }
    };

    const handleAddCustomButton = () => {
        if (!newBtnLabel.trim() || !newBtnAction.trim()) {
            toast.warning('Ingresa el texto del botón y su comando o acción');
            return;
        }
        if (accionDesconocida(newBtnAction)) {
            toast.warning(`Baku no tiene el comando ${newBtnAction.trim().split(/\s+/)[0]}. Elegí uno de la lista o escribí el pedido en palabras, sin la barra.`);
            return;
        }
        const newBtn: CustomBotButton = {
            id: `btn_${Date.now()}`,
            label: newBtnLabel.trim(),
            action: newBtnAction.trim(),
            category: newBtnCategory,
            isActive: true
        };
        const updated = [...customButtons, newBtn];
        persistButtons(updated);
        setNewBtnLabel('');
        setNewBtnAction('');
        setShowAddBtnModal(false);
        toast.success(`Botón "${newBtn.label}" agregado a las funciones de Baku`);
    };

    const handleDeleteCustomButton = (id: string) => {
        const updated = customButtons.filter(b => b.id !== id);
        persistButtons(updated);
        toast.info('Botón eliminado');
    };

    const handleToggleCustomButton = (id: string) => {
        const updated = customButtons.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b);
        persistButtons(updated);
    };


    return (
        <div className="min-h-screen bg-[#080B10] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/10 via-emerald-500/5 to-cyan-500/10 border border-blue-500/20 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium tracking-wide">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            BAKU TELEGRAM BOT V2.0 · LIVE SUPABASE SYNC
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-emerald-300 tracking-tight">
                            Gestión Interna del Bot de Telegram
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
                            Centro de mando operativo: audita comandos interactivos, resuelve claves SRI faltantes en caliente y coordina el asistente inteligente con la web.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href="https://t.me"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                        >
                            <Send size={16} />
                            Abrir Bot en Telegram
                            <ExternalLink size={14} className="opacity-70" />
                        </a>
                        <button
                            onClick={() => {
                                toast.info('Datos en caliente sincronizados con Supabase y el Bot');
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-sm transition-all"
                        >
                            <RefreshCw size={15} />
                            Refrescar Estado
                        </button>
                    </div>
                </div>

                {/* KPI Quick Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/60">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-xs text-slate-400 font-medium">Clientes Totales</div>
                        <div className="text-2xl font-black text-white mt-1">{activeClients.length}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">En cartera activa</div>
                    </div>
                    <div
                        onClick={() => { setActiveTab('claves'); setFilterKeyStatus('missing'); }}
                        className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all"
                    >
                        <div className="text-xs text-amber-400 font-medium flex items-center justify-between">
                            <span>Sin Clave SRI</span>
                            <AlertTriangle size={13} />
                        </div>
                        <div className="text-2xl font-black text-amber-300 mt-1">{clientsWithKeyIssues.length}</div>
                        <div className="text-[11px] text-amber-400/70 mt-0.5">Requieren resolución</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('incompletos')}
                        className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all"
                    >
                        <div className="text-xs text-purple-400 font-medium flex items-center justify-between">
                            <span>Expedientes Incompletos</span>
                            <Users size={13} />
                        </div>
                        <div className="text-2xl font-black text-purple-300 mt-1">{incompleteClients.length}</div>
                        <div className="text-[11px] text-purple-400/70 mt-0.5">Sin teléfono/email</div>
                    </div>
                    <div
                        onClick={() => setActiveTab('auditoria')}
                        className="p-3 rounded-xl bg-[#2B6AFF]/5 border border-[#2B6AFF]/20 hover:border-[#2B6AFF]/40 cursor-pointer transition-all"
                    >
                        <div className="text-xs text-[#7ea2ff] font-medium flex items-center justify-between">
                            <span>Botones de /menu</span>
                            <Sliders size={13} />
                        </div>
                        <div className="text-sm font-bold text-white mt-2">
                            {customButtons.filter(b => b.isActive).length} activos
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">Hasta 6 en Telegram</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('estado')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'estado'
                            ? 'border-[#04B17B] text-[#04B17B] bg-[#04B17B]/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Activity size={16} />
                    Estado de Baku
                </button>
                <button
                    onClick={() => setActiveTab('claves')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'claves'
                            ? 'border-blue-400 text-blue-400 bg-blue-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Key size={16} />
                    Asignador de Claves SRI ({clientsWithKeyIssues.length})
                </button>
                <button
                    onClick={() => setActiveTab('auditoria')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'auditoria'
                            ? 'border-blue-400 text-blue-300 bg-blue-500/10 shadow-lg shadow-blue-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Sliders size={16} className="text-blue-400" />
                    Botones de /menu
                </button>
                <button
                    onClick={() => setActiveTab('mapa')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'mapa'
                            ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Layers size={16} />
                    Mapa Visual de Funciones &amp; Comandos
                </button>
                <button
                    onClick={() => setActiveTab('incompletos')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'incompletos'
                            ? 'border-purple-400 text-purple-400 bg-purple-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Users size={16} />
                    Expedientes por Completar ({incompleteClients.length})
                </button>
            </div>

            {/* TAB 1: ASIGNADOR DE CLAVES */}
            {activeTab === 'estado' && <BakuEstadoPanel />}

            {activeTab === 'claves' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                ref={busquedaRef}
                                type="search"
                                name="buscar-cliente-telegram"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                inputMode="search"
                                data-lpignore="true"
                                data-1p-ignore
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o RUC (ej: Murillo, 2026071315102)..."
                                className="w-full pl-10 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-all"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchTerm(''); busquedaRef.current?.focus(); }}
                                    aria-label="Limpiar búsqueda"
                                    title="Limpiar búsqueda"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterKeyStatus('missing')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'missing'
                                        ? 'bg-blue-500 text-slate-950 font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                ⚠️ Faltan Claves ({clientsWithKeyIssues.length})
                            </button>
                            <button
                                onClick={() => setFilterKeyStatus('short')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'short'
                                        ? 'bg-blue-500 text-slate-950 font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                🔴 Cortas (&lt; 6)
                            </button>
                            <button
                                onClick={() => setFilterKeyStatus('ok')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'ok'
                                        ? 'bg-emerald-500 text-slate-950 font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                🟢 Con Clave
                            </button>
                            <button
                                onClick={() => setFilterKeyStatus('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'all'
                                        ? 'bg-slate-600 text-white font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                Todos
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3.5 px-4 font-semibold">Contribuyente / RUC</th>
                                        <th className="py-3.5 px-4 font-semibold">Estado SRI</th>
                                        <th className="py-3.5 px-4 font-semibold">Clave SRI (Editar en Caliente)</th>
                                        <th className="py-3.5 px-4 font-semibold">Atajo Telegram</th>
                                        <th className="py-3.5 px-4 font-semibold text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {displayedClients.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500">
                                                No se encontraron clientes bajo este filtro.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedClients.map(client => {
                                            const isEditing = editingPasswords[client.id] !== undefined;
                                            const currentVal = isEditing ? editingPasswords[client.id] : (client.sriPassword || '');
                                            const phone = client.phones?.[0];

                                            return (
                                                <tr
                                                    key={client.id}
                                                    className="hover:bg-slate-800/30 transition-colors"
                                                >
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-white flex items-center gap-2">
                                                            {client.name}
                                                        </div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                                            <span>RUC: {client.ruc}</span>
                                                            {phone && <span>· 📱 {phone}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {!client.sriPassword ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                                <AlertCircle size={12} />
                                                                Falta Clave
                                                            </span>
                                                        ) : client.sriPassword.length < 6 ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                <AlertTriangle size={12} />
                                                                Corta (&lt;6)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <CheckCircle2 size={12} />
                                                                Configurada
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-2 max-w-xs">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type={showPassword[client.id] ? 'text' : 'password'}
                                                                    value={currentVal}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setEditingPasswords(prev => ({
                                                                            ...prev,
                                                                            [client.id]: val
                                                                        }));
                                                                    }}
                                                                    placeholder="Escribe la clave SRI..."
                                                                    className="w-full px-3 py-1.5 pr-8 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white focus:outline-none focus:border-amber-400 transition-all"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowPassword(p => ({ ...p, [client.id]: !p[client.id] }))}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                                                >
                                                                    {showPassword[client.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <button
                                                            onClick={() => handleCopy(`pon clave a ${client.name.split(' ')[0]} MiClave2026`, client.id)}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-all"
                                                            title="Copiar comando listo para enviar en Telegram"
                                                        >
                                                            {copiedText === client.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                            pon clave a {client.name.split(' ')[0]}...
                                                        </button>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <button
                                                            onClick={() => handleSavePassword(client.id, client.name)}
                                                            disabled={!isEditing || savingId === client.id}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                isEditing
                                                                    ? 'bg-blue-500 hover:bg-blue-400 text-slate-950 shadow-md active:scale-95'
                                                                    : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                                                            }`}
                                                        >
                                                            {savingId === client.id ? (
                                                                <RefreshCw size={13} className="animate-spin" />
                                                            ) : (
                                                                <Save size={13} />
                                                            )}
                                                            Guardar en Supabase
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MAPA VISUAL DE FUNCIONES & COMANDOS */}
            {activeTab === 'mapa' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Tarjeta 1: Gestión Interna */}
                        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition-all space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Bot size={22} />
                                </span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                    /gestion
                                </span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Hub de Gestión Interna</h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Consola interactiva con teclado en línea: audita credenciales SRI, expedientes vacíos y deudas sin salir del chat.
                                </p>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                                <div>• Botón 🔑 Auditoría Claves</div>
                                <div>• Botón 🔏 Firmas por Vencer</div>
                                <div>• Botón 📋 Expedientes Vacíos</div>
                                <div>• Botón 💰 Cobros &amp; Cartera</div>
                            </div>
                            <button
                                onClick={() => handleCopy('/gestion', 'cmd_gestion')}
                                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            >
                                {copiedText === 'cmd_gestion' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                Copiar comando /gestion
                            </button>
                        </div>

                        {/* Tarjeta 2: Reporte Operativo */}
                        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    <FileText size={22} />
                                </span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                    /reporte
                                </span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Reporte Operativo con Acciones</h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Transforma el informe pasivo en activo: cada reporte adjunta botones directos para resolver pendientes al instante.
                                </p>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                                <div>• [ 🔑 Resolver Claves SRI ]</div>
                                <div>• [ 💰 Deudores &amp; Mora ]</div>
                                <div>• [ ⏰ Ver Vencimientos ]</div>
                                <div>• [ 🧰 Gestión Interna ]</div>
                            </div>
                            <button
                                onClick={() => handleCopy('/reporte', 'cmd_reporte')}
                                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            >
                                {copiedText === 'cmd_reporte' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                Copiar comando /reporte
                            </button>
                        </div>

                        {/* Tarjeta 3: Atajos Lenguaje Natural */}
                        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Terminal size={22} />
                                </span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                                    MODO PRO
                                </span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Lenguaje Natural Ultra-Flexible</h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    El bot ahora limpia prefijos conversacionales y no falla con nombres que lleven signos de puntuación (caso Murillo).
                                </p>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                                <div>• pon clave a murillo 123456</div>
                                <div>• clave murillo: MiClave.99</div>
                                <div>• actualiza clave de chavez a ...</div>
                                <div>• deudores / vencimientos</div>
                            </div>
                            <button
                                onClick={() => handleCopy('pon clave a murillo MiClave2026', 'cmd_murillo')}
                                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            >
                                {copiedText === 'cmd_murillo' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                Copiar ejemplo de Murillo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: REPORTE OPERATIVO EN VIVO */}

            {/* TAB 4: EXPEDIENTES POR COMPLETAR */}
            {activeTab === 'incompletos' && (
                <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white text-sm">Clientes con Expedientes Incompletos</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Clientes a los que les falta teléfono WhatsApp, email o régimen tributario para notificaciones automáticas:
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('clients')}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
                        >
                            Ir al Directorio Completo
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Contribuyente</th>
                                    <th className="py-3 px-4">RUC</th>
                                    <th className="py-3 px-4">Falta Teléfono</th>
                                    <th className="py-3 px-4">Falta Email</th>
                                    <th className="py-3 px-4">Falta Régimen</th>
                                    <th className="py-3 px-4 text-right">Expediente</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {incompleteClients.slice(0, 30).map(c => {
                                    const phone = c.phones?.[0];
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                                            <td className="py-3 px-4 font-mono text-xs text-slate-400">{c.ruc}</td>
                                            <td className="py-3 px-4">
                                                {!phone ? (
                                                    <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                                                        <AlertCircle size={12} /> Sin Celular
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-emerald-400 font-mono">{phone}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {!c.email ? (
                                                    <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                                                        <AlertCircle size={12} /> Sin Correo
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300 truncate max-w-[150px] inline-block">{c.email}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {!c.regime ? (
                                                    <span className="text-xs text-amber-400 font-semibold">Sin Régimen</span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">{c.regime}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => navigate('clients', { clientToView: c })}
                                                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                                                >
                                                    Ver Perfil
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

            {/* TAB 5: AUDITORÍA & SIMULADOR IA DE RESPUESTAS (REGLAS Y BOTONES) */}
            {activeTab === 'auditoria' && (
                <div className="space-y-6">
                    {/* SECCIÓN: PERSONALIZADOR DE FUNCIONES & BOTONES DEL BOT */}
                    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium">
                                    <Sliders size={13} />
                                    EXPANDIR CAPACIDADES DE BAKU
                                </div>
                                <h3 className="text-lg font-black text-white mt-1">
                                    Personalizador de Funciones &amp; Botones Rápidos
                                </h3>
                                <p className="text-xs text-slate-400 max-w-2xl mt-0.5 leading-relaxed">
                                    Los botones activos aparecen al final de <span className="font-mono text-cyan-300">/menu</span> en Telegram (hasta 6). Un comando lo ejecuta; un texto sin barra se lo pide a Baku como si lo escribieras.
                                </p>
                                <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium ${
                                    syncEstado.tipo === 'ok' ? 'text-emerald-400' : syncEstado.tipo === 'local' ? 'text-amber-300' : 'text-slate-500'
                                }`}>
                                    {syncEstado.tipo === 'cargando' && (<><RefreshCw size={12} className="animate-spin" /> Leyendo lo que tiene Baku…</>)}
                                    {syncEstado.tipo === 'ok' && (<><CheckCircle2 size={12} /> Sincronizado con Baku</>)}
                                    {syncEstado.tipo === 'local' && (<><AlertTriangle size={12} className="shrink-0" /> Sólo en este navegador, Baku no los ve. {syncEstado.detalle}</>)}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowAddBtnModal(!showAddBtnModal)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all shrink-0 active:scale-95"
                            >
                                <Plus size={16} />
                                {showAddBtnModal ? 'Cerrar Formulario' : '➕ Crear Nuevo Botón'}
                            </button>
                        </div>

                        {/* Formulario Desplegable para Agregar Nuevo Botón */}
                        {showAddBtnModal && (
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5">
                                    <Edit3 size={13} /> Configurar Nuevo Botón Interactivo
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-400">Texto del Botón (con Emoji):</label>
                                        <input
                                            type="text"
                                            value={newBtnLabel}
                                            onChange={(e) => setNewBtnLabel(e.target.value)}
                                            placeholder="Ej: 🧾 Factura Rápida"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-400">Comando o Acción:</label>
                                        <input
                                            type="text"
                                            value={newBtnAction}
                                            onChange={(e) => setNewBtnAction(e.target.value)}
                                            list="baku-commands"
                                            placeholder="Ej: /cobranza o deudores de más de $50"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                                        />
                                        <datalist id="baku-commands">
                                            {BAKU_COMMANDS.map(c => <option key={c} value={c} />)}
                                        </datalist>
                                        {accionDesconocida(newBtnAction) && (
                                            <p className="text-[10px] text-amber-300">Baku no tiene ese comando. Elegí uno de la lista o escribilo en palabras, sin la barra.</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-400">Categoría:</label>
                                        <select
                                            value={newBtnCategory}
                                            onChange={(e) => setNewBtnCategory(e.target.value as any)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                                        >
                                            <option value="Tributario">Tributario</option>
                                            <option value="Cobranzas">Cobranzas</option>
                                            <option value="Gestión">Gestión</option>
                                            <option value="Accesos">Accesos</option>
                                            <option value="Personalizado">Personalizado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setShowAddBtnModal(false)}
                                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddCustomButton}
                                        className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow"
                                    >
                                        Guardar Botón
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Grilla de Botones Existentes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {customButtons.map((btn) => (
                                <div
                                    key={btn.id}
                                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                        btn.isActive
                                            ? 'bg-slate-950/80 border-slate-700/80 hover:border-blue-500/40'
                                            : 'bg-slate-950/40 border-slate-800/40 opacity-50'
                                    }`}
                                >
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                            {btn.label}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span className="font-mono text-cyan-400 truncate max-w-[120px]">
                                                {btn.action}
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                                {btn.category}
                                            </span>
                                            {accionDesconocida(btn.action) && (
                                                <span className="px-1.5 rounded bg-amber-500/15 text-amber-300 shrink-0" title="Baku no tiene este comando: el botón no va a funcionar en Telegram">
                                                    ⚠ no existe en Baku
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => handleToggleCustomButton(btn.id)}
                                            title={btn.isActive ? 'Desactivar' : 'Activar'}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                btn.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                                            }`}
                                        >
                                            <Check size={13} />
                                        </button>
                                        {btn.id.startsWith('btn_') && !DEFAULT_CUSTOM_BUTTONS.some(d => d.id === btn.id) && (
                                            <button
                                                onClick={() => handleDeleteCustomButton(btn.id)}
                                                title="Eliminar botón"
                                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TARJETA INFORMATIVA: REGLA DE ORO DE COMUNICACIÓN BAKU (SECCIÓN 13 DE AGENTS.MD) */}
                    <div className="rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-blue-950/20 border border-blue-500/30 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-blue-400" />
                            <h4 className="font-bold text-blue-300 text-xs sm:text-sm uppercase tracking-wide">
                                Regla de Oro Activa en Memoria del Sistema (.agents/AGENTS.md §13)
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                                <div className="font-bold text-white mb-1">1. Cero Saludos Vacíos</div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    Prohibido arrancar con "Hola Santiago...". Comenzar inmediatamente con el dato clave, deuda o resultado solicitado.
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                                <div className="font-bold text-white mb-1">2. Código Monoespaciado</div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    RUCs, claves y números siempre en formato <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">`código`</code> para copiado con 1 toque en el móvil.
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                                <div className="font-bold text-white mb-1">3. Teclados de 1-Toque</div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    Toda respuesta debe terminar con botones interactivos que anticipen los siguientes pasos lógicos (cobro, clave, reporte).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
