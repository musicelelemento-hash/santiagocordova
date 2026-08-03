import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileSpreadsheet, Plus, Search, Download, Printer, CheckCircle, 
    XCircle, Clock, Send, FileText, ArrowRight, Trash2, Edit3, Copy, 
    ExternalLink, DollarSign, Calculator, RefreshCw, Zap, Shield, UserCheck
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { db } from '../services/db';

export interface CotizacionItem {
    id: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    aplicaIva: boolean;
    subtotal: number;
}

export interface Cotizacion {
    id: string;
    secuencial: string;
    fechaEmision: string;
    fechaValidez: string;
    clienteId?: string;
    rucCliente: string;
    nombreCliente: string;
    emailCliente?: string;
    telefonoCliente?: string;
    direccionCliente?: string;
    items: CotizacionItem[];
    subtotalZero: number;
    subtotalIva: number;
    ivaAmount: number;
    total: number;
    estado: 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Facturada';
    notas?: string;
    createdAt: string;
}

interface CotizacionesScreenProps {
    navigate: (screen: any, options?: any) => void;
}

export const CotizacionesScreen: React.FC<CotizacionesScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);

    // Form States
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [rucCliente, setRucCliente] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [emailCliente, setEmailCliente] = useState('');
    const [telefonoCliente, setTelefonoCliente] = useState('');
    const [direccionCliente, setDireccionCliente] = useState('');
    const [diasValidez, setDiasValidez] = useState<number>(15);
    const [notas, setNotas] = useState('Validez de la cotización: 15 días. Precios incluyen asesoría y acompañamiento tributario continuo.');

    const [items, setItems] = useState<CotizacionItem[]>([
        { id: '1', descripcion: 'Servicios Contables y Asesoría Tributaria Mensual', cantidad: 1, precioUnitario: 35.00, aplicaIva: false, subtotal: 35.00 }
    ]);

    // Cargar historial de cotizaciones desde IndexedDB local
    useEffect(() => {
        const loadCotizaciones = async () => {
            try {
                const stored = await db.getLocal('sc_cotizaciones_history');
                if (stored && Array.isArray(stored)) {
                    setCotizaciones(stored);
                } else {
                    // Datos iniciales de demostración PRO
                    const demoData: Cotizacion[] = [
                        {
                            id: 'COT-1001',
                            secuencial: 'COT-001',
                            fechaEmision: new Date().toISOString().split('T')[0],
                            fechaValidez: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
                            rucCliente: '0705787745001',
                            nombreCliente: 'CORDOVA RAMIREZ ROBERTO SANTIAGO',
                            emailCliente: 'info@santiagocordova.com',
                            telefonoCliente: '0978980722',
                            direccionCliente: 'Pasaje, El Oro',
                            items: [
                                { id: 'i1', descripcion: 'Plan Anual Facturación Electrónica SRI (Ecuafact / Zifac)', cantidad: 1, precioUnitario: 50.00, aplicaIva: true, subtotal: 50.00 },
                                { id: 'i2', descripcion: 'Emisión e Instalación de Firma Electrónica .p12 (Vigencia 1 Año)', cantidad: 1, precioUnitario: 25.00, aplicaIva: true, subtotal: 25.00 }
                            ],
                            subtotalZero: 0,
                            subtotalIva: 75.00,
                            ivaAmount: 11.25,
                            total: 86.25,
                            estado: 'Aprobada',
                            notas: 'Incluye soporte técnico preferencial y configuración inicial de firmas.',
                            createdAt: new Date().toISOString()
                        }
                    ];
                    setCotizaciones(demoData);
                    await db.setLocal('sc_cotizaciones_history', demoData);
                }
            } catch (err) {
                console.error("Error al cargar cotizaciones:", err);
            }
        };
        loadCotizaciones();
    }, []);

    const saveCotizacionesToDb = async (newList: Cotizacion[]) => {
        setCotizaciones(newList);
        await db.setLocal('sc_cotizaciones_history', newList);
    };

    // Auto-completar cliente seleccionado
    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        const c = clients.find(item => item.id === clientId);
        if (c) {
            setRucCliente(c.ruc);
            setNombreCliente(c.tradeName || c.name);
            setEmailCliente(c.email || '');
            const pObj = c.phones?.[0];
            const phone = typeof pObj === 'object' ? (pObj as any).number || '' : (pObj || '');
            setTelefonoCliente(phone);
            setDireccionCliente(c.address || 'Pasaje, El Oro');
        }
    };

    // Agregar nuevo ítem al formulario
    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { id: Date.now().toString(), descripcion: 'Nuevo Servicio / Producto', cantidad: 1, precioUnitario: 25.00, aplicaIva: false, subtotal: 25.00 }
        ]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof CotizacionItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (field === 'cantidad' || field === 'precioUnitario') {
                updated.subtotal = Number(updated.cantidad) * Number(updated.precioUnitario);
            }
            return updated;
        }));
    };

    // Totales calculados del formulario
    const formTotals = useMemo(() => {
        let subtotalZero = 0;
        let subtotalIva = 0;
        items.forEach(item => {
            const st = item.cantidad * item.precioUnitario;
            if (item.aplicaIva) subtotalIva += st;
            else subtotalZero += st;
        });
        const ivaAmount = subtotalIva * 0.15;
        const total = subtotalZero + subtotalIva + ivaAmount;
        return { subtotalZero, subtotalIva, ivaAmount, total };
    }, [items]);

    // Crear nueva Cotización
    const handleSaveCotizacion = async () => {
        if (!nombreCliente || !rucCliente) {
            toast.error("Por favor ingresa el nombre y RUC del cliente.");
            return;
        }
        if (items.length === 0) {
            toast.error("Agrega al menos un ítem a la cotización.");
            return;
        }

        const nextSeqNum = cotizaciones.length + 1002;
        const newCotizacion: Cotizacion = {
            id: `COT-${Date.now()}`,
            secuencial: `COT-${String(nextSeqNum).padStart(4, '0')}`,
            fechaEmision: new Date().toISOString().split('T')[0],
            fechaValidez: new Date(Date.now() + diasValidez * 86400000).toISOString().split('T')[0],
            clienteId: selectedClientId || undefined,
            rucCliente,
            nombreCliente,
            emailCliente,
            telefonoCliente,
            direccionCliente,
            items,
            ...formTotals,
            estado: 'Borrador',
            notas,
            createdAt: new Date().toISOString()
        };

        const updatedList = [newCotizacion, ...cotizaciones];
        await saveCotizacionesToDb(updatedList);
        setIsCreateModalOpen(false);
        toast.success(`🎉 Cotización ${newCotizacion.secuencial} creada exitosamente.`);
    };

    // Cambiar estado de Cotización
    const handleChangeEstado = async (id: string, newEstado: Cotizacion['estado']) => {
        const updated = cotizaciones.map(c => c.id === id ? { ...c, estado: newEstado } : c);
        await saveCotizacionesToDb(updated);
        toast.success(`Cotización actualizada a: ${newEstado}`);
    };

    // Convertir a Factura SRI
    const handleConvertToInvoice = (cot: Cotizacion) => {
        const firstItem = cot.items[0];
        const desc = cot.items.map(i => `${i.descripcion} (x${i.cantidad})`).join(' + ');
        navigate('sri_facturacion', {
            clientId: cot.clienteId,
            amount: cot.total,
            description: desc || `Proforma ${cot.secuencial}`
        });
        handleChangeEstado(cot.id, 'Facturada');
        toast.info(`Transfiriendo cotización ${cot.secuencial} a Facturación SRI...`);
    };

    // Imprimir Proforma / RIDE Cotización
    const handlePrintCotizacion = (cot: Cotizacion) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error("Por favor, habilita las ventanas emergentes en tu navegador.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cotización Proforma - ${cot.secuencial}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-b: 2px solid #00A896; padding-bottom: 20px; margin-bottom: 25px; }
                    .logo-title { font-size: 22px; font-weight: 900; color: #00A896; text-transform: uppercase; letter-spacing: 1px; }
                    .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
                    .cot-badge { background: #00A896; color: white; font-weight: 800; padding: 6px 16px; border-radius: 12px; font-size: 14px; text-transform: uppercase; }
                    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; background: #f8fafc; padding: 16px; border-radius: 16px; font-size: 12px; border: 1px solid #e2e8f0; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
                    .table th { background: #0f172a; color: white; text-transform: uppercase; font-size: 10px; padding: 10px; text-align: left; }
                    .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                    .totals { display: flex; justify-content: flex-end; margin-bottom: 25px; }
                    .totals-box { width: 260px; font-size: 12px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; }
                    .totals-final { font-weight: 900; font-size: 16px; color: #00A896; border-bottom: none; padding-top: 10px; }
                    .footer-notes { background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 12px; font-size: 11px; color: #1e40af; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="logo-title">Soluciones Contables & Tributarias</div>
                        <div class="subtitle">Santiago Córdova — Asesoria Profesional e Innovación Digital</div>
                        <div class="subtitle">RUC: 0705787745001 • Pasaje, El Oro</div>
                    </div>
                    <div class="cot-badge">${cot.secuencial}</div>
                </div>

                <div class="grid-info">
                    <div>
                        <strong>CLIENTE:</strong> ${cot.nombreCliente}<br/>
                        <strong>RUC / CÉDULA:</strong> ${cot.rucCliente}<br/>
                        <strong>TELÉFONO:</strong> ${cot.telefonoCliente || '—'}<br/>
                        <strong>EMAIL:</strong> ${cot.emailCliente || '—'}
                    </div>
                    <div style="text-align: right;">
                        <strong>FECHA EMISIÓN:</strong> ${cot.fechaEmision}<br/>
                        <strong>VÁLIDO HASTA:</strong> ${cot.fechaValidez}<br/>
                        <strong>ESTADO:</strong> ${cot.estado.toUpperCase()}
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Descripción del Servicio / Producto</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">P. Unit.</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cot.items.map(i => `
                            <tr>
                                <td>${i.descripcion} ${i.aplicaIva ? '<small style="color:#00A896">(IVA 15%)</small>' : '<small style="color:#64748b">(IVA 0%)</small>'}</td>
                                <td style="text-align: center;">${i.cantidad}</td>
                                <td style="text-align: right;">$${i.precioUnitario.toFixed(2)}</td>
                                <td style="text-align: right; font-weight: 700;">$${i.subtotal.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row"><span>Subtotal IVA 0%:</span> <span>$${cot.subtotalZero.toFixed(2)}</span></div>
                        <div class="totals-row"><span>Subtotal IVA 15%:</span> <span>$${cot.subtotalIva.toFixed(2)}</span></div>
                        <div class="totals-row"><span>IVA 15%:</span> <span>$${cot.ivaAmount.toFixed(2)}</span></div>
                        <div class="totals-row totals-final"><span>TOTAL ESTIMADO:</span> <span>$${cot.total.toFixed(2)}</span></div>
                    </div>
                </div>

                <div class="footer-notes">
                    <strong>📌 NOTAS Y CONDICIONES:</strong><br/>
                    ${cot.notas || 'Validez de la cotización: 15 días.'}
                </div>

                <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Cotizaciones filtradas
    const filteredCotizaciones = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return cotizaciones.filter(c => {
            if (filterEstado !== 'todos' && c.estado !== filterEstado) return false;
            if (!q) return true;
            return c.nombreCliente.toLowerCase().includes(q) ||
                   c.rucCliente.includes(q) ||
                   c.secuencial.toLowerCase().includes(q);
        });
    }, [cotizaciones, searchTerm, filterEstado]);

    const totalCotizacionesSum = useMemo(() => {
        return cotizaciones.reduce((acc, c) => acc + c.total, 0);
    }, [cotizaciones]);

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER PRO DE COTIZACIONES ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-[#00A896] to-teal-600 shadow-xl shadow-[#00A896]/30 text-white shrink-0">
                            <FileSpreadsheet size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#00A896] animate-pulse shadow-[0_0_10px_rgba(0,168,150,0.8)]" />
                                <span className="text-[10px] font-black text-[#00A896] uppercase tracking-[0.3em]">Gestión de Ofertas & Proformas</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Cotizaciones y Presupuestos
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Genera proformas profesionales para servicios contables, firmas electrónicas y facturadores con conversión en 1-clic a Factura SRI.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#00A896] to-teal-500 hover:from-teal-400 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-[#00A896]/25 active:scale-95 shrink-0"
                    >
                        <Plus size={18} /> Nueva Cotización Proforma
                    </button>
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, RUC o secuencial..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar">
                    {['todos', 'Borrador', 'Enviada', 'Aprobada', 'Facturada'].map(st => (
                        <button
                            key={st}
                            onClick={() => setFilterEstado(st)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border shrink-0 ${
                                filterEstado === st
                                    ? 'bg-[#00A896]/20 border-[#00A896]/40 text-[#00A896]'
                                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'
                            }`}
                        >
                            {st === 'todos' ? 'Todas' : st}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── TABLA DE COTIZACIONES ── */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                {filteredCotizaciones.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl text-slate-400">
                        No hay cotizaciones registradas con los filtros seleccionados.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-4 px-5">Secuencial / Emisión</th>
                                    <th className="py-4 px-5">Cliente</th>
                                    <th className="py-4 px-5">Detalle / Servicios</th>
                                    <th className="py-4 px-5">Estado</th>
                                    <th className="py-4 px-5 text-right">Monto Total</th>
                                    <th className="py-4 px-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredCotizaciones.map((cot) => (
                                    <tr key={cot.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-5">
                                            <p className="font-mono font-bold text-teal-400">{cot.secuencial}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">Emisión: {cot.fechaEmision}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="font-bold text-white uppercase">{cot.nombreCliente}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">RUC: {cot.rucCliente}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="text-slate-300 font-medium line-clamp-1">
                                                {cot.items.map(i => i.descripcion).join(', ')}
                                            </p>
                                            <span className="text-[10px] text-slate-500 font-mono">{cot.items.length} ítems incluidos</span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <select
                                                value={cot.estado}
                                                onChange={(e) => handleChangeEstado(cot.id, e.target.value as any)}
                                                className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase outline-none cursor-pointer bg-slate-950 ${
                                                    cot.estado === 'Aprobada' ? 'border-emerald-500/30 text-emerald-400' :
                                                    cot.estado === 'Facturada' ? 'border-indigo-500/30 text-indigo-400' :
                                                    cot.estado === 'Enviada' ? 'border-amber-500/30 text-amber-400' :
                                                    'border-slate-700 text-slate-400'
                                                }`}
                                            >
                                                <option value="Borrador">📝 Borrador</option>
                                                <option value="Enviada">📤 Enviada</option>
                                                <option value="Aprobada">✅ Aprobada</option>
                                                <option value="Facturada">🧾 Facturada SRI</option>
                                                <option value="Rechazada">❌ Rechazada</option>
                                            </select>
                                        </td>
                                        <td className="py-4 px-5 text-right font-mono font-bold text-lg text-white">
                                            ${cot.total.toFixed(2)}
                                        </td>
                                        <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                                            <button
                                                onClick={() => handlePrintCotizacion(cot)}
                                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase transition-all inline-flex items-center gap-1 text-[10px]"
                                                title="Imprimir / Exportar PDF Proforma"
                                            >
                                                <Printer size={12} /> Imprimir
                                            </button>

                                            <button
                                                onClick={() => handleConvertToInvoice(cot)}
                                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold uppercase transition-all inline-flex items-center gap-1 text-[10px] border border-emerald-500/20"
                                                title="Facturar esta cotización en el Facturador SRI"
                                            >
                                                <Zap size={12} /> Facturar SRI
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── MODAL NUEVA COTIZACIÓN ── */}
            {isCreateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsCreateModalOpen(null as any)} title="📝 Nueva Cotización Proforma" size="lg">
                    <div className="space-y-6 p-4 text-white">
                        {/* Selector de Cliente Existente */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                                Seleccionar Cliente del Directorio (Opcional)
                            </label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => handleSelectClient(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-bold text-white outline-none focus:border-[#00A896]"
                            >
                                <option value="">-- Seleccionar cliente o ingresar prospecto manualmente --</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} — {c.ruc}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Datos del Cliente */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre / Razón Social *</label>
                                <input
                                    type="text"
                                    value={nombreCliente}
                                    onChange={(e) => setNombreCliente(e.target.value)}
                                    placeholder="Ej: Juan Perez / Empresa S.A."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-bold outline-none focus:border-[#00A896]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">RUC / Cédula *</label>
                                <input
                                    type="text"
                                    value={rucCliente}
                                    onChange={(e) => setRucCliente(e.target.value)}
                                    placeholder="Ej: 0701234567001"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-bold outline-none focus:border-[#00A896]"
                                />
                            </div>
                        </div>

                        {/* Ítems de Cotización */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Detalle de Servicios y Productos
                                </label>
                                <button
                                    onClick={handleAddItem}
                                    className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-bold border border-indigo-500/30 flex items-center gap-1"
                                >
                                    <Plus size={12} /> Agregar Ítem
                                </button>
                            </div>

                            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
                                {items.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-slate-950 border border-white/5">
                                        <div className="col-span-6">
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={(e) => handleUpdateItem(item.id, 'descripcion', e.target.value)}
                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.cantidad}
                                                onChange={(e) => handleUpdateItem(item.id, 'cantidad', parseFloat(e.target.value) || 1)}
                                                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white text-center font-mono outline-none"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={item.precioUnitario}
                                                onChange={(e) => handleUpdateItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white text-right font-mono outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <button onClick={() => handleRemoveItem(item.id)} className="text-rose-400 hover:text-rose-300">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totales Resumen */}
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex justify-between items-center text-xs font-mono">
                            <span className="text-slate-400 font-bold uppercase">Total Cotizado:</span>
                            <span className="text-2xl font-black text-emerald-400">${formTotals.total.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCotizacion}
                                className="px-6 py-2 rounded-xl bg-[#00A896] hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg"
                            >
                                Guardar Cotización
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
