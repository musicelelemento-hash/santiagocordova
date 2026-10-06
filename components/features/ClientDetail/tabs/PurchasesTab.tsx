import React, { useState, useEffect, useMemo } from 'react';
import {
    ShoppingCart, FileText, CheckCircle2, AlertCircle, Plus, Search,
    Sparkles, Building2, MessageCircle, ArrowRightLeft, Filter, Tag,
    ChevronLeft, ChevronRight, Check, X, DollarSign, Calendar, Info, Trash2
} from 'lucide-react';
import { Client } from '../../../../types';
import { formatPeriodForDisplay } from '../../../../services/sri';
import { useToast } from '../../../../context/ToastContext';
import {
    SupplierCatalogService, PurchaseInvoiceItem, ClientPurchasesAudit,
    ECONOMIC_ACTIVITIES, CATEGORY_LABELS, SupplierCategory
} from '../../../../services/supplierCatalogService';
import { SupplierCatalogModal } from '../../SupplierCatalogModal';

interface PurchasesTabProps {
    client: Client;
    onUpdateClientDirect?: (updatedData: Partial<Client>) => Promise<void>;
}

export const PurchasesTab: React.FC<PurchasesTabProps> = ({
    client,
    onUpdateClientDirect
}) => {
    const { toast } = useToast();

    // ── Período seleccionado (por defecto mes anterior) ─────────────────────────
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    });

    // ── Datos de auditoría de compras ───────────────────────────────────────────
    const [purchasesAudit, setPurchasesAudit] = useState<ClientPurchasesAudit>(() =>
        SupplierCatalogService.getClientPurchases(client, selectedPeriod)
    );

    // ── Filtros y Búsqueda ──────────────────────────────────────────────────────
    const [filterType, setFilterType] = useState<'all' | 'con_credito' | 'sin_credito' | 'tarifa_0'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // ── Formulario de Factura Manual ────────────────────────────────────────────
    const [newInvoice, setNewInvoice] = useState<Partial<PurchaseInvoiceItem>>({
        rucEmisor: '',
        razonSocial: '',
        secuencial: '',
        valorSinImpuestos: 0,
        iva: 0,
        importeTotal: 0,
        tieneCreditoTributario: true,
        tarifaIva: 15
    });

    // Recargar compras cuando cambia el cliente o período
    useEffect(() => {
        const audit = SupplierCatalogService.getClientPurchases(client, selectedPeriod);
        setPurchasesAudit(audit);
    }, [client.ruc, selectedPeriod]);

    // Actividad económica actual del cliente
    const currentActivityId = client.economicActivity || client.taxProfile?.economicActivity || 'servicios_profesionales';
    const currentActivity = ECONOMIC_ACTIVITIES.find(a => a.id === currentActivityId) || ECONOMIC_ACTIVITIES[0];

    // Cambiar período fiscal
    const handlePeriodChange = (deltaMonths: number) => {
        const [yStr, mStr] = selectedPeriod.split('-');
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + deltaMonths;
        if (m < 1) { m = 12; y--; }
        else if (m > 12) { m = 1; y++; }
        setSelectedPeriod(`${y}-${String(m).padStart(2, '0')}`);
    };

    // Cambiar actividad económica del cliente
    const handleActivityChange = async (newActId: string) => {
        const updatedProfile = {
            ...(client.taxProfile || {
                ivaFrequency: 'Mensual',
                requiresAnnualRenta: true,
                requiresAnexosGastos: false,
                hasActiveDevolucionIva: false,
                hasActiveElderlyDevolucionIva: false,
                requiresIce: false,
                requiresAnexoPvp: false
            }),
            economicActivity: newActId
        };

        if (onUpdateClientDirect) {
            await onUpdateClientDirect({
                economicActivity: newActId,
                taxProfile: updatedProfile as any
            });
        }
        toast.success(`Actividad económica actualizada a ${ECONOMIC_ACTIVITIES.find(a => a.id === newActId)?.label}`);
    };

    // Alternar crédito tributario de una factura individual (Toggle 500 vs 502)
    const handleToggleTaxCredit = (invoiceId: string) => {
        const updatedInvoices = purchasesAudit.invoices.map(inv => {
            if (inv.id === invoiceId) {
                return {
                    ...inv,
                    tieneCreditoTributario: !inv.tieneCreditoTributario
                };
            }
            return inv;
        });

        const updatedAudit: ClientPurchasesAudit = {
            ...purchasesAudit,
            invoices: updatedInvoices
        };

        SupplierCatalogService.saveClientPurchases(updatedAudit);
        setPurchasesAudit(SupplierCatalogService.getClientPurchases(client, selectedPeriod));
        toast.success('Clasificación tributaria actualizada.');
    };

    // Auto-clasificar todas las facturas según la actividad del cliente
    const handleAutoClassify = () => {
        const updatedInvoices = purchasesAudit.invoices.map(inv => {
            const supplier = SupplierCatalogService.findSupplier(inv.rucEmisor);
            const evaluation = SupplierCatalogService.evaluateTaxCredit(
                supplier,
                currentActivityId,
                inv.tarifaIva ?? 15
            );

            return {
                ...inv,
                categoria: supplier?.categoria || inv.categoria,
                tieneCreditoTributario: evaluation.tieneCredito
            };
        });

        const updatedAudit: ClientPurchasesAudit = {
            ...purchasesAudit,
            invoices: updatedInvoices
        };

        SupplierCatalogService.saveClientPurchases(updatedAudit);
        setPurchasesAudit(SupplierCatalogService.getClientPurchases(client, selectedPeriod));
        toast.success(`✨ ${updatedInvoices.length} facturas auto-clasificadas según el perfil de ${currentActivity.label}.`);
    };

    // Guardar factura manual
    const handleAddManualInvoice = () => {
        if (!newInvoice.rucEmisor || newInvoice.rucEmisor.length < 10) {
            toast.error('RUC emisor inválido.');
            return;
        }
        if (!newInvoice.razonSocial) {
            toast.error('Razón Social obligatoria.');
            return;
        }

        const subtotal = Number(newInvoice.valorSinImpuestos || 0);
        const tarifa = Number(newInvoice.tarifaIva || 15);
        const iva = tarifa === 0 ? 0 : Number((subtotal * (tarifa / 100)).toFixed(2));
        const total = Number((subtotal + iva).toFixed(2));

        const item: PurchaseInvoiceItem = {
            id: `manual-${Date.now()}`,
            numero: purchasesAudit.invoices.length + 1,
            secuencial: newInvoice.secuencial || '001-001-000000000',
            fechaEmision: newInvoice.fechaEmision || `${selectedPeriod}-01`,
            rucEmisor: newInvoice.rucEmisor.trim(),
            razonSocial: newInvoice.razonSocial.trim(),
            categoria: newInvoice.categoria || 'general',
            valorSinImpuestos: subtotal,
            iva,
            importeTotal: total,
            tieneCreditoTributario: !!newInvoice.tieneCreditoTributario,
            tarifaIva: tarifa,
            esManual: true
        };

        const updatedAudit: ClientPurchasesAudit = {
            ...purchasesAudit,
            invoices: [...purchasesAudit.invoices, item]
        };

        SupplierCatalogService.saveClientPurchases(updatedAudit);
        setPurchasesAudit(SupplierCatalogService.getClientPurchases(client, selectedPeriod));
        setIsAddModalOpen(false);
        setNewInvoice({
            rucEmisor: '',
            razonSocial: '',
            secuencial: '',
            valorSinImpuestos: 0,
            iva: 0,
            importeTotal: 0,
            tieneCreditoTributario: true,
            tarifaIva: 15
        });
        toast.success('Factura agregada al período.');
    };

    // Eliminar factura
    const handleDeleteInvoice = (id: string) => {
        const filtered = purchasesAudit.invoices.filter(i => i.id !== id);
        const updatedAudit: ClientPurchasesAudit = {
            ...purchasesAudit,
            invoices: filtered
        };
        SupplierCatalogService.saveClientPurchases(updatedAudit);
        setPurchasesAudit(SupplierCatalogService.getClientPurchases(client, selectedPeriod));
        toast.info('Factura removida.');
    };

    // Generar mensaje de WhatsApp
    const handleSendWhatsApp = () => {
        const phone = (client as any).phone || client.phones?.[0] || '';
        if (!phone) {
            toast.error('El cliente no tiene teléfono registrado.');
            return;
        }

        const periodLabel = formatPeriodForDisplay(selectedPeriod);
        const s = purchasesAudit.summary;
        const msg = encodeURIComponent(
            `Hola estimado(a) ${client.name} 👋,\n\n` +
            `Le comparto el resumen de compras procesadas para su declaración de *${periodLabel}*:\n\n` +
            `📄 Total Comprobantes: ${s.totalFacturas}\n` +
            `🟢 Compras con Crédito Tributario (Casillero 500): $${s.base15ConCredito.toFixed(2)} (IVA a favor: $${s.iva15ConCredito.toFixed(2)})\n` +
            `🔴 Gastos Personales / Sin Crédito (Casillero 502): $${s.base15SinCredito.toFixed(2)}\n` +
            (s.base0 > 0 ? `⚪ Compras Tarifa 0% (Casillero 507): $${s.base0.toFixed(2)}\n` : '') +
            (s.base5 > 0 ? `🔵 Compras Tarifa 5% (Casillero 540): $${s.base5.toFixed(2)}\n` : '') +
            `💰 Total Facturado en Compras: $${s.totalGasto.toFixed(2)}\n\n` +
            `Sus compras han sido debidamente segregadas conforme la normativa del SRI (Art. 66 LRTI).\n\n` +
            `Saludos cordiales,\nSantiago Córdova - Asesoría Tributaria`
        );

        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    };

    // Facturas filtradas para la tabla
    const filteredInvoices = useMemo(() => {
        return purchasesAudit.invoices.filter(inv => {
            const matchesSearch =
                inv.rucEmisor.includes(searchTerm) ||
                inv.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (inv.secuencial && inv.secuencial.includes(searchTerm));

            if (!matchesSearch) return false;

            if (filterType === 'con_credito') return inv.tieneCreditoTributario && (inv.tarifaIva ?? 15) > 0;
            if (filterType === 'sin_credito') return !inv.tieneCreditoTributario && (inv.tarifaIva ?? 15) > 0;
            if (filterType === 'tarifa_0') return (inv.tarifaIva ?? 0) === 0 || inv.iva === 0;

            return true;
        });
    }, [purchasesAudit.invoices, filterType, searchTerm]);

    const summary = purchasesAudit.summary;

    return (
        <div className="w-full space-y-6 font-mono text-slate-100">
            {/* ── 1. CABECERA TÁCTICA & SELECTOR DE PERÍODO ─────────────────────── */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shadow-lg shadow-amber-500/10">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-display">
                                Compras & Segregación Tributaria
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 uppercase">
                                Art. 66 LRTI
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-sans mt-0.5">
                            Gestión de facturas recibidas de <strong className="text-white">{client.name}</strong> • Casilleros 500 / 502 / 507 / 540.
                        </p>
                    </div>
                </div>

                {/* Período Selector & Botón Navegación */}
                <div className="flex items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
                    <div className="flex items-center bg-[#020b14] p-1.5 rounded-2xl border border-white/10 shadow-inner">
                        <button
                            onClick={() => handlePeriodChange(-1)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                            title="Mes anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="px-3 text-center min-w-[130px]">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Período</span>
                            <span className="text-xs font-black text-white">
                                {formatPeriodForDisplay(selectedPeriod)}
                            </span>
                        </div>
                        <button
                            onClick={() => handlePeriodChange(1)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                            title="Mes siguiente"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={handleSendWhatsApp}
                        className="px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer"
                        title="Enviar resumen de compras por WhatsApp"
                    >
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                </div>
            </div>

            {/* ── 2. ACTIVIDAD ECONÓMICA DEL CLIENTE (CATEGORIZACIÓN) ─────────── */}
            <div className="bg-[#051424]/70 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                        <Tag size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                            Actividad Económica del Contribuyente
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                                {currentActivity.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
                                • {currentActivity.description}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        value={currentActivityId}
                        onChange={e => handleActivityChange(e.target.value)}
                        className="flex-1 md:flex-initial px-3.5 py-2 bg-[#020b14] border border-white/15 rounded-xl text-xs font-bold text-slate-200 focus:border-[#00A896] outline-none cursor-pointer"
                    >
                        {ECONOMIC_ACTIVITIES.map(act => (
                            <option key={act.id} value={act.id} className="bg-slate-900 text-white">
                                {act.label}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={handleAutoClassify}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 shadow-lg shadow-amber-500/10 cursor-pointer"
                        title="Auto-clasificar todas las facturas del período según este giro"
                    >
                        <Sparkles size={14} />
                        <span>Auto-clasificar</span>
                    </button>
                </div>
            </div>

            {/* ── 3. KPI CARDS: CASILLEROS TRIBUTARIOS DEL FORMULARIO 104 SRI ──── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs font-mono">
                {/* Casillero 500 / 510: Con Crédito */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#051424]/90 border border-emerald-500/30 shadow-lg shadow-emerald-500/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                        <span>Casillero 500 / 510</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-[9px]">
                            100% Crédito
                        </span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-emerald-400 block font-mono">
                        ${summary.base15ConCredito.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>Crédito IVA (520): ${summary.iva15ConCredito.toFixed(2)}</span>
                    </div>
                </div>

                {/* Casillero 502 / 512: Sin Crédito Tributario */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#051424]/90 border border-rose-500/30 shadow-lg shadow-rose-500/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                        <span>Casillero 502 / 512</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 text-[9px]">
                            Sin Crédito
                        </span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-rose-400 block font-mono">
                        ${summary.base15SinCredito.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-rose-400/80 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        <span>Gasto Personal / No deducible</span>
                    </div>
                </div>

                {/* Casillero 507: Tarifa 0% */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#051424]/90 border border-white/10 shadow-lg">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                        <span>Casillero 507 / 517</span>
                        <span className="text-[9px] text-slate-400">Tarifa 0%</span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-slate-200 block font-mono">
                        ${summary.base0.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Insumos y servicios gravados 0%
                    </div>
                </div>

                {/* Casillero 540 (5%) + Comprobantes */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#051424]/90 border border-white/10 shadow-lg">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                        <span>Casillero 540 (5%)</span>
                        <span className="text-[9px] text-[#2B6AFF] font-bold">
                            {summary.totalFacturas} Facturas (115)
                        </span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-[#2B6AFF] block font-mono">
                        ${summary.base5.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-[#2B6AFF] mt-1">
                        Crédito 5%: ${summary.iva5.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* ── 4. BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTROS Y ACCIONES ───────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#051424]/70 p-4 rounded-2xl border border-white/10">
                {/* Search & Tabs */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar proveedor o RUC..."
                            className="w-full pl-9 pr-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-[#00A896] outline-none"
                        />
                    </div>

                    <div className="flex items-center bg-[#020b14] p-1 rounded-xl border border-white/10 text-[11px] overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                filterType === 'all' ? 'bg-white/15 text-white font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Todas ({purchasesAudit.invoices.length})
                        </button>
                        <button
                            onClick={() => setFilterType('con_credito')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                filterType === 'con_credito' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            500 Crédito
                        </button>
                        <button
                            onClick={() => setFilterType('sin_credito')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                filterType === 'sin_credito' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            502 Sin Crédito
                        </button>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => setIsCatalogModalOpen(true)}
                        className="px-3.5 py-2 bg-[#020b14] hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver y editar catálogo general de proveedores"
                    >
                        <Building2 size={14} className="text-amber-400" />
                        <span>Catálogo General</span>
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3.5 py-2 bg-[#00A896] hover:bg-[#008f80] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-[#00A896]/20 active:scale-95 cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Agregar Factura</span>
                    </button>
                </div>
            </div>

            {/* ── 5. TABLA DE FACTURAS DE COMPRAS DEL CLIENTE ──────────────────── */}
            <div className="bg-[#051424]/90 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-[#08182b] text-slate-400 border-b border-white/10 text-[10px] uppercase tracking-wider font-bold">
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">Proveedor / Emisor</th>
                                <th className="p-4">Categoría</th>
                                <th className="p-4 text-right">Base Imponible</th>
                                <th className="p-4 text-right">IVA</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-center">Clasificación SRI</th>
                                <th className="p-4 text-center w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                        <ShoppingCart size={32} className="mx-auto mb-2 opacity-30 text-slate-500" />
                                        <p className="font-bold">No hay comprobantes para el filtro seleccionado.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv, idx) => {
                                    const catInfo = CATEGORY_LABELS[inv.categoria || 'general'] || CATEGORY_LABELS.general;
                                    const isTarifa0 = (inv.tarifaIva ?? 0) === 0 || inv.iva === 0;

                                    return (
                                        <tr
                                            key={inv.id}
                                            className="hover:bg-white/[0.02] transition-colors group"
                                        >
                                            <td className="p-4 text-center text-slate-500 font-mono">
                                                {inv.numero || idx + 1}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-white max-w-xs truncate">
                                                    {inv.razonSocial}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                                    <span className="text-[#00A896]">{inv.rucEmisor}</span>
                                                    <span>•</span>
                                                    <span>{inv.secuencial || 'S/N'}</span>
                                                    {inv.fechaEmision && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{inv.fechaEmision}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${catInfo.bg} ${catInfo.color} border ${catInfo.border} whitespace-nowrap`}>
                                                    {catInfo.label}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-slate-200">
                                                ${inv.valorSinImpuestos.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-slate-300">
                                                ${inv.iva.toFixed(2)}
                                                {inv.tarifaIva === 5 && (
                                                    <span className="ml-1 text-[9px] text-[#2B6AFF] font-bold">(5%)</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-mono font-black text-amber-400">
                                                ${inv.importeTotal.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {isTarifa0 ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-white/10 font-bold">
                                                        Casillero 507 (0%)
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleTaxCredit(inv.id)}
                                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto active:scale-95 cursor-pointer ${
                                                            inv.tieneCreditoTributario
                                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                                        }`}
                                                        title="Haz clic para alternar entre Con Crédito (500) y Sin Crédito (502)"
                                                    >
                                                        {inv.tieneCreditoTributario ? (
                                                            <>
                                                                <Check size={13} className="text-emerald-400" />
                                                                <span>500 Crédito</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <X size={13} className="text-rose-400" />
                                                                <span>502 Personal</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {inv.esManual && (
                                                    <button
                                                        onClick={() => handleDeleteInvoice(inv.id)}
                                                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                                                        title="Eliminar factura manual"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Resumen */}
                <div className="p-4 bg-[#08182b] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
                    <div className="flex items-center gap-2">
                        <Info size={14} className="text-[#00A896]" />
                        <span>
                            Mostrando {filteredInvoices.length} de {purchasesAudit.invoices.length} facturas registradas.
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-white font-mono">
                        <span>Base Total: <strong className="text-emerald-400">${summary.totalBase.toFixed(2)}</strong></span>
                        <span>IVA Total: <strong className="text-amber-400">${summary.totalIva.toFixed(2)}</strong></span>
                    </div>
                </div>
            </div>

            {/* ── MODAL DE NUEVA FACTURA MANUAL ────────────────────────────────── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-[#020b14]/85 backdrop-blur-xl animate-in fade-in">
                    <div className="w-full max-w-lg bg-[#051424] p-6 rounded-3xl border border-white/15 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Plus size={16} className="text-[#00A896]" />
                                <span>Agregar Factura de Compra</span>
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">RUC Proveedor *</label>
                                <input
                                    type="text"
                                    maxLength={13}
                                    value={newInvoice.rucEmisor}
                                    onChange={e => setNewInvoice({ ...newInvoice, rucEmisor: e.target.value.replace(/\D/g, '') })}
                                    placeholder="13 dígitos"
                                    className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#00A896]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No. Comprobante</label>
                                <input
                                    type="text"
                                    value={newInvoice.secuencial}
                                    onChange={e => setNewInvoice({ ...newInvoice, secuencial: e.target.value })}
                                    placeholder="001-001-000000001"
                                    className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#00A896]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Razón Social *</label>
                            <input
                                type="text"
                                value={newInvoice.razonSocial}
                                onChange={e => setNewInvoice({ ...newInvoice, razonSocial: e.target.value })}
                                placeholder="Nombre del proveedor"
                                className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#00A896]"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Base Imponible ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newInvoice.valorSinImpuestos || ''}
                                    onChange={e => setNewInvoice({ ...newInvoice, valorSinImpuestos: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#00A896]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tarifa IVA</label>
                                <select
                                    value={newInvoice.tarifaIva ?? 15}
                                    onChange={e => setNewInvoice({ ...newInvoice, tarifaIva: parseInt(e.target.value, 10) })}
                                    className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none"
                                >
                                    <option value={15}>15% IVA</option>
                                    <option value={5}>5% IVA</option>
                                    <option value={0}>0% IVA</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoría</label>
                                <select
                                    value={newInvoice.categoria || 'general'}
                                    onChange={e => setNewInvoice({ ...newInvoice, categoria: e.target.value as SupplierCategory })}
                                    className="w-full px-3 py-2 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white outline-none"
                                >
                                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-2 p-3 bg-[#020b14] rounded-xl border border-white/10 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newInvoice.tieneCreditoTributario}
                                    onChange={e => setNewInvoice({ ...newInvoice, tieneCreditoTributario: e.target.checked })}
                                    className="w-4 h-4 text-[#00A896] rounded"
                                />
                                <span className="text-xs font-bold text-slate-200">
                                    Genera Crédito Tributario (Casillero 500)
                                </span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddManualInvoice}
                                className="px-5 py-2 bg-[#00A896] hover:bg-[#008f80] text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#00A896]/20 cursor-pointer"
                            >
                                Guardar Factura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL DEL CATÁLOGO GENERAL DE PROVEEDORES ────────────────────── */}
            <SupplierCatalogModal
                isOpen={isCatalogModalOpen}
                onClose={() => setIsCatalogModalOpen(false)}
                onSupplierUpdated={() => {
                    setPurchasesAudit(SupplierCatalogService.getClientPurchases(client, selectedPeriod));
                }}
            />
        </div>
    );
};
