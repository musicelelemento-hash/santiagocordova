import React, { useState, useEffect } from 'react';
import {
    X, Save, User, ShieldCheck, Key, DollarSign, Building, Phone, Mail, MapPin,
    BadgePercent, Calendar, Lock, CheckCircle2, AlertCircle, FileText, Activity, Zap, Sparkles
} from 'lucide-react';
import { Client, TaxRegime, IvaFrequency } from '../../../types';
import { validateIdentifier } from '../../../services/sri';
import { useToast } from '../../../context/ToastContext';

interface ClientEditDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    onSave: (updatedClient: Client) => void;
}

export const ClientEditDrawer: React.FC<ClientEditDrawerProps> = ({
    isOpen,
    onClose,
    client,
    onSave
}) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState<Client>({ ...client });
    const [activeTab, setActiveTab] = useState<'general' | 'fiscal' | 'credentials' | 'fees'>('general');
    const [showSriPassword, setShowSriPassword] = useState(false);
    const [showSignaturePassword, setShowSignaturePassword] = useState(false);
    const [rucError, setRucError] = useState<string | null>(null);

    useEffect(() => {
        if (client) {
            setFormData({ ...client });
            setRucError(null);
        }
    }, [client, isOpen]);

    if (!isOpen) return null;

    const handleRucChange = (val: string) => {
        const clean = val.trim();
        setFormData(prev => ({ ...prev, ruc: clean }));
        if (clean.length >= 10) {
            const isValid = validateIdentifier(clean);
            if (!isValid) {
                setRucError('RUC / Cédula inválido según algoritmo SRI.');
            } else {
                setRucError(null);
            }
        } else {
            setRucError('Mínimo 10 dígitos.');
        }
    };

    const handlePhoneChange = (index: number, val: string) => {
        const updated = [...(formData.phones || [])];
        updated[index] = val;
        setFormData(prev => ({ ...prev, phones: updated }));
    };

    const handleAddPhone = () => {
        setFormData(prev => ({ ...prev, phones: [...(prev.phones || []), ''] }));
    };

    const handleRemovePhone = (index: number) => {
        const updated = (formData.phones || []).filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, phones: updated }));
    };

    const handleRegimeChange = (regime: TaxRegime) => {
        let defaultFreq: IvaFrequency = 'Mensual';
        let defaultRenta = true;

        if (regime === TaxRegime.RimpeNegocioPopular) {
            defaultFreq = 'Ninguno';
            defaultRenta = true;
        } else if (regime === TaxRegime.RimpeEmprendedor) {
            defaultFreq = 'Semestral';
            defaultRenta = true;
        }

        setFormData(prev => ({
            ...prev,
            regime,
            taxProfile: {
                ...(prev.taxProfile || {
                    ivaFrequency: defaultFreq,
                    requiresAnnualRenta: defaultRenta,
                    requiresAnexosGastos: false,
                    hasActiveDevolucionIva: false,
                    hasActiveElderlyDevolucionIva: false,
                    requiresIce: false,
                    requiresAnexoPvp: false
                }),
                ivaFrequency: defaultFreq,
                requiresAnnualRenta: defaultRenta
            }
        }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("El nombre o razón social es obligatorio.");
            return;
        }
        if (formData.ruc.trim().length < 10 || rucError) {
            toast.error("Por favor verifique el RUC o Cédula antes de guardar.");
            return;
        }

        onSave(formData);
        toast.success("Cliente actualizado exitosamente.");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-[#020b14]/80 backdrop-blur-xl animate-in fade-in duration-300">
            {/* Modal Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Main Centered Modal Window (Stitch Obsidian Glass) */}
            <div className="w-full max-w-4xl xl:max-w-5xl bg-[#051424]/95 backdrop-blur-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-3xl border border-white/10 border-t-white/20 animate-in zoom-in-95 duration-300 relative overflow-hidden z-10 font-sans">
                {/* Header */}
                <div className="p-6 bg-[#0b1326]/80 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30 flex items-center justify-center font-bold shadow-md shadow-[#00A896]/15">
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight font-display">
                                Editar Expediente de Cliente
                            </h2>
                            <p className="text-xs text-slate-400 font-mono font-medium mt-0.5">
                                {client.name} • <span className="text-[#00A896]">{client.ruc}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 p-2 bg-[#020b14]/60 border-b border-white/5 flex-shrink-0 overflow-x-auto font-mono">
                    {[
                        { id: 'general', label: '1. Datos Generales', icon: User },
                        { id: 'fiscal', label: '2. Perfil Fiscal SRI', icon: BadgePercent },
                        { id: 'credentials', label: '3. Credenciales', icon: Key },
                        { id: 'fees', label: '4. Honorarios', icon: DollarSign },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-md shadow-[#00A896]/20 border border-white/10'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Form Body */}
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* TAB 1: DATOS GENERALES */}
                    {activeTab === 'general' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                                    Nombre o Razón Social *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-[#00A896] outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        RUC / Cédula *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.ruc}
                                        onChange={e => handleRucChange(e.target.value)}
                                        className={`w-full px-4 py-3 bg-[#0b1326]/80 border rounded-2xl text-sm font-mono font-bold tracking-wider outline-none transition-all ${
                                            rucError
                                                ? 'border-rose-500/50 text-rose-400'
                                                : 'border-white/10 text-white focus:border-[#00A896]'
                                        }`}
                                    />
                                    {rucError && (
                                        <p className="text-[10px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} /> {rucError}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Nombre Comercial
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tradeName || ''}
                                        onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                                        placeholder="Ej. Comercial Don Pedro"
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-medium text-white focus:border-[#00A896] outline-none transition-all font-sans"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="cliente@ejemplo.com"
                                    className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-medium text-white focus:border-[#00A896] outline-none transition-all font-mono"
                                />
                            </div>

                            <div className="font-mono">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Teléfonos (WhatsApp)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddPhone}
                                        className="text-[10px] font-bold text-[#00A896] hover:underline"
                                    >
                                        + Agregar otro número
                                    </button>
                                </div>
                                {(formData.phones && formData.phones.length > 0 ? formData.phones : ['']).map((phone, idx) => (
                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={phone}
                                            onChange={e => handlePhoneChange(idx, e.target.value)}
                                            placeholder="Ej. 0991234567"
                                            className="flex-1 px-4 py-2.5 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-medium text-white focus:border-[#00A896] outline-none transition-all"
                                        />
                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhone(idx)}
                                                className="p-2.5 text-rose-400 hover:bg-rose-500/15 rounded-xl transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                                    Dirección Domiciliaria / Establecimiento
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.address || ''}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-medium text-white focus:border-[#00A896] outline-none transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-mono">
                                <label className="flex items-center gap-3 p-3 bg-[#0b1326]/80 rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.isArtisan || false}
                                        onChange={e => setFormData({ ...formData, isArtisan: e.target.checked })}
                                        className="w-4 h-4 text-[#00A896] rounded accent-[#00A896]"
                                    />
                                    <span className="text-xs font-bold text-slate-300">Calificación Artesanal</span>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-[#0b1326]/80 rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.isCourtesy || false}
                                        onChange={e => setFormData({ ...formData, isCourtesy: e.target.checked })}
                                        className="w-4 h-4 text-[#00A896] rounded accent-[#00A896]"
                                    />
                                    <span className="text-xs font-bold text-slate-300">Cliente de Cortesía (Sin Cobro)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: PERFIL FISCAL SRI */}
                    {activeTab === 'fiscal' && (
                        <div className="space-y-5 animate-in fade-in duration-200 font-mono">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Régimen Tributario SRI
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { id: TaxRegime.General, label: 'General', desc: 'IVA Mensual/Semestral' },
                                        { id: TaxRegime.RimpeEmprendedor, label: 'RIMPE Emprendedor', desc: 'IVA Semestral + Renta' },
                                        { id: TaxRegime.RimpeNegocioPopular, label: 'RIMPE Negocio Pop.', desc: 'Renta Anual Fija' },
                                    ].map(r => (
                                        <button
                                            type="button"
                                            key={r.id}
                                            onClick={() => handleRegimeChange(r.id)}
                                            className={`p-4 rounded-2xl border text-left transition-all ${
                                                formData.regime === r.id
                                                    ? 'bg-[#00A896]/15 border-[#00A896]/40 text-[#00A896] font-bold shadow-md shadow-[#00A896]/15'
                                                    : 'bg-[#0b1326]/80 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                            }`}
                                        >
                                            <p className="text-xs font-bold">{r.label}</p>
                                            <p className="text-[10px] opacity-75 mt-1 font-sans">{r.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Frecuencia IVA
                                    </label>
                                    <select
                                        value={formData.taxProfile?.ivaFrequency || 'Mensual'}
                                        onChange={e => setFormData({
                                            ...formData,
                                            taxProfile: {
                                                ...(formData.taxProfile || { requiresAnnualRenta: true, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }),
                                                ivaFrequency: e.target.value as any
                                            }
                                        })}
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-[#00A896] outline-none"
                                    >
                                        <option value="Mensual" className="bg-slate-900 text-white">Mensual</option>
                                        <option value="Semestral" className="bg-slate-900 text-white">Semestral</option>
                                        <option value="Ninguno" className="bg-slate-900 text-white">Ninguno</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Inicio de Obligaciones
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.clientStartPeriod || ''}
                                        onChange={e => setFormData({ ...formData, clientStartPeriod: e.target.value })}
                                        placeholder="Ej: 2026-01 o 2026-S1"
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 font-mono">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Obligaciones Especiales y Devoluciones</p>

                                <label className="flex items-center gap-3 p-3.5 bg-[#0b1326]/80 rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.taxProfile?.requiresAnnualRenta ?? true}
                                        onChange={e => setFormData({
                                            ...formData,
                                            taxProfile: {
                                                ...(formData.taxProfile || { ivaFrequency: 'Mensual', requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }),
                                                requiresAnnualRenta: e.target.checked
                                            }
                                        })}
                                        className="w-4 h-4 text-[#00A896] rounded accent-[#00A896]"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-white">Impuesto a la Renta Anual</span>
                                        <p className="text-[10px] text-slate-400 font-sans">Requiere declaración anual de Renta (Formulario 102/102A)</p>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3.5 bg-[#0b1326]/80 rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.taxProfile?.hasActiveDevolucionIva ?? false}
                                        onChange={e => setFormData({
                                            ...formData,
                                            taxProfile: {
                                                ...(formData.taxProfile || { ivaFrequency: 'Mensual', requiresAnnualRenta: true, requiresAnexosGastos: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }),
                                                hasActiveDevolucionIva: e.target.checked
                                            }
                                        })}
                                        className="w-4 h-4 text-[#00A896] rounded accent-[#00A896]"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-white">Devolución de IVA (Tercera Edad / Discapacidad)</span>
                                        <p className="text-[10px] text-slate-400 font-sans">Módulo activo para trámite de devolución de IVA</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: CREDENCIALES Y SEGURIDAD */}
                    {activeTab === 'credentials' && (
                        <div className="space-y-4 animate-in fade-in duration-200 font-mono">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Clave SRI en Línea
                                </label>
                                <div className="relative">
                                    <input
                                        type={showSriPassword ? "text" : "password"}
                                        value={formData.sriPassword || ''}
                                        onChange={e => setFormData({ ...formData, sriPassword: e.target.value })}
                                        placeholder="Clave del portal SRI"
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none pr-14"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSriPassword(!showSriPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white"
                                    >
                                        {showSriPassword ? "Ocultar" : "Ver"}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Contraseña Firma Electrónica (.p12)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showSignaturePassword ? "text" : "password"}
                                            value={formData.electronicSignaturePassword || ''}
                                            onChange={e => setFormData({ ...formData, electronicSignaturePassword: e.target.value })}
                                            placeholder="Contraseña del archivo .p12"
                                            className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none pr-14"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSignaturePassword(!showSignaturePassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white"
                                        >
                                            {showSignaturePassword ? "Ocultar" : "Ver"}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Expiración de Firma Electrónica
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.signatureExpirationDate ? formData.signatureExpirationDate.split('T')[0] : ''}
                                        onChange={e => setFormData({ ...formData, signatureExpirationDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-medium text-white focus:border-[#00A896] outline-none [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Contraseña IESS (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.iessPassword || ''}
                                    onChange={e => setFormData({ ...formData, iessPassword: e.target.value })}
                                    placeholder="Clave patronal/afiliado IESS"
                                    className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB 4: HONORARIOS */}
                    {activeTab === 'fees' && (
                        <div className="space-y-4 animate-in fade-in duration-200 font-mono">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Estructura Personalizada de Honorarios ($)
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Honorario Mensual ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fee_structure?.monthly ?? 5}
                                        onChange={e => setFormData({
                                            ...formData,
                                            fee_structure: {
                                                ...(formData.fee_structure || {}),
                                                monthly: parseFloat(e.target.value) || 0
                                            }
                                        })}
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Honorario Semestral ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fee_structure?.semestral ?? 10}
                                        onChange={e => setFormData({
                                            ...formData,
                                            fee_structure: {
                                                ...(formData.fee_structure || {}),
                                                semestral: parseFloat(e.target.value) || 0
                                            }
                                        })}
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Renta Anual ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fee_structure?.annual ?? 10}
                                        onChange={e => setFormData({
                                            ...formData,
                                            fee_structure: {
                                                ...(formData.fee_structure || {}),
                                                annual: parseFloat(e.target.value) || 0
                                            }
                                        })}
                                        className="w-full px-4 py-3 bg-[#0b1326]/80 border border-white/10 rounded-2xl text-sm font-mono font-bold text-white focus:border-[#00A896] outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer Actions */}
                <div className="p-5 bg-[#0b1326]/80 border-t border-white/10 flex items-center justify-between flex-shrink-0 font-mono">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleFormSubmit}
                        className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00A896]/20 active:scale-95 transition-all border border-white/10"
                    >
                        <Save size={15} />
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};
