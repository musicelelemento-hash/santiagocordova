import React, { useState, useMemo } from 'react';
import {
    X, Search, Plus, Save, Building2, Tag, ShieldCheck, AlertCircle,
    Check, Filter, Sparkles, Edit2, Info, ArrowRightLeft
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
    SupplierCatalogService, SupplierRecord, SupplierCategory, TaxCreditDefault,
    CATEGORY_LABELS
} from '../../services/supplierCatalogService';

interface SupplierCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSupplierUpdated?: () => void;
}

export const SupplierCatalogModal: React.FC<SupplierCatalogModalProps> = ({
    isOpen,
    onClose,
    onSupplierUpdated
}) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [catalog, setCatalog] = useState<Record<string, SupplierRecord>>(() => SupplierCatalogService.getCatalog());
    
    // Estado para nuevo proveedor o edición
    const [isEditing, setIsEditing] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<SupplierRecord>({
        ruc: '',
        razonSocial: '',
        nombreComercial: '',
        categoria: 'general',
        reglaGeneral: 'con_credito',
        notas: ''
    });

    const suppliersList = useMemo(() => {
        return Object.values(catalog).filter(s => {
            const matchesSearch =
                s.ruc.includes(searchTerm) ||
                s.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.nombreComercial && s.nombreComercial.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory === 'all' || s.categoria === selectedCategory;

            return matchesSearch && matchesCategory;
        }).sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
    }, [catalog, searchTerm, selectedCategory]);

    const handleOpenCreate = () => {
        setEditingSupplier({
            ruc: '',
            razonSocial: '',
            nombreComercial: '',
            categoria: 'general',
            reglaGeneral: 'con_credito',
            notas: ''
        });
        setIsEditing(true);
    };

    const handleOpenEdit = (sup: SupplierRecord) => {
        setEditingSupplier({ ...sup });
        setIsEditing(true);
    };

    const handleSave = () => {
        const rucClean = editingSupplier.ruc.replace(/\D/g, '').trim();
        if (rucClean.length !== 13) {
            toast.error('El RUC del proveedor debe tener exactamente 13 dígitos.');
            return;
        }
        if (!editingSupplier.razonSocial.trim()) {
            toast.error('La Razón Social del proveedor es obligatoria.');
            return;
        }

        SupplierCatalogService.saveSupplier({
            ...editingSupplier,
            ruc: rucClean
        });

        setCatalog(SupplierCatalogService.getCatalog());
        setIsEditing(false);
        toast.success(`✅ Proveedor ${editingSupplier.razonSocial} guardado en el catálogo general.`);
        if (onSupplierUpdated) onSupplierUpdated();
    };

    const handleQuickToggleRule = (sup: SupplierRecord, rule: TaxCreditDefault) => {
        const updated = { ...sup, reglaGeneral: rule };
        SupplierCatalogService.saveSupplier(updated);
        setCatalog(SupplierCatalogService.getCatalog());
        toast.success(`Regla de ${sup.razonSocial} cambiada.`);
        if (onSupplierUpdated) onSupplierUpdated();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6 bg-[#020b14]/85 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="w-full max-w-5xl bg-[#051424] max-h-[92vh] flex flex-col rounded-3xl border border-white/10 shadow-2xl overflow-hidden font-mono">
                {/* Header */}
                <div className="p-6 bg-[#0b1326]/90 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shadow-lg shadow-amber-500/10">
                            <Building2 size={22} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                                <span>Catálogo General de Proveedores</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                                    {Object.keys(catalog).length} Registrados
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 font-sans mt-0.5">
                                Clasificación centralizada para segregación de compras SRI (Casillero 500 Crédito vs 502 Sin Crédito).
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenCreate}
                            className="px-4 py-2.5 bg-[#00A896] hover:bg-[#008f80] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#00A896]/20 active:scale-95 cursor-pointer"
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Nuevo Proveedor</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Sub-header / Search & Filter */}
                <div className="p-4 bg-[#08182b]/70 border-b border-white/5 flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por RUC o Razón Social (ej. Banco Pichincha, Favorita, Primax)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#020b14]/70 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-[#00A896] outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="px-3.5 py-2.5 bg-[#020b14]/70 border border-white/10 rounded-2xl text-xs text-slate-300 focus:border-[#00A896] outline-none cursor-pointer"
                        >
                            <option value="all">Todas las Categorías</option>
                            {Object.entries(CATEGORY_LABELS).map(([catId, info]) => (
                                <option key={catId} value={catId}>
                                    {info.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                    {isEditing ? (
                        /* Formulario de edición o creación */
                        <div className="max-w-2xl mx-auto bg-[#08182b] p-6 rounded-3xl border border-white/15 space-y-4 shadow-xl">
                            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Edit2 size={16} className="text-[#00A896]" />
                                    <span>{editingSupplier.ruc ? 'Editar Proveedor' : 'Nuevo Proveedor General'}</span>
                                </h3>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="text-xs text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        RUC del Proveedor (13 dígitos) *
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={13}
                                        value={editingSupplier.ruc}
                                        onChange={e => setEditingSupplier({ ...editingSupplier, ruc: e.target.value.replace(/\D/g, '') })}
                                        placeholder="Ej. 1790010937001"
                                        className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Nombre Comercial
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSupplier.nombreComercial || ''}
                                        onChange={e => setEditingSupplier({ ...editingSupplier, nombreComercial: e.target.value })}
                                        placeholder="Ej. BANCO PICHINCHA"
                                        className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Razón Social Oficial *
                                </label>
                                <input
                                    type="text"
                                    value={editingSupplier.razonSocial}
                                    onChange={e => setEditingSupplier({ ...editingSupplier, razonSocial: e.target.value })}
                                    placeholder="Ej. BANCO PICHINCHA C.A."
                                    className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Categoría General
                                    </label>
                                    <select
                                        value={editingSupplier.categoria}
                                        onChange={e => setEditingSupplier({ ...editingSupplier, categoria: e.target.value as SupplierCategory })}
                                        className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none"
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([catId, info]) => (
                                            <option key={catId} value={catId} className="bg-slate-900">
                                                {info.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Regla por Defecto SRI
                                    </label>
                                    <select
                                        value={editingSupplier.reglaGeneral}
                                        onChange={e => setEditingSupplier({ ...editingSupplier, reglaGeneral: e.target.value as TaxCreditDefault })}
                                        className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none"
                                    >
                                        <option value="con_credito" className="bg-slate-900">🟢 Con Crédito 100% (Casillero 500)</option>
                                        <option value="sin_credito" className="bg-slate-900">🔴 Sin Crédito / Personal (Casillero 502)</option>
                                        <option value="segun_actividad" className="bg-slate-900">🟡 Depende de la Actividad del Cliente</option>
                                        <option value="tarifa_cero" className="bg-slate-900">⚪ Tarifa 0% (Casillero 507)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Notas Contables / Justificación
                                </label>
                                <textarea
                                    rows={2}
                                    value={editingSupplier.notas || ''}
                                    onChange={e => setEditingSupplier({ ...editingSupplier, notas: e.target.value })}
                                    placeholder="Ej. Comisiones bancarias operativas para deducción en Formulario 104..."
                                    className="w-full px-3.5 py-2.5 bg-[#020b14] border border-white/10 rounded-xl text-xs text-white focus:border-[#00A896] outline-none resize-none font-sans"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-5 py-2.5 text-xs text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2.5 bg-[#00A896] hover:bg-[#008f80] text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#00A896]/20 flex items-center gap-2 cursor-pointer"
                                >
                                    <Save size={15} />
                                    <span>Guardar Proveedor</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Lista de proveedores */
                        <div className="space-y-3">
                            {suppliersList.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Building2 size={36} className="mx-auto mb-3 opacity-30 text-slate-500" />
                                    <p className="text-sm font-bold">No se encontraron proveedores</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Intenta con otro término de búsqueda o crea un nuevo proveedor.
                                    </p>
                                </div>
                            ) : (
                                suppliersList.map(sup => {
                                    const catInfo = CATEGORY_LABELS[sup.categoria] || CATEGORY_LABELS.general;
                                    return (
                                        <div
                                            key={sup.ruc}
                                            className="p-4 rounded-2xl bg-[#08182b]/80 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                                        >
                                            <div className="space-y-1 max-w-md">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white text-xs">
                                                        {sup.razonSocial}
                                                    </span>
                                                    {sup.nombreComercial && (
                                                        <span className="text-[10px] text-slate-400 font-sans">
                                                            ({sup.nombreComercial})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <span className="font-mono text-[#00A896]">{sup.ruc}</span>
                                                    <span>•</span>
                                                    <span className={`px-2 py-0.5 rounded-full ${catInfo.bg} ${catInfo.color} border ${catInfo.border}`}>
                                                        {catInfo.label}
                                                    </span>
                                                </div>
                                                {sup.notas && (
                                                    <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                                                        {sup.notas}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Regla y Botones */}
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <div className="flex items-center bg-[#020b14] p-1 rounded-xl border border-white/10 text-[10px]">
                                                    <button
                                                        onClick={() => handleQuickToggleRule(sup, 'con_credito')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${
                                                            sup.reglaGeneral === 'con_credito'
                                                                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                        title="Genera Crédito 100% (Casillero 500)"
                                                    >
                                                        500 Crédito
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickToggleRule(sup, 'sin_credito')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${
                                                            sup.reglaGeneral === 'sin_credito'
                                                                ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                        title="Gasto Personal / Sin Crédito (Casillero 502)"
                                                    >
                                                        502 Sin Crédito
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickToggleRule(sup, 'segun_actividad')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${
                                                            sup.reglaGeneral === 'segun_actividad'
                                                                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                        title="Depende de la actividad del cliente"
                                                    >
                                                        Por Actividad
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => handleOpenEdit(sup)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                                    title="Editar proveedor"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#0b1326] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
                    <span className="flex items-center gap-1.5">
                        <Info size={14} className="text-[#00A896]" />
                        <span>Los cambios en este catálogo aplican globalmente a las auditorías y declaraciones de compras.</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
