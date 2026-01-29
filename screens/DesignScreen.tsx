
import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, ArrowRight, Loader, X, Save, ShieldCheck, 
    User, MapPin, Mail, Phone, Briefcase, FileJson, DollarSign, Key, 
    ToggleRight, ToggleLeft, ArrowLeft, FileUp, Download, Plus, Clock
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, TaxRegime, ClientCategory, Screen, Task, TaskStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import { extractDataFromSriPdf } from '../services/pdfExtraction';
import { addDays } from 'date-fns';

interface DesignScreenProps {
    navigate: (screen: Screen, options?: any) => void;
    sriCredentials?: Record<string, string>;
}

// Estructura para obligaciones extra detectadas
interface ExtraObligation {
    id: string;
    name: string;
    price: number;
    periodicity: 'Mensual' | 'Semestral' | 'Anual';
    selected: boolean;
}

export const DesignScreen: React.FC<DesignScreenProps> = ({ navigate, sriCredentials }) => {
    const { toast } = useToast();
    const { clients, setClients, setTasks } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Flow State
    const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
    const [extractedData, setExtractedData] = useState<Partial<Client> | null>(null);
    const [existingClient, setExistingClient] = useState<Client | null>(null);
    const [isVip, setIsVip] = useState(false);
    const [isActiveClient, setIsActiveClient] = useState(true);
    const [foundPasswordInVault, setFoundPasswordInVault] = useState(false);
    
    // Extra Obligations State (PRODUCTOS)
    const [extraObligations, setExtraObligations] = useState<ExtraObligation[]>([]);

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
        setExtraObligations([]);

        try {
            // --- USO DEL EXTRACTOR LOCAL (SIN IA) ---
            const rawData = await extractDataFromSriPdf(file);
            
            // --- TRANSFORMACIÓN A FORMATO INTERNO ---
            // Detectar duplicados
            const match = clients.find(c => c.ruc === rawData.ruc);
            setExistingClient(match || null);
            
            // Buscar clave en bóveda local (Robustez: Trim RUC)
            let finalPassword = match?.sriPassword || '';
            const cleanRuc = rawData.ruc.trim();
            if (!finalPassword && cleanRuc && sriCredentials && sriCredentials[cleanRuc]) {
                finalPassword = sriCredentials[cleanRuc];
                setFoundPasswordInVault(true);
            }

            // --- LÓGICA INTELIGENTE DE OBLIGACIONES ---
            
            // 1. Determinar Categoría Principal (BASE: IVA)
            let detectedCategory = ClientCategory.InternoMensual;
            if (rawData.regimen === TaxRegime.RimpeNegocioPopular) {
                detectedCategory = ClientCategory.ImpuestoRentaNegocioPopular;
            } else if (rawData.obligaciones_tributarias === 'semestral') {
                detectedCategory = ClientCategory.InternoSemestral;
            } else if (rawData.obligaciones_tributarias === 'mensual') {
                detectedCategory = ClientCategory.InternoMensual;
            }

            // 2. DETECTAR PRODUCTOS/OBLIGACIONES ESPECÍFICAS (Separados del régimen)
            const extras: ExtraObligation[] = [];
            
            rawData.lista_obligaciones.forEach((obs) => {
                const upperObs = obs.toUpperCase();
                
                // Mapeo de obligaciones especiales a productos con precio
                if (upperObs.includes("ICE")) {
                     const isMensual = upperObs.includes("MENSUAL");
                     extras.push({
                         id: uuidv4(),
                         name: isMensual ? "Declaración Mensual de ICE" : "Declaración de ICE",
                         price: 25.00,
                         periodicity: isMensual ? 'Mensual' : 'Anual',
                         selected: true
                     });
                     // A menudo el ICE implica Anexo
                     if (upperObs.includes("ANEXO")) {
                         extras.push({
                             id: uuidv4(),
                             name: "Anexo de Movimiento ICE",
                             price: 20.00,
                             periodicity: 'Mensual',
                             selected: true
                         });
                     }
                }
                
                if (upperObs.includes("PVP") || upperObs.includes("PRECIOS DE VENTA")) {
                    extras.push({
                         id: uuidv4(),
                         name: "Anexo Anual PVP",
                         price: 30.00,
                         periodicity: 'Anual',
                         selected: true
                     });
                }
                
                if (upperObs.includes("VEHÍCULOS") || upperObs.includes("MOTORIZADOS")) {
                    extras.push({
                         id: uuidv4(),
                         name: "Impuesto a la Propiedad de Vehículos",
                         price: 10.00,
                         periodicity: 'Anual',
                         selected: true
                     });
                }
                
                 if (upperObs.includes("ACCIONISTAS") || upperObs.includes("APS")) {
                    extras.push({
                         id: uuidv4(),
                         name: "Anexo de Accionistas (APS)",
                         price: 40.00,
                         periodicity: 'Anual',
                         selected: true
                     });
                }
            });
            
            // Eliminar duplicados por nombre
            const uniqueExtras = extras.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
            setExtraObligations(uniqueExtras);

            // Mantener configuración si el cliente ya existe
            if (match) {
                setIsVip(match.category.includes('Suscripción'));
                setIsActiveClient(match.isActive ?? true);
            } else {
                setIsVip(false);
                setIsActiveClient(true);
            }

            setExtractedData({
                id: match?.id || uuidv4(),
                ruc: rawData.ruc,
                name: rawData.apellidos_nombres,
                address: rawData.direccion, // Parroquia | Referencia
                economicActivity: rawData.actividad_economica, // Actividad limpia (sin *)
                email: rawData.contacto.email,
                phones: rawData.contacto.celular ? [rawData.contacto.celular] : [],
                regime: rawData.regimen, // El régimen se mantiene estricto (3 tipos)
                category: detectedCategory,
                sriPassword: finalPassword,
                notes: `Obligaciones detectadas en PDF:\n${rawData.lista_obligaciones.join('\n')}`,
                declarationHistory: match?.declarationHistory || [],
                customServiceFee: match?.customServiceFee,
                electronicSignaturePassword: match?.electronicSignaturePassword || '',
                sharedAccessKey: match?.sharedAccessKey || ''
            });

            setStep('review');
            toast.success("Datos extraídos correctamente.");

        } catch (error: any) {
            console.error(error);
            toast.error("Error al procesar el PDF. Asegúrese de que sea un RUC válido.");
            setStep('upload');
        }
    };

    const handleSave = () => {
        if (!extractedData || !extractedData.ruc || !extractedData.name) {
            toast.error("Datos incompletos. RUC y Nombre son obligatorios.");
            return;
        }

        // Apply VIP Override Logic for main category
        let finalCategory = extractedData.category || ClientCategory.InternoMensual;
        if (isVip) {
            if (finalCategory === ClientCategory.InternoMensual) finalCategory = ClientCategory.SuscripcionMensual;
            if (finalCategory === ClientCategory.InternoSemestral) finalCategory = ClientCategory.SuscripcionSemestral;
        } else {
            if (finalCategory === ClientCategory.SuscripcionMensual) finalCategory = ClientCategory.InternoMensual;
            if (finalCategory === ClientCategory.SuscripcionSemestral) finalCategory = ClientCategory.InternoSemestral;
        }

        // Add extra obligations to notes and potentially schedule tasks
        let notes = extractedData.notes || '';
        const selectedExtras = extraObligations.filter(e => e.selected);
        
        if (selectedExtras.length > 0) {
            notes += `\n\n--- PRODUCTOS / OBLIGACIONES ADICIONALES ---\n`;
            selectedExtras.forEach(e => {
                notes += `• ${e.name} (${e.periodicity}): $${e.price}\n`;
            });
        }

        const finalClient: Client = {
            ...extractedData as Client,
            category: finalCategory,
            isActive: isActiveClient,
            notes: notes
        };

        setClients(prev => {
            if (existingClient) {
                return prev.map(c => c.id === finalClient.id ? finalClient : c);
            }
            return [...prev, finalClient];
        });

        // GENERATE TASKS FOR EXTRA OBLIGATIONS (PRODUCTOS)
        if (selectedExtras.length > 0) {
            const newTasks: Task[] = selectedExtras.map(extra => ({
                id: uuidv4(),
                title: extra.name,
                description: `Obligación específica detectada en RUC. Periodicidad: ${extra.periodicity}. Generado automáticamente.`,
                clientId: finalClient.id,
                dueDate: addDays(new Date(), 7).toISOString(), // Default due date next week
                status: TaskStatus.Pendiente,
                cost: extra.price,
                advancePayment: 0
            }));
            setTasks(prev => [...prev, ...newTasks]);
            toast.success(`${newTasks.length} tareas de servicios adicionales creadas.`);
        }

        setStep('success');
        toast.success(existingClient ? "Cliente actualizado" : "Cliente creado");
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-fade-in px-4 h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-6 pt-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <ScanLine className="text-brand-teal"/> Extractor PDF RUC (Local)
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Lectura instantánea de Certificados SRI sin uso de Inteligencia Artificial.
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
                                <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Analizando Estructura...</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Extrayendo datos y obligaciones...</p>
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
                                        onClick={(e) => { e.stopPropagation(); setStep('upload'); setExtractedData(null); setExistingClient(null); setExtraObligations([]); }}
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
                                    <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Subir Certificado RUC</h3>
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
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Actividad Económica</label>
                                    <input 
                                        value={extractedData.economicActivity || ''} 
                                        onChange={e => setExtractedData({...extractedData, economicActivity: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 text-sm" 
                                        placeholder="Actividad extraída..."
                                    />
                                </div>
                                
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
                                
                                {/* OBLIGACIONES EXTRA DETECTADAS (PRODUCTOS) */}
                                {extraObligations.length > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-black text-brand-navy dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Briefcase size={14}/> Productos / Obligaciones Detectadas
                                        </h4>
                                        <p className="text-[10px] text-slate-500 mb-3">
                                            Seleccione las obligaciones adicionales que se configurarán como tareas/productos tarifados.
                                        </p>
                                        <div className="space-y-3">
                                            {extraObligations.map((extra, idx) => (
                                                <div key={extra.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={extra.selected} 
                                                            onChange={e => {
                                                                const newExtras = [...extraObligations];
                                                                newExtras[idx].selected = e.target.checked;
                                                                setExtraObligations(newExtras);
                                                            }}
                                                            className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal"
                                                        />
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{extra.name}</span>
                                                    </div>
                                                    
                                                    {extra.selected && (
                                                        <div className="flex gap-2 w-full sm:w-auto">
                                                            <div className="relative w-20">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">$</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={extra.price}
                                                                    onChange={e => {
                                                                        const newExtras = [...extraObligations];
                                                                        newExtras[idx].price = parseFloat(e.target.value);
                                                                        setExtraObligations(newExtras);
                                                                    }}
                                                                    className="w-full pl-4 p-1.5 text-[10px] rounded-lg border bg-slate-50 dark:bg-slate-700 font-bold"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* NOTAS DE OBLIGACIONES */}
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <FileJson size={12}/> Resumen de Obligaciones
                                    </p>
                                    <textarea 
                                        value={extractedData.notes || ''}
                                        onChange={e => setExtractedData({...extractedData, notes: e.target.value})}
                                        className="w-full bg-transparent text-xs text-yellow-800 dark:text-yellow-200 font-medium border-none p-0 focus:ring-0 resize-none h-24"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                                <button 
                                    onClick={() => { setStep('upload'); setExtractedData(null); setExistingClient(null); setExtraObligations([]); }}
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
