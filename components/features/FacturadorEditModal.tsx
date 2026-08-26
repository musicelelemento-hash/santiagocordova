import React, { useState } from 'react';
import { 
    X, ShoppingBag, Globe, Key, Eye, EyeOff, Copy, Check, 
    Save, Shield, Laptop, DollarSign, Calendar, FileText, 
    Layers, Sparkles, ExternalLink, HelpCircle
} from 'lucide-react';
import { Client, BillingPlan, BillingPlanType } from '../../types';
import { useToast } from '../../context/ToastContext';

interface FacturadorEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    onSave: (clientId: string, updatedPlan: Partial<BillingPlan>, clientUpdates?: Partial<Client>) => Promise<void> | void;
}

const PRESET_PLATFORMS = [
    { name: 'SRI en Línea (Gratuito)', url: 'https://srienlinea.sri.gob.ec', type: 'sri_gratuito' as BillingPlanType, icon: '🏛️' },
    { name: 'Ecuafact', url: 'https://app.ecuafact.com', type: 'por_factura' as BillingPlanType, icon: '⚡' },
    { name: 'Siigo Contífico', url: 'https://login.contifico.com', type: 'plan_mensual' as BillingPlanType, icon: '💼' },
    { name: 'Dátil', url: 'https://app.datil.co', type: 'por_factura' as BillingPlanType, icon: '📊' },
    { name: 'Facturito', url: 'https://facturito.ec', type: 'por_factura' as BillingPlanType, icon: '🛒' },
    { name: 'Zifact', url: 'https://sistema.zifac.com', type: 'paquete_docs' as BillingPlanType, icon: '📦' },
];

export const FacturadorEditModal: React.FC<FacturadorEditModalProps> = ({
    isOpen,
    onClose,
    client,
    onSave
}) => {
    const { toast } = useToast();
    const currentPlan = client.billingPlan || client.facturadorConfig || {};

    const [programName, setProgramName] = useState(currentPlan.programName || 'SRI en Línea (Gratuito)');
    const [url, setUrl] = useState(currentPlan.url || 'https://srienlinea.sri.gob.ec');
    const [username, setUsername] = useState(currentPlan.username || client.ruc || '');
    const [password, setPassword] = useState(currentPlan.password || client.sriPassword || '');
    const [planType, setPlanType] = useState<BillingPlanType>(currentPlan.planType || 'por_factura');
    const [feePerInvoice, setFeePerInvoice] = useState<number>(currentPlan.feePerInvoice ?? 1.00);
    const [monthlyFee, setMonthlyFee] = useState<number>(currentPlan.monthlyFee ?? 20.00);
    const [includedInvoices, setIncludedInvoices] = useState<number>(currentPlan.includedInvoices ?? 30);
    const [documentCount, setDocumentCount] = useState<number>(currentPlan.documentCount ?? 100);
    const [expirationDate, setExpirationDate] = useState(currentPlan.expirationDate || '');
    const [price, setPrice] = useState<number>(currentPlan.price ?? 0);
    
    // Credenciales sincronizadas
    const [sriPassword, setSriPassword] = useState(client.sriPassword || '');
    const [signaturePassword, setSignaturePassword] = useState(client.electronicSignaturePassword || '');

    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleCopy = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        toast.success(`Copiado: ${fieldName}`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleSelectPreset = (preset: typeof PRESET_PLATFORMS[0]) => {
        setProgramName(preset.name);
        setUrl(preset.url);
        if (!currentPlan.planType) {
            setPlanType(preset.type);
        }
        toast.info(`Configurado preset: ${preset.name}`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const updatedPlan: Partial<BillingPlan> = {
                ...currentPlan,
                programName: programName.trim(),
                url: url.trim(),
                username: username.trim(),
                password: password.trim(),
                planType,
                feePerInvoice: Number(feePerInvoice) || 0,
                monthlyFee: Number(monthlyFee) || 0,
                includedInvoices: Number(includedInvoices) || 0,
                documentCount: Number(documentCount) || 0,
                expirationDate: expirationDate || undefined,
                price: Number(price) || 0,
                updatedAt: new Date().toISOString()
            };

            const clientUpdates: Partial<Client> = {
                sriPassword: sriPassword.trim(),
                electronicSignaturePassword: signaturePassword.trim()
            };

            await onSave(client.id, updatedPlan, clientUpdates);
            toast.success(`✅ Facturador de ${client.name} actualizado con éxito.`);
            onClose();
        } catch (err: any) {
            toast.error(`Error guardando facturador: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-2xl bg-[#051424] border border-white/15 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans"
                onClick={e => e.stopPropagation()}
            >
                {/* Background ambient light */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-[#00A896]/15 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#2B6AFF]/15 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 relative z-10 bg-[#0b1326]/60 backdrop-blur-xl">
                    <div className="flex items-center gap-3 font-mono">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-600 flex items-center justify-center text-white shadow-lg shadow-[#00A896]/20">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-widest">EXPEDIENTE DE EMISIÓN</span>
                            <h2 className="text-lg font-black text-white uppercase font-display leading-tight truncate max-w-md">
                                {client.tradeName || client.name}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar relative z-10 text-xs font-mono">
                    
                    {/* Presets Rápidos de Software */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                            Plataforma de Facturación Rápida
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {PRESET_PLATFORMS.map(p => {
                                const isSelected = programName.toLowerCase().includes(p.name.toLowerCase());
                                return (
                                    <button
                                        type="button"
                                        key={p.name}
                                        onClick={() => handleSelectPreset(p)}
                                        className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                                            isSelected 
                                                ? 'bg-[#00A896]/20 border-[#00A896] text-white shadow-md shadow-[#00A896]/10 font-bold'
                                                : 'bg-[#020b14] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                        }`}
                                    >
                                        <span className="text-base">{p.icon}</span>
                                        <span className="truncate text-[11px]">{p.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Software Name & URL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Nombre del Facturador
                            </label>
                            <input
                                type="text"
                                value={programName}
                                onChange={e => setProgramName(e.target.value)}
                                placeholder="Ej: Ecuafact, SRI en Línea, Siigo..."
                                required
                                className="w-full px-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]/60 transition-all font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                <span>URL de Acceso Directo</span>
                                {url && (
                                    <a 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-[#00A896] hover:underline flex items-center gap-1 text-[9px]"
                                    >
                                        Probar Enlace <ExternalLink size={10} />
                                    </a>
                                )}
                            </label>
                            <div className="relative">
                                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="url"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://app.ecuafact.com..."
                                    className="w-full pl-10 pr-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]/60 transition-all font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Credenciales de Acceso al Facturador */}
                    <div className="p-5 bg-[#020b14] border border-white/10 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Key size={13} /> Credenciales de Login al Facturador
                            </span>
                            <span className="text-[9px] text-slate-500">Accesos con 1 toque en pantalla</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Usuario */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                    Usuario / RUC
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder={client.ruc}
                                        className="w-full px-3.5 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono text-xs outline-none focus:border-[#00A896]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(username, 'Usuario')}
                                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                                        title="Copiar usuario"
                                    >
                                        {copiedField === 'Usuario' ? <Check size={14} className="text-[#00A896]" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>

                            {/* Contraseña Facturador */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                    Contraseña Facturador
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <div className="relative w-full">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Contraseña del portal..."
                                            className="w-full pl-3.5 pr-9 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono text-xs outline-none focus:border-[#00A896]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                        >
                                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(password, 'Clave Facturador')}
                                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                                        title="Copiar contraseña"
                                    >
                                        {copiedField === 'Clave Facturador' ? <Check size={14} className="text-[#00A896]" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Claves SRI & Firma Sincronizadas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                    🏛️ Clave SRI (Portal Oficial)
                                </label>
                                <input
                                    type="text"
                                    value={sriPassword}
                                    onChange={e => setSriPassword(e.target.value)}
                                    placeholder="Clave SRI..."
                                    className="w-full px-3.5 py-2 bg-[#051424] border border-white/10 rounded-xl text-slate-200 font-mono text-xs outline-none focus:border-[#00A896]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                    🔐 Clave Firma Electrónica (.p12)
                                </label>
                                <input
                                    type="text"
                                    value={signaturePassword}
                                    onChange={e => setSignaturePassword(e.target.value)}
                                    placeholder="Clave del certificado .p12..."
                                    className="w-full px-3.5 py-2 bg-[#051424] border border-white/10 rounded-xl text-slate-200 font-mono text-xs outline-none focus:border-[#00A896]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Modelo de Cobro y Tarifa de Honorarios */}
                    <div className="p-5 bg-[#020b14] border border-white/10 rounded-3xl space-y-4">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <DollarSign size={13} /> Modalidad de Cobro & Honorarios Contables
                        </span>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { id: 'por_factura', label: 'Por Factura', desc: 'Tarifa por comprobante' },
                                { id: 'plan_mensual', label: 'Plan Mensual', desc: 'Tarifa fija recurrente' },
                                { id: 'paquete_docs', label: 'Paquete Docs', desc: 'Saldo de comprobantes' },
                                { id: 'sri_gratuito', label: 'SRI Gratuito', desc: 'Solo soporte contable' },
                            ].map(m => (
                                <button
                                    type="button"
                                    key={m.id}
                                    onClick={() => setPlanType(m.id as any)}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        planType === m.id
                                            ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                                            : 'bg-[#051424] border-white/10 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <div className="text-xs">{m.label}</div>
                                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">{m.desc}</div>
                                </button>
                            ))}
                        </div>

                        {/* Inputs condicionales según el modelo */}
                        <div className="pt-2">
                            {planType === 'por_factura' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Honorario por Cada Factura Llenada ($ USD)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                            <input
                                                type="number"
                                                step="0.25"
                                                min="0"
                                                value={feePerInvoice}
                                                onChange={e => setFeePerInvoice(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center text-[10px] text-slate-400 font-sans bg-white/5 p-3 rounded-xl">
                                        💡 Ejemplo: Si emites 15 facturas en el mes a $1.00 c/u, el sistema liquidará $15.00 a cobrar.
                                    </div>
                                </div>
                            )}

                            {planType === 'plan_mensual' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Tarifa Plana Mensual ($ USD)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={monthlyFee}
                                                onChange={e => setMonthlyFee(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Facturas Incluidas al Mes
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={includedInvoices}
                                            onChange={e => setIncludedInvoices(parseInt(e.target.value, 10) || 0)}
                                            className="w-full px-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {planType === 'paquete_docs' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Saldo de Documentos
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={documentCount}
                                            onChange={e => setDocumentCount(parseInt(e.target.value, 10) || 0)}
                                            className="w-full px-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Precio Paquete ($ USD)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={price}
                                            onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                                            className="w-full px-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                            Fecha Caducidad Plan
                                        </label>
                                        <input
                                            type="date"
                                            value={expirationDate ? expirationDate.split('T')[0] : ''}
                                            onChange={e => setExpirationDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-[#051424] border border-white/10 rounded-xl text-white font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {planType === 'sri_gratuito' && (
                                <div className="text-[11px] text-slate-400 bg-white/5 p-3 rounded-xl font-sans">
                                    🏛️ Emisión directa desde el portal SRI en Línea con firma electrónica .p12 sin costo de software externo.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold uppercase tracking-wider shadow-lg shadow-[#00A896]/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Save size={16} />
                            <span>{isSaving ? 'Guardando...' : 'Guardar Facturador'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
