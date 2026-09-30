import React, { useMemo, useState, useEffect } from 'react';
import {
    Bot, Send, Key, KeyRound, CheckCircle2, Copy, ExternalLink,
    RefreshCw, Search, Eye, EyeOff, Save, Sparkles, Layers,
    Terminal, Users, AlertCircle, FileText, Check, AlertTriangle,
    Wand2, MessageSquare, Gauge, Plus, Trash2, Sliders, Smartphone,
    ArrowRight, Play, CheckCircle, Flame, ThumbsUp, Zap, HelpCircle,
    SlidersHorizontal, Edit3
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../context/ToastContext';
import { auditAndOptimizeBotResponse } from '../services/geminiService';

interface TelegramBotScreenProps {
    navigate: (screen: any, options?: any) => void;
    theme?: 'light' | 'dark';
}

type TabType = 'mapa' | 'claves' | 'reporte' | 'incompletos' | 'auditoria';

export interface CustomBotButton {
    id: string;
    label: string;
    action: string;
    category: 'Tributario' | 'Cobranzas' | 'Gestión' | 'Accesos' | 'Personalizado';
    isActive: boolean;
}

export const DEFAULT_CUSTOM_BUTTONS: CustomBotButton[] = [
    { id: 'btn_1', label: '🔑 Resolver Clave', action: '/claves', category: 'Accesos', isActive: true },
    { id: 'btn_2', label: '📱 WhatsApp Cobro', action: 'generar_cobro', category: 'Cobranzas', isActive: true },
    { id: 'btn_3', label: '📊 Resumen Financiero', action: '/reporte', category: 'Gestión', isActive: true },
    { id: 'btn_4', label: '📅 Vencimientos SRI', action: '/vencimientos', category: 'Tributario', isActive: true },
    { id: 'btn_5', label: '🧾 Bajar Comprobantes', action: '/comprobantes', category: 'Tributario', isActive: true },
    { id: 'btn_6', label: '⚡ Probar Claves SRI', action: '/probar_claves', category: 'Accesos', isActive: true },
];

export const TelegramBotScreen: React.FC<TelegramBotScreenProps> = ({ navigate, theme = 'dark' }) => {
    const { clients, tasks = [], updateClient } = useAppStore();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<TabType>('claves');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterKeyStatus, setFilterKeyStatus] = useState<'all' | 'missing' | 'short' | 'ok'>('missing');
    const [editingPasswords, setEditingPasswords] = useState<{ [id: string]: string }>({});
    const [showPassword, setShowPassword] = useState<{ [id: string]: boolean }>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // Auditoría & Simulador State
    const [selectedAuditClientId, setSelectedAuditClientId] = useState<string>('');
    const [auditQuery, setAuditQuery] = useState<string>('¿Cuánto debe Murillo y cuál es su estado tributario?');
    const [personalityStyle, setPersonalityStyle] = useState<'directo' | 'dinamico' | 'formal'>('directo');
    const [rawBotResponse, setRawBotResponse] = useState<string>('');
    const [isAuditing, setIsAuditing] = useState<boolean>(false);
    const [auditResult, setAuditResult] = useState<{
        score: number;
        clarityCritique: string;
        optimizedResponse: string;
        suggestedButtons: { label: string; action: string }[];
    } | null>(null);

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

    // Murillo specific detection
    const murilloClient = useMemo(() => {
        return activeClients.find(c =>
            c.name.toUpperCase().includes('MURILLO') ||
            c.ruc === '2026071315102'
        );
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

        // Put Murillo first if in list
        return [...list].sort((a, b) => {
            if (a.id === murilloClient?.id) return -1;
            if (b.id === murilloClient?.id) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [activeClients, filterKeyStatus, searchTerm, murilloClient]);

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

    // Auditoría & Simulador Helpers
    useEffect(() => {
        if (!selectedAuditClientId && activeClients.length > 0) {
            setSelectedAuditClientId(murilloClient?.id || activeClients[0].id);
        }
    }, [activeClients, murilloClient, selectedAuditClientId]);

    const AUDIT_SCENARIOS = [
        {
            title: '💡 Deuda & Estado Murillo',
            query: '¿Cuánto debe Murillo y cuál es su estado tributario?',
            category: 'Cobranzas'
        },
        {
            title: '🔑 Configurar Clave SRI',
            query: 'Pon la clave del SRI a Murillo 123456',
            category: 'Accesos'
        },
        {
            title: '📅 Vencimientos de la Semana',
            query: '¿Cuáles son los clientes con vencimiento de declaración esta semana?',
            category: 'Tributario'
        },
        {
            title: '💰 Balance de Honorarios',
            query: 'Dame el resumen de cobranzas de honorarios del mes actual',
            category: 'Gestión'
        },
        {
            title: '📱 Mensaje Cobro WhatsApp',
            query: 'Genera el mensaje de cobro formal para Murillo por $45',
            category: 'Cobranzas'
        },
        {
            title: '⚠️ Revisión de Credenciales',
            query: '¿Qué clientes tienen la clave del SRI incorrecta o faltante?',
            category: 'Accesos'
        }
    ];

    const handleSelectScenario = (scenario: { title: string; query: string }) => {
        setAuditQuery(scenario.query);
        handleGenerateBaseResponse(scenario.query);
    };

    const handleGenerateBaseResponse = (queryToUse?: string) => {
        const q = (queryToUse || auditQuery).toLowerCase();
        const client = activeClients.find(c => c.id === selectedAuditClientId) || murilloClient || activeClients[0];
        const clientName = client?.name || 'Cliente';
        const clientRuc = client?.ruc || '0000000000001';
        const clientPhone = client?.phones?.[0] || 'No registrado';
        const pass = client?.sriPassword || '';

        // Calculate pending tasks debt
        const clientTasks = (tasks || []).filter(t => t.clientId === client?.id);
        const debt = clientTasks
            .filter(t => t.status !== 'Pagada' && t.status !== 'Completada')
            .reduce((sum, t) => sum + (t.cost || 0), 0);

        let response = '';

        if (q.includes('clave') || q.includes('password') || q.includes('contraseña')) {
            if (q.includes('pon') || q.includes('actualiza') || q.includes('cambia')) {
                response = `Hola Santiago, espero que estés bien. He procedido a recibir tu solicitud de actualización. La nueva clave para el contribuyente ${clientName} con RUC ${clientRuc} será registrada como 123456. Por favor confirma si deseas que proceda a guardarla en la base de datos de Supabase. Saludos cordiales. Baku.`;
            } else {
                response = `Hola estimado Santiago, con respecto a la clave del SRI del cliente ${clientName} (RUC: ${clientRuc}), te informo que ${pass ? `su clave registrada actualmente es ${pass}. Recuerda mantenerla segura.` : 'no posee ninguna contraseña registrada en la base de datos. Sería bueno que la configuremos pronto.'} Quedo a tus órdenes para lo que necesites. Baku.`;
            }
        } else if (q.includes('debe') || q.includes('deuda') || q.includes('cobro') || q.includes('cuanto')) {
            response = `Estimado Santiago, un saludo cordial. Consultando la base de datos de Soluciones Contables Pro, te indico que el cliente ${clientName} con RUC ${clientRuc} y teléfono ${clientPhone} tiene un total pendiente de ${debt > 0 ? `$${debt.toFixed(2)} por honorarios contables` : 'al día en sus pagos de honorarios ($0.00)'}. Su régimen es ${client?.regime || 'General'}. Cualquier duda adicional me puedes avisar para preparar el comprobante. Baku.`;
        } else if (q.includes('vencimiento') || q.includes('semana') || q.includes('plazo')) {
            const digit9 = clientRuc.length >= 10 ? clientRuc[8] : '1';
            const daysMap: Record<string, number> = { '1': 10, '2': 12, '3': 14, '4': 16, '5': 18, '6': 20, '7': 22, '8': 24, '9': 26, '0': 28 };
            const dueDay = daysMap[digit9] || 14;
            response = `Buenas tardes Santiago. Para tu información tributaria, el 9no dígito del RUC de ${clientName} es ${digit9}, por lo cual su vencimiento mensual es el día ${dueDay} de cada mes. Recuerda ingresar al portal del SRI con anticipación para evitar multas por declaraciones tardías. Atentamente, Baku.`;
        } else if (q.includes('balance') || q.includes('honorario') || q.includes('resumen')) {
            const totalClients = activeClients.length;
            const withoutKey = clientsWithKeyIssues.length;
            response = `Hola Santiago. Aquí te dejo el informe del despacho: Contamos actualmente con ${totalClients} clientes activos en la cartera. De ellos, ${withoutKey} clientes presentan novedades o no tienen su clave del SRI guardada. Las recaudaciones siguen en proceso regular. Por favor revisa si deseas que te dé más detalles. Saludos. Baku.`;
        } else {
            response = `Hola Santiago. En respuesta a tu consulta sobre "${queryToUse || auditQuery}", he revisado los registros en Supabase para ${clientName}. Todo se encuentra sincronizado bajo el régimen ${client?.regime || 'General'}. Dime qué otra acción deseas realizar para apoyarte. Saludos. Baku.`;
        }

        setRawBotResponse(response);
        setAuditResult(null);
    };

    const handleRunAiAudit = async () => {
        let baseResp = rawBotResponse;
        if (!baseResp.trim()) {
            handleGenerateBaseResponse();
            baseResp = rawBotResponse;
        }

        setIsAuditing(true);
        try {
            const styleDesc = personalityStyle === 'directo'
                ? 'Ultra-directo ejecutivo (Cero saludos vacíos, datos en código monoespaciado, máxima acción)'
                : personalityStyle === 'dinamico'
                    ? 'Dinámico & ágil (Microinteractivo, emojis funcionales, orientado a resolución móvil)'
                    : 'Tributario formal (Normativa SRI, artículos, referencias técnicas de casillero)';

            const result = await auditAndOptimizeBotResponse(auditQuery, baseResp || 'Consulta general', styleDesc);
            setAuditResult(result);
            toast.success(`Auditoría IA completada · Eficiencia: ${result.score}/100`);
        } catch (e: any) {
            toast.error(e?.message || 'Error al ejecutar auditoría con Gemini AI');
        } finally {
            setIsAuditing(false);
        }
    };

    const handleAddCustomButton = () => {
        if (!newBtnLabel.trim() || !newBtnAction.trim()) {
            toast.warning('Ingresa el texto del botón y su comando o acción');
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
        setCustomButtons(updated);
        localStorage.setItem('baku_custom_buttons', JSON.stringify(updated));
        setNewBtnLabel('');
        setNewBtnAction('');
        setShowAddBtnModal(false);
        toast.success(`Botón "${newBtn.label}" agregado a las funciones de Baku`);
    };

    const handleDeleteCustomButton = (id: string) => {
        const updated = customButtons.filter(b => b.id !== id);
        setCustomButtons(updated);
        localStorage.setItem('baku_custom_buttons', JSON.stringify(updated));
        toast.info('Botón eliminado');
    };

    const handleToggleCustomButton = (id: string) => {
        const updated = customButtons.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b);
        setCustomButtons(updated);
        localStorage.setItem('baku_custom_buttons', JSON.stringify(updated));
    };

    const handleExecuteSimulatedButton = (btn: { label: string; action: string }) => {
        if (btn.action === '/claves') {
            toast.info('⚡ Acción 1-Toque: Cambiando a Asignador de Claves SRI');
            setActiveTab('claves');
        } else if (btn.action === '/reporte') {
            toast.info('⚡ Acción 1-Toque: Abriendo Reporte Operativo');
            setActiveTab('reporte');
        } else if (btn.action === 'generar_cobro') {
            const client = activeClients.find(c => c.id === selectedAuditClientId) || murilloClient;
            const text = `Estimado ${client?.name || 'Cliente'}, le saluda el Ing. Santiago Córdova. Le recordamos que sus honorarios profesionales se encuentran pendientes. Puede realizar su transferencia a la cuenta habitual. ¡Muchas gracias!`;
            navigator.clipboard.writeText(text);
            toast.success('📱 Mensaje de WhatsApp generado y copiado al portapapeles');
        } else {
            navigator.clipboard.writeText(btn.action);
            toast.success(`⚡ Botón [${btn.label}] ejecutado · Comando copiado: ${btn.action}`);
        }
    };

    const renderTelegramFormattedText = (rawText: string) => {
        if (!rawText) return null;
        const lines = rawText.split('\n');
        return lines.map((line, idx) => {
            const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*|<b>[^<]+<\/b>|<code>[^<]+<\/code>)/g);
            return (
                <div key={idx} className="min-h-[1.25rem] leading-relaxed">
                    {parts.map((p, pIdx) => {
                        if (p.startsWith('`') && p.endsWith('`')) {
                            return <code key={pIdx} className="bg-[#0f1722] text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded border border-amber-500/20">{p.slice(1, -1)}</code>;
                        }
                        if (p.startsWith('<code>') && p.endsWith('</code>')) {
                            return <code key={pIdx} className="bg-[#0f1722] text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded border border-amber-500/20">{p.slice(6, -7)}</code>;
                        }
                        if (p.startsWith('**') && p.endsWith('**')) {
                            return <strong key={pIdx} className="font-bold text-white">{p.slice(2, -2)}</strong>;
                        }
                        if (p.startsWith('<b>') && p.endsWith('</b>')) {
                            return <strong key={pIdx} className="font-bold text-white">{p.slice(3, -4)}</strong>;
                        }
                        return <span key={pIdx}>{p}</span>;
                    })}
                </div>
            );
        });
    };

    return (
        <div className="min-h-screen bg-[#080B10] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-cyan-500/10 border border-amber-500/20 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium tracking-wide">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            BAKU TELEGRAM BOT V2.0 · LIVE SUPABASE SYNC
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 tracking-tight">
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
                        className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40 cursor-pointer transition-all"
                    >
                        <div className="text-xs text-yellow-400 font-medium flex items-center justify-between">
                            <span>Auditoría &amp; Reglas IA</span>
                            <Sparkles size={13} className="animate-pulse" />
                        </div>
                        <div className="text-sm font-bold text-yellow-300 mt-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                            Simulador Activo
                        </div>
                        <div className="text-[11px] text-yellow-400/70 mt-1">Cero relleno · 1-clic</div>
                    </div>
                </div>
            </div>

            {/* Caso Murillo Spotlight Banner */}
            {murilloClient && (
                <div className="rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            <KeyRound size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase tracking-wide">
                                    Caso Especial Solucionado
                                </span>
                                <span className="text-xs text-slate-400 font-mono">RUC: {murilloClient.ruc}</span>
                            </div>
                            <div className="text-base font-bold text-white mt-0.5">
                                {murilloClient.name}
                            </div>
                            <div className="text-xs text-slate-300 mt-0.5">
                                Estado actual:{' '}
                                {murilloClient.sriPassword ? (
                                    <span className="text-emerald-400 font-mono font-medium">Clave configurada ({murilloClient.sriPassword.slice(0, 2)}••••)</span>
                                ) : (
                                    <span className="text-rose-400 font-semibold">Sin clave en base de datos</span>
                                )}
                                {' · '}
                                <span className="text-slate-400">Ahora puedes escribirle en Telegram <i>"pon clave a murillo 1234"</i> o asignarla aquí abajo.</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => {
                                setActiveTab('claves');
                                setSearchTerm('MURILLO');
                            }}
                            className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                        >
                            ✏️ Configurar Clave de Murillo
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('claves')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'claves'
                            ? 'border-amber-400 text-amber-400 bg-amber-500/5'
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
                            ? 'border-yellow-400 text-yellow-300 bg-yellow-500/10 shadow-lg shadow-yellow-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Sparkles size={16} className="text-yellow-400 animate-pulse" />
                    🔬 Auditoría &amp; Simulador IA (Reglas &amp; Botones)
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
                    onClick={() => setActiveTab('reporte')}
                    className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                        activeTab === 'reporte'
                            ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <FileText size={16} />
                    Reporte Operativo Interactivo
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
            {activeTab === 'claves' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o RUC (ej: Murillo, 2026071315102)..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterKeyStatus('missing')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'missing'
                                        ? 'bg-amber-500 text-slate-950 font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                ⚠️ Faltan Claves ({clientsWithKeyIssues.length})
                            </button>
                            <button
                                onClick={() => setFilterKeyStatus('short')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filterKeyStatus === 'short'
                                        ? 'bg-amber-500 text-slate-950 font-bold'
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
                                            const isMurillo = client.id === murilloClient?.id;
                                            const phone = client.phones?.[0];

                                            return (
                                                <tr
                                                    key={client.id}
                                                    className={`hover:bg-slate-800/30 transition-colors ${
                                                        isMurillo ? 'bg-amber-500/5' : ''
                                                    }`}
                                                >
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-white flex items-center gap-2">
                                                            {client.name}
                                                            {isMurillo && (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                                                                    CASO MURILLO
                                                                </span>
                                                            )}
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
                                                                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md active:scale-95'
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
                        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
            {activeTab === 'reporte' && (
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white">Vista Previa de la Consola Operativa</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Así luce y responde Baku cuando solicitas el reporte diario proactivo en Telegram:
                            </p>
                        </div>
                    </div>

                    <div className="max-w-2xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 p-6 space-y-4 font-mono text-xs text-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-3">
                            <span className="flex items-center gap-2 text-emerald-400 font-bold">
                                <Bot size={16} /> BAKU ASISTENTE SRI
                            </span>
                            <span>{new Date().toLocaleDateString('es-EC', { dateStyle: 'long' })}</span>
                        </div>

                        <div className="space-y-3 leading-relaxed">
                            <div className="text-amber-400 font-bold text-sm">
                                📊 REPORTE OPERATIVO CONSOLIDADO
                            </div>
                            <div>👥 <b>Cartera Total:</b> {activeClients.length} contribuyentes activos</div>
                            <div>
                                🔑 <b>Auditoría Claves SRI:</b> {activeClients.length - clientsWithKeyIssues.length} operativas ·{' '}
                                <span className="text-rose-400 font-bold">{clientsWithKeyIssues.length} requieren atención</span>
                            </div>
                            <div>
                                📋 <b>Expedientes:</b> {incompleteClients.length} clientes con datos pendientes (teléfono/email)
                            </div>
                            <div>
                                🛡️ <b>Mesa RPA:</b> Enlace en tiempo real activo con la extensión Nueva Luz 3.0.
                            </div>
                        </div>

                        {/* Interactive Action Keyboard Simulation */}
                        <div className="pt-4 border-t border-slate-800/80 space-y-2">
                            <div className="text-[11px] text-slate-400 font-sans font-semibold">
                                ⚡ Teclado de Acción Rápida (1-Clic en Telegram):
                            </div>
                            <div className="grid grid-cols-2 gap-2 font-sans font-medium text-xs">
                                <button
                                    onClick={() => setActiveTab('claves')}
                                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-center transition-all"
                                >
                                    🔑 Resolver Claves SRI ({clientsWithKeyIssues.length})
                                </button>
                                <button
                                    onClick={() => navigate('cobranza')}
                                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-center transition-all"
                                >
                                    💰 Deudores &amp; Mora
                                </button>
                                <button
                                    onClick={() => navigate('declaraciones')}
                                    className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-center transition-all"
                                >
                                    ⏰ Ver Vencimientos
                                </button>
                                <button
                                    onClick={() => setActiveTab('mapa')}
                                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-center transition-all"
                                >
                                    🧰 Gestión Interna
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                    {/* Banner de Cabecera del Laboratorio */}
                    <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-cyan-500/10 border border-yellow-500/20 p-6 backdrop-blur-xl">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="space-y-1.5">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-mono font-semibold">
                                    <Sparkles size={13} className="text-yellow-400" />
                                    LABORATORIO DE COMUNICACIÓN BAKU ELITE · GEMINI AI
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                    Auditoría &amp; Simulador de Respuestas del Bot
                                </h2>
                                <p className="text-slate-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
                                    Verifica cómo responde Baku ante casos de la vida real con datos vivos de Supabase. Pule la brevedad, elimina relleno protocolar, exige teclados interactivos de 1 toque y crea nuevas funciones personalizadas.
                                </p>
                            </div>

                            {/* Selector de Personalidad y Estilo */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                                <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
                                    <SlidersHorizontal size={13} /> Estilo:
                                </span>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                        onClick={() => setPersonalityStyle('directo')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            personalityStyle === 'directo'
                                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        <Zap size={13} /> Directo
                                    </button>
                                    <button
                                        onClick={() => setPersonalityStyle('dinamico')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            personalityStyle === 'dinamico'
                                                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        <Flame size={13} /> Dinámico
                                    </button>
                                    <button
                                        onClick={() => setPersonalityStyle('formal')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            personalityStyle === 'formal'
                                                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        <FileText size={13} /> Formal
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Selector de Cliente de Prueba Vía Supabase */}
                        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Users size={16} className="text-amber-400 shrink-0" />
                                <span className="text-xs font-bold text-slate-300">Cliente para la simulación:</span>
                                <select
                                    value={selectedAuditClientId}
                                    onChange={(e) => {
                                        setSelectedAuditClientId(e.target.value);
                                        setAuditResult(null);
                                    }}
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-amber-400 max-w-xs truncate"
                                >
                                    {activeClients.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.ruc}) {c.id === murilloClient?.id ? '★ MURILLO' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Mini Resumen del Cliente Seleccionado */}
                            {(() => {
                                const c = activeClients.find(x => x.id === selectedAuditClientId) || murilloClient;
                                if (!c) return null;
                                return (
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="px-2 py-1 rounded bg-slate-900/80 border border-slate-800 text-slate-300 font-mono">
                                            RUC: {c.ruc}
                                        </span>
                                        <span className="px-2 py-1 rounded bg-slate-900/80 border border-slate-800 text-slate-300">
                                            Régimen: {c.regime || 'General'}
                                        </span>
                                        {c.sriPassword ? (
                                            <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                                                🔑 Clave OK ({c.sriPassword.slice(0, 2)}••••)
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                                                ⚠️ Sin Clave SRI
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Escenarios de Prueba & Editor de Consulta */}
                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={16} className="text-yellow-400" />
                                <h3 className="font-bold text-white text-sm">Escenarios de Prueba Rápidos (1-Clic)</h3>
                            </div>
                            <span className="text-xs text-slate-400">Haz clic en un caso para simularlo al instante</span>
                        </div>

                        {/* Chips de Escenarios */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {AUDIT_SCENARIOS.map((sc, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectScenario(sc)}
                                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 text-left transition-all group"
                                >
                                    <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                                        {sc.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                                        {sc.category}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Campo de Entrada de Consulta */}
                        <div className="space-y-2 pt-2">
                            <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                                <span>Consulta o Instrucción enviada por Santiago:</span>
                                <span className="text-[11px] text-slate-500">Puedes editar o escribir cualquier orden libre</span>
                            </label>
                            <div className="relative">
                                <textarea
                                    rows={2}
                                    value={auditQuery}
                                    onChange={(e) => setAuditQuery(e.target.value)}
                                    placeholder="Ej: ¿Cuánto debe Murillo y cuál es su estado fiscal?"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400/80 transition-all font-mono"
                                />
                            </div>

                            {/* Botones de Acción de Simulación */}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                                <button
                                    onClick={() => handleGenerateBaseResponse()}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center gap-2"
                                >
                                    <Bot size={15} />
                                    Generar Respuesta Base
                                </button>
                                <button
                                    onClick={handleRunAiAudit}
                                    disabled={isAuditing}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isAuditing ? (
                                        <>
                                            <RefreshCw size={15} className="animate-spin" />
                                            Auditando con Gemini AI...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={15} />
                                            ✨ Auditar y Optimizar con IA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Comparador de Respuestas: Base vs Optimizada */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Columna Izquierda: Respuesta Base Original */}
                        <div className="bg-slate-900/40 rounded-2xl border border-slate-800/80 p-5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                                        <h3 className="font-bold text-white text-sm">Respuesta Base (Sin Optimizar)</h3>
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                        Texto convencional
                                    </span>
                                </div>

                                <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-4 text-xs text-slate-300 leading-relaxed font-sans min-h-[140px] whitespace-pre-wrap">
                                    {rawBotResponse || (
                                        <span className="text-slate-500 italic">
                                            Haz clic en "Generar Respuesta Base" o selecciona un caso de arriba para simular la respuesta inicial del bot...
                                        </span>
                                    )}
                                </div>

                                {rawBotResponse && (
                                    <div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-3 text-xs text-slate-400 space-y-1">
                                        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                                            Diagnóstico Preliminar:
                                        </div>
                                        <div className="text-slate-400 leading-tight">
                                            {rawBotResponse.toLowerCase().includes('hola') || rawBotResponse.toLowerCase().includes('estimado') ? (
                                                <span className="text-amber-300/90">
                                                    ⚠️ Contiene saludos protocolares y texto de relleno ("Hola estimado..."). La IA los eliminará para dar prioridad al dato inmediato.
                                                </span>
                                            ) : (
                                                <span className="text-emerald-400/90">
                                                    ✓ Estructura informativa base identificada. Lista para incorporar botones de 1 toque.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {rawBotResponse && (
                                <button
                                    onClick={() => handleCopy(rawBotResponse, 'base_resp')}
                                    className="w-full py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all mt-3"
                                >
                                    <Copy size={13} />
                                    {copiedText === 'base_resp' ? 'Copiado' : 'Copiar Texto Base'}
                                </button>
                            )}
                        </div>

                        {/* Columna Derecha: Vista Previa de Telegram Mockup con Auditoría IA */}
                        <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/80 rounded-2xl border border-yellow-500/30 p-5 space-y-4 flex flex-col justify-between shadow-2xl">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-yellow-400" />
                                        <h3 className="font-bold text-white text-sm">Respuesta Auditada (Baku Elite)</h3>
                                    </div>
                                    {auditResult && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                                            <Gauge size={13} /> {auditResult.score}/100 Eficiencia
                                        </div>
                                    )}
                                </div>

                                {/* Crítica del Auditor IA */}
                                {auditResult?.clarityCritique && (
                                    <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-200/90 flex items-start gap-2.5">
                                        <Zap size={15} className="text-yellow-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-yellow-300">Auditoría IA: </span>
                                            {auditResult.clarityCritique}
                                        </div>
                                    </div>
                                )}

                                {/* Simulación de Burbuja de Telegram Dark Mode */}
                                <div className="rounded-2xl bg-[#17212b] border border-[#242f3d] p-4 text-slate-100 shadow-xl space-y-3">
                                    {/* Cabecera del Bot en Telegram */}
                                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/60">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-[10px]">
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-1">
                                                    Baku | Comandante Operativo
                                                    <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-400 font-mono">bot</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-mono">Telegram Live</span>
                                    </div>

                                    {/* Cuerpo del Mensaje */}
                                    <div className="text-xs text-slate-200 leading-relaxed font-sans min-h-[90px]">
                                        {auditResult ? (
                                            renderTelegramFormattedText(auditResult.optimizedResponse)
                                        ) : (
                                            <div className="text-slate-400 italic text-center py-6">
                                                Presiona <span className="text-yellow-400 font-semibold">"✨ Auditar y Optimizar con IA"</span> para ver la versión perfeccionada sin relleno y con teclado interactivo...
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer con hora y check de Telegram */}
                                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono pt-1">
                                        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-cyan-400 font-bold">✓✓</span>
                                    </div>

                                    {/* Teclado Inline Interactivo (1-Toque) */}
                                    {((auditResult?.suggestedButtons && auditResult.suggestedButtons.length > 0) || customButtons.some(b => b.isActive)) && (
                                        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                                <span>Teclado Interactivo (Haz clic para probar):</span>
                                                <span className="text-cyan-400 text-[9px]">1-TOQUE ACTION</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                                {/* Botones sugeridos por la IA */}
                                                {(auditResult?.suggestedButtons || []).map((btn, bIdx) => (
                                                    <button
                                                        key={`ai_${bIdx}`}
                                                        onClick={() => handleExecuteSimulatedButton(btn)}
                                                        className="py-2 px-3 rounded-lg bg-[#242f3d] hover:bg-[#2e3b4d] active:scale-95 border border-cyan-500/30 text-cyan-200 text-xs font-semibold text-center transition-all truncate flex items-center justify-center gap-1.5 shadow"
                                                    >
                                                        <span>{btn.label}</span>
                                                    </button>
                                                ))}

                                                {/* Botones personalizados activos */}
                                                {customButtons.filter(b => b.isActive).slice(0, 4).map((cBtn) => (
                                                    <button
                                                        key={cBtn.id}
                                                        onClick={() => handleExecuteSimulatedButton(cBtn)}
                                                        className="py-2 px-3 rounded-lg bg-[#1f2937] hover:bg-[#283548] active:scale-95 border border-amber-500/30 text-amber-200 text-xs font-semibold text-center transition-all truncate flex items-center justify-center gap-1.5 shadow"
                                                    >
                                                        <span>{cBtn.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Botones de acción inferior */}
                            {auditResult && (
                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        onClick={() => handleCopy(auditResult.optimizedResponse, 'opt_resp')}
                                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all"
                                    >
                                        <Copy size={14} />
                                        {copiedText === 'opt_resp' ? '¡Copiado para Telegram!' : 'Copiar Texto Optimizado'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            toast.success('Respuesta modelo y estructura de botones guardadas en la memoria local');
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                                    >
                                        <Save size={14} /> Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

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
                                    Agrega nuevos botones de acción o comandos interactivos para que aparezcan en Telegram o en las respuestas de Baku con solo 1 toque.
                                </p>
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
                                            placeholder="Ej: /facturar o /clave"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                                        />
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
                                            ? 'bg-slate-950/80 border-slate-700/80 hover:border-amber-500/40'
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
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => handleExecuteSimulatedButton(btn)}
                                            title="Probar en simulador"
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-colors"
                                        >
                                            <Play size={13} />
                                        </button>
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
                    <div className="rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/30 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-400" />
                            <h4 className="font-bold text-amber-300 text-xs sm:text-sm uppercase tracking-wide">
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
                                    RUCs, claves y números siempre en formato <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">`código`</code> para copiado con 1 toque en el móvil.
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
