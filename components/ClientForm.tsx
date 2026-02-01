
import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { validateIdentifier, validateSriPassword, fetchSRIPublicData } from '../services/sri';
import { analyzeClientPhoto } from '../services/geminiService';
import { 
    Loader, CreditCard, User, Key, Eye, EyeOff, 
    Briefcase, MapPin, Phone, Mail, 
    Image as ImageIcon, Plus, CheckCircle, AlertTriangle, Crown, Power, FileText,
    CalendarClock, FileCheck, Info, DollarSign, ShieldCheck, ListPlus, Trash2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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
  economicActivity: '',
  isActive: true,
  phones: [''],
  email: '',
  notes: '',
  customServiceFee: 10 // Default fee set to 10 as requested
};

// Mapeo de Frecuencias Base (Lo que ve el usuario vs lógica interna)
type FrequencyType = 'MENSUAL' | 'SEMESTRAL' | 'ANUAL_RENTA' | 'DEVOLUCION';

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    
    // Estados de UI para separar lógica
    const [identifierType, setIdentifierType] = useState<'ruc' | 'cedula'>('ruc');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSearchingSRI, setIsSearchingSRI] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Custom Tasks State
    const [newCustomTask, setNewCustomTask] = useState('');
    const [customTasks, setCustomTasks] = useState<string[]>([]);

    // Estados derivados para la UI "Elite"
    const [isVip, setIsVip] = useState(initialData?.category?.includes('Suscripción') ?? false);
    
    // Lógica de frecuencia inicial
    const getInitialFrequency = (): FrequencyType => {
        const cat = initialData?.category || ClientCategory.InternoMensual;
        if (cat.includes('Mensual') && !cat.includes('Devolución')) return 'MENSUAL';
        if (cat.includes('Semestral')) return 'SEMESTRAL';
        if (cat.includes('Devolución')) return 'DEVOLUCION';
        if (cat.includes('Popular') || cat.includes('Renta')) return 'ANUAL_RENTA';
        return 'MENSUAL';
    };
    const [frequency, setFrequency] = useState<FrequencyType>(getInitialFrequency());

    // Obligaciones Adicionales (Checklist visual)
    const [extraObligations, setExtraObligations] = useState({
        iceMensual: initialData?.notes?.includes('ICE') || false,
        anexoPvp: initialData?.notes?.includes('PVP') || false,
        vehiculos: initialData?.notes?.includes('Vehículos') || false,
        patente: initialData?.notes?.includes('Patente') || false,
        supercias: initialData?.notes?.includes('Supercias') || false,
    });

    // --- LOGIC: AUTO-DETECT PASSWORD FROM VAULT ---
    useEffect(() => {
        const ruc = clientData.ruc || '';
        if (ruc.length === 13 && sriCredentials && !clientData.sriPassword) {
            const foundPassword = sriCredentials[ruc];
            if (foundPassword) {
                setClientData(prev => ({ ...prev, sriPassword: foundPassword }));
                setFeedback({ type: 'success', message: '¡Llave Maestra encontrada en Bóveda!' });
                setTimeout(() => setFeedback(null), 3000);
            }
        }
    }, [clientData.ruc, sriCredentials]);

    // --- LOGIC: SRI PUBLIC DATA FETCH ---
    useEffect(() => {
        const querySRI = async () => {
            const ruc = clientData.ruc || '';
            if ((ruc.length === 10 || ruc.length === 13) && !clientData.name && !isSearchingSRI) {
                setIsSearchingSRI(true);
                try {
                    const data = await fetchSRIPublicData(ruc);
                    if (data) {
                        setClientData(prev => ({ 
                            ...prev, 
                            name: data.name || prev.name,
                            address: data.address || prev.address,
                            economicActivity: data.activity || prev.economicActivity
                        }));
                        setFeedback({ type: 'success', message: 'Datos fiscales sincronizados con SRI.' });
                        setTimeout(() => setFeedback(null), 2500);
                    }
                } catch (e) { console.error(e); } finally { setIsSearchingSRI(false); }
            }
        };
        const timeoutId = setTimeout(querySRI, 500);
        return () => clearTimeout(timeoutId);
    }, [clientData.ruc, clientData.name]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsAnalyzing(true);
        setFeedback(null);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64String = (e.target?.result as string).split(',')[1];
                const aiData = await analyzeClientPhoto(base64String, file.type) as any;
                
                // Determinar frecuencia basada en IA
                if (aiData.obligaciones_tributarias === 'semestral') setFrequency('SEMESTRAL');
                else if (aiData.obligaciones_tributarias === 'anual') setFrequency('ANUAL_RENTA');
                else setFrequency('MENSUAL');

                setClientData(prev => ({
                    ...prev, 
                    ...aiData, 
                    phones: (aiData.phones && aiData.phones.length > 0) ? aiData.phones : prev.phones,
                    email: aiData.email || prev.email,
                    address: aiData.address || prev.address
                }));
                setIsAnalyzing(false);
                setFeedback({ type: 'success', message: 'RUC Escaneado correctamente.' });
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            setIsAnalyzing(false);
            setFeedback({ type: 'error', message: 'No se pudo leer el documento.' });
        }
    };

    const handleExtraChange = (key: keyof typeof extraObligations) => {
        setExtraObligations(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleAddCustomTask = () => {
        if (newCustomTask.trim()) {
            setCustomTasks([...customTasks, newCustomTask.trim()]);
            setNewCustomTask('');
        }
    };

    const handleRemoveCustomTask = (index: number) => {
        setCustomTasks(customTasks.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        // 1. Validation
        const errors: Record<string, string> = {};
        const rucValidation = validateIdentifier(clientData.ruc || '');
        if (!rucValidation.isValid) errors.ruc = rucValidation.message || 'ID Inválido';
        if (!clientData.name) errors.name = 'El nombre es obligatorio.';
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setFeedback({ type: 'error', message: 'Complete los campos obligatorios marcados en rojo.' });
            return;
        }

        // 2. Logic: Construct Final Category based on Frequency + VIP
        let finalCategory = ClientCategory.InternoMensual;
        
        if (frequency === 'ANUAL_RENTA') {
            finalCategory = ClientCategory.ImpuestoRentaNegocioPopular; 
        } else if (frequency === 'DEVOLUCION') {
            finalCategory = ClientCategory.DevolucionIvaTerceraEdad;
        } else if (frequency === 'SEMESTRAL') {
            finalCategory = isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        } else {
            // MENSUAL
            finalCategory = isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;
        }

        // 3. Logic: Construct Notes with Extra Obligations & Custom Tasks
        let finalNotes = clientData.notes || '';
        const extrasList = [];
        if (extraObligations.iceMensual) extrasList.push("• Declaración/Anexo ICE Mensual");
        if (extraObligations.anexoPvp) extrasList.push("• Anexo Anual PVP");
        if (extraObligations.vehiculos) extrasList.push("• Impuesto Vehicular");
        if (extraObligations.patente) extrasList.push("• Patente Municipal");
        if (extraObligations.supercias) extrasList.push("• Supercias");
        
        // Add Custom Tasks to Notes
        customTasks.forEach(task => {
            extrasList.push(`• Tarea Extra: ${task}`);
        });
        
        if (extrasList.length > 0) {
            finalNotes += `\n\n--- OBLIGACIONES ADICIONALES ---\n${extrasList.join('\n')}`;
        }

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            category: finalCategory,
            notes: finalNotes,
            phones: (clientData.phones || []).filter(p => p.trim() !== ''),
            isActive: clientData.isActive ?? true
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* --- HEADER: DRAG & DROP & SCANNER --- */}
            <div className="relative group cursor-pointer">
                <input type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" onChange={handleImageUpload} disabled={isAnalyzing} />
                <div className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all duration-300 ${isAnalyzing ? 'border-sky-400 bg-sky-50' : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}`}>
                    {isAnalyzing ? (
                        <div className="flex flex-col items-center animate-pulse py-2">
                            <Loader className="w-8 h-8 text-sky-500 animate-spin mb-2"/>
                            <p className="text-xs font-bold text-sky-600">Procesando Documento...</p>
                        </div>
                    ) : (
                        <div className="flex flex-row items-center justify-center gap-4 py-2">
                            <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <ImageIcon size={20} />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Auto-completar con Imagen</p>
                                <p className="text-[10px] text-slate-400">Arrastra o toca para subir RUC/Cédula</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- COLUMNA 1: IDENTIDAD --- */}
                <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                        <User size={14} className="text-brand-teal"/> Identidad & Contacto
                    </h4>
                    
                    <div className="flex gap-3">
                        <div className="w-1/3">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Tipo ID</label>
                            <div className="relative">
                                <select 
                                    value={identifierType} 
                                    onChange={(e) => setIdentifierType(e.target.value as any)}
                                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none appearance-none"
                                >
                                    <option value="ruc">RUC</option>
                                    <option value="cedula">Cédula</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                            </div>
                        </div>
                        <div className="w-2/3 relative">
                             <label className="text-[10px] font-bold text-slate-500 mb-1 block">Número de Identificación</label>
                             <input 
                                type="text" 
                                value={clientData.ruc || ''} 
                                onChange={e => { setClientData({...clientData, ruc: e.target.value}); setValidationErrors(prev => ({...prev, ruc: ''})); }} 
                                className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all ${validationErrors.ruc ? 'border-red-500 bg-red-50' : 'border-slate-200 dark:border-slate-700'}`}
                                placeholder={identifierType === 'ruc' ? "1790000000001" : "1700000000"}
                            />
                            {isSearchingSRI && <Loader size={14} className="absolute right-3 top-[34px] animate-spin text-sky-500"/>}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Apellidos y Nombres / Razón Social</label>
                        <input 
                            type="text" 
                            value={clientData.name || ''} 
                            onChange={e => { setClientData({...clientData, name: e.target.value}); setValidationErrors(prev => ({...prev, name: ''})); }} 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none uppercase placeholder-normal"
                            placeholder="Ej: JUAN PÉREZ"
                        />
                         {validationErrors.name && <p className="text-red-500 text-[10px] mt-1 font-bold flex items-center gap-1"><AlertTriangle size={10}/> {validationErrors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Celular</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="text" 
                                    value={(clientData.phones || [''])[0]} 
                                    onChange={e => setClientData({...clientData, phones: [e.target.value]})} 
                                    className="w-full pl-9 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-sky-500"
                                    placeholder="099..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Email</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="email" 
                                    value={clientData.email || ''} 
                                    onChange={e => setClientData({...clientData, email: e.target.value})} 
                                    className="w-full pl-9 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-sky-500"
                                    placeholder="@email.com"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 mb-1 block">Dirección Fiscal</label>
                         <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-3 text-slate-400"/>
                            <textarea 
                                value={clientData.address || ''}
                                onChange={e => setClientData({...clientData, address: e.target.value})}
                                className="w-full pl-9 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none resize-none h-24 focus:border-sky-500"
                                placeholder="IMPORTANTE: Incluir Calle, Nro, Intersección, PARROQUIA y REFERENCIA."
                            />
                         </div>
                    </div>
                </div>

                {/* --- COLUMNA 2: TRIBUTARIO (Elite Design) --- */}
                <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                        <Briefcase size={14} className="text-brand-teal"/> Perfil Tributario
                    </h4>
                    
                    {/* CONTROLES DE ESTADO (Switches) */}
                    <div className="flex gap-3 mb-2">
                        <button 
                            onClick={() => setIsVip(!isVip)}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 group ${isVip ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                        >
                            <Crown size={20} className={`transition-colors ${isVip ? 'fill-current' : 'group-hover:text-amber-400'}`}/>
                            <span className="text-[10px] font-black uppercase">VIP / Suscrito</span>
                        </button>
                         <button 
                            onClick={() => setClientData(prev => ({...prev, isActive: !prev.isActive}))}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${(clientData.isActive ?? true) ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-200 text-red-400'}`}
                        >
                            <Power size={20}/>
                            <span className="text-[10px] font-black uppercase">{(clientData.isActive ?? true) ? 'Activo' : 'Inactivo'}</span>
                        </button>
                    </div>

                    <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
                        {/* 1. Clave SRI con Bóveda */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-500 mb-1 flex justify-between items-center">
                                <span>CLAVE SRI</span>
                                {feedback && feedback.type === 'success' && feedback.message.includes('Bóveda') && (
                                    <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                        <Key size={10}/> Encontrada
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <input 
                                    type={passwordVisible ? 'text' : 'password'} 
                                    value={clientData.sriPassword || ''} 
                                    onChange={e => setClientData({...clientData, sriPassword: e.target.value})} 
                                    className="w-full p-3 pr-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    placeholder="••••••••"
                                />
                                <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600">
                                    {passwordVisible ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>

                        {/* 2. Régimen */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">RÉGIMEN TRIBUTARIO</label>
                            <div className="relative">
                                <select 
                                    value={clientData.regime} 
                                    onChange={e => {
                                        const val = e.target.value as TaxRegime;
                                        setClientData({...clientData, regime: val});
                                        // Auto-select frequency logic
                                        if(val === TaxRegime.RimpeNegocioPopular) setFrequency('ANUAL_RENTA');
                                    }} 
                                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none appearance-none"
                                >
                                    {Object.values(TaxRegime).map(val => <option key={val} value={val}>{val}</option>)}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                            </div>

                             {/* Smart Alert for Income Tax Date */}
                             <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-800">
                                <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                                <div>
                                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Aviso Renta Anual</p>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-tight">
                                        {clientData.regime === TaxRegime.RimpeNegocioPopular 
                                            ? "Declaración obligatoria en MAYO (Cuota Fija)." 
                                            : "Declaración obligatoria en MARZO (Tabla Progresiva)."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Obligación Principal (Frecuencia) */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">FRECUENCIA DE DECLARACIÓN</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setFrequency('MENSUAL')}
                                    className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${frequency === 'MENSUAL' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                >
                                    Mensual
                                </button>
                                <button 
                                    onClick={() => setFrequency('SEMESTRAL')}
                                    className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${frequency === 'SEMESTRAL' ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                >
                                    Semestral
                                </button>
                                <button 
                                    onClick={() => setFrequency('ANUAL_RENTA')}
                                    className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${frequency === 'ANUAL_RENTA' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                >
                                    Solo Renta
                                </button>
                                 <button 
                                    onClick={() => setFrequency('DEVOLUCION')}
                                    className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${frequency === 'DEVOLUCION' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                >
                                    Devolución
                                </button>
                            </div>
                        </div>

                        {/* 4. Tarifa Personalizada */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">TARIFA DE SERVICIO</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input 
                                    type="number"
                                    value={clientData.customServiceFee || ''}
                                    onChange={e => setClientData({...clientData, customServiceFee: parseFloat(e.target.value)})}
                                    placeholder="Vacío = 10.00 (Tarifa Base)"
                                    className="w-full pl-6 p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:border-sky-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* OBLIGACIONES ADICIONALES */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block flex items-center gap-1">
                            <FileCheck size={12}/> Obligaciones y Tareas Extra
                        </label>
                        <div className="space-y-2">
                            {[
                                { key: 'iceMensual', label: 'Anexo/Declaración ICE Mensual' },
                                { key: 'anexoPvp', label: 'Anexo Anual PVP' },
                                { key: 'vehiculos', label: 'Impuesto a Vehículos' },
                                { key: 'patente', label: 'Patente Municipal' },
                                { key: 'supercias', label: 'Informe Supercias' },
                            ].map(item => (
                                <label key={item.key} className="flex items-center gap-3 cursor-pointer group p-1 hover:bg-slate-50 rounded-lg transition-colors">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${extraObligations[item.key as keyof typeof extraObligations] ? 'bg-brand-teal border-brand-teal text-white' : 'border-slate-300 group-hover:border-brand-teal'}`}>
                                        {extraObligations[item.key as keyof typeof extraObligations] && <CheckCircle size={12}/>}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={extraObligations[item.key as keyof typeof extraObligations]}
                                        onChange={() => handleExtraChange(item.key as any)}
                                    />
                                    <span className={`text-xs font-medium ${extraObligations[item.key as keyof typeof extraObligations] ? 'text-slate-800 dark:text-white font-bold' : 'text-slate-500'}`}>
                                        {item.label}
                                    </span>
                                </label>
                            ))}

                            {/* CUSTOM TASK INPUT */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Agregar Otra Tarea (ej. Facturación)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newCustomTask}
                                        onChange={(e) => setNewCustomTask(e.target.value)}
                                        placeholder="Nueva tarea..."
                                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTask()}
                                    />
                                    <button onClick={handleAddCustomTask} className="p-2 bg-brand-teal text-white rounded-lg hover:bg-teal-600 transition-colors">
                                        <Plus size={14}/>
                                    </button>
                                </div>
                                {customTasks.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {customTasks.map((task, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                                <span className="flex items-center gap-1"><ListPlus size={10}/> {task}</span>
                                                <button onClick={() => handleRemoveCustomTask(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {feedback && (
                <div className={`p-4 text-center text-xs font-bold rounded-2xl animate-fade-in-down flex items-center justify-center gap-2 shadow-lg ${feedback.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
                    {feedback.message}
                </div>
            )}
            
            <div className="pt-2">
                <button onClick={handleSubmit} className="w-full py-4 bg-brand-navy hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
                    <Plus size={20} strokeWidth={3} />
                    <span>{initialData?.id ? 'Guardar Cambios' : 'Guardar Nuevo Cliente'}</span>
                </button>
            </div>
        </div>
    );
};
