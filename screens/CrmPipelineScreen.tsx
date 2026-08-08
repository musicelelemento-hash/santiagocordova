import React, { useState, useEffect, useMemo } from 'react';
import { 
    Kanban, Plus, Search, Phone, MessageSquare, DollarSign, 
    ArrowRight, CheckCircle2, XCircle, Clock, UserPlus, Filter, 
    FileText, Zap, ChevronRight, UserCheck, ShieldCheck, Trash2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { db } from '../services/db';

export type PipelineStage = 'prospecto' | 'cotizacion' | 'negociacion' | 'ganado' | 'perdido';

export interface CrmLead {
    id: string;
    nombre: string;
    ruc?: string;
    telefono: string;
    email?: string;
    servicioInteres: 'Honorarios Mensuales' | 'Firma Electrónica .p12' | 'Facturador Zifac/Ecuafact' | 'Devolución IVA' | 'Asesoría Tributaria';
    montoEstimado: number;
    etapa: PipelineStage;
    origen: 'WhatsApp' | 'Web' | 'Recomendación' | 'Oficina';
    notas: string[];
    createdAt: string;
    updatedAt: string;
}

interface CrmPipelineScreenProps {
    navigate: (screen: any, options?: any) => void;
}

export const CrmPipelineScreen: React.FC<CrmPipelineScreenProps> = ({ navigate }) => {
    const { clients, addClient } = useAppStore();
    const { toast } = useToast();

    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<CrmLead | null>(null);

    // Form States para nuevo Lead
    const [nombreForm, setNombreForm] = useState('');
    const [rucForm, setRucForm] = useState('');
    const [telefonoForm, setTelefonoForm] = useState('');
    const [emailForm, setEmailForm] = useState('');
    const [servicioForm, setServicioForm] = useState<CrmLead['servicioInteres']>('Honorarios Mensuales');
    const [montoForm, setMontoForm] = useState<number>(35.00);
    const [origenForm, setOrigenForm] = useState<CrmLead['origen']>('WhatsApp');

    // Cargar leads de CRM desde IndexedDB
    useEffect(() => {
        const loadLeads = async () => {
            try {
                const stored = await db.getLocal('sc_crm_leads_history');
                if (stored && Array.isArray(stored)) {
                    setLeads(stored);
                } else {
                    // Datos iniciales de demostración
                    const demoLeads: CrmLead[] = [
                        {
                            id: 'LEAD-001',
                            nombre: 'Ing. Carlos Mendoza (Constructora)',
                            ruc: '0701239876001',
                            telefono: '0991234567',
                            email: 'carlos@constructora.com',
                            servicioInteres: 'Honorarios Mensuales',
                            montoEstimado: 60.00,
                            etapa: 'cotizacion',
                            origen: 'WhatsApp',
                            notas: ['Cliente requiere asesoría para declaración semestral de IVA y facturación SRI.'],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        {
                            id: 'LEAD-002',
                            nombre: 'Dra. Ana Lucia Torres (Clínica)',
                            ruc: '0704445556001',
                            telefono: '0987654321',
                            servicioInteres: 'Firma Electrónica .p12',
                            montoEstimado: 25.00,
                            etapa: 'prospecto',
                            origen: 'Recomendación',
                            notas: ['Interesada en firma .p12 por 1 año para emitir facturas médicas.'],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        {
                            id: 'LEAD-003',
                            nombre: 'Comercial El Oro S.A.',
                            ruc: '0790011223001',
                            telefono: '0978980722',
                            servicioInteres: 'Facturador Zifac/Ecuafact',
                            montoEstimado: 50.00,
                            etapa: 'negociacion',
                            origen: 'Web',
                            notas: ['Se envió proforma del plan anual de facturación electrónica.'],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }
                    ];
                    setLeads(demoLeads);
                    await db.setLocal('sc_crm_leads_history', demoLeads);
                }
            } catch (err) {
                console.error("Error al cargar CRM leads:", err);
            }
        };
        loadLeads();
    }, []);

    const saveLeadsToDb = async (newList: CrmLead[]) => {
        setLeads(newList);
        await db.setLocal('sc_crm_leads_history', newList);
    };

    // Crear nuevo Lead
    const handleCreateLead = async () => {
        if (!nombreForm || !telefonoForm) {
            toast.error("Ingresa al menos el nombre y teléfono del prospecto.");
            return;
        }

        const newLead: CrmLead = {
            id: `LEAD-${Date.now()}`,
            nombre: nombreForm,
            ruc: rucForm || undefined,
            telefono: telefonoForm,
            email: emailForm || undefined,
            servicioInteres: servicioForm,
            montoEstimado: montoForm,
            etapa: 'prospecto',
            origen: origenForm,
            notas: [`Prospecto registrado desde ${origenForm}`],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updated = [newLead, ...leads];
        await saveLeadsToDb(updated);
        setIsCreateModalOpen(false);
        setNombreForm('');
        setTelefonoForm('');
        toast.success(`🎉 Prospecto ${newLead.nombre} agregado al embudo CRM.`);
    };

    // Cambiar etapa del pipeline
    const handleChangeStage = async (leadId: string, newStage: PipelineStage) => {
        const updated = leads.map(l => {
            if (l.id !== leadId) return l;
            return {
                ...l,
                etapa: newStage,
                updatedAt: new Date().toISOString()
            };
        });
        await saveLeadsToDb(updated);
        toast.success(`Prospecto movido a etapa: ${newStage.toUpperCase()}`);
    };

    // Convertir Prospecto Ganado en Cliente Activo del Directorio
    const handleConvertToActiveClient = async (lead: CrmLead) => {
        const newClient: Client = {
            id: `client-${Date.now()}`,
            name: lead.nombre,
            ruc: lead.ruc || `070${Math.floor(Math.random() * 8999999) + 1000000}001`,
            email: lead.email || '',
            phones: [lead.telefono],
            address: 'Pasaje, El Oro',
            regime: 'RIMPE Emprendedor' as any,
            sriPassword: '',
            isActive: true,
            declarations: []
        };

        addClient(newClient);
        await handleChangeStage(lead.id, 'ganado');
        toast.success(`🚀 ¡Felicidades! ${lead.nombre} se ha convertido en Cliente Activo del Directorio.`);
    };

    // Enviar WhatsApp al Lead
    const handleSendWhatsApp = (lead: CrmLead) => {
        const cleanPhone = lead.telefono.replace(/\D/g, '');
        const message = `Estimado(a) *${lead.nombre}*, le saludamos de SantiagoCórdova.com. Estamos atentos para asesorarle en su servicio de *${lead.servicioInteres}*. ¿Desea coordinar los detalles?`;
        window.open(`https://wa.me/593${cleanPhone.replace(/^0/, '')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const filteredLeads = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return leads.filter(l => {
            if (!q) return true;
            return l.nombre.toLowerCase().includes(q) ||
                   (l.ruc && l.ruc.includes(q)) ||
                   l.telefono.includes(q) ||
                   l.servicioInteres.toLowerCase().includes(q);
        });
    }, [leads, searchTerm]);

    const stages: Array<{ id: PipelineStage; label: string; color: string; bg: string }> = [
        { id: 'prospecto', label: '📥 1. Prospectos', color: 'text-indigo-400', bg: 'border-indigo-500/30 bg-indigo-500/5' },
        { id: 'cotizacion', label: '📑 2. Cotización Enviada', color: 'text-sky-400', bg: 'border-sky-500/30 bg-sky-500/5' },
        { id: 'negociacion', label: '🤝 3. En Negociación', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/5' },
        { id: 'ganado', label: '✅ 4. Clientes Ganados', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/5' },
        { id: 'perdido', label: '❌ 5. Perdidos', color: 'text-rose-400', bg: 'border-rose-500/30 bg-rose-500/5' }
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER PRO DE CRM ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/30 text-white shrink-0">
                            <Kanban size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">CRM Embudo & Seguimiento de Clientes</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Pipeline de Prospectos & Leads
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Gestión comercial de prospectos para honorarios contables, firmas electrónicas y servicios tributarios.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 shrink-0"
                    >
                        <Plus size={18} /> Nuevo Prospecto / Lead
                    </button>
                </div>
            </div>

            {/* ── BARRA BÚSQUEDA ── */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Buscar por prospecto, RUC o teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
            </div>

            {/* ── EMBUDO KANBAN CRM (5 COLUMNAS) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
                {stages.map(st => {
                    const leadsInStage = filteredLeads.filter(l => l.etapa === st.id);
                    const totalValue = leadsInStage.reduce((s, l) => s + l.montoEstimado, 0);

                    return (
                        <div key={st.id} className={`p-4 rounded-3xl border flex flex-col space-y-4 min-w-[240px] ${st.bg}`}>
                            {/* Header de Etapa */}
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                <div>
                                    <h3 className={`text-xs font-black uppercase tracking-wider ${st.color}`}>{st.label}</h3>
                                    <span className="text-[10px] text-slate-400 font-mono">${totalValue.toFixed(2)} estimador</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-mono font-bold text-white">
                                    {leadsInStage.length}
                                </span>
                            </div>

                            {/* Tarjetas de Leads */}
                            <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar max-h-[65vh]">
                                {leadsInStage.map(lead => (
                                    <div
                                        key={lead.id}
                                        className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-indigo-500/40 transition-all space-y-3 shadow-md"
                                    >
                                        <div>
                                            <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase block">{lead.origen}</span>
                                            <h4 className="font-bold text-white text-xs truncate">{lead.nombre}</h4>
                                            {lead.ruc && <p className="text-[10px] text-slate-400 font-mono">RUC: {lead.ruc}</p>}
                                        </div>

                                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono">
                                            <span className="text-slate-400 text-[10px] truncate max-w-[120px]">{lead.servicioInteres}</span>
                                            <span className="font-bold text-emerald-400">${lead.montoEstimado.toFixed(2)}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                onClick={() => handleSendWhatsApp(lead)}
                                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30"
                                            >
                                                <Phone size={11} /> WhatsApp
                                            </button>

                                            {lead.etapa !== 'ganado' && (
                                                <button
                                                    onClick={() => handleConvertToActiveClient(lead)}
                                                    className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase border border-indigo-500/30"
                                                    title="Convertir a Cliente Activo"
                                                >
                                                    <UserCheck size={11} /> Ganar
                                                </button>
                                            )}
                                        </div>

                                        {/* Selector rápido de Etapa */}
                                        <select
                                            value={lead.etapa}
                                            onChange={(e) => handleChangeStage(lead.id, e.target.value as any)}
                                            className="w-full mt-1 px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-[9px] font-bold text-slate-300 outline-none"
                                        >
                                            <option value="prospecto">Move a Prospecto</option>
                                            <option value="cotizacion">Move a Cotización</option>
                                            <option value="negociacion">Move a Negociación</option>
                                            <option value="ganado">Move a Ganado</option>
                                            <option value="perdido">Move a Perdido</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── MODAL NUEVO PROSPECTO ── */}
            {isCreateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsCreateModalOpen(false)} title="📥 Registrar Nuevo Prospecto CRM" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Nombre / Razón Social *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Ing. Pedro Perez"
                                    value={nombreForm}
                                    onChange={(e) => setNombreForm(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-bold text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Teléfono / WhatsApp *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 0991234567"
                                    value={telefonoForm}
                                    onChange={(e) => setTelefonoForm(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">RUC / Cédula (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 0701234567001"
                                    value={rucForm}
                                    onChange={(e) => setRucForm(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Origen del Lead</label>
                                <select
                                    value={origenForm}
                                    onChange={(e) => setOrigenForm(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                                >
                                    <option value="WhatsApp">📱 WhatsApp</option>
                                    <option value="Web">🌐 Sitio Web</option>
                                    <option value="Recomendación">👥 Recomendación</option>
                                    <option value="Oficina">🏢 Oficina Mostrador</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Servicio de Interés</label>
                                <select
                                    value={servicioForm}
                                    onChange={(e) => setServicioForm(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                                >
                                    <option value="Honorarios Mensuales">Honorarios Mensuales</option>
                                    <option value="Firma Electrónica .p12">Firma Electrónica .p12</option>
                                    <option value="Facturador Zifac/Ecuafact">Facturador Zifac/Ecuafact</option>
                                    <option value="Devolución IVA">Devolución IVA</option>
                                    <option value="Asesoría Tributaria">Asesoría Tributaria</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Monto Estimado ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={montoForm}
                                    onChange={(e) => setMontoForm(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleCreateLead} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs">Guardar Lead</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
