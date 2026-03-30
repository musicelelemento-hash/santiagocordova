import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { validateIdentifier, validateSriPassword } from '../services/sri';
import { extractDataFromSriPdf } from '../services/pdfExtraction';
import { 
    Loader, CreditCard, User, Key, Eye, EyeOff, 
    MapPin, Phone, Mail, 
    CheckCircle, AlertTriangle, Crown, ScanLine, 
    DollarSign, FileText, ToggleLeft, ToggleRight, Power,
    Briefcase, Calendar, Info, Coins, Save
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
  fee_structure: {
      monthly: 5, 
      annual: 10,
      semestral: 5
  }
};

type FrequencyType = 'MENSUAL' | 'SEMESTRAL' | 'ANUAL_RENTA' | 'DEVOLUCION';

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const { toast } = useToast();
    const { clients } = useAppStore(); 
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [modalFeedback, setModalFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const [isVip, setIsVip] = useState(initialData?.category?.includes('Suscripción') ?? true); 
    const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
    
    const [monthlyFee, setMonthlyFee] = useState<string>(
        (clientData.feeStructure?.monthly ?? 5).toString()
    );
    const [annualFee, setAnnualFee] = useState<string>(
        (clientData.feeStructure?.annual ?? 10).toString()
    );

    const getInitialFrequency = (): FrequencyType => {
        const cat = initialData?.category || ClientCategory.InternoMensual;
        if (cat.includes('Mensual') && !cat.includes('Devolución')) return 'MENSUAL';
        if (cat.includes('Semestral')) return 'SEMESTRAL';
        if (cat.includes('Devolución')) return 'DEVOLUCION';
        if (cat.includes('Popular') || cat.includes('Renta')) return 'ANUAL_RENTA';
        return 'MENSUAL';
    };
    const [frequency, setFrequency] = useState<FrequencyType>(getInitialFrequency());

    const checkExistingRuc = (ruc: string) => {
        const cleanRuc = ruc.trim();
        if (cleanRuc.length >= 10) {
            const exists = clients.find(c => c.ruc === cleanRuc && c.id !== clientData.id);
            if (exists) {
                setValidationErrors(prev => ({...prev, ruc: `RUC ya registrado: ${exists.name}`}));
                setModalFeedback({ 
                    message: `Este RUC ya pertenece a ${exists.name}. Se actualizarán sus datos.`, 
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
            
            let passwordToUse = clientData.sriPassword;
            if (!passwordToUse && sriCredentials && sriCredentials[extracted.ruc]) {
                passwordToUse = sriCredentials[extracted.ruc];
                toast.success("¡Clave encontrada en Bóveda!");
            }

            checkExistingRuc(extracted.ruc);

            setClientData(prev => ({
                ...prev,
                ruc: extracted.ruc,
                name: extracted.apellidos_nombres,
                address: extracted.direccion,
                email: extracted.contacto.email || prev.email,
                phones: extracted.contacto.celular ? [extracted.contacto.celular] : prev.phones,
                regime: extracted.regimen,
                sriPassword: passwordToUse,
                fee_structure: {
                    monthly: 5,
                    annual: 10,
                    semestral: 5
                },
                isArtisan: extracted.es_artesano,
                establishmentCount: extracted.cantidad_establecimientos
            }));
            
            setMonthlyFee("5");
            setAnnualFee("10");
            setIsVip(true);

            if (extracted.regimen === TaxRegime.RimpeNegocioPopular) setFrequency('ANUAL_RENTA');
            else if (extracted.obligaciones_tributarias === 'semestral') setFrequency('SEMESTRAL');
            else setFrequency('MENSUAL');

            setModalFeedback({ message: 'Datos escaneados. Tarifas $5/$10 listas.', type: 'success' });

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

        let finalCategory = ClientCategory.InternoMensual;
        if (frequency === 'ANUAL_RENTA') finalCategory = ClientCategory.ImpuestoRentaNegocioPopular; 
        else if (frequency === 'DEVOLUCION') finalCategory = ClientCategory.DevolucionIvaTerceraEdad;
        else if (frequency === 'SEMESTRAL') finalCategory = isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        else finalCategory = isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;

        const mFee = parseFloat(monthlyFee) || 5;
        const aFee = parseFloat(annualFee) || 10;

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            category: finalCategory,
            phones: (clientData.phones || []).filter(p => p.trim() !== ''),
            isActive: isActive,
            fee_structure: {
                monthly: mFee,
                semestral: mFee, 
                annual: aFee
            }
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-8 animate-fade-in relative px-1">
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
                        <p className="text-sm font-bold text-brand-navy dark:text-white">Analizando Documento...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl text-slate-500 group-hover:text-brand-teal transition-colors shadow-sm">
                            <ScanLine size={24} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-wide">Importar desde RUC PDF</h4>
                    </div>
                )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <User className="text-brand-teal" size={18}/>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identidad y Contacto</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wider">RUC contribuyente</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    value={clientData.ruc || ''} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setClientData({...clientData, ruc: val});
                                        checkExistingRuc(val);
                                    }}
                                    className={`w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all ${validationErrors.ruc ? 'border-amber-500' : 'border-slate-200 dark:border-slate-700'}`}
                                    placeholder="1790000000001"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wider">Razón Social</label>
                            <input 
                                type="text" 
                                value={clientData.name || ''} 
                                onChange={e => setClientData({...clientData, name: e.target.value})}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all"
                                placeholder="Nombre completo"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wider">WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        value={(clientData.phones || [''])[0]} 
                                        onChange={e => setClientData({...clientData, phones: [e.target.value]})}
                                        className="w-full pl-8 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                                        placeholder="09..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="email" 
                                        value={clientData.email || ''} 
                                        onChange={e => setClientData({...clientData, email: e.target.value})}
                                        className="w-full pl-8 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <Briefcase className="text-brand-teal" size={18}/>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuración & Tarifas</h3>
                    </div>

                    <div className="space-y-5">
                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 mb-1 block uppercase tracking-wider">Clave SRI</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type={passwordVisible ? "text" : "password"} 
                                    value={clientData.sriPassword || ''} 
                                    onChange={e => setClientData({...clientData, sriPassword: e.target.value})} 
                                    className="w-full pl-10 pr-10 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold"
                                    placeholder="••••••••"
                                />
                                <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    {passwordVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        <div>
                             <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">Obligación Actual</label>
                             <div className="grid grid-cols-2 gap-2">
                                 {[
                                     {id: 'MENSUAL', label: 'IVA MENSUAL'},
                                     {id: 'SEMESTRAL', label: 'IVA SEMESTRAL'},
                                     {id: 'ANUAL_RENTA', label: 'SÓLO RENTA'},
                                     {id: 'DEVOLUCION', label: 'DEVOLUCIÓN'}
                                 ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => setFrequency(opt.id as any)} 
                                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${frequency === opt.id ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                    >
                                        {opt.label}
                                    </button>
                                 ))}
                             </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-inner">
                             <div className="flex flex-col gap-4">
                                 <div className="flex justify-between items-center gap-4">
                                     <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Cliente VIP</span>
                                            <span className={`text-xs font-bold ${isVip ? 'text-amber-500' : 'text-slate-300'}`}>{isVip ? 'Suscrito' : 'Normal'}</span>
                                        </div>
                                        <button onClick={() => setIsVip(!isVip)} className={`transition-colors ${isVip ? 'text-amber-500' : 'text-slate-300'}`}>
                                            {isVip ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                     </div>

                                     <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado</span>
                                            <span className={`text-xs font-bold ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>{isActive ? 'Activo' : 'Inactivo'}</span>
                                        </div>
                                        <button onClick={() => setIsActive(!isActive)} className={`transition-colors ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            {isActive ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                                        </button>
                                     </div>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider absolute -top-2 left-2 bg-slate-50 dark:bg-slate-900 px-1 z-10">Honorario Mes</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="w-full pl-6 p-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" placeholder="5.00"/>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider absolute -top-2 left-2 bg-slate-50 dark:bg-slate-900 px-1 z-10">Honorario Renta</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                            <input type="number" value={annualFee} onChange={e => setAnnualFee(e.target.value)} className="w-full pl-6 p-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" placeholder="10.00"/>
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
                    {modalFeedback.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
                    {modalFeedback.message}
                </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest">
                    Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-4 bg-brand-navy hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    <Save size={18} />
                    <span>Guardar Ficha del Cliente</span>
                </button>
            </div>
        </div>
    );
};