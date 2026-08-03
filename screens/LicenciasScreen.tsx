import React, { useState, useEffect, useMemo } from 'react';
import { 
    Key, ShieldCheck, Plus, Search, Calendar, AlertTriangle, 
    CheckCircle, Copy, PhoneCall, ExternalLink, RefreshCw, Lock, 
    Smartphone, Server, Zap, ShieldAlert, Award
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { db } from '../services/db';

export interface LicenciaSaaS {
    id: string;
    licenseKey: string;
    clienteId?: string;
    nombreCliente: string;
    rucCliente: string;
    tipoServicio: 'Facturador Zifac' | 'Facturador Ecuafact' | 'Firma Electrónica .p12' | 'Suscripción Contable Anual' | 'Software Personalizado';
    fechaActivacion: string;
    fechaExpiracion: string;
    estado: 'Activa' | 'Por Vencer' | 'Expirada' | 'Suspendida';
    observaciones?: string;
    notificadoRenovacion?: boolean;
}

interface LicenciasScreenProps {
    navigate: (screen: any, options?: any) => void;
}

export const LicenciasScreen: React.FC<LicenciasScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [licencias, setLicencias] = useState<LicenciaSaaS[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Form States
    const [selectedClientId, setSelectedClientId] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [rucCliente, setRucCliente] = useState('');
    const [tipoServicio, setTipoServicio] = useState<LicenciaSaaS['tipoServicio']>('Facturador Zifac');
    const [duracionMeses, setDuracionMeses] = useState<number>(12);
    const [observaciones, setObservaciones] = useState('');

    // Generar Clave de Licencia
    const generateKey = () => {
        const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SC-LIC-2026-${part1}-${part2}`;
    };

    // Cargar licencias desde IndexedDB / Supabase
    useEffect(() => {
        const loadLicencias = async () => {
            try {
                const stored = await db.getLocal('sc_licencias_history');
                if (stored && Array.isArray(stored)) {
                    setLicencias(stored);
                } else {
                    // Datos iniciales de demostración PRO
                    const demoData: LicenciaSaaS[] = [
                        {
                            id: 'LIC-001',
                            licenseKey: 'SC-LIC-2026-[#ZIFAC]-9982',
                            nombreCliente: 'CORDOVA RAMIREZ ROBERTO SANTIAGO',
                            rucCliente: '0705787745001',
                            tipoServicio: 'Facturador Zifac',
                            fechaActivacion: '2026-01-01',
                            fechaExpiracion: '2027-01-01',
                            estado: 'Activa',
                            observaciones: 'Licencia Facturador Electrónico ilimitado Zifac.',
                        },
                        {
                            id: 'LIC-002',
                            licenseKey: 'SC-LIC-2026-[#P12]-4412',
                            nombreCliente: 'FARMACIA POPULAR EL ORO',
                            rucCliente: '0701234567001',
                            tipoServicio: 'Firma Electrónica .p12',
                            fechaActivacion: '2025-08-15',
                            fechaExpiracion: '2026-08-15',
                            estado: 'Por Vencer',
                            observaciones: 'Firma electrónica Security Data .p12 por 1 año.',
                        }
                    ];
                    setLicencias(demoData);
                    await db.setLocal('sc_licencias_history', demoData);
                }
            } catch (err) {
                console.error("Error al cargar licencias:", err);
            }
        };
        loadLicencias();
    }, []);

    const saveLicenciasToDb = async (newList: LicenciaSaaS[]) => {
        setLicencias(newList);
        await db.setLocal('sc_licencias_history', newList);
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        const c = clients.find(item => item.id === clientId);
        if (c) {
            setNombreCliente(c.tradeName || c.name);
            setRucCliente(c.ruc);
        }
    };

    const handleCreateLicencia = async () => {
        if (!nombreCliente || !rucCliente) {
            toast.error("Selecciona o ingresa el nombre y RUC del cliente.");
            return;
        }

        const now = new Date();
        const expDate = new Date(now.setMonth(now.getMonth() + duracionMeses));

        const newLic: LicenciaSaaS = {
            id: `LIC-${Date.now()}`,
            licenseKey: generateKey(),
            clienteId: selectedClientId || undefined,
            nombreCliente,
            rucCliente,
            tipoServicio,
            fechaActivacion: new Date().toISOString().split('T')[0],
            fechaExpiracion: expDate.toISOString().split('T')[0],
            estado: 'Activa',
            observaciones
        };

        const updated = [newLic, ...licencias];
        await saveLicenciasToDb(updated);
        setIsCreateModalOpen(false);
        toast.success(`🎉 Licencia ${newLic.licenseKey} generada correctamente.`);
    };

    // Renovación por WhatsApp
    const handleSendRenewalWhatsApp = (lic: LicenciaSaaS) => {
        const clientObj = clients.find(c => c.ruc === lic.rucCliente || c.id === lic.clienteId);
        const pObj = clientObj?.phones?.[0];
        const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
        const cleanPhone = phone.replace(/\D/g, '');

        const message = `Estimado(a) *${lic.nombreCliente}*, le saludamos de SantiagoCórdova.com. Le recordamos que su licencia de *${lic.tipoServicio}* (Clave: \`${lic.licenseKey}\`) está próxima a vencer el *${lic.fechaExpiracion}*.\n\nPara coordinar su renovación y mantener su servicio activo sin interrupciones, comuníquese con nosotros por este medio.`;

        if (cleanPhone) {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            navigator.clipboard.writeText(message);
            toast.info("Mensaje copiado al portapapeles. (El cliente no tiene teléfono guardado)");
        }
    };

    const filteredLicencias = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return licencias.filter(l => {
            if (filterEstado !== 'todos' && l.estado !== filterEstado) return false;
            if (!q) return true;
            return l.nombreCliente.toLowerCase().includes(q) ||
                   l.rucCliente.includes(q) ||
                   l.licenseKey.toLowerCase().includes(q) ||
                   l.tipoServicio.toLowerCase().includes(q);
        });
    }, [licencias, searchTerm, filterEstado]);

    const kpis = useMemo(() => {
        const activas = licencias.filter(l => l.estado === 'Activa').length;
        const porVencer = licencias.filter(l => l.estado === 'Por Vencer').length;
        const expiradas = licencias.filter(l => l.estado === 'Expirada').length;
        return { total: licencias.length, activas, porVencer, expiradas };
    }, [licencias]);

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER PRO DE LICENCIAS ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-amber-500/10 via-yellow-500/5 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-xl shadow-amber-500/30 text-white shrink-0">
                            <Key size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em]">Gestor de Suscripciones & SaaS</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Licencias y Servicios Suscritos
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Control de licencias de facturadores, firmas electrónicas y suscripciones anuales con alertas automáticas.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-amber-500/25 active:scale-95 shrink-0"
                    >
                        <Plus size={18} /> Nueva Licencia SaaS
                    </button>
                </div>
            </div>

            {/* ── KPIs RESUMEN LICENCIAS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Licencias</span>
                        <p className="text-2xl font-black font-mono text-white mt-0.5">{kpis.total}</p>
                    </div>
                    <Server size={24} className="text-indigo-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">Licencias Activas</span>
                        <p className="text-2xl font-black font-mono text-emerald-400 mt-0.5">{kpis.activas}</p>
                    </div>
                    <CheckCircle size={24} className="text-emerald-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-amber-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-amber-400 uppercase">Por Vencer</span>
                        <p className="text-2xl font-black font-mono text-amber-400 mt-0.5">{kpis.porVencer}</p>
                    </div>
                    <AlertTriangle size={24} className="text-amber-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-rose-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-rose-400 uppercase">Expiradas</span>
                        <p className="text-2xl font-black font-mono text-rose-400 mt-0.5">{kpis.expiradas}</p>
                    </div>
                    <ShieldAlert size={24} className="text-rose-400" />
                </div>
            </div>

            {/* ── BARRA BÚSQUEDA ── */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por clave, cliente o servicio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-500"
                    />
                </div>
            </div>

            {/* ── TABLA DE LICENCIAS ── */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <th className="py-4 px-5">Clave de Licencia</th>
                                <th className="py-4 px-5">Cliente / RUC</th>
                                <th className="py-4 px-5">Servicio Suscrito</th>
                                <th className="py-4 px-5">Expiración</th>
                                <th className="py-4 px-5">Estado</th>
                                <th className="py-4 px-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLicencias.map((lic) => (
                                <tr key={lic.id} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="py-4 px-5 font-mono font-bold text-amber-300">
                                        <div className="flex items-center gap-1.5">
                                            <Key size={12} className="text-amber-400" />
                                            <span>{lic.licenseKey}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-5">
                                        <p className="font-bold text-white uppercase">{lic.nombreCliente}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">RUC: {lic.rucCliente}</p>
                                    </td>
                                    <td className="py-4 px-5">
                                        <p className="font-bold text-teal-400">{lic.tipoServicio}</p>
                                    </td>
                                    <td className="py-4 px-5 font-mono text-slate-300">
                                        {lic.fechaExpiracion}
                                    </td>
                                    <td className="py-4 px-5">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                            lic.estado === 'Activa' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                            lic.estado === 'Por Vencer' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        }`}>
                                            {lic.estado}
                                        </span>
                                    </td>
                                    <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(lic.licenseKey);
                                                toast.success("Clave de licencia copiada al portapapeles.");
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase transition-all inline-flex items-center gap-1 text-[10px]"
                                            title="Copiar Clave"
                                        >
                                            <Copy size={11} /> Clave
                                        </button>
                                        <button
                                            onClick={() => handleSendRenewalWhatsApp(lic)}
                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold uppercase transition-all inline-flex items-center gap-1 text-[10px] border border-emerald-500/20"
                                            title="Enviar aviso por WhatsApp"
                                        >
                                            <PhoneCall size={11} /> WhatsApp
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── MODAL NUEVA LICENCIA ── */}
            {isCreateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsCreateModalOpen(false)} title="🔑 Activar Nueva Licencia SaaS" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-300 uppercase block">Seleccionar Cliente</label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => handleSelectClient(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                            >
                                <option value="">-- Seleccionar cliente --</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ruc}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Servicio Suscrito</label>
                                <select
                                    value={tipoServicio}
                                    onChange={(e) => setTipoServicio(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                                >
                                    <option value="Facturador Zifac">Facturador Zifac</option>
                                    <option value="Facturador Ecuafact">Facturador Ecuafact</option>
                                    <option value="Firma Electrónica .p12">Firma Electrónica .p12</option>
                                    <option value="Suscripción Contable Anual">Suscripción Contable Anual</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Duración (Meses)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="36"
                                    value={duracionMeses}
                                    onChange={(e) => setDuracionMeses(parseInt(e.target.value) || 12)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleCreateLicencia} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">Generar Licencia</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
