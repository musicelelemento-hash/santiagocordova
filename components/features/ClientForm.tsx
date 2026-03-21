import React, { useState, useEffect, useRef } from 'react';
import { Client, TaxRegime, DeclarationStatus, StoredFile } from '../../types';
import { validateIdentifier, validateSriPassword, getPeriod } from '../../services/sri';
import { extractDataFromSriPdf, fileToBase64 } from '../../services/pdfExtraction';
import {
    User, Mail, Phone, MapPin, FileText, Plus, X, Upload, Check, Loader, Lock, Briefcase, Camera, ScanText, Sparkles, Building2, Receipt, Palette,
    ScanLine, CreditCard, Key, EyeOff, Eye, Calendar, DollarSign, Zap, Coins, ToggleRight, ToggleLeft, CheckCircle, AlertTriangle, Save, Users
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../context/ToastContext';
import { useAppStore } from '../../store/useAppStore';

interface ClientFormProps {
    initialData?: Partial<Client>;
    onSubmit: (client: Client) => void;
    onCancel: () => void;
    sriCredentials?: Record<string, string>;
}

const newClientInitialState: Partial<Client> = {
    regime: TaxRegime.General,
    sriPassword: '',
    ruc: '',
    name: '',
    address: '',
    isActive: true,
    phones: [''],
    email: '',
    notes: '',
    signatureExpirationDate: '',
    feeStructure: {
        monthly: 5,
        annual: 10,
        semestral: 10
    },
    taxProfile: {
        ivaFrequency: 'Mensual',
        requiresAnnualRenta: true,
        requiresAnexosGastos: false,
        hasActiveDevolucionIva: false,
        hasActiveElderlyDevolucionIva: false,
        requiresIce: false,
        requiresAnexoPvp: false
    }
};

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const { toast } = useToast();
    const { clients } = useAppStore();
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const [isVip, setIsVip] = useState(initialData?.isVip ?? false);
    const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

    // Tax Profile States
    const initialTaxProfile = initialData?.taxProfile || {
        ivaFrequency: 'Mensual' as const,
        requiresAnnualRenta: initialData?.taxProfile?.requiresAnnualRenta ?? true,
        requiresAnexosGastos: initialData?.notes?.includes('ANEXO_GASTOS') ? true : false,
        hasActiveDevolucionIva: initialData?.taxProfile?.hasActiveDevolucionIva ?? false
    };

    // Retrocompatibilidad inicial
    const [ivaFrequency, setIvaFrequency] = useState<'Mensual' | 'Semestral' | 'Ninguno'>(
        initialTaxProfile.ivaFrequency
    );
    const [requiresAnnualRenta, setRequiresAnnualRenta] = useState(initialTaxProfile.requiresAnnualRenta);
    const [requiresAnexosGastos, setRequiresAnexosGastos] = useState(initialTaxProfile.requiresAnexosGastos);
    const [hasActiveDevolucionIva, setHasActiveDevolucionIva] = useState(initialTaxProfile.hasActiveDevolucionIva);
    const [requiresIce, setRequiresIce] = useState(initialData?.taxProfile?.requiresIce ?? false);
    const [requiresAnexoPvp, setRequiresAnexoPvp] = useState(initialData?.taxProfile?.requiresAnexoPvp ?? false);

    const [monthlyFee, setMonthlyFee] = useState<string>(
        (clientData.feeStructure?.monthly ?? 5).toString()
    );
    const [annualFee, setAnnualFee] = useState<string>(
        (clientData.feeStructure?.annual ?? 10).toString()
    );

    const checkExistingRuc = (ruc: string) => {
        const cleanRuc = ruc.trim();
        if (cleanRuc.length >= 10) {
            const exists = clients.find(c => c.ruc === cleanRuc && c.id !== clientData.id);
            if (exists) {
                setValidationErrors(prev => ({ ...prev, ruc: `RUC ya registrado: ${exists.name}` }));
                setModalFeedback({
                    message: `Este RUC ya pertenece a ${exists.name}. Se actualizarán sus datos.`,
                    type: 'warning'
                });
            } else {
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.ruc;
                    return newErrors;
                });
                if (modalFeedback?.type === 'warning') setModalFeedback(null);
            }
        }
    };

    const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error("Por favor suba un archivo PDF válido.");
            return;
        }

        setIsAnalyzing(true);
        setModalFeedback(null);

        try {
            const extracted = await extractDataFromSriPdf(file);

            const cleanRuc = extracted.ruc.trim();
            const exists = clients.find(c => c.ruc === cleanRuc && c.id !== clientData.id);

            let passwordToUse = clientData.sriPassword;
            if (!passwordToUse && sriCredentials && sriCredentials[extracted.ruc]) {
                passwordToUse = sriCredentials[extracted.ruc];
                toast.success("¡Clave encontrada en Bóveda!");
            }
            // If the PDF is a RUC certificate, store it separately
            if (extracted.isCertificate) {
                const b64 = await fileToBase64(file);
                const certFile: StoredFile = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                    content: b64
                };
                setClientData(prev => ({ ...prev, rucCertificate: certFile }));
            }
            // Preserve existing VIP status if client already exists; otherwise default to false
            const existingVip = exists ? exists.isVip : false;
            setIsVip(existingVip);

            setClientData(prev => {
                const baseClient = exists || prev;
                return {
                    ...baseClient,
                    ruc: extracted.ruc,
                    name: extracted.apellidos_nombres || baseClient.name,
                    address: extracted.direccion || baseClient.address,
                    email: extracted.contacto.email || baseClient.email,
                    phones: extracted.contacto.celular ? [extracted.contacto.celular] : baseClient.phones,
                    regime: extracted.regimen || baseClient.regime,
                    sriPassword: passwordToUse,
                    // Preserve existing feeStructure; only set defaults for new clients
                    feeStructure: exists ? baseClient.feeStructure : {
                        monthly: 5,
                        annual: 10,
                        semestral: 10
                    },
                    isArtisan: extracted.es_artesano !== undefined ? extracted.es_artesano : baseClient.isArtisan,
                    establishmentCount: extracted.cantidad_establecimientos || baseClient.establishmentCount
                };
            });

            if (exists) {
                setModalFeedback({
                    message: `Cliente encontrado (${exists.name}). Se autocompletaron los campos vacíos con los datos del PDF. Al guardar, se actualizará este cliente.`,
                    type: 'warning'
                });
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.ruc;
                    return newErrors;
                });
            } else {
                setModalFeedback({ message: 'Datos escaneados. Perfil tributario autoconfigurado.', type: 'success' });
            }

            setMonthlyFee(exists ? (exists.feeStructure?.monthly ?? 5).toString() : "5");
            setAnnualFee(exists ? (exists.feeStructure?.annual ?? 10).toString() : "10");
            // VIP status already set above based on existence; no override needed

            if (!exists) {
                if (extracted.regimen === TaxRegime.RimpeNegocioPopular) {
                    setIvaFrequency('Ninguno');
                    setRequiresAnnualRenta(true);
                } else if (extracted.regimen === TaxRegime.RimpeEmprendedor || extracted.obligaciones_tributarias === 'semestral') {
                    setIvaFrequency('Semestral');
                    setRequiresAnnualRenta(true);
                    if (!exists || !exists.feeStructure?.semestral) setMonthlyFee("10");
                } else {
                    setIvaFrequency('Mensual');
                    setRequiresAnnualRenta(true);
                }
            } else {
                setIvaFrequency(exists.taxProfile?.ivaFrequency || 'Mensual');
                setRequiresAnnualRenta(exists.taxProfile?.requiresAnnualRenta ?? true);
            }

        } catch (error: any) {
            console.error(error);
            setModalFeedback({ message: 'Error al leer el PDF.', type: 'error' });
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = () => {
        const errors: Record<string, string> = {};
        if (!clientData.ruc) errors.ruc = 'RUC requerido';
        if (!clientData.name) errors.name = 'Nombre requerido';

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        const mFee = parseFloat(monthlyFee) || 5;
        const aFee = parseFloat(annualFee) || 10;

        let notes = clientData.notes || '';
        // Mantenemos [REQ: ...] por backward compat
        if (requiresAnexosGastos && !notes.includes('ANEXO_GASTOS')) notes += '\n[REQ: ANEXO_GASTOS]';
        if (hasActiveDevolucionIva && !notes.includes('DEVOLUCION_RET')) notes += '\n[REQ: DEVOLUCION_RET]';

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            isVip: isVip,
            phones: (clientData.phones || []).filter(p => p.trim() !== ''),
            isActive: isActive,
            notes: notes.trim(),
            signatureExpirationDate: clientData.signatureExpirationDate,
            taxProfile: {
                ivaFrequency,
                requiresAnnualRenta,
                requiresAnexosGastos,
                hasActiveDevolucionIva,
                hasActiveElderlyDevolucionIva: clientData.taxProfile?.hasActiveElderlyDevolucionIva ?? false,
                requiresIce,
                requiresAnexoPvp
            },
            feeStructure: {
                monthly: ivaFrequency === 'Mensual' ? mFee : (clientData.feeStructure?.monthly ?? 5),
                semestral: ivaFrequency === 'Semestral' ? mFee : (clientData.feeStructure?.semestral ?? 10),
                annual: aFee
            },
            declarationHistory: clientData.declarationHistory || [
                {
                    period: getPeriod({ ...clientData, regime: clientData.regime || TaxRegime.General } as Client, new Date()),
                    status: DeclarationStatus.Pendiente,
                    updatedAt: new Date().toISOString()
                }
            ]
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-8 animate-fade-in relative px-1">
            {/* STITCH SCANNER: High-Tech Import Area */}
            <div
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`
                    relative rounded-[2rem] border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-500 group overflow-hidden
                    ${isAnalyzing 
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
                        : 'glass-elite border-white/20 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'}
                `}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                {/* Scanner Animation Effect */}
                {isAnalyzing && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scan-line"></div>
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />

                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                            <Loader className="w-10 h-10 text-emerald-500 animate-spin relative z-10" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black text-emerald-500 uppercase tracking-[0.2em] animate-pulse">Analizando Núcleo SRI</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Extrayendo ADN Tributario...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-2">
                        <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-500 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                            <ScanLine size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="text-md font-black dark:text-white text-slate-800 uppercase tracking-widest mb-1">
                                <span className="text-gradient-teal">Stitch Scanner</span> Elite
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Arrastra o haz clic para procesar Certificado RUC (PDF)</p>
                        </div>
                    </div>
                )}
            </div>
            {clientData.rucCertificate && (
                <div className="flex items-center gap-2 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl animate-fade-in shadow-sm">
                    <div className="bg-teal-500/10 p-2 rounded-xl text-brand-teal">
                        <FileText size={18} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest leading-tight">Certificado RUC detectado</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{clientData.rucCertificate.name}</p>
                    </div>
                    <button
                        onClick={() => setClientData(prev => ({ ...prev, rucCertificate: undefined }))}
                        className="p-2 hover:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl transition-colors"
                        title="Eliminar certificado"
                    >
                        <X size={16} />
                    </button>
                    <div className="h-6 w-[1.5px] bg-teal-100 dark:bg-teal-800 mx-1"></div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-teal text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-500/20">
                        <Check size={12} strokeWidth={4} />
                        Validado
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6 glass-elite p-6 rounded-[2rem] border border-white/10">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                        <div className="bg-sky-500/10 p-2 rounded-xl text-sky-500">
                            <User size={20} />
                        </div>
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identidad y Contacto <span className="text-emerald-500 ml-1">Elite</span></h3>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">RUC Contribuyente</label>
                            <div className="relative group">
                                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    value={clientData.ruc || ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setClientData({ ...clientData, ruc: val });
                                        checkExistingRuc(val);
                                    }}
                                    className={`w-full pl-12 p-3.5 bg-white/5 dark:bg-slate-900/40 border rounded-2xl text-sm font-mono font-black outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all backdrop-blur-3xl ${validationErrors.ruc ? 'border-rose-500/50' : 'border-white/10 dark:border-white/5'}`}
                                    placeholder="1790000000001"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">Razón Social</label>
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    value={clientData.name || ''}
                                    onChange={e => setClientData({ ...clientData, name: e.target.value })}
                                    className="w-full pl-12 p-3.5 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-white/5 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-sky-500/30 transition-all backdrop-blur-3xl"
                                    placeholder="NOMBRE O RAZÓN SOCIAL"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">WhatsApp</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        value={(clientData.phones || [''])[0]}
                                        onChange={e => setClientData({ ...clientData, phones: [e.target.value] })}
                                        className="w-full pl-10 p-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-white/5 rounded-2xl text-xs font-black backdrop-blur-3xl"
                                        placeholder="09..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                                    <input
                                        type="email"
                                        value={clientData.email || ''}
                                        onChange={e => setClientData({ ...clientData, email: e.target.value })}
                                        className="w-full pl-10 p-3 bg-white/5 dark:bg-slate-900/40 border border-white/10 dark:border-white/5 rounded-2xl text-xs font-black backdrop-blur-3xl"
                                        placeholder="CORREO@EXCELENCIA.COM"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Dirección (Ubicación)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                                <textarea
                                    rows={2}
                                    value={clientData.address || ''}
                                    onChange={e => setClientData({ ...clientData, address: e.target.value })}
                                    className="w-full pl-8 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium resize-none"
                                    placeholder="Provincia, Ciudad, Calle principal..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 glass-elite p-6 rounded-[2rem] border border-white/10">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                        <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500">
                            <Briefcase size={20} />
                        </div>
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración <span className="text-gradient-teal">Tributaria</span></h3>
                    </div>

                    <div className="space-y-5">
                        <div className="mb-2">
                            <label className="text-[9px] font-black text-slate-400 mb-3 block uppercase tracking-widest pl-1">Régimen Estratégico</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: TaxRegime.General, label: 'GENERAL', icon: Building2 },
                                    { value: TaxRegime.RimpeEmprendedor, label: 'EMPRENDEDOR', icon: Zap },
                                    { value: TaxRegime.RimpeNegocioPopular, label: 'POPULAR', icon: Users }
                                ].map((opt) => {
                                    const Icon = opt.icon as any;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setClientData({ ...clientData, regime: opt.value });
                                                if (opt.value === TaxRegime.RimpeEmprendedor) {
                                                     setIvaFrequency('Semestral');
                                                     setRequiresAnnualRenta(true);
                                                     if (monthlyFee === "5") setMonthlyFee("10");
                                                 } else if (opt.value === TaxRegime.RimpeNegocioPopular) {
                                                     setIvaFrequency('Ninguno');
                                                     setRequiresAnnualRenta(true);
                                                 }
                                            }}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${clientData.regime === opt.value ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-xl scale-105' : 'bg-white/5 border-white/10 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500'}`}
                                        >
                                            <Icon size={14} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Clave SRI</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        value={clientData.sriPassword || ''}
                                        onChange={e => setClientData({ ...clientData, sriPassword: e.target.value })}
                                        className="w-full pl-10 pr-10 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold"
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                    />
                                    <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Vence Firma Elec.</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="date"
                                        value={clientData.signatureExpirationDate || ''}
                                        onChange={e => setClientData({ ...clientData, signatureExpirationDate: e.target.value })}
                                        className="w-full pl-10 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-wider">Frecuencia Declaración IVA</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'Mensual', label: 'Mensual' },
                                    { id: 'Semestral', label: 'Semestral' },
                                    { id: 'Ninguno', label: 'Ninguno / Exento' }
                                ].map(opt => (
                                    <button
                                         key={opt.id}
                                         disabled={clientData.regime === TaxRegime.RimpeEmprendedor || clientData.regime === TaxRegime.RimpeNegocioPopular}
                                         onClick={() => {
                                             setIvaFrequency(opt.id as any);
                                             if (opt.id === 'Semestral' && monthlyFee === "5") setMonthlyFee("10");
                                         }}
                                         className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${ivaFrequency === opt.id || (clientData.regime === TaxRegime.RimpeEmprendedor && opt.id === 'Semestral') || (clientData.regime === TaxRegime.RimpeNegocioPopular && opt.id === 'Ninguno') ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'} ${(clientData.regime === TaxRegime.RimpeEmprendedor && opt.id !== 'Semestral') || (clientData.regime === TaxRegime.RimpeNegocioPopular && opt.id !== 'Ninguno') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                     >
                                         {opt.label}
                                     </button>
                                ))}
                            </div>
                              {/* Módulos Extra (Tax Profile) */}
                        <div className="bg-slate-950/5 dark:bg-white/5 rounded-3xl p-5 border border-white/10 shadow-inner mb-4 backdrop-blur-3xl">
                            <label className="text-[9px] font-black text-slate-400 mb-4 block uppercase tracking-widest pl-1">Bóveda de Obligaciones</label>
                            <div className="space-y-3">
                                {[
                                    { id: 'renta', label: 'Impuesto Renta Anual (Obligatorio este año)', checked: requiresAnnualRenta, onChange: (v: boolean) => setRequiresAnnualRenta(v), disabled: false, color: 'emerald', icon: Calendar, sub: 'Operación Marzo' },
                                    { id: 'anexo', label: 'Anexo Gastos Pers.', checked: requiresAnexosGastos, onChange: (v: boolean) => setRequiresAnexosGastos(v), color: 'sky', icon: FileText, sub: 'Febrero' },
                                    { id: 'dev', label: 'Retorno Devolución', checked: hasActiveDevolucionIva, onChange: (v: boolean) => setHasActiveDevolucionIva(v), color: 'purple', icon: DollarSign, sub: 'SRI Tercera Edad' },
                                ].map(mod => (
                                    <label key={mod.id} className={`flex items-center p-4 rounded-2xl border transition-all duration-300 ${mod.disabled ? 'opacity-70 cursor-not-allowed bg-slate-100/10' : 'cursor-pointer'} ${mod.checked ? `border-${mod.color}-500/50 bg-${mod.color}-500/5 shadow-[0_0_15px_rgba(0,0,0,0.05)] scale-[1.02]` : 'border-white/10 hover:border-white/20'}`}>
                                        <input type="checkbox" checked={mod.checked} disabled={mod.disabled} onChange={e => mod.onChange && mod.onChange(e.target.checked)} className={`mr-4 h-5 w-5 rounded-lg border-white/20 bg-transparent text-${mod.color}-500 focus:ring-0`} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className={`text-[11px] font-black uppercase tracking-tight ${mod.checked ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>{mod.label}</span>
                                                {mod.alert && <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">{mod.alert}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-50">
                                                <mod.icon size={10} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">{mod.sub}</span>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-950/5 dark:bg-white/5 rounded-3xl p-5 border border-white/10 shadow-inner backdrop-blur-3xl">
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center gap-4">
                                    <div onClick={() => setIsVip(!isVip)} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer flex-1 ${isVip ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                        <Sparkles size={18} className={isVip ? 'text-amber-500' : 'text-slate-400'} />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Socio VIP</span>
                                            <span className={`text-[10px] font-black ${isVip ? 'text-amber-500' : 'text-slate-400'}`}>{isVip ? 'ELITE' : 'NORMAL'}</span>
                                        </div>
                                    </div>

                                    <div onClick={() => setIsActive(!isActive)} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer flex-1 ${isActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                        <CheckCircle size={18} className={isActive ? 'text-emerald-500' : 'text-slate-400'} />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                                            <span className={`text-[10px] font-black ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>{isActive ? 'ACTIVO' : 'PAUSADO'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">Cuota Periódica</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={14} />
                                            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="w-full pl-10 p-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-black focus:border-emerald-500/50 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest pl-1">Cuota Anual</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={14} />
                                            <input type="number" value={annualFee} onChange={e => setAnnualFee(e.target.value)} className="w-full pl-10 p-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-black focus:border-emerald-500/50 outline-none transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {modalFeedback && (
                <div className={`p-4 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-fade-in ${modalFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : modalFeedback.type === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    {modalFeedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {modalFeedback.message}
                </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-white/10">
                <button onClick={onCancel} className="flex-1 py-4 bg-white/5 text-slate-400 font-black rounded-2xl hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest border border-white/5">
                    Abortar Operación
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em]">
                    <Save size={20} />
                    <span>Confirmar Ficha de Cliente</span>
                </button>
            </div>
        </div>
    );
};