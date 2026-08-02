import React, { useMemo, useState } from 'react';
import {
    ShoppingBag, PhoneCall, AlertTriangle, CheckCircle2, ArrowRight,
    Search, FileText, Check, Copy, ExternalLink, Download, Eye, EyeOff,
    Globe, RefreshCw, UploadCloud, UserCheck, ShieldCheck, Laptop, Lock, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { downloadStoredFile } from '../services/fileService';

interface FacturadoresScreenProps {
    navigate: (screen: any, options?: any) => void;
    initialSearchTerm?: string;
}

export const FacturadoresScreen: React.FC<FacturadoresScreenProps> = ({ navigate, initialSearchTerm = '' }) => {
    const { clients, updateClient } = useAppStore();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'todos' | 'recursos_listos' | 'subido_plataforma' | 'activado'>('todos');

    const facturadorClients = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return clients.filter(c => {
            if (c.isDeleted || !c.isActive || !c.facturadorConfig) return false;
            
            // Filter by status
            if (filterStatus !== 'todos') {
                const status = c.facturadorActivationStatus || 'recursos_listos';
                if (status !== filterStatus) return false;
            }

            if (!q) return true;
            return c.name.toLowerCase().includes(q) || 
                   c.ruc.includes(q) || 
                   (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
                   c.facturadorConfig?.programName?.toLowerCase().includes(q);
        });
    }, [clients, searchTerm, filterStatus]);

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

    const formatExpiry = (date?: string) => {
        if (!date) return '—';
        const d = new Date(date);
        return isNaN(d.getTime()) ? date : format(d, "d MMM yyyy", { locale: es });
    };

    // KPI Counters
    const kpis = useMemo(() => {
        const activeFacturadores = clients.filter(c => !c.isDeleted && c.isActive && c.facturadorConfig);
        const recursos = activeFacturadores.filter(c => !c.facturadorActivationStatus || c.facturadorActivationStatus === 'recursos_listos').length;
        const subido = activeFacturadores.filter(c => c.facturadorActivationStatus === 'subido_plataforma').length;
        const activado = activeFacturadores.filter(c => c.facturadorActivationStatus === 'activado').length;
        return { total: activeFacturadores.length, recursos, subido, activado };
    }, [clients]);

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER DE FACTURADORES ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-[#00A896]/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-to-tr from-purple-500/10 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-[#00A896] to-teal-600 shadow-xl shadow-[#00A896]/30 text-white shrink-0">
                            <ShoppingBag size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_rgba(0,168,150,0.8)]" />
                                <span className="text-[10px] font-black text-[#00A896] uppercase tracking-[0.3em]">Registro de Emisión Digital</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Facturadores y Planes de Clientes
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Control de planes de facturación contratados, recopilación de recursos y estado de activación en plataformas.
                            </p>
                        </div>
                    </div>

                    {/* KPI RESUMEN */}
                    <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <button
                            onClick={() => setFilterStatus('todos')}
                            className={`flex flex-col items-center px-4 py-3 rounded-2xl border backdrop-blur-md transition-all ${
                                filterStatus === 'todos'
                                    ? 'bg-[#00A896]/15 border-[#00A896]/30 text-white'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                            }`}
                        >
                            <span className="text-xl font-black font-mono text-[#00A896]">{kpis.total}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Total Planes</span>
                        </button>
                        <button
                            onClick={() => setFilterStatus('recursos_listos')}
                            className={`flex flex-col items-center px-4 py-3 rounded-2xl border backdrop-blur-md transition-all ${
                                filterStatus === 'recursos_listos'
                                    ? 'bg-rose-500/15 border-rose-500/30 text-white'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                            }`}
                        >
                            <span className="text-xl font-black font-mono text-rose-400">{kpis.recursos}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Recursos Listos</span>
                        </button>
                        <button
                            onClick={() => setFilterStatus('subido_plataforma')}
                            className={`flex flex-col items-center px-4 py-3 rounded-2xl border backdrop-blur-md transition-all ${
                                filterStatus === 'subido_plataforma'
                                    ? 'bg-amber-400/15 border-amber-400/30 text-white'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                            }`}
                        >
                            <span className="text-xl font-black font-mono text-amber-400">{kpis.subido}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">En Plataforma</span>
                        </button>
                        <button
                            onClick={() => setFilterStatus('activado')}
                            className={`flex flex-col items-center px-4 py-3 rounded-2xl border backdrop-blur-md transition-all ${
                                filterStatus === 'activado'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-white'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                            }`}
                        >
                            <span className="text-xl font-black font-mono text-emerald-400">{kpis.activado}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Activados</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA Y FILTRADO ── */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, RUC o plan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 focus:ring-1 focus:ring-[#00A896]/30 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* ── LISTA DE FACTURADORES ── */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Registro de Trámites y Activaciones de Facturadores
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Descarga los recursos recopilados y súbelos a la plataforma para tramitar y activar sus planes.
                        </p>
                    </div>
                </div>

                {facturadorClients.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-white/10 rounded-3xl text-slate-400">
                        No se encontraron clientes con planes de facturador registrados que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-4 px-5">Cliente</th>
                                    <th className="py-4 px-5">Plan Vendido</th>
                                    <th className="py-4 px-5">Recursos / Archivos</th>
                                    <th className="py-4 px-5">Estado de Trámite</th>
                                    <th className="py-4 px-5">Credenciales Facturador</th>
                                    <th className="py-4 px-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {facturadorClients.map((client) => {
                                    const config = client.facturadorConfig!;
                                    const pwdVisible = visiblePasswords[client.id] || false;
                                    const isCopied = copiedId === client.id;
                                    const providerUrl = config.url || (config.programName?.toLowerCase().includes('zifac') ? 'https://sistema.zifac.com' : 'https://app.ecuafact.com');

                                    return (
                                        <tr key={client.id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="py-4 px-5">
                                                <p className="font-bold text-white uppercase">{client.tradeName || client.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{client.ruc}</p>
                                            </td>
                                            <td className="py-4 px-5">
                                                <p className="font-bold text-teal-400">{config.programName}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">
                                                    {config.documentStatus || 'Plan Registrado'} {config.price ? `— $${config.price}` : ''}
                                                </p>
                                            </td>
                                            <td className="py-4 px-5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {client.idCardFront ? (
                                                        <button
                                                            onClick={() => downloadStoredFile(client.idCardFront)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1"
                                                            title="Descargar Cédula Frontal"
                                                        >
                                                            <Download size={10} /> 🪪 Frente
                                                        </button>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-white/5" title="Falta Cédula Frontal">⚠️ Frente</span>
                                                    )}

                                                    {client.idCardBack ? (
                                                        <button
                                                            onClick={() => downloadStoredFile(client.idCardBack)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1"
                                                            title="Descargar Cédula Reverso"
                                                        >
                                                            <Download size={10} /> 🪪 Reverso
                                                        </button>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-white/5" title="Falta Cédula Reverso">⚠️ Reverso</span>
                                                    )}

                                                    {client.idCardSelfie ? (
                                                        <button
                                                            onClick={() => downloadStoredFile(client.idCardSelfie)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1"
                                                            title="Descargar Foto Selfie"
                                                        >
                                                            <Download size={10} /> 📸 Selfie
                                                        </button>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-white/5" title="Falta Selfie">⚠️ Selfie</span>
                                                    )}

                                                    {client.rucPdf ? (
                                                        <button
                                                            onClick={() => downloadStoredFile(client.rucPdf)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1"
                                                            title="Descargar RUC Actualizado"
                                                        >
                                                            <Download size={10} /> 📄 RUC
                                                        </button>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-white/5" title="Falta RUC Actualizado">⚠️ RUC</span>
                                                    )}

                                                    {config.programName?.toLowerCase().includes('ecuafact') && (
                                                        client.ecuafactSignedRequest ? (
                                                            <button
                                                                onClick={() => downloadStoredFile(client.ecuafactSignedRequest)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1"
                                                                title="Descargar Solicitud de Terceros Firmada"
                                                            >
                                                                <Download size={10} /> ✍️ Solicitud
                                                            </button>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-white/5" title="Falta Solicitud Firmada">⚠️ Solicitud</span>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-5">
                                                <select
                                                    value={client.facturadorActivationStatus || 'recursos_listos'}
                                                    onChange={(e) => {
                                                        const newStatus = e.target.value as any;
                                                        updateClient(client.id, { facturadorActivationStatus: newStatus });
                                                        toast.success(`Trámite de ${client.name} marcado como: ${
                                                            newStatus === 'recursos_listos' ? 'Recursos Listos' :
                                                            newStatus === 'subido_plataforma' ? 'Subido a Plataforma' : 'Activado y Listo'
                                                        }`);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl border font-bold outline-none cursor-pointer bg-slate-950 ${
                                                        (client.facturadorActivationStatus === 'activado') ? 'border-emerald-500/30 text-emerald-400' :
                                                        (client.facturadorActivationStatus === 'subido_plataforma') ? 'border-amber-500/30 text-amber-400' :
                                                        'border-rose-500/30 text-rose-400'
                                                    }`}
                                                >
                                                    <option value="recursos_listos">🔴 Recursos Listos</option>
                                                    <option value="subido_plataforma">🟡 Subido a Plataforma</option>
                                                    <option value="activado">🟢 Activado y Listo</option>
                                                </select>
                                            </td>
                                            <td className="py-4 px-5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                                                        <span className="text-slate-500">U:</span> {config.username || client.ruc}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-slate-500 font-mono text-[11px]">C:</span>
                                                        <div className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                                                            <span className="font-bold text-slate-300 min-w-[60px] text-[10px] font-mono">
                                                                {pwdVisible ? (config.password || client.sriPassword) : '••••••••'}
                                                            </span>
                                                            <button
                                                                onClick={() => togglePasswordVisibility(client.id)}
                                                                className="p-0.5 hover:text-white text-slate-400 transition-colors"
                                                                title="Ver / Ocultar"
                                                            >
                                                                {pwdVisible ? <EyeOff size={10} /> : <Eye size={10} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleCopyPassword(client.id, config.password || client.sriPassword)}
                                                                className="p-0.5 hover:text-teal-400 text-slate-400 transition-colors"
                                                                title="Copiar clave"
                                                            >
                                                                {isCopied ? <Check size={10} className="text-teal-400" /> : <Copy size={10} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5 text-right space-x-1.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        const message = `Estimado(a) *${client.name}*, le saludamos de SantiagoCórdova.com. Le informamos que su facturador electrónico *${config.programName}* ha sido activado con éxito.\n\n*Plataforma:* ${providerUrl}\n*Usuario:* ${config.username || client.ruc}\n*Clave:* ${config.password || client.sriPassword}\n\nYa puede emitir sus facturas electrónicas normalmente.`;
                                                        const pObj = client.phones?.[0];
                                                        const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
                                                        setWhatsAppPrompt({ clientName: client.name, phone, message });
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold uppercase transition-all inline-flex items-center gap-1 border border-emerald-500/20"
                                                    title="Enviar credenciales de facturación por WhatsApp"
                                                >
                                                    <PhoneCall size={11} /> WhatsApp
                                                </button>

                                                <button
                                                    onClick={() => window.open(providerUrl, '_blank')}
                                                    className="px-2.5 py-1.5 rounded-lg bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] font-bold uppercase transition-all inline-flex items-center gap-1 border border-[#00A896]/20"
                                                    title="Visitar plataforma del Facturador"
                                                >
                                                    <Globe size={11} /> Abrir
                                                </button>

                                                <button
                                                    onClick={() => navigate('clients', { clientIdToView: client.id, initialTab: 'vault' })}
                                                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase transition-all inline-flex items-center border border-white/10"
                                                    title="Ver Bóveda del Cliente"
                                                >
                                                    <ExternalLink size={11} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── MODAL WHATSAPP NOTIFICACIÓN ── */}
            {whatsAppPrompt && (
                <Modal isOpen={true} onClose={() => setWhatsAppPrompt(null)} title="💬 Enviar Credenciales de Facturación" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <p className="text-xs text-slate-300">
                            Enviarás el siguiente mensaje con los datos de acceso del facturador al cliente <strong>{whatsAppPrompt.clientName}</strong>:
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
                                rel="noopener noreferrer"
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                                <PhoneCall size={14} /> Abrir WhatsApp Web
                            </a>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
