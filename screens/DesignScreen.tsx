
import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, ArrowRight, Loader, X, Save, ShieldCheck, 
    User, MapPin, Mail, Phone, Briefcase, FileJson, DollarSign, Key, 
    ToggleRight, ToggleLeft, ArrowLeft, FileUp, Download, Plus, Clock, Crown,
    Hammer, Building, RefreshCw, ArrowRightLeft
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

    const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
    const [extractedData, setExtractedData] = useState<Partial<Client> | null>(null);
    const [existingClient, setExistingClient] = useState<Client | null>(null);
    const [isVip, setIsVip] = useState(false);
    const [isActiveClient, setIsActiveClient] = useState(true);
    const [foundPasswordInVault, setFoundPasswordInVault] = useState(false);
    
    const [selectedFrequency, setSelectedFrequency] = useState<'MENSUAL' | 'SEMESTRAL' | 'ANUAL' | 'DEVOLUCION'>('MENSUAL');
    const [extraObligations, setExtraObligations] = useState<ExtraObligation[]>([]);

    // Data Comparison State
    const [nameConflict, setNameConflict] = useState(false);

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
        setExistingClient(null);
        setNameConflict(false);

        try {
            const rawData = await extractDataFromSriPdf(file);
            
            // Verificación defensiva
            if (!rawData || !rawData.ruc) {
                throw new Error("No se pudieron extraer datos del PDF.");
            }

            const cleanRuc = rawData.ruc.trim();
            
            // 1. IDENTIFICACIÓN ÚNICA POR RUC (CRÍTICO)
            const match = clients.find(c => c.ruc === cleanRuc);
            
            if (match) {
                setExistingClient(match);
                // Detectar si el nombre cambió radicalmente
                // Usa optional chaining para seguridad
                const oldName = (match.name || '').split(' ')[0].toLowerCase();
                const newName = (rawData.apellidos_nombres || '').split(' ')[0].toLowerCase();

                if (oldName !== newName) {
                    setNameConflict(true);
                    toast.warning(`¡Atención! El RUC ${cleanRuc} ya existe pero tiene un nombre diferente.`);
                } else {
                    toast.info(`Cliente encontrado: ${match.name}`);
                }
            }
            
            // 2. Búsqueda de Clave
            let finalPassword = match?.sriPassword || '';
            if (!finalPassword && cleanRuc && sriCredentials && sriCredentials[cleanRuc]) {
                finalPassword = sriCredentials[cleanRuc];
                setFoundPasswordInVault(true);
            }

            // 3. Determinación de Frecuencia
            if (rawData.regimen === TaxRegime.RimpeNegocioPopular) {
                setSelectedFrequency('ANUAL');
            } else if (rawData.obligaciones_tributarias === 'semestral') {
                setSelectedFrequency('SEMESTRAL');
            } else {
                setSelectedFrequency('MENSUAL');
            }

            // 4. Obligaciones Extras
            const extras: ExtraObligation[] = [];
            if (rawData.lista_obligaciones) {
                rawData.lista_obligaciones.forEach((obs) => {
                    const upperObs = obs.toUpperCase();
                    if (upperObs.includes("ICE")) {
                         const isMensual = upperObs.includes("MENSUAL");
                         extras.push({ id: uuidv4(), name: isMensual ? "Declaración Mensual de ICE" : "Declaración de ICE", price: 25.00, periodicity: isMensual ? 'Mensual' : 'Anual', selected: true });
                         if (upperObs.includes("ANEXO")) {
                             extras.push({ id: uuidv4(), name: "Anexo de Movimiento ICE", price: 20.00, periodicity: 'Mensual', selected: true });
                         }
                    }
                    if (upperObs.includes("PVP")) {
                        extras.push({ id: uuidv4(), name: "Anexo Anual PVP", price: 30.00, periodicity: 'Anual', selected: true });
                    }
                    if (upperObs.includes("VEHÍCULOS") || upperObs.includes("MOTORIZADOS")) {
                        extras.push({ id: uuidv4(), name: "Impuesto a la Propiedad de Vehículos", price: 10.00, periodicity: 'Anual', selected: true });
                    }
                     if (upperObs.includes("ACCIONISTAS") || upperObs.includes("APS")) {
                        extras.push({ id: uuidv4(), name: "Anexo de Accionistas (APS)", price: 40.00, periodicity: 'Anual', selected: true });
                    }
                });
            }
            const uniqueExtras = extras.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
            setExtraObligations(uniqueExtras);

            // 5. Configurar datos pre-existentes si es update
            if (match) {
                setIsVip(match.category.includes('Suscripción'));
                setIsActiveClient(match.isActive ?? true);
            } else {
                setIsVip(false);
                setIsActiveClient(true);
            }

            // 6. Preparar datos finales
            setExtractedData({
                id: match?.id || uuidv4(), // MANTENER ID SI EXISTE
                ruc: cleanRuc,
                name: rawData.apellidos_nombres,
                address: rawData.direccion,
                economicActivity: rawData.actividad_economica,
                email: rawData.contacto.email || match?.email || '',
                phones: rawData.contacto.celular ? [rawData.contacto.celular] : (match?.phones || []),
                regime: rawData.regimen,
                sriPassword: finalPassword,
                notes: `Obligaciones detectadas en PDF:\n${(rawData.lista_obligaciones || []).join('\n')}`,
                declarationHistory: match?.declarationHistory || [],
                customServiceFee: match?.customServiceFee,
                electronicSignaturePassword: match?.electronicSignaturePassword || '',
                sharedAccessKey: match?.sharedAccessKey || '',
                isArtisan: rawData.es_artesano,
                establishmentCount: rawData.cantidad_establecimientos
            });

            setStep('review');

        } catch (error: any) {
            console.error(error);
            toast.error("Error al procesar el PDF: " + (error.message || "Formato desconocido"));
            setStep('upload');
            // Limpiar input para permitir reintentar el mismo archivo
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = () => {
        if (!extractedData || !extractedData.ruc || !extractedData.name) {
            toast.error("Datos incompletos. RUC y Nombre son obligatorios.");
            return;
        }

        let finalCategory = ClientCategory.InternoMensual;
        if (selectedFrequency === 'ANUAL') {
             finalCategory = ClientCategory.ImpuestoRentaNegocioPopular;
        } else if (selectedFrequency === 'DEVOLUCION') {
             finalCategory = ClientCategory.DevolucionIvaTerceraEdad;
        } else if (selectedFrequency === 'SEMESTRAL') {
             finalCategory = isVip ? ClientCategory.SuscripcionSemestral : ClientCategory.InternoSemestral;
        } else {
             finalCategory = isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual;
        }

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
            // Lógica crítica: ACTUALIZAR POR ID O RUC
            const existingIndex = prev.findIndex(c => c.ruc === finalClient.ruc);
            if (existingIndex > -1) {
                const newClients = [...prev];
                // Fusionar datos conservando historial y ID original
                newClients[existingIndex] = { 
                    ...prev[existingIndex], 
                    ...finalClient,
                    id: prev[existingIndex].id, // Forzar ID original
                    declarationHistory: prev[existingIndex].declarationHistory // Mantener historial
                }; 
                return newClients;
            }
            return [...prev, finalClient];
        });

        if (selectedExtras.length > 0) {
            const newTasks: Task[] = selectedExtras.map(extra => ({
                id: uuidv4(),
                title: extra.name,
                description: `Obligación específica detectada en RUC. Periodicidad: ${extra.periodicity}. Generado automáticamente.`,
                clientId: finalClient.id,
                dueDate: addDays(new Date(), 7).toISOString(),
                status: TaskStatus.Pendiente,
                cost: extra.price,
                advancePayment: 0
            }));
            setTasks(prev => [...prev, ...newTasks]);
            toast.success(`${newTasks.length} tareas adicionales creadas.`);
        }

        setStep('success');
        toast.success(existingClient ? "Ficha de cliente actualizada" : "Nuevo cliente registrado");
    };

    const ComparisonRow = ({ label, oldVal, newVal, highlight = false }: { label: string, oldVal?: string, newVal?: string, highlight?: boolean }) => {
        if (!existingClient) return null;
        const isDiff = oldVal !== newVal;
        if (!isDiff && !highlight) return null;

        return (
            <div className={`grid grid-cols-2 gap-2 text-xs p-2 rounded-lg ${isDiff ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                <div className="text-slate-500">
                    <span className="block font-bold text-[9px] uppercase">{label} (Actual)</span>
                    <span className="line-through opacity-70">{oldVal || '-'}</span>
                </div>
                <div className="text-slate-800 dark:text-white font-bold">
                     <span className="block font-bold text-[9px] uppercase text-brand-teal">{label} (Nuevo)</span>
                    {newVal || '-'}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-fade-in px-4 h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-6 pt-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <ScanLine className="text-brand-teal"/> Extractor PDF RUC (Pro)
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        El sistema usará el <strong>RUC</strong> como identificador único para crear o actualizar.
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
                                <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Analizando RUC...</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Verificando existencia en base de datos</p>
                            </div>
                        ) : step === 'success' ? (
                            <div className="text-center relative z-10">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                                    <CheckCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-emerald-700 mb-2">¡Proceso Exitoso!</h3>
                                <p className="text-slate-500 mb-8 text-sm">
                                    {existingClient 
                                        ? `Los datos de ${extractedData?.name} han sido sincronizados.` 
                                        : 'Cliente registrado correctamente.'}
                                </p>
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
                                    <p className="text-slate-400 text-sm">Si el RUC ya existe, actualizaremos los datos. Si es nuevo, lo crearemos.</p>
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
                                        <div className="flex flex-col mt-1">
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-700 w-fit">
                                                <RefreshCw size={12} className="animate-spin-slow"/>
                                                <span className="text-[10px] font-bold uppercase">Actualizando Cliente Existente</span>
                                            </div>
                                            {nameConflict && (
                                                <div className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                                    <AlertTriangle size={10}/> Conflicto de Nombre detectado
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1"><Plus size={12}/> Nuevo Cliente Detectado</span>
                                    )}
                                </div>
                                
                                <div className="flex gap-4">
                                     <button onClick={() => setIsVip(!isVip)} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${isVip ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                        <span className="text-[9px] font-black uppercase flex items-center gap-1"><Crown size={10}/> VIP Suscrito</span>
                                        {isVip ? <ToggleRight size={24} className="text-amber-500"/> : <ToggleLeft size={24}/>}
                                     </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
                                {/* COMPARISON SECTION FOR UPDATES */}
                                {existingClient && (
                                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <ArrowRightLeft size={14}/> Cambios Detectados
                                        </h4>
                                        <div className="space-y-2">
                                            <ComparisonRow label="Razón Social" oldVal={existingClient.name} newVal={extractedData.name} />
                                            <ComparisonRow label="Dirección" oldVal={existingClient.address} newVal={extractedData.address} />
                                            <ComparisonRow label="Régimen" oldVal={existingClient.regime} newVal={extractedData.regime} />
                                            {extractedData.name === existingClient.name && extractedData.address === existingClient.address && extractedData.regime === existingClient.regime && (
                                                <p className="text-xs text-slate-400 italic">No hay cambios significativos en los datos principales.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RUC (Llave Principal)</label>
                                        <input 
                                            value={extractedData.ruc || ''} 
                                            readOnly // RUC IS READ ONLY FROM PDF TO AVOID ERRORS
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Régimen</label>
                                        <select 
                                            value={extractedData.regime}
                                            onChange={e => {
                                                const val = e.target.value as TaxRegime;
                                                setExtractedData({...extractedData, regime: val});
                                                if(val === TaxRegime.RimpeNegocioPopular) setSelectedFrequency('ANUAL');
                                            }}
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
                                        className={`w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-800 dark:text-white border ${nameConflict ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 dark:border-slate-700'}`} 
                                    />
                                    {nameConflict && <p className="text-[10px] text-red-500 font-bold px-2">Nombre difiere del registro actual</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dirección (Extraída)</label>
                                    <textarea 
                                        rows={3}
                                        value={extractedData.address || ''} 
                                        onChange={e => setExtractedData({...extractedData, address: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-medium text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 resize-none" 
                                    />
                                </div>
                                
                                {foundPasswordInVault && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                                        <Key size={16} className="text-emerald-600"/>
                                        <span className="text-xs text-emerald-800 font-medium">Contraseña recuperada automáticamente de la Bóveda.</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                                <button 
                                    onClick={() => { setStep('upload'); setExtractedData(null); setExistingClient(null); setExtraObligations([]); setNameConflict(false); }}
                                    className="flex-1 py-4 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-sm transition-colors uppercase tracking-wider"
                                >
                                    Descartar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className={`flex-[2] py-4 rounded-xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide transform hover:scale-[1.02] ${existingClient ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-brand-navy text-white hover:bg-slate-800'}`}
                                >
                                    <Save size={18}/> {existingClient ? 'Confirmar Fusión de Datos' : 'Guardar Nuevo Cliente'}
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
