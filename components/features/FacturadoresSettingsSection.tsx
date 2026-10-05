import React, { useState } from 'react';
import {
    ShoppingBag, Plus, Trash2, Edit3, Save, Check, CheckCircle,
    ExternalLink, Eye, EyeOff, Send, Zap, Mail, DollarSign,
    AlertCircle, Sparkles, Laptop, Key, FileText, RefreshCw,
    Lock, ShieldCheck, X, ChevronRight, Layers, ArrowUpRight
} from 'lucide-react';
import { SystemComboConfig, SystemSettings } from '../../types';
import { sendResendEmail } from '../../services/resendEmailService';
import { useToast } from '../../context/ToastContext';

interface FacturadoresSettingsSectionProps {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
    onSaveAll: () => Promise<void> | void;
    isSaving: boolean;
    saved: boolean;
}

export const FacturadoresSettingsSection: React.FC<FacturadoresSettingsSectionProps> = ({
    settings,
    onUpdateSettings,
    onSaveAll,
    isSaving,
    saved
}) => {
    const { toast } = useToast();
    const [editingCombo, setEditingCombo] = useState<SystemComboConfig | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    
    // Resend email test state
    const [isTestingResend, setIsTestingResend] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [resendStatus, setResendStatus] = useState<{ success?: boolean; message?: string } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);

    // Form fields for editing/creating combo
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState<SystemComboConfig['category']>('talonario');
    const [formPrice, setFormPrice] = useState<number>(40);
    const [formCostPrice, setFormCostPrice] = useState<number>(12);
    const [formDocCount, setFormDocCount] = useState<number>(100);
    const [formIsUnlimited, setFormIsUnlimited] = useState<boolean>(false);
    const [formValidity, setFormValidity] = useState<'anual' | 'mensual' | 'permanente'>('anual');
    const [formAccessUrl, setFormAccessUrl] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formIsActive, setFormIsActive] = useState<boolean>(true);

    const handleOpenEdit = (combo: SystemComboConfig) => {
        setEditingCombo(combo);
        setIsCreatingNew(false);
        setFormName(combo.name);
        setFormCategory(combo.category);
        setFormPrice(combo.price);
        setFormCostPrice(combo.costPrice ?? 0);
        setFormDocCount(combo.documentCount ?? 100);
        setFormIsUnlimited((combo.documentCount ?? 0) >= 999999 || combo.category === 'sri_gratuito');
        setFormValidity(combo.validityPeriod ?? (combo.category === 'sri_gratuito' ? 'permanente' : 'anual'));
        setFormAccessUrl(combo.accessUrl ?? '');
        setFormNotes(combo.notes ?? '');
        setFormIsActive(combo.isActive);
    };

    const handleOpenCreate = () => {
        setIsCreatingNew(true);
        setEditingCombo({
            id: `combo-${Date.now()}`,
            name: '',
            price: 45,
            costPrice: 15,
            category: 'talonario',
            documentCount: 100,
            validityPeriod: 'anual',
            isActive: true,
            accessUrl: 'https://talonarioamigo.santiagocordova.com',
            notes: ''
        });
        setFormName('');
        setFormCategory('talonario');
        setFormPrice(45);
        setFormCostPrice(15);
        setFormDocCount(100);
        setFormIsUnlimited(false);
        setFormValidity('anual');
        setFormAccessUrl('https://talonarioamigo.santiagocordova.com');
        setFormNotes('');
        setFormIsActive(true);
    };

    const handleSaveComboForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error("El nombre del plan o facturador es obligatorio.");
            return;
        }

        const updatedCombo: SystemComboConfig = {
            id: editingCombo?.id || `combo-${Date.now()}`,
            name: formName.trim(),
            category: formCategory,
            price: Number(formPrice) || 0,
            costPrice: Number(formCostPrice) || 0,
            documentCount: formIsUnlimited ? 999999 : Number(formDocCount) || 0,
            validityPeriod: formValidity,
            accessUrl: formAccessUrl.trim(),
            notes: formNotes.trim(),
            isActive: formIsActive
        };

        const currentCombos = settings.combos || [];
        const exists = currentCombos.some(c => c.id === updatedCombo.id);
        const newCombos = exists
            ? currentCombos.map(c => c.id === updatedCombo.id ? updatedCombo : c)
            : [...currentCombos, updatedCombo];

        onUpdateSettings({
            ...settings,
            combos: newCombos,
            lastUpdated: new Date().toISOString()
        });

        toast.success(`Plan "${updatedCombo.name}" guardado en memoria.`);
        setEditingCombo(null);
        setIsCreatingNew(false);
    };

    const handleDeleteCombo = (id: string, name: string) => {
        if (!confirm(`¿Eliminar el plan "${name}" de la configuración?`)) return;
        const newCombos = (settings.combos || []).filter(c => c.id !== id);
        onUpdateSettings({
            ...settings,
            combos: newCombos,
            lastUpdated: new Date().toISOString()
        });
        toast.info(`Plan "${name}" eliminado.`);
    };

    const handleToggleActive = (id: string) => {
        const newCombos = (settings.combos || []).map(c => 
            c.id === id ? { ...c, isActive: !c.isActive } : c
        );
        onUpdateSettings({
            ...settings,
            combos: newCombos,
            lastUpdated: new Date().toISOString()
        });
    };

    // Quick preset helper when selecting category in form
    const handleCategoryChange = (cat: SystemComboConfig['category']) => {
        setFormCategory(cat);
        if (cat === 'sri_gratuito') {
            setFormPrice(0);
            setFormCostPrice(0);
            setFormIsUnlimited(true);
            setFormValidity('permanente');
            setFormAccessUrl('https://srienlinea.sri.gob.ec');
            if (!formName) setFormName('Facturador SRI Gratuito');
        } else if (cat === 'talonario') {
            setFormAccessUrl('https://talonarioamigo.santiagocordova.com');
            if (!formName) setFormName('Talonario Amigo 100 docs');
        } else if (cat === 'ecuafact') {
            setFormAccessUrl('https://app.ecuafact.com');
            if (!formName) setFormName('Combo ECUAFACT 60 docs');
        } else if (cat === 'zifact') {
            setFormAccessUrl('https://sistema.zifac.com');
            if (!formName) setFormName('Combo ZIFACT 100 docs');
        } else if (cat === 'firma') {
            setFormDocCount(0);
            if (!formName) setFormName('Solo Firma Electrónica .p12 (1 año)');
        }
    };

    const handleTestResend = async () => {
        const apiKey = settings.resendApiKey;
        if (!apiKey || !apiKey.trim()) {
            toast.error("Ingresa primero la API Key de Resend.");
            return;
        }

        setIsTestingResend(true);
        setResendStatus(null);
        try {
            const recipient = testEmail.trim() || 'santiagocordova@gmail.com';
            const res = await sendResendEmail({
                apiKey: apiKey.trim(),
                from: settings.resendSenderEmail || 'facturacion@santiagocordova.com',
                to: recipient,
                subject: '⚡ Prueba de Conexión Exitosa - Soluciones Contables Pro',
                html: `
                    <div style="font-family: sans-serif; background: #020617; color: #fff; padding: 32px; border-radius: 20px; border: 1px solid rgba(201,169,110,0.3); max-width: 500px; margin: 0 auto;">
                        <span style="background: rgba(201,169,110,0.2); color: #C9A96E; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 50px; text-transform: uppercase;">Resend Conectado</span>
                        <h2 style="color: #ffffff; margin-top: 16px;">¡Conexión Exitosa con Resend!</h2>
                        <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
                            Tu clave de API está operando correctamente desde <strong>Soluciones Contables Pro</strong>. Ya puedes enviar avisos de caducidad, comprobantes agotados y credenciales a tus clientes en tiempo real.
                        </p>
                        <div style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px; font-size: 12px; color: #38bdf8; margin-top: 16px;">
                            Fecha de prueba: ${new Date().toLocaleString('es-EC')}
                        </div>
                    </div>
                `
            });

            if (res.success) {
                setResendStatus({ success: true, message: `Correo de prueba enviado con éxito (ID: ${res.id})` });
                toast.success("✅ Correo enviado con éxito mediante Resend.");
            } else {
                setResendStatus({ success: false, message: res.error || 'Error enviando correo' });
                toast.error(`Error: ${res.error}`);
            }
        } catch (e: any) {
            setResendStatus({ success: false, message: e.message });
            toast.error("Fallo de conexión con Resend.");
        } finally {
            setIsTestingResend(false);
        }
    };

    // Calculate margins and statistics
    const totalCombos = (settings.combos || []).length;
    const activeCombos = (settings.combos || []).filter(c => c.isActive).length;
    const potentialMargin = (settings.combos || []).reduce((acc, c) => acc + ((c.price || 0) - (c.costPrice || 0)), 0);

    return (
        <div className="rounded-[2.5rem] bg-surface-low border border-foreground/10 border-t-foreground/20 shadow-2xl backdrop-blur-2xl overflow-hidden font-mono space-y-8 p-6 sm:p-10">
            {/* ── HEADER DE SECCIÓN ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-foreground/10">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-gradient-to-br from-tertiary/20 to-primary/10 border border-tertiary/30 rounded-2xl text-tertiary shadow-lg shadow-tertiary/10">
                        <ShoppingBag size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest bg-tertiary/10 px-2.5 py-0.5 rounded-full border border-tertiary/20">
                                Catálogo & Precios 2026
                            </span>
                            {saved && (
                                <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold animate-in fade-in">
                                    <CheckCircle size={13} /> Guardado
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black font-display text-on-surface uppercase tracking-tight mt-1">
                            Facturadores, Planes & Tarifas de Llenado
                        </h2>
                        <p className="text-xs text-on-surface-variant font-sans mt-0.5 max-w-2xl">
                            Administra Ecuafact, Zifact, tu propio <strong>Talonario Amigo</strong> y el Facturador Gratuito del SRI. Controla costos de compra, precios al cliente y márgenes netos.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleOpenCreate}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary border border-tertiary/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-tertiary/5"
                    >
                        <Plus size={14} />
                        <span>Añadir Facturador</span>
                    </button>
                    <button
                        onClick={onSaveAll}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-tertiary to-tertiary hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-tertiary/25 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>Guardar Todo</span>
                    </button>
                </div>
            </div>

            {/* ── KPI BANNER DE RENTABILIDAD ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-surface-lowest border border-foreground/10 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Facturadores</div>
                        <div className="text-2xl font-black text-on-surface mt-1">{totalCombos} <span className="text-xs text-on-surface-variant font-normal">({activeCombos} activos)</span></div>
                    </div>
                    <Layers size={22} className="text-tertiary/70" />
                </div>
                <div className="p-4 rounded-2xl bg-surface-lowest border border-foreground/10 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Propio & SRI Gratuito</div>
                        <div className="text-2xl font-black text-on-surface mt-1">
                            {(settings.combos || []).filter(c => c.category === 'talonario' || c.category === 'sri_gratuito').length}
                        </div>
                    </div>
                    <Sparkles size={22} className="text-amber-400" />
                </div>
                <div className="p-4 rounded-2xl bg-surface-lowest border border-foreground/10 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Margen Bruto de Catálogo</div>
                        <div className="text-2xl font-black text-tertiary mt-1 font-mono">${potentialMargin.toFixed(2)} USD</div>
                    </div>
                    <DollarSign size={22} className="text-tertiary" />
                </div>
            </div>

            {/* ── FORMULARIO DE CREACIÓN / EDICIÓN INLINE ── */}
            {editingCombo && (
                <div className="p-6 bg-surface-lowest border-2 border-tertiary/40 rounded-3xl space-y-5 animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl shadow-tertiary/10">
                    <div className="flex items-center justify-between pb-3 border-b border-foreground/10">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-tertiary/15 text-tertiary">
                                {isCreatingNew ? <Plus size={16} /> : <Edit3 size={16} />}
                            </span>
                            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                                {isCreatingNew ? 'Registrar Nuevo Plan o Facturador' : `Editando: ${editingCombo.name}`}
                            </h3>
                        </div>
                        <button
                            onClick={() => { setEditingCombo(null); setIsCreatingNew(false); }}
                            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 rounded-xl transition-all cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleSaveComboForm} className="space-y-4 text-xs font-mono">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Nombre del Plan */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre del Plan / Combo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Talonario Amigo 100 docs"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary"
                                />
                            </div>

                            {/* Categoría / Software */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Software / Categoría *</label>
                                <select
                                    value={formCategory}
                                    onChange={(e) => handleCategoryChange(e.target.value as any)}
                                    className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary"
                                >
                                    <option value="talonario">💎 Talonario Amigo (Propio)</option>
                                    <option value="sri_gratuito">🏛️ Facturador SRI Gratuito (Ley)</option>
                                    <option value="ecuafact">📄 Ecuafact</option>
                                    <option value="zifact">⚡ Zifact</option>
                                    <option value="firma">🔑 Solo Firma Electrónica</option>
                                    <option value="otro">📦 Otro Facturador</option>
                                </select>
                            </div>

                            {/* URL de Acceso */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">URL de Acceso Directo</label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={formAccessUrl}
                                    onChange={(e) => setFormAccessUrl(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary"
                                />
                            </div>

                            {/* Precio al Cliente */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-tertiary uppercase">Precio Venta al Cliente ($) *</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formPrice}
                                        onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface font-bold outline-none focus:border-tertiary"
                                    />
                                </div>
                            </div>

                            {/* Costo de Compra */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-amber-400 uppercase">Costo Compra / Despacho ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formCostPrice}
                                        onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface font-bold outline-none focus:border-amber-400"
                                    />
                                </div>
                            </div>

                            {/* Margen Calculado en Vivo */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Margen de Ganancia</label>
                                <div className="px-3.5 py-2.5 bg-tertiary/10 border border-tertiary/30 rounded-xl flex items-center justify-between">
                                    <span className="font-bold text-tertiary">${(formPrice - formCostPrice).toFixed(2)} USD</span>
                                    <span className="text-[10px] font-bold text-tertiary bg-tertiary/20 px-2 py-0.5 rounded-md">
                                        {formPrice > 0 ? `${Math.round(((formPrice - formCostPrice) / formPrice) * 100)}%` : '0%'}
                                    </span>
                                </div>
                            </div>

                            {/* Cupo de Documentos */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Comprobantes Incluidos</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-tertiary font-bold">
                                        <input
                                            type="checkbox"
                                            checked={formIsUnlimited}
                                            onChange={(e) => setFormIsUnlimited(e.target.checked)}
                                            className="rounded"
                                        />
                                        <span>Ilimitado (SRI)</span>
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    disabled={formIsUnlimited}
                                    value={formIsUnlimited ? 999999 : formDocCount}
                                    onChange={(e) => setFormDocCount(parseInt(e.target.value) || 0)}
                                    className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary disabled:opacity-50"
                                />
                            </div>

                            {/* Vigencia */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Período de Vigencia</label>
                                <select
                                    value={formValidity}
                                    onChange={(e) => setFormValidity(e.target.value as any)}
                                    className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary"
                                >
                                    <option value="anual">1 Año (Anual)</option>
                                    <option value="mensual">Mensual</option>
                                    <option value="permanente">Permanente / Sin Vencimiento</option>
                                </select>
                            </div>

                            {/* Estado Activo */}
                            <div className="space-y-1.5 flex flex-col justify-end">
                                <label className="flex items-center gap-2 p-2.5 bg-surface-low border border-foreground/10 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formIsActive}
                                        onChange={(e) => setFormIsActive(e.target.checked)}
                                        className="rounded text-tertiary"
                                    />
                                    <span className="text-[11px] font-bold text-on-surface">Disponible para Venta y Asignación</span>
                                </label>
                            </div>
                        </div>

                        {/* Notas */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase">Descripción / Observaciones</label>
                            <input
                                type="text"
                                placeholder="Ej: Emisión rápida, incluye soporte y configuración inicial"
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                className="w-full px-3.5 py-2 bg-surface-low border border-foreground/10 rounded-xl text-on-surface outline-none focus:border-tertiary"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => { setEditingCombo(null); setIsCreatingNew(false); }}
                                className="px-4 py-2 border border-foreground/10 rounded-xl text-on-surface-variant hover:text-on-surface text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-tertiary hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-tertiary/20 flex items-center gap-1.5"
                            >
                                <Check size={14} />
                                <span>{isCreatingNew ? 'Registrar en Catálogo' : 'Actualizar Plan'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── LISTA DE FACTURADORES & COMBOS REGISTRADOS ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    <span>Planes en el Sistema ({(settings.combos || []).length})</span>
                    <span className="text-[10px]">Haz clic en editar para cambiar precios o URLs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(settings.combos || []).map(combo => {
                        const cost = combo.costPrice ?? 0;
                        const price = combo.price ?? 0;
                        const margin = price - cost;
                        const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;
                        const isSriGratuito = combo.category === 'sri_gratuito';

                        const icon = 
                            combo.category === 'talonario' ? '💎' :
                            combo.category === 'ecuafact' ? '📄' :
                            combo.category === 'zifact' ? '⚡' :
                            combo.category === 'sri_gratuito' ? '🏛️' :
                            combo.category === 'firma' ? '🔑' : '📦';

                        return (
                            <div
                                key={combo.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                    combo.isActive 
                                        ? 'bg-surface-lowest border-foreground/10 hover:border-tertiary/40' 
                                        : 'bg-surface-lowest/40 border-foreground/5 opacity-60'
                                }`}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xl p-2 rounded-xl bg-surface-low border border-foreground/10 shrink-0">
                                                {icon}
                                            </span>
                                            <div>
                                                <h4 className="text-xs font-bold text-on-surface uppercase truncate max-w-[180px]">
                                                    {combo.name}
                                                </h4>
                                                <span className="text-[9px] font-bold text-tertiary uppercase bg-tertiary/10 px-2 py-0.5 rounded border border-tertiary/20">
                                                    {combo.category}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleToggleActive(combo.id)}
                                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border cursor-pointer ${
                                                combo.isActive 
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                                    : 'bg-foreground/5 text-on-surface-variant border-foreground/10'
                                            }`}
                                        >
                                            {combo.isActive ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </div>

                                    {/* Insignias de Documentos y Vigencia */}
                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                        <span className="bg-foreground/5 text-on-surface-variant px-2 py-0.5 rounded border border-foreground/5 font-mono">
                                            📄 {combo.documentCount && combo.documentCount >= 999999 ? 'Ilimitados' : `${combo.documentCount || 0} docs`}
                                        </span>
                                        <span className="bg-foreground/5 text-on-surface-variant px-2 py-0.5 rounded border border-foreground/5">
                                            📅 {combo.validityPeriod === 'permanente' ? 'Permanente' : combo.validityPeriod === 'mensual' ? 'Mensual' : 'Anual'}
                                        </span>
                                        {combo.accessUrl && (
                                            <a
                                                href={combo.accessUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sky-400 hover:underline flex items-center gap-0.5"
                                            >
                                                <ExternalLink size={10} /> Link
                                            </a>
                                        )}
                                    </div>

                                    {/* Breakdown Financiero */}
                                    <div className="p-3 bg-surface-low border border-foreground/10 rounded-xl space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-on-surface-variant">Precio Cliente:</span>
                                            <span className="font-bold text-on-surface font-mono text-sm">${price.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-on-surface-variant">Costo Despacho:</span>
                                            <span className="text-amber-400 font-mono">${cost.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-foreground/5 text-[11px]">
                                            <span className="text-tertiary font-bold">Margen Neto:</span>
                                            <span className="text-tertiary font-bold font-mono">
                                                +${margin.toFixed(2)} ({marginPercent}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-foreground/5">
                                    <button
                                        onClick={() => handleOpenEdit(combo)}
                                        className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-foreground/10 rounded-lg transition-all cursor-pointer"
                                        title="Editar este plan"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCombo(combo.id, combo.name)}
                                        className="p-1.5 text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                        title="Eliminar del catálogo"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SECCIÓN 2: TARIFAS DE LLENADO DE FACTURAS (EMISIÓN A TERCEROS) ── */}
            <div className="p-6 bg-surface-lowest border border-foreground/10 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                            Tarifas de Llenado de Facturas (Servicio a Clientes)
                        </h3>
                        <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                            Valores predeterminados aplicables al facturar por cuenta de clientes como Pinea, Wilmer o Camba Paola.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Tarifa Unitaria */}
                    <div className="p-4 bg-surface-low border border-foreground/10 rounded-2xl space-y-2">
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase">Factura Unitaria (Por Unidad)</div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                            <input
                                type="number"
                                step="0.50"
                                min="0"
                                value={settings.defaultFillingUnitFee ?? 2.00}
                                onChange={(e) => onUpdateSettings({
                                    ...settings,
                                    defaultFillingUnitFee: parseFloat(e.target.value) || 2.00,
                                    lastUpdated: new Date().toISOString()
                                })}
                                className="w-full pl-7 pr-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-bold outline-none focus:border-tertiary"
                            />
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-sans">
                            Cobro estándar por cada comprobante llenado (ej: $2.00 por factura).
                        </p>
                    </div>

                    {/* Pack 5 Facturas */}
                    <div className="p-4 bg-surface-low border border-foreground/10 rounded-2xl space-y-2">
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase">Paquete Mensual (Hasta 5 docs)</div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                            <input
                                type="number"
                                step="0.50"
                                min="0"
                                value={settings.defaultFillingPack5Fee ?? 5.00}
                                onChange={(e) => onUpdateSettings({
                                    ...settings,
                                    defaultFillingPack5Fee: parseFloat(e.target.value) || 5.00,
                                    lastUpdated: new Date().toISOString()
                                })}
                                className="w-full pl-7 pr-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-bold outline-none focus:border-tertiary"
                            />
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-sans">
                            Tarifa fija promocional para clientes con emisión reducida mensual (ej: $5.00 hasta 5 facturas).
                        </p>
                    </div>

                    {/* Combo Mensual $10 (Camba Paola) */}
                    <div className="p-4 bg-surface-low border border-foreground/10 rounded-2xl space-y-2">
                        <div className="text-[10px] font-bold text-tertiary uppercase">Combo Mensual Declaración + Facturas</div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                            <input
                                type="number"
                                step="1.00"
                                min="0"
                                value={settings.defaultMonthlyComboFee ?? 10.00}
                                onChange={(e) => onUpdateSettings({
                                    ...settings,
                                    defaultMonthlyComboFee: parseFloat(e.target.value) || 10.00,
                                    lastUpdated: new Date().toISOString()
                                })}
                                className="w-full pl-7 pr-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-tertiary font-bold outline-none focus:border-tertiary"
                            />
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-sans">
                            Cobro conjunto mensual: $5.00 por declaración mensual + $5.00 de facturas llenadas ($10.00 total).
                        </p>
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 3: SERVICIO DE CORREO ELECTRÓNICO (RESEND) ── */}
            <div className="p-6 bg-surface-lowest border border-foreground/10 rounded-3xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            <Mail size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                                Servicio de Correo Electrónico Profesional (Resend)
                            </h3>
                            <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                                Envía informes de liquidación, avisos de caducidad y credenciales seguras directamente a los clientes.
                            </p>
                        </div>
                    </div>

                    <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-bold"
                    >
                        <span>Obtener API Key en Resend</span>
                        <ExternalLink size={10} />
                    </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Resend API Key */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Resend API Key</label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                placeholder="re_123456789..."
                                value={settings.resendApiKey || ''}
                                onChange={(e) => onUpdateSettings({
                                    ...settings,
                                    resendApiKey: e.target.value.trim(),
                                    lastUpdated: new Date().toISOString()
                                })}
                                className="w-full pr-10 pl-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                            >
                                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Email Remitente */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Email Remitente</label>
                        <input
                            type="email"
                            placeholder="facturacion@santiagocordova.com"
                            value={settings.resendSenderEmail || ''}
                            onChange={(e) => onUpdateSettings({
                                ...settings,
                                resendSenderEmail: e.target.value.trim(),
                                lastUpdated: new Date().toISOString()
                            })}
                            className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                        />
                    </div>

                    {/* Nombre Remitente */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre Remitente</label>
                        <input
                            type="text"
                            placeholder="Ing. Santiago Córdova"
                            value={settings.resendSenderName || ''}
                            onChange={(e) => onUpdateSettings({
                                ...settings,
                                resendSenderName: e.target.value.trim(),
                                lastUpdated: new Date().toISOString()
                            })}
                            className="w-full px-3.5 py-2.5 bg-surface-low border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                        />
                    </div>
                </div>

                {/* Prueba de Envío */}
                <div className="p-4 bg-surface-low border border-foreground/10 rounded-2xl space-y-3 pt-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="w-full sm:flex-1">
                            <input
                                type="email"
                                placeholder="Ingresa tu correo para prueba (ej: santiagocordova@gmail.com)"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="w-full px-3.5 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleTestResend}
                            disabled={isTestingResend || !settings.resendApiKey}
                            className="w-full sm:w-auto px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 cursor-pointer"
                        >
                            {isTestingResend ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                            <span>Probar Envío Resend</span>
                        </button>
                    </div>

                    {resendStatus && (
                        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                            resendStatus.success 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                            {resendStatus.success ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                            <span>{resendStatus.message}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
