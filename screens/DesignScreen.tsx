
import React, { useState, useRef } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, Sparkles, ArrowRight, Loader, RefreshCw, 
    CreditCard, User, MapPin, Mail, Phone, Briefcase, 
    Save, FileJson, ShieldCheck, ArrowLeft, X, Image as ImageIcon, Camera, FileUp, ToggleLeft, ToggleRight, FileType, DollarSign, Key
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, TaxRegime, ClientCategory, StoredFile, Screen } from '../types';
import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import { analyzeClientPhoto } from '../services/geminiService';

interface DesignScreenProps {
    navigate: (screen: Screen, options?: any) => void;
    sriCredentials?: Record<string, string>;
}

export const DesignScreen: React.FC<DesignScreenProps> = ({ navigate, sriCredentials }) => {
    const { toast } = useToast();
    const { clients, setClients } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Flow State
    const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
    const [extractedData, setExtractedData] = useState<Partial<Client> | null>(null);
    const [existingClient, setExistingClient] = useState<Client | null>(null);
    const [isVip, setIsVip] = useState(false);
    const [isActiveClient, setIsActiveClient] = useState(true);
    const [foundPasswordInVault, setFoundPasswordInVault] = useState(false);

    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                toast.error("Solo se permiten archivos PDF del RUC.");
                return;
            }
            processDocument(file);
        }
    };

    const processDocument = async (file: File) => {
        setStep('analyzing');
        setFoundPasswordInVault(false);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64String = (e.target?.result as string).split(',')[1];
                
                try {
                    // Send to Gemini as PDF
                    const result = await analyzeClientPhoto(base64String, file.type);
                    
                    // Duplicate Detection
                    const match = clients.find(c => c.ruc === result.ruc);
                    setExistingClient(match || null);
                    
                    // Check Vault for Password if not found in client
                    let finalPassword = result.sriPassword || '';
                    if (!finalPassword && match?.sriPassword) {
                        finalPassword = match.sriPassword;
                    } else if (!finalPassword && result.ruc && sriCredentials && sriCredentials[result.ruc]) {
                        finalPassword = sriCredentials[result.ruc];
                        setFoundPasswordInVault(true);
                    }

                    // --- INTELLIGENT CATEGORY LOGIC ---
                    // Default to Monthly unless signs of Semestral or Rimpe Popular
                    let detectedCategory = ClientCategory.InternoMensual; // Default: "si es mensual solo va a decir declaracion de iva"
                    const notesUpper = (result.notes || '').toUpperCase();
                    
                    if (result.regime === TaxRegime.RimpeNegocioPopular) {
                        detectedCategory = ClientCategory.ImpuestoRentaNegocioPopular;
                    } else {
                        // Check explicit semestral keywords in obligations extracted by Gemini
                        if (notesUpper.includes('SEMESTRAL') || notesUpper.includes('SEMESTRE')) {
                            detectedCategory = ClientCategory.InternoSemestral;
                        } else {
                            detectedCategory = ClientCategory.InternoMensual;
                        }
                    }

                    // Set defaults based on existing or extracted
                    if (match) {
                        // Maintain VIP status if already set
                        setIsVip(match.category.includes('Suscripción'));
                        setIsActiveClient(match.isActive ?? true);
                        // If user manually changed category before, maybe keep it? 
                        // For now, let's suggest the detected one but allow override, or keep existing if strong match
                        // Actually, if updating from PDF, we likely want the PDF's truth.
                        // But VIP status is internal.
                    } else {
                        // New client defaults
                        setIsVip(false);
                        setIsActiveClient(true);
                    }

                    setExtractedData({
                        ...result,
                        // Ensure category aligns with logic + VIP toggle will happen in render
                        category: detectedCategory,
                        // If updating, preserve IDs and history
                        id: match?.id || uuidv4(),
                        customServiceFee: match?.customServiceFee, 
                        declarationHistory: match?.declarationHistory || [],
                        sriPassword: finalPassword,
                    });
                    setStep('review');
                } catch (error: any) {
                    console.error(error);
                    toast.error(error.message || "Error en el análisis IA.");
                    setStep('upload');
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            toast.error("Error al leer el archivo.");
            setStep('upload');
        }
    };

    const handleSave = () => {
        if (!extractedData || !extractedData.ruc || !extractedData.name) {
            toast.error("Datos incompletos. RUC y Nombre son obligatorios.");
            return;
        }

        // Determine Final Category based on Switches & Detected Logic
        let finalCategory = extractedData.category || ClientCategory.InternoMensual;
        
        // Apply VIP Override
        if (isVip) {
            if (finalCategory === ClientCategory.InternoMensual) finalCategory = ClientCategory.SuscripcionMensual;
            if (finalCategory === ClientCategory.InternoSemestral) finalCategory = ClientCategory.SuscripcionSemestral;
        } else {
             // Ensure it's internal if VIP is off
            if (finalCategory === ClientCategory.SuscripcionMensual) finalCategory = ClientCategory.InternoMensual;
            if (finalCategory === ClientCategory.SuscripcionSemestral) finalCategory = ClientCategory.InternoSemestral;
        }

        const finalClient: Client = {
            id: extractedData.id || uuidv4(),
            ruc: extractedData.ruc,
            name: extractedData.name,
            tradeName: extractedData.tradeName || existingClient?.tradeName || '',
            sriPassword: extractedData.sriPassword || existingClient?.sriPassword || '',
            regime: extractedData.regime || TaxRegime.General,
            category: finalCategory,
            customServiceFee: extractedData.customServiceFee, 
            economicActivity: extractedData.economicActivity || '',
            address: extractedData.address || '',
            email: extractedData.email || '',
            phones: extractedData.phones || [],
            notes: extractedData.notes || '', 
            declarationHistory: existingClient?.declarationHistory || [],
            isActive: isActiveClient,
            isArtisan: !!extractedData.isArtisan,
            establishmentCount: 1,
            jurisdiction: 'EL ORO', 
            electronicSignaturePassword: existingClient?.electronicSignaturePassword || '',
            sharedAccessKey: existingClient?.sharedAccessKey || ''
        };

        setClients(prev => {
            if (existingClient) {
                return prev.map(c => c.id === finalClient.id ? finalClient : c);
            }
            return [...prev, finalClient];
        });

        setStep('success');
        toast.success(existingClient ? "Cliente actualizado correctamente" : "Cliente creado exitosamente");
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-fade-in px-4 h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-6 pt-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <ScanLine className="text-brand-teal"/> Extractor PDF RUC
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Sube el Certificado de RUC (PDF) para extracción inteligente de datos.
                    </p>
                </div>
                <button onClick={() => navigate('clients')} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-colors self-start md:self-auto">
                    <X size={16} className="inline mr-1"/> Cancelar
                </button>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
                {/* UPLOAD ZONE */}
                <div className="lg:col-span-5 flex flex-col">
                    <div 
                        className={`
                            flex-1 relative rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center p-8 group overflow-hidden bg-white dark:bg-slate-900 shadow-sm
                            ${step === 'analyzing' ? 'border-brand-teal bg-brand-teal/5 pointer-events-none' : 'border-slate-200 dark:border-slate-700 hover:border-brand-teal/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                        `}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileSelection} accept=".pdf" className="hidden" />
                        
                        {step === 'analyzing' ? (
                            <div className="text-center relative z-10">
                                <Loader className="w-16 h-16 text-brand-teal animate-spin mx-auto mb-6"/>
                                <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Procesando PDF...</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Buscando obligaciones y contactos...</p>
                            </div>
                        ) : step === 'success' ? (
                            <div className="text-center relative z-10">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                                    <CheckCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-emerald-700 mb-2">¡Proceso Exitoso!</h3>
                                <p className="text-slate-500 mb-8 text-sm">{existingClient ? 'Datos del cliente actualizados.' : 'Cliente registrado en la base.'}</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); navigate('clients', { clientIdToView: extractedData?.id }); }}
                                        className="flex-1 px-4 py-3 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all text-xs uppercase"
                                    >
                                        Ver Ficha
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setStep('upload'); setExtractedData(null); setExistingClient(null); }}
                                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs uppercase"
                                    >
                                        Nuevo PDF
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center relative z-10 space-y-6 w-full max-w-xs">
                                <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-red-100 dark:border-red-900/30">
                                    <FileText size={40} className="text-red-600 dark:text-red-400" />
                                </div>
                                
                                <div>
                                    <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Subir Certificado</h3>
                                    <p className="text-slate-400 text-sm">Formato aceptado: <strong>Solo PDF</strong></p>
                                </div>

                                <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-brand-teal text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all flex items-center justify-center gap-2">
                                    <FileUp size={20}/>
                                    <span>Seleccionar PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* REVIEW ZONE */}
                <div className="lg:col-span-7 h-full flex flex-col min-h-0">
                    {step === 'review' && extractedData ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl h-full flex flex-col animate-slide-in-right">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-brand-navy dark:text-white flex items-center gap-2">
                                        <ShieldCheck size={24} className="text-brand-teal"/> Revisión de Datos
                                    </h3>
                                    {existingClient ? (
                                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle size={12}/> Cliente Existente Detectado (Modo Actualización)</span>
                                    ) : (
                                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1"><CheckCircle size={12}/> Nuevo Cliente Detectado</span>
                                    )}
                                </div>
                                
                                {/* Switches */}
                                <div className="flex gap-4">
                                     <button onClick={() => setIsVip(!isVip)} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${isVip ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                        <span className="text-[9px] font-black uppercase">VIP / Suscrito</span>
                                        {isVip ? <ToggleRight size={24} className="text-amber-500"/> : <ToggleLeft size={24}/>}
                                     </button>
                                     <button onClick={() => setIsActiveClient(!isActiveClient)} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${isActiveClient ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-500'}`}>
                                        <span className="text-[9px] font-black uppercase">Estado</span>
                                        {isActiveClient ? <ToggleRight size={24} className="text-green-500"/> : <ToggleLeft size={24}/>}
                                     </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
                                {/* Form Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RUC / ID</label>
                                        <input 
                                            value={extractedData.ruc || ''} 
                                            onChange={e => setExtractedData({...extractedData, ruc: e.target.value})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Régimen</label>
                                        <select 
                                            value={extractedData.regime}
                                            onChange={e => setExtractedData({...extractedData, regime: e.target.value as TaxRegime})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 text-sm"
                                        >
                                            {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nombre / Razón Social</label>
                                    <input 
                                        value={extractedData.name || ''} 
                                        onChange={e => setExtractedData({...extractedData, name: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700" 
                                    />
                                </div>
                                
                                {/* Password Field (Auto-detected from vault) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex justify-between">
                                        <span>Clave SRI</span>
                                        {foundPasswordInVault && (
                                            <span className="text-emerald-600 flex items-center gap-1"><Key size={10}/> Encontrada en Bóveda</span>
                                        )}
                                    </label>
                                    <input 
                                        type="password"
                                        value={extractedData.sriPassword || ''} 
                                        onChange={e => setExtractedData({...extractedData, sriPassword: e.target.value})}
                                        className={`w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono font-bold text-slate-800 dark:text-white border ${foundPasswordInVault ? 'border-emerald-300' : 'border-slate-200 dark:border-slate-700'}`} 
                                        placeholder="No encontrada"
                                    />
                                </div>

                                {/* Address and Tariff Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dirección Completa</label>
                                        <textarea 
                                            value={extractedData.address || ''} 
                                            onChange={e => setExtractedData({...extractedData, address: e.target.value})}
                                            rows={2}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 resize-none" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-wider ml-1 flex items-center gap-1"><DollarSign size={10}/> Tarifa ($)</label>
                                        <input 
                                            type="number"
                                            value={extractedData.customServiceFee ?? ''} 
                                            onChange={e => setExtractedData({...extractedData, customServiceFee: parseFloat(e.target.value)})}
                                            className="w-full p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl font-black text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 text-center" 
                                            placeholder="Auto"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Actividad Económica Principal</label>
                                    <textarea 
                                        value={extractedData.economicActivity || ''} 
                                        onChange={e => setExtractedData({...extractedData, economicActivity: e.target.value})}
                                        rows={2}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 resize-none" 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Email</label>
                                        <input 
                                            value={extractedData.email || ''} 
                                            onChange={e => setExtractedData({...extractedData, email: e.target.value})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700" 
                                        />
                                    </div>
                                     <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Celular</label>
                                        <input 
                                            value={(extractedData.phones || [])[0] || ''} 
                                            onChange={e => setExtractedData({...extractedData, phones: [e.target.value]})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <FileJson size={12}/> Obligaciones Tributarias (Notas)
                                    </p>
                                    <textarea 
                                        value={extractedData.notes || ''}
                                        onChange={e => setExtractedData({...extractedData, notes: e.target.value})}
                                        className="w-full bg-transparent text-xs text-yellow-800 dark:text-yellow-200 font-medium border-none p-0 focus:ring-0 resize-none h-24"
                                        placeholder="No se detectaron obligaciones adicionales."
                                    />
                                    {extractedData.category?.includes('Semestral') && (
                                        <p className="text-[10px] text-yellow-600 mt-2 font-bold">⚠️ Se detectó periodicidad SEMESTRAL.</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                                <button 
                                    onClick={() => { setStep('upload'); setExtractedData(null); setExistingClient(null); }}
                                    className="flex-1 py-4 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-sm transition-colors uppercase tracking-wider"
                                >
                                    Descartar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className={`flex-[2] py-4 rounded-xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide transform hover:scale-[1.02] ${existingClient ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-brand-navy text-white hover:bg-slate-800'}`}
                                >
                                    <Save size={18}/> {existingClient ? 'Actualizar Cliente' : 'Crear Cliente'}
                                </button>
                            </div>
                        </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                                <ArrowLeft size={24} className="text-slate-300"/>
                            </div>
                            <h4 className="text-lg font-bold text-slate-400">Esperando archivo PDF...</h4>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
