
import React, { useState, useEffect, useRef } from 'react';
import { Client, ClientCategory, TaxRegime } from '../types';
import { validateIdentifier, validateSriPassword, fetchSRIPublicData } from '../services/sri';
import { analyzeClientPhoto } from '../services/geminiService';
import { 
    Loader, UploadCloud, CreditCard, User, Key, Eye, EyeOff, 
    Briefcase, MapPin, Phone, Mail, Hammer, Building, 
    Image as ImageIcon, Plus, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, Crown, Power
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ClientFormProps {
    initialData?: Partial<Client>;
    onSubmit: (client: Client) => void;
    onCancel: () => void;
    sriCredentials?: Record<string, string>;
}

const IVA_CATEGORIES = [
    ClientCategory.SuscripcionMensual,
    ClientCategory.InternoMensual,
    ClientCategory.SuscripcionSemestral,
    ClientCategory.InternoSemestral,
    ClientCategory.DevolucionIvaTerceraEdad,
];

const newClientInitialState: Partial<Client> = {
  regime: TaxRegime.General,
  category: ClientCategory.SuscripcionMensual,
  declarationHistory: [],
  sriPassword: '',
  ruc: '',
  name: '',
  address: '',
  economicActivity: '',
  isActive: true,
  phones: [''],
};

export const ClientForm: React.FC<ClientFormProps> = ({ initialData, onSubmit, onCancel, sriCredentials }) => {
    const [clientData, setClientData] = useState<Partial<Client>>({ ...newClientInitialState, ...initialData });
    const [identifierType, setIdentifierType] = useState<'ruc' | 'cedula'>('ruc');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSearchingSRI, setIsSearchingSRI] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    
    // Derived States for Switches
    const isVip = clientData.category?.includes('Suscripción');
    const isActive = clientData.isActive ?? true;

    // Auto-fill password from credentials
    useEffect(() => {
        if (clientData.ruc && clientData.ruc.length === 13 && sriCredentials && !clientData.sriPassword) {
            const foundPassword = sriCredentials[clientData.ruc];
            if (foundPassword) {
                setClientData(prev => ({ ...prev, sriPassword: foundPassword }));
                setFeedback({ type: 'success', message: 'Clave recuperada de la base de datos.' });
                setTimeout(() => setFeedback(null), 3000);
            }
        }
    }, [clientData.ruc, sriCredentials]);

    // Auto-query SRI Public Data
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
                        setFeedback({ type: 'success', message: 'Datos encontrados en SRI.' });
                        setTimeout(() => setFeedback(null), 2500);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearchingSRI(false);
                }
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
                
                let category = aiData.category;
                if (!category) {
                     if (aiData.regime === TaxRegime.RimpeNegocioPopular) category = ClientCategory.ImpuestoRentaNegocioPopular;
                     else category = ClientCategory.SuscripcionMensual;
                }

                setClientData(prev => ({
                    ...prev, 
                    ...aiData, 
                    phones: aiData.phones?.length ? aiData.phones : prev.phones,
                    category
                }));
                setIsAnalyzing(false);
                setFeedback({ type: 'success', message: 'Datos extraídos correctamente.' });
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            setIsAnalyzing(false);
            setFeedback({ type: 'error', message: error.message || 'Error al analizar imagen.' });
        }
    };

    const handleVipToggle = () => {
        if (clientData.regime === TaxRegime.RimpeNegocioPopular) return; // NP doesn't have monthly sub logic typically

        let newCategory = clientData.category;
        if (isVip) {
            // Downgrade
            if (newCategory === ClientCategory.SuscripcionMensual) newCategory = ClientCategory.InternoMensual;
            if (newCategory === ClientCategory.SuscripcionSemestral) newCategory = ClientCategory.InternoSemestral;
        } else {
            // Upgrade
            if (newCategory === ClientCategory.InternoMensual) newCategory = ClientCategory.SuscripcionMensual;
            if (newCategory === ClientCategory.InternoSemestral) newCategory = ClientCategory.SuscripcionSemestral;
            if (!newCategory) newCategory = ClientCategory.SuscripcionMensual;
        }
        setClientData(prev => ({...prev, category: newCategory}));
    };

    const handleSubmit = () => {
        const errors: Record<string, string> = {};
        const rucValidation = validateIdentifier(clientData.ruc || '');
        if (!rucValidation.isValid) errors.ruc = rucValidation.message || 'ID Inválido';
        if (!clientData.name) errors.name = 'El nombre es obligatorio.';
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setFeedback({ type: 'error', message: 'Corrija los errores antes de continuar.' });
            return;
        }

        const finalClient: Client = {
            id: clientData.id || uuidv4(),
            ...clientData as Client,
            phones: (clientData.phones || []).filter(p => p.trim() !== ''),
        };

        onSubmit(finalClient);
    };

    return (
        <div className="space-y-6">
            <div className="relative group cursor-pointer">
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" onChange={handleImageUpload} disabled={isAnalyzing} />
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 ${isAnalyzing ? 'border-sky-400 bg-sky-50' : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}`}>
                    {isAnalyzing ? (
                        <div className="flex flex-col items-center animate-pulse">
                            <Loader className="w-10 h-10 text-sky-500 animate-spin mb-2"/>
                            <p className="text-sm font-bold text-sky-600">Analizando Documento...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <ImageIcon size={24} />
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Auto-completar con Imagen</p>
                            <p className="text-xs text-slate-400 mt-1">Sube foto del RUC o Cédula</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">Identificación</h4>
                    
                    <div>
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3">
                            <button onClick={() => setIdentifierType('ruc')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${identifierType === 'ruc' ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600' : 'text-slate-500'}`}>RUC</button>
                            <button onClick={() => setIdentifierType('cedula')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${identifierType === 'cedula' ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600' : 'text-slate-500'}`}>Cédula</button>
                        </div>
                        
                        <div className={`relative flex items-center bg-slate-50 dark:bg-slate-800 border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 transition-all ${validationErrors.ruc ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}>
                            <span className="pl-3 text-slate-400"><CreditCard size={18} /></span>
                            <input 
                                type="text" 
                                value={clientData.ruc || ''} 
                                onChange={e => { setClientData({...clientData, ruc: e.target.value}); setValidationErrors(prev => ({...prev, ruc: ''})); }} 
                                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white font-mono text-sm"
                                placeholder={identifierType === 'ruc' ? "1790000000001" : "1700000000"}
                            />
                            {isSearchingSRI && <div className="pr-3"><Loader size={16} className="animate-spin text-sky-500"/></div>}
                        </div>
                        {validationErrors.ruc && <p className="text-red-500 text-xs mt-1">{validationErrors.ruc}</p>}
                    </div>

                    <div className="relative">
                        <div className={`relative flex items-center bg-slate-50 dark:bg-slate-800 border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 transition-all ${validationErrors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}>
                            <span className="pl-3 text-slate-400"><User size={18}/></span>
                            <input 
                                type="text" 
                                value={clientData.name || ''} 
                                onChange={e => { setClientData({...clientData, name: e.target.value}); setValidationErrors(prev => ({...prev, name: ''})); }} 
                                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white text-sm" 
                                placeholder="Nombre / Razón Social"
                            />
                        </div>
                        {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                    </div>

                    {/* Dirección Detallada */}
                    <div className="relative">
                         <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1"><MapPin size={12}/> Dirección Completa</label>
                         <textarea 
                            value={clientData.address || ''}
                            onChange={e => setClientData({...clientData, address: e.target.value})}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none h-24"
                            placeholder="Calle Principal, Intersección, Referencia y Parroquia"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">Tributario</h4>
                    
                    <div className="flex gap-4 mb-2">
                        {/* VIP Switch */}
                        <div 
                            onClick={handleVipToggle}
                            className={`flex-1 p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${isVip ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                        >
                            {isVip ? <Crown size={24} className="mb-1 fill-current"/> : <Crown size={24} className="mb-1"/>}
                            <span className="text-xs font-bold">VIP Suscrito</span>
                        </div>
                        
                        {/* Active Switch */}
                        <div 
                            onClick={() => setClientData(prev => ({...prev, isActive: !isActive}))}
                            className={`flex-1 p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                        >
                            {isActive ? <Power size={24} className="mb-1"/> : <Power size={24} className="mb-1 opacity-50"/>}
                            <span className="text-xs font-bold">{isActive ? 'Activo' : 'Inactivo'}</span>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="relative flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 transition-all">
                            <span className="pl-3 text-slate-400"><Key size={18}/></span>
                            <input 
                                type={passwordVisible ? 'text' : 'password'} 
                                value={clientData.sriPassword || ''} 
                                onChange={e => setClientData({...clientData, sriPassword: e.target.value})} 
                                className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white text-sm font-mono"
                                placeholder="Clave SRI"
                            />
                            <button onClick={() => setPasswordVisible(!passwordVisible)} className="pr-3 text-slate-400 hover:text-slate-600">{passwordVisible ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <select value={clientData.regime} onChange={e => setClientData({...clientData, regime: e.target.value as TaxRegime})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 outline-none">
                            {Object.values(TaxRegime).map(val => <option key={val} value={val}>{val}</option>)}
                        </select>
                        <select value={clientData.category} onChange={e => setClientData({...clientData, category: e.target.value as ClientCategory})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 outline-none">
                            {IVA_CATEGORIES.map(val => <option key={val} value={val}>{val}</option>)}
                        </select>
                    </div>

                    <div className="relative flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <span className="pl-3 text-slate-400"><Briefcase size={18}/></span>
                        <input 
                            type="text" 
                            value={clientData.economicActivity || ''} 
                            onChange={e => setClientData({...clientData, economicActivity: e.target.value})} 
                            className="w-full p-3 bg-transparent outline-none text-slate-800 dark:text-white text-sm"
                            placeholder="Actividad Económica"
                        />
                    </div>
                </div>
            </div>

            {feedback && (
                <div className={`p-4 text-center text-sm font-bold rounded-xl animate-fade-in-down flex items-center justify-center gap-2 ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
                    {feedback.message}
                </div>
            )}
            
            <button onClick={handleSubmit} className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-200 dark:shadow-sky-900/40 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                <Plus size={22} strokeWidth={3} />
                <span>{initialData ? 'Guardar Cambios' : 'Guardar Nuevo Cliente'}</span>
            </button>
        </div>
    );
};
