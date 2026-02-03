
import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { validateIdentifier } from '../services/sri';
import { extractDataFromSriPdf } from '../services/pdfExtraction';
import { 
    Loader, CreditCard, User, Key, Eye, EyeOff, 
    MapPin, Phone, Mail, 
    CheckCircle, AlertTriangle, Crown, ScanLine, 
    DollarSign, FileText, ToggleLeft, ToggleRight, Power,
    Briefcase, Calendar, Info
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
    const { clients } = useAppStore(); // Access global clients for validation
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // UI States
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Switches
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

    // REAL-TIME RUC VALIDATION
    const checkExistingRuc = (ruc: string) => {
        const cleanRuc = ruc.trim();
        if (cleanRuc.length >= 10) {
            const exists = clients.find(c => c.ruc === cleanRuc && c.id !== clientData.id); // Exclude self if editing
            if (exists) {
                setValidationErrors(prev => ({...prev, ruc: `RUC ya registrado: ${exists.name}`}));
                setModalFeedback({ 
                    message: `El cliente ${exists.name} ya está registrado con este RUC. Se actualizará su ficha.`, 
                    type: 'warning' 
                });
            } else {
                setValidationErrors(prev => {
                    const newErrors = {...prev};
                    delete newErrors.ruc;
                    return newErrors;
                });
                if(modalFeedback?.type === 'warning') setModalFeedback(null);
            }
        }
    };

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

            // Check existing
            checkExistingRuc(extracted.ruc);

            // Alerta si no hay contactos
            if (!extracted.contacto.celular && !extracted.contacto.email) {
                toast.warning("No se encontraron medios de contacto (celular/email/fijo) en el RUC. Por favor ingréselos manualmente.");
            } else {
                toast.success("Medios de contacto extraídos.");
            }

            // Construir notas enriquecidas
            const obligationsList = extracted.lista_obligaciones.map(o => `• ${o}`).join('\n');
            const newNotes = (clientData.notes ? clientData.notes + '\n\n' : '') + 
                           `--- OBLIGACIONES DETECTADAS ---\n${obligationsList}\n` +
                           `Actividad: ${extracted.actividad_economica.substring(0, 100)}...`;

            setClientData(prev => ({
                ...prev,
                ruc: extracted.ruc,
                name: extracted.apellidos_nombres,
                address: extracted.direccion,
                email: extracted.contacto.email || prev.email,
                phones: extracted.contacto.celular ? [extracted.contacto.celular] : prev.phones,
                regime: extracted.regimen,
                sriPassword: passwordToUse,
                notes: newNotes,
                isArtisan: extracted.es_artesano,
                establishmentCount: extracted.cantidad_establecimientos
            }));

            if (extracted.regimen === TaxRegime.RimpeNegocioPopular) setFrequency('ANUAL_RENTA');
            else if (extracted.obligaciones_tributarias === 'semestral') setFrequency('SEMESTRAL');
            else setFrequency('MENSUAL');

            setModalFeedback({ message: 'Datos extraídos correctamente del RUC.', type: 'success' });

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
        <div className="space-y-8 animate-fade-in relative px-1">
             
             {/* --- HEADER: PDF EXTRACTOR --- */}
             <div 
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`
                    relative rounded-3xl border-3 border-dashed p-6 text-center cursor-pointer transition-all duration-300 group overflow-hidden
                    ${isAnalyzing ? 'border-brand-teal bg-teal-50/50 pointer-events-none' : 'border-slate-200 hover:border-brand-teal hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}
                `}
             >
                <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
                
                {isAnalyzing ? (
                    <div className="flex items-center justify-center gap-3">
                        <Loader className="w-5 h-5 text-brand-teal animate-spin"/>
                        <p className="text-sm font-bold text-brand-navy dark:text-white">Procesando Documento...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl text-slate-500 group-hover:text-brand-teal transition-colors shadow-sm">
                            <ScanLine size={24} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-wide">Cargar PDF del RUC</h4>
                        <p className="text-[10px] text-slate-400">Lectura automática de datos</p>
                    </div>
                )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 
                 {/* COLUMNA 1: IDENTIDAD & UBICACIÓN */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <User className="text-brand-teal" size={18}/>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identidad y Ubicación</h3>
                    </div>
                    
                    <div className="space-y-4">
                        {/* RUC */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Número RUC</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    value={clientData.ruc || ''} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setClientData({...clientData, ruc: val});
                                        checkExistingRuc(val);
                                    }}
                                    className={`w-full pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all ${validationErrors.ruc ? 'border-amber-500 focus:ring-amber-500' : 'border-slate-200 dark:border-slate-700'}`}
                                    placeholder="1790000000001"
                                />
                            </div>
                            {validationErrors.ruc && <p className="text-amber-600 text-[10px] mt-1 font-bold flex items-center gap-1"><Info size={10}/> {validationErrors.ruc}</p>}
                        </div>

                        {/* NOMBRE */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Apellidos y Nombres / Razón Social</label>
                            <input 
                                type="text" 
                                value={clientData.name || ''} 
                                onChange={e => setClientData({...clientData, name: e.target.value})}
                                className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all ${validationErrors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>

                        {/* DIRECCIÓN */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Dirección (Parroquia y Referencia)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                                <textarea 
                                    rows={4}
                                    value={clientData.address || ''} 
                                    onChange={e => setClientData({...clientData, address: e.target.value})}
                                    className="w-full pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-brand-teal resize-none"
                                    placeholder="Ej: Parroquia X, Calle Principal, frente al parque..."
                                />
                            </div>
                        </div>

                        {/* CONTACTO */}
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Celular / Teléfono</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        value={(clientData.phones || [''])[0]} 
                                        onChange={e => setClientData({...clientData, phones: [e.target.value]})}
                                        className="w-full pl-8 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                        placeholder="099... / 072..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="email" 
                                        value={clientData.email || ''} 
                                        onChange={e => setClientData({...clientData, email: e.target.value})}
                                        className="w-full pl-8 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* COLUMNA 2: PERFIL TRIBUTARIO Y NEGOCIO */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <Briefcase className="text-brand-teal" size={18}/>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Perfil Tributario</h3>
                    </div>

                    <div className="space-y-5">
                        {/* CREDENCIALES */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1.5 flex justify-between uppercase">
                                <span>Clave SRI</span>
                                {clientData.sriPassword && sriCredentials && Object.values(sriCredentials).includes(clientData.sriPassword) && (
                                    <span className="text-emerald-600 flex items-center gap-1 text-[9px] uppercase font-black"><Key size={10}/> En Bóveda</span>
                                )}
                            </label>
                            <div className="relative">
                                <input 
                                    type={passwordVisible ? "text" : "password"} 
                                    value={clientData.sriPassword || ''} 
                                    onChange={e => setClientData({...clientData, sriPassword: e.target.value})} 
                                    className="w-full pl-3 pr-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-teal"
                                    placeholder="••••••••"
                                />
                                <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-teal">
                                    {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        {/* RÉGIMEN */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Régimen Tributario</label>
                            <select 
                                value={clientData.regime}
                                onChange={(e) => setClientData({...clientData, regime: e.target.value as TaxRegime})}
                                className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-200 rounded-xl text-xs font-bold"
                            >
                                {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* FRECUENCIA / OBLIGACIÓN */}
                        <div>
                             <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase">Frecuencia / Obligación Principal</label>
                             <div className="grid grid-cols-2 gap-2">
                                 <button onClick={() => setFrequency('MENSUAL')} className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'MENSUAL' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>IVA MENSUAL</button>
                                 <button onClick={() => setFrequency('SEMESTRAL')} className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'SEMESTRAL' ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>IVA SEMESTRAL</button>
                                 <button onClick={() => setFrequency('ANUAL_RENTA')} className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'ANUAL_RENTA' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>SOLO RENTA</button>
                                 <button onClick={() => setFrequency('DEVOLUCION')} className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all ${frequency === 'DEVOLUCION' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>DEVOLUCIÓN</button>
                             </div>
                        </div>

                        {/* ESTADO Y TARIFAS (PANEL DE CONTROL) */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800">
                             <div className="flex flex-col gap-4">
                                 {/* Switches Row */}
                                 <div className="flex justify-between items-center gap-4">
                                     <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cliente VIP</span>
                                            <span className={`text-[10px] font-bold ${isVip ? 'text-amber-500' : 'text-slate-300'}`}>{isVip ? 'Suscrito' : 'Normal'}</span>
                                        </div>
                                        <button onClick={() => setIsVip(!isVip)} className={`transition-colors ${isVip ? 'text-amber-500' : 'text-slate-300'}`}>
                                            {isVip ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                     </div>

                                     <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estado</span>
                                            <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>{isActive ? 'Activo' : 'Inactivo'}</span>
                                        </div>
                                        <button onClick={() => setIsActive(!isActive)} className={`transition-colors ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            {isActive ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                     </div>
                                 </div>
                                 
                                 {/* Fees Row */}
                                 <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider absolute -top-2 left-2 bg-slate-50 dark:bg-slate-900 px-1">Mensual</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="w-full pl-6 p-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-brand-teal" placeholder="0.00"/>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider absolute -top-2 left-2 bg-slate-50 dark:bg-slate-900 px-1">Anual</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                            <input type="number" value={annualFee} onChange={e => setAnnualFee(e.target.value)} className="w-full pl-6 p-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-brand-teal" placeholder="0.00"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
             </div>

             {/* NOTAS Y OBLIGACIONES DETALLADAS */}
             <div className="mt-2 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                 <p className="text-[10px] font-black text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                     <Info size={12}/> Notas & Obligaciones
                 </p>
                 <textarea 
                     value={clientData.notes || ''}
                     onChange={e => setClientData({...clientData, notes: e.target.value})}
                     className="w-full bg-transparent text-xs text-yellow-800 dark:text-yellow-200 font-medium border-none p-0 focus:ring-0 resize-none h-20"
                     placeholder="Las obligaciones detectadas aparecerán aquí..."
                 />
             </div>

             {modalFeedback && (
                <div className={`p-4 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-fade-in ${modalFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : modalFeedback.type === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    {modalFeedback.type === 'success' ? <CheckCircle size={18}/> : modalFeedback.type === 'warning' ? <AlertTriangle size={18}/> : <AlertTriangle size={18}/>}
                    {modalFeedback.message}
                </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest">
                    Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-4 bg-brand-navy hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    <FileText size={18} />
                    <span>Guardar Ficha</span>
                </button>
            </div>
        </div>
    );
};
