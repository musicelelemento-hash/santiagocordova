
import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { validateIdentifier } from '../services/sri';
import { extractDataFromSriPdf } from '../services/pdfExtraction';
import { 
    Loader, CreditCard, User, Key, Eye, EyeOff, 
    MapPin, Phone, Mail, 
    CheckCircle, AlertTriangle, Crown, ScanLine, 
    DollarSign, FileText, ToggleLeft, ToggleRight, Power
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../context/ToastContext';

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
  feeStructure: {
      monthly: 0,
      annual: 0,
      semestral: 0
  }
};

type FrequencyType = 'MENSUAL' | 'SEMESTRAL' | 'ANUAL_RENTA' | 'DEVOLUCION';

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const { toast } = useToast();
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // UI States
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const [isVip, setIsVip] = useState(initialData?.category?.includes('Suscripción') ?? false);
    const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
    
    // Fees State
    const [monthlyFee, setMonthlyFee] = useState<string>(clientData.feeStructure?.monthly?.toString() || '');
    const [annualFee, setAnnualFee] = useState<string>(clientData.feeStructure?.annual?.toString() || '');

    const getInitialFrequency = (): FrequencyType => {
        const cat = initialData?.category || ClientCategory.InternoMensual;
        if (cat.includes('Mensual') && !cat.includes('Devolución')) return 'MENSUAL';
        if (cat.includes('Semestral')) return 'SEMESTRAL';
        if (cat.includes('Devolución')) return 'DEVOLUCION';
        if (cat.includes('Popular') || cat.includes('Renta')) return 'ANUAL_RENTA';
        return 'MENSUAL';
    };
    const [frequency, setFrequency] = useState<FrequencyType>(getInitialFrequency());

    // --- LÓGICA DEL EXTRACTOR PDF ---
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
            
            // Auto-detectar contraseña en bóveda
            let passwordToUse = clientData.sriPassword;
            if (!passwordToUse && sriCredentials && sriCredentials[extracted.ruc]) {
                passwordToUse = sriCredentials[extracted.ruc];
                toast.success("¡Clave encontrada en Bóveda!");
            }

            setClientData(prev => ({
                ...prev,
                ruc: extracted.ruc,
                name: extracted.apellidos_nombres,
                address: extracted.direccion, // Aquí viene Parroquia y Referencia del PDF
                email: extracted.contacto.email,
                phones: extracted.contacto.celular ? [extracted.contacto.celular] : prev.phones,
                regime: extracted.regimen,
                sriPassword: passwordToUse,
                notes: (prev.notes ? prev.notes + '\n' : '') + `Obligaciones detectadas: ${extracted.lista_obligaciones.join(', ')}`
            }));

            // Auto-seleccionar frecuencia
            if (extracted.obligaciones_tributarias === 'anual' || extracted.regimen === TaxRegime.RimpeNegocioPopular) {
                setFrequency('ANUAL_RENTA');
            } else if (extracted.obligaciones_tributarias === 'semestral') {
                setFrequency('SEMESTRAL');
            } else {
                setFrequency('MENSUAL');
            }

            setModalFeedback({ message: 'Datos extraídos correctamente.', type: 'success' });

        } catch (error: any) {
            console.error(error);
            setModalFeedback({ message: 'No se pudo leer el PDF. Ingrese manualmente.', type: 'error' });
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = () => {
        const errors: Record<string, string> = {};
        const rucValidation = validateIdentifier(clientData.ruc || '');
        if (!rucValidation.isValid) errors.ruc = rucValidation.message || 'ID Inválido';
        if (!clientData.name) errors.name = 'El nombre es obligatorio.';
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setModalFeedback({ type: 'error', message: 'Faltan campos obligatorios.' });
            return;
        }

        let finalCategory = ClientCategory.InternoMensual;
        if (frequency === 'ANUAL_RENTA') finalCategory = ClientCategory.ImpuestoRentaNegocioPopular; 
        else if (frequency === 'DEVOLUCION') finalCategory = ClientCategory.DevolucionIvaTerceraEdad;
        else if (frequency === 'SEMESTRAL') finalCategory = isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        else finalCategory = isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;

        const mFee = parseFloat(monthlyFee) || 0;
        const aFee = parseFloat(annualFee) || 0;

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            category: finalCategory,
            phones: (clientData.phones || []).filter(p => p.trim() !== ''),
            isActive: isActive,
            feeStructure: {
                monthly: mFee,
                semestral: mFee, 
                annual: aFee
            }
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-6 animate-fade-in relative px-1">
             
             {/* --- EXTRACTATOR CARD --- */}
             <div 
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`
                    relative rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-300 group overflow-hidden
                    ${isAnalyzing ? 'border-brand-teal bg-teal-50/50 pointer-events-none' : 'border-slate-300 hover:border-brand-teal hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}
                `}
             >
                <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
                
                {isAnalyzing ? (
                    <div className="flex items-center justify-center gap-3">
                        <Loader className="w-5 h-5 text-brand-teal animate-spin"/>
                        <p className="text-sm font-bold text-brand-navy dark:text-white">Extrayendo datos...</p>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-slate-500 group-hover:text-brand-teal transition-colors">
                            <ScanLine size={20} />
                        </div>
                        <div className="text-left">
                             <h4 className="text-sm font-bold text-slate-700 dark:text-white">Cargar RUC (PDF)</h4>
                             <p className="text-[10px] text-slate-400">Autocompletar datos del certificado</p>
                        </div>
                    </div>
                )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 
                 {/* COLUMNA 1: IDENTIDAD & UBICACIÓN */}
                 <div className="space-y-5">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">1. Datos Personales</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">NÚMERO RUC</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    value={clientData.ruc || ''} 
                                    onChange={e => setClientData({...clientData, ruc: e.target.value})}
                                    className={`w-full pl-9 p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all ${validationErrors.ruc ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                    placeholder="1790000000001"
                                />
                            </div>
                            {validationErrors.ruc && <p className="text-red-500 text-[10px] mt-1 font-bold">{validationErrors.ruc}</p>}
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">APELLIDOS Y NOMBRES</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    value={clientData.name || ''} 
                                    onChange={e => setClientData({...clientData, name: e.target.value})}
                                    className={`w-full pl-9 p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all ${validationErrors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">DIRECCIÓN (REFERENCIA Y PARROQUIA)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                                <textarea 
                                    rows={3}
                                    value={clientData.address || ''} 
                                    onChange={e => setClientData({...clientData, address: e.target.value})}
                                    className="w-full pl-9 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-teal resize-none"
                                    placeholder="Ej: Parroquia X, frente al parque..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">CELULAR</label>
                                <input 
                                    type="text" 
                                    value={(clientData.phones || [''])[0]} 
                                    onChange={e => setClientData({...clientData, phones: [e.target.value]})}
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">EMAIL</label>
                                <input 
                                    type="email" 
                                    value={clientData.email || ''} 
                                    onChange={e => setClientData({...clientData, email: e.target.value})}
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none"
                                />
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* COLUMNA 2: TRIBUTARIO & ESTADO */}
                 <div className="space-y-5">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">2. Perfil Tributario</h3>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                                <span>CLAVE SRI</span>
                                {clientData.sriPassword && sriCredentials && Object.values(sriCredentials).includes(clientData.sriPassword) && (
                                    <span className="text-emerald-600 flex items-center gap-1 text-[9px] uppercase font-bold"><Key size={10}/> En Bóveda</span>
                                )}
                            </label>
                            <div className="relative">
                                <input 
                                    type={passwordVisible ? "text" : "password"} 
                                    value={clientData.sriPassword || ''} 
                                    onChange={e => setClientData({...clientData, sriPassword: e.target.value})} 
                                    className="w-full pl-3 pr-9 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-teal"
                                    placeholder="••••••••"
                                />
                                <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-teal">
                                    {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">RÉGIMEN</label>
                            <select 
                                value={clientData.regime}
                                onChange={(e) => setClientData({...clientData, regime: e.target.value as TaxRegime})}
                                className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-200 rounded-xl text-sm font-bold"
                            >
                                {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div>
                             <label className="text-[10px] font-bold text-slate-500 mb-2 block">OBLIGACIONES TRIBUTARIAS</label>
                             <div className="grid grid-cols-2 gap-2">
                                 <button onClick={() => setFrequency('MENSUAL')} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'MENSUAL' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>IVA MENSUAL</button>
                                 <button onClick={() => setFrequency('SEMESTRAL')} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'SEMESTRAL' ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>IVA SEMESTRAL</button>
                                 <button onClick={() => setFrequency('ANUAL_RENTA')} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'ANUAL_RENTA' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>SOLO RENTA</button>
                                 <button onClick={() => setFrequency('DEVOLUCION')} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'DEVOLUCION' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>DEVOLUCIÓN</button>
                             </div>
                        </div>

                        {/* ESTADO Y TARIFAS */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                             <div className="flex gap-4 mb-3">
                                 <div className="flex-1 flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500">CLIENTE VIP</label>
                                    <button onClick={() => setIsVip(!isVip)} className={`${isVip ? 'text-amber-500' : 'text-slate-300'}`}>
                                        {isVip ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                    </button>
                                 </div>
                                 <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                                 <div className="flex-1 flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500">ACTIVO</label>
                                    <button onClick={() => setIsActive(!isActive)} className={`${isActive ? 'text-green-500' : 'text-slate-300'}`}>
                                        {isActive ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                    </button>
                                 </div>
                             </div>
                             
                             <div className="flex gap-2">
                                <div className="relative w-full">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="w-full pl-5 p-1.5 text-xs bg-white border rounded-lg font-bold" placeholder="Mes"/>
                                </div>
                                <div className="relative w-full">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input type="number" value={annualFee} onChange={e => setAnnualFee(e.target.value)} className="w-full pl-5 p-1.5 text-xs bg-white border rounded-lg font-bold" placeholder="Año"/>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
             </div>

             {modalFeedback && (
                <div className={`p-3 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 ${modalFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {modalFeedback.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                    {modalFeedback.message}
                </div>
            )}

            <div className="flex gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest">
                    Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 bg-brand-navy hover:bg-slate-800 text-white font-black rounded-xl shadow-lg transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    <FileText size={16} />
                    <span>Guardar Ficha</span>
                </button>
            </div>
        </div>
    );
};
