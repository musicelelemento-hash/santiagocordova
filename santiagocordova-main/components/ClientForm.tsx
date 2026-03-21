
import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { extractPdfInWorker } from '../services/workerBridge';
import { 
    Loader, User, Key, Eye, EyeOff, 
    CheckCircle, AlertTriangle, ScanLine, 
    Save, Briefcase, Phone, Mail, MapPin, 
    FileText, CreditCard, Building, Hammer, Lock,
    ChevronDown, UploadCloud, Info, RefreshCw, Crown,
    Calendar, TrendingUp, DollarSign, FileKey, Globe, Server
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../context/ToastContext';
import { useAppStore } from '../store/useAppStore';

interface ClientFormProps {
    initialData?: Partial<Client>;
    onSubmit: (client: Client) => void;
    onCancel: () => void;
    sriCredentials?: Record<string, string>;
}

const newClientInitialState: Partial<Client> = {
  regime: TaxRegime.General,
  category: ClientCategory.InternoMensual,
  sriPassword: '',
  ruc: '',
  name: '',
  tradeName: '',
  address: '',
  isActive: true,
  phones: [''],
  email: '',
  economicActivity: '',
  isArtisan: false,
  establishmentCount: 1,
  jurisdiction: '',
  electronicSignaturePassword: '',
  billingSystemName: '',
  billingSystemUrl: '',
  billingSystemUser: '',
  billingSystemPassword: '',
  fee_structure: { monthly: 0, annual: 0 }
};

type FrequencyType = 'MENSUAL' | 'SEMESTRAL' | 'ANUAL_RENTA' | 'DEVOLUCION';

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const { toast } = useToast();
    const { serviceFees } = useAppStore();
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [signaturePasswordVisible, setSignaturePasswordVisible] = useState(false);
    const [billingPasswordVisible, setBillingPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const isEditMode = !!initialData?.id;
    const [isVip, setIsVip] = useState(initialData?.category?.includes('Suscripción') ?? true); 
    const [isActive, setIsActive] = useState(clientData.isActive ?? true);
    
    // Extras
    const [hasAnexo, setHasAnexo] = useState(false);
    const [hasDevolucion, setHasDevolucion] = useState(false);

    // Determinar frecuencia inicial
    const getInitialFrequency = (): FrequencyType => {
        const cat = clientData.category || ClientCategory.InternoMensual;
        if (cat.includes('Mensual') && !cat.includes('Devolución')) return 'MENSUAL';
        if (cat.includes('Semestral')) return 'SEMESTRAL';
        if (cat.includes('Devolución')) return 'DEVOLUCION';
        if (cat.includes('Popular') || cat.includes('Renta')) return 'ANUAL_RENTA';
        return 'MENSUAL';
    };
    const [frequency, setFrequency] = useState<FrequencyType>(getInitialFrequency());

    // Honorarios
    const [monthlyFee, setMonthlyFee] = useState<string>(() => {
        if (clientData.feeStructure?.monthly !== undefined) return clientData.feeStructure.monthly.toString();
        if (frequency === 'SEMESTRAL') return serviceFees.ivaSemestral.toString();
        if (frequency === 'MENSUAL') return serviceFees.ivaMensual.toString();
        if (frequency === 'DEVOLUCION') return serviceFees.devolucionIva.toString();
        return "0";
    });

    const [annualFee, setAnnualFee] = useState<string>(() => {
        if (clientData.feeStructure?.annual !== undefined) return clientData.feeStructure.annual.toString();
        if (clientData.regime === TaxRegime.RimpeNegocioPopular) return serviceFees.rentaNP.toString();
        return serviceFees.rentaGeneral.toString();
    });

    // Detectar extras en notas si existen (simulación simple)
    useEffect(() => {
        if (clientData.notes) {
            if (clientData.notes.includes('ANEXO_GASTOS')) setHasAnexo(true);
            if (clientData.notes.includes('DEVOLUCION_RET')) setHasDevolucion(true);
        }
    }, []);

    // --- VAULT SYNC ---
    useEffect(() => {
        if (clientData.ruc && clientData.ruc.length === 13 && sriCredentials) {
            const vaultPassword = sriCredentials[clientData.ruc];
            if (vaultPassword && (!clientData.sriPassword || clientData.sriPassword !== vaultPassword)) {
                if (!clientData.sriPassword) {
                     setClientData(prev => ({ ...prev, sriPassword: vaultPassword }));
                     toast.success("Clave autocompletada desde Bóveda");
                }
            }
        }
    }, [clientData.ruc, sriCredentials]);

    // Handlers de Cambio
    const handleRegimeChange = (regime: TaxRegime) => {
        setClientData({ ...clientData, regime });
        if (regime === TaxRegime.RimpeNegocioPopular) {
            setAnnualFee(serviceFees.rentaNP.toString());
            setFrequency('ANUAL_RENTA');
            setMonthlyFee("0");
        } else {
            setAnnualFee(serviceFees.rentaGeneral.toString());
            if (frequency === 'ANUAL_RENTA') {
                 setFrequency('MENSUAL');
                 setMonthlyFee(serviceFees.ivaMensual.toString());
            }
        }
    };

    const handleFrequencyChange = (newFreq: FrequencyType) => {
        setFrequency(newFreq);
        switch (newFreq) {
            case 'MENSUAL': setMonthlyFee(serviceFees.ivaMensual.toString()); break;
            case 'SEMESTRAL': setMonthlyFee(serviceFees.ivaSemestral.toString()); break;
            case 'DEVOLUCION': setMonthlyFee(serviceFees.devolucionIva.toString()); break;
            case 'ANUAL_RENTA': setMonthlyFee("0"); break;
        }
    };

    const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const extracted = await extractPdfInWorker(file);
            const detectedRegime = extracted.regimen as TaxRegime;
            
            setClientData(prev => ({
                ...prev,
                ruc: extracted.ruc || prev.ruc,
                name: extracted.apellidos_nombres || prev.name,
                address: extracted.direccion || prev.address,
                email: extracted.contacto.email || prev.email,
                phones: extracted.contacto.celular ? [extracted.contacto.celular] : prev.phones,
                regime: detectedRegime,
                economicActivity: extracted.actividad_economica || prev.economicActivity,
                isArtisan: extracted.es_artesano ?? prev.isArtisan,
                establishmentCount: extracted.cantidad_establecimientos ?? prev.establishmentCount,
                jurisdiction: extracted.direccion || prev.jurisdiction
            }));
            
            if (detectedRegime === TaxRegime.RimpeNegocioPopular) {
                setFrequency('ANUAL_RENTA');
                setAnnualFee(serviceFees.rentaNP.toString());
                setMonthlyFee("0");
            } else {
                setAnnualFee(serviceFees.rentaGeneral.toString());
                if (extracted.obligaciones_tributarias === 'semestral') {
                    setFrequency('SEMESTRAL');
                    setMonthlyFee(serviceFees.ivaSemestral.toString());
                } else {
                    setFrequency('MENSUAL');
                    setMonthlyFee(serviceFees.ivaMensual.toString());
                }
            }
            toast.success("Información extraída del PDF correctamente");
        } catch (error: any) {
             toast.error("Error al leer PDF: " + error.message);
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = () => {
        if (!clientData.ruc || clientData.ruc.length < 10) {
            toast.error("El RUC es obligatorio");
            return;
        }
        if (!clientData.name) {
            toast.error("La Razón Social es obligatoria");
            return;
        }

        let finalCategory = ClientCategory.InternoMensual;
        if (frequency === 'ANUAL_RENTA') finalCategory = ClientCategory.ImpuestoRentaNegocioPopular; 
        else if (frequency === 'DEVOLUCION') finalCategory = ClientCategory.DevolucionIvaTerceraEdad;
        else if (frequency === 'SEMESTRAL') finalCategory = isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        else finalCategory = isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;

        // Append extras to notes
        let notes = clientData.notes || '';
        if (hasAnexo && !notes.includes('ANEXO_GASTOS')) notes += '\n[REQ: ANEXO_GASTOS]';
        if (hasDevolucion && !notes.includes('DEVOLUCION_RET')) notes += '\n[REQ: DEVOLUCION_RET]';

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            category: finalCategory,
            isActive: isActive,
            notes: notes.trim(),
            fee_structure: {
                monthly: parseFloat(monthlyFee) || 0,
                annual: parseFloat(annualFee) || 0
            }
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-6 animate-fade-in text-slate-700 dark:text-slate-200">
             
             {/* HEADER: IMPORTACIÓN INTELIGENTE */}
             <div 
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`relative group rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${isAnalyzing ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-sky-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-900/10'}`}
             >
                <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
                <div className="flex flex-col items-center gap-2">
                    {isAnalyzing ? (
                        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin"/>
                    ) : (
                        <UploadCloud size={32} className="text-slate-400 group-hover:text-sky-500 transition-colors"/>
                    )}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-sky-600 transition-colors">
                            {isAnalyzing ? 'Analizando Documento...' : 'Importar desde Certificado RUC (PDF)'}
                        </h4>
                        {!isAnalyzing && <p className="text-xs text-slate-400">Autocompletado inteligente de datos</p>}
                    </div>
                </div>
             </div>

             <div className="space-y-6">
                 
                 {/* BLOQUE 1: IDENTIDAD Y CONTACTO */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <User size={14}/> Identidad
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block">RUC / Cédula</label>
                            <div className="relative">
                                <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="text" 
                                    value={clientData.ruc || ''} 
                                    onChange={e => setClientData({...clientData, ruc: e.target.value})}
                                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    placeholder="17900..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block">Nombre / Razón Social</label>
                            <input 
                                type="text"
                                value={clientData.name || ''} 
                                onChange={e => setClientData({...clientData, name: e.target.value})}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none uppercase transition-all"
                                placeholder="NOMBRE COMERCIAL O PERSONA"
                            />
                        </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-semibold mb-1.5 block">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="email"
                                    value={clientData.email || ''} 
                                    onChange={e => setClientData({...clientData, email: e.target.value})}
                                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    placeholder="cliente@email.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block">Celular</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="tel"
                                    value={(clientData.phones || [''])[0]} 
                                    onChange={e => setClientData({...clientData, phones: [e.target.value]})}
                                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                    placeholder="099..."
                                />
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* BLOQUE 2: DETALLES TRIBUTARIOS */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Briefcase size={14}/> Perfil Tributario
                    </h3>
                    
                    <div className="mb-6">
                        <label className="text-xs font-semibold mb-2 block">Régimen</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: TaxRegime.General, label: 'General' },
                                { value: TaxRegime.RimpeEmprendedor, label: 'RIMPE Emprendedor' },
                                { value: TaxRegime.RimpeNegocioPopular, label: 'Negocio Popular' }
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleRegimeChange(opt.value)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                        clientData.regime === opt.value
                                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                         <label className="text-xs font-semibold mb-2 block">Obligaciones Tributarias</label>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <button 
                                onClick={() => handleFrequencyChange('MENSUAL')}
                                className={`p-3 rounded-xl border text-left transition-all ${frequency === 'MENSUAL' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${frequency === 'MENSUAL' ? 'text-blue-600' : 'text-slate-400'}`}>Estándar</span>
                                <span className={`font-bold text-sm ${frequency === 'MENSUAL' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>IVA Mensual + Renta</span>
                            </button>

                            <button 
                                onClick={() => handleFrequencyChange('SEMESTRAL')}
                                className={`p-3 rounded-xl border text-left transition-all ${frequency === 'SEMESTRAL' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${frequency === 'SEMESTRAL' ? 'text-purple-600' : 'text-slate-400'}`}>Semestral</span>
                                <span className={`font-bold text-sm ${frequency === 'SEMESTRAL' ? 'text-purple-800 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>IVA Semestral + Renta</span>
                            </button>

                            <button 
                                onClick={() => handleFrequencyChange('ANUAL_RENTA')}
                                className={`p-3 rounded-xl border text-left transition-all ${frequency === 'ANUAL_RENTA' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${frequency === 'ANUAL_RENTA' ? 'text-orange-600' : 'text-slate-400'}`}>Negocio Popular</span>
                                <span className={`font-bold text-sm ${frequency === 'ANUAL_RENTA' ? 'text-orange-800 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>Solo Impuesto Renta</span>
                            </button>

                            <button 
                                onClick={() => handleFrequencyChange('DEVOLUCION')}
                                className={`p-3 rounded-xl border text-left transition-all ${frequency === 'DEVOLUCION' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                            >
                                <span className={`text-[10px] font-bold uppercase block mb-1 ${frequency === 'DEVOLUCION' ? 'text-emerald-600' : 'text-slate-400'}`}>Tercera Edad</span>
                                <span className={`font-bold text-sm ${frequency === 'DEVOLUCION' ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>Devolución IVA</span>
                            </button>
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Opcionales */}
                        <div>
                             <label className="text-xs font-semibold mb-3 block text-slate-500">Opcionales (Anuales)</label>
                             <div className="space-y-3">
                                <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${hasAnexo ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
                                    <input type="checkbox" checked={hasAnexo} onChange={e => setHasAnexo(e.target.checked)} className="mr-3 h-4 w-4 text-sky-600"/>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Anexo Gastos Personales</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Calendar size={10}/> Febrero</span>
                                    </div>
                                </label>
                                <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${hasDevolucion ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
                                    <input type="checkbox" checked={hasDevolucion} onChange={e => setHasDevolucion(e.target.checked)} className="mr-3 h-4 w-4 text-indigo-600"/>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Devolución Retenciones</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><DollarSign size={10}/> Saldo a Favor</span>
                                    </div>
                                </label>
                             </div>
                        </div>

                         <div className="space-y-3">
                            <label className="text-xs font-semibold mb-1 block text-slate-500">Ubicación (Matriz)</label>
                            <div className="relative group">
                                <div className="absolute top-3 left-3 text-slate-400 group-focus-within:text-sky-500 transition-colors">
                                    <MapPin size={20}/>
                                </div>
                                <textarea 
                                    rows={3}
                                    value={clientData.address || ''} 
                                    onChange={e => setClientData({...clientData, address: e.target.value})}
                                    className="w-full pl-10 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 resize-none font-medium leading-relaxed"
                                    placeholder="Provincia, Ciudad, Parroquia, Calle Principal y Número..."
                                />
                            </div>
                            
                            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={isVip} 
                                    onChange={e => setIsVip(e.target.checked)}
                                    className="rounded text-amber-500 focus:ring-amber-500" 
                                />
                                <span className="text-sm font-medium flex items-center gap-1">Cliente VIP (Suscripción) <Crown size={12} className="text-amber-500"/></span>
                            </label>
                        </div>
                    </div>
                 </div>

                 {/* BLOQUE 3: CREDENCIALES (BÓVEDA ACTUALIZADA) */}
                 <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-inner">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Lock size={14}/> Bóveda de Claves
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Clave SRI */}
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <label className="text-xs font-semibold">Clave SRI</label>
                                {sriCredentials && clientData.ruc && sriCredentials[clientData.ruc] && (
                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 rounded-full font-bold flex items-center gap-1 animate-fade-in">
                                        <CheckCircle size={10}/> Encontrada
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <input 
                                    type={passwordVisible ? "text" : "password"} 
                                    value={clientData.sriPassword || ''} 
                                    onChange={e => setClientData({...clientData, sriPassword: e.target.value})}
                                    className={`w-full p-2.5 pr-10 bg-white dark:bg-slate-900 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500 transition-all ${sriCredentials && sriCredentials[clientData.ruc] === clientData.sriPassword ? 'border-green-300 dark:border-green-800 ring-1 ring-green-100 dark:ring-green-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                    placeholder="••••••••"
                                />
                                <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500">
                                    {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        {/* Firma Electrónica (Clave) */}
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block">Firma Electrónica (Clave .P12)</label>
                            <div className="relative">
                                <FileKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type={signaturePasswordVisible ? "text" : "password"} 
                                    value={clientData.electronicSignaturePassword || ''} 
                                    onChange={e => setClientData({...clientData, electronicSignaturePassword: e.target.value})}
                                    className="w-full pl-9 p-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Clave del archivo"
                                />
                                <button onClick={() => setSignaturePasswordVisible(!signaturePasswordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500">
                                    {signaturePasswordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 italic">* Suba el archivo en Detalles del Cliente.</p>
                        </div>
                    </div>
                    
                    {/* Sistema de Facturación */}
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Sistema de Facturación</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold mb-1 block">Nombre / Proveedor</label>
                                <div className="relative">
                                    <Server size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        value={clientData.billingSystemName || ''} 
                                        onChange={e => setClientData({...clientData, billingSystemName: e.target.value})}
                                        className="w-full pl-9 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                                        placeholder="Ej: Contífico, SRI y Yo"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1 block">Enlace (URL)</label>
                                <div className="relative">
                                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        value={clientData.billingSystemUrl || ''} 
                                        onChange={e => setClientData({...clientData, billingSystemUrl: e.target.value})}
                                        className="w-full pl-9 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1 block">Usuario / Login</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        value={clientData.billingSystemUser || ''} 
                                        onChange={e => setClientData({...clientData, billingSystemUser: e.target.value})}
                                        className="w-full pl-9 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                                        placeholder="Usuario de acceso"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1 block">Clave Acceso</label>
                                <div className="relative">
                                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type={billingPasswordVisible ? "text" : "password"} 
                                        value={clientData.billingSystemPassword || ''} 
                                        onChange={e => setClientData({...clientData, billingSystemPassword: e.target.value})}
                                        className="w-full pl-9 p-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                                        placeholder="Clave"
                                    />
                                    <button onClick={() => setBillingPasswordVisible(!billingPasswordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500">
                                        {billingPasswordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
             </div>

            {/* FOOTER ACTIONS */}
            <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button onClick={onCancel} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                    <Save size={18}/> Guardar Expediente
                </button>
            </div>
        </div>
    );
};
