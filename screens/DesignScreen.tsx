
import React, { useState, useRef } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, Sparkles, ArrowRight, Loader, RefreshCw, 
    CreditCard, User, MapPin, Mail, Phone, Briefcase, 
    Save, FileJson, ShieldCheck, ArrowLeft, X, Image as ImageIcon, Camera
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, TaxRegime, ClientCategory, StoredFile, Screen } from '../types';
import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import { analyzeClientPhoto } from '../services/geminiService';

interface DesignScreenProps {
    navigate: (screen: Screen, options?: any) => void;
}

export const DesignScreen: React.FC<DesignScreenProps> = ({ navigate }) => {
    const { toast } = useToast();
    const { clients, setClients } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Flow State
    const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<Partial<Client> | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            processDocument(file);
        }
    };

    const processDocument = async (file: File) => {
        setStep('analyzing');
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64String = (e.target?.result as string).split(',')[1];
                
                try {
                    const result = await analyzeClientPhoto(base64String, file.type);
                    
                    const existingClient = clients.find(c => c.ruc === result.ruc);
                    setIsUpdating(!!existingClient);

                    setExtractedData({
                        ...result,
                        id: existingClient?.id || uuidv4(),
                        declarationHistory: existingClient?.declarationHistory || [],
                        // Default logic if AI misses
                        regime: result.regime || TaxRegime.General,
                        category: result.category || ClientCategory.SuscripcionMensual,
                        isActive: true
                    });
                    setStep('review');
                } catch (error: any) {
                    console.error(error);
                    toast.error(error.message || "Error en el análisis IA.");
                    setStep('upload');
                    setPreviewUrl(null);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            toast.error("Error al procesar archivo.");
            setStep('upload');
        }
    };

    const handleSave = () => {
        if (!extractedData || !extractedData.ruc || !extractedData.name) {
            toast.error("Datos incompletos. RUC y Nombre son obligatorios.");
            return;
        }

        const rucFile: StoredFile | undefined = selectedFile ? {
            name: selectedFile.name,
            type: selectedFile.type.includes('pdf') ? 'pdf' : 'image',
            size: selectedFile.size,
            lastModified: selectedFile.lastModified
        } : undefined;

        const finalClient: Client = {
            id: extractedData.id || uuidv4(),
            ruc: extractedData.ruc,
            name: extractedData.name,
            tradeName: extractedData.tradeName || '',
            sriPassword: extractedData.sriPassword || '',
            regime: extractedData.regime || TaxRegime.General,
            category: extractedData.category || ClientCategory.SuscripcionMensual,
            economicActivity: extractedData.economicActivity || '',
            address: extractedData.address || '',
            email: extractedData.email || '',
            phones: extractedData.phones || [],
            notes: extractedData.notes || 'Cliente digitalizado vía IA.',
            declarationHistory: extractedData.declarationHistory || [],
            isActive: true,
            rucPdf: rucFile, 
            isArtisan: !!extractedData.isArtisan,
            establishmentCount: 1,
            jurisdiction: 'EL ORO', // Default location
            electronicSignaturePassword: '',
            sharedAccessKey: ''
        };

        setClients(prev => {
            if (isUpdating) {
                return prev.map(c => c.id === finalClient.id ? finalClient : c);
            }
            return [...prev, finalClient];
        });

        setStep('success');
        toast.success(isUpdating ? "Cliente actualizado" : "Cliente creado");
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in px-4 h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-8 pt-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-black text-brand-navy dark:text-white flex items-center gap-2">
                        <ScanLine className="text-brand-teal"/> Onboarding Digital
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Sube un RUC o Cédula y deja que la IA estructure el expediente.
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
                            ${step === 'analyzing' ? 'border-brand-teal bg-brand-teal/5 pointer-events-none' : 'border-slate-200 dark:border-slate-700'}
                        `}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileSelection} accept=".pdf,image/*" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleFileSelection} accept="image/*" capture="environment" className="hidden" />
                        
                        {/* Background Preview */}
                        {previewUrl && (
                            <div className="absolute inset-0 z-0 opacity-10">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}

                        {step === 'analyzing' ? (
                            <div className="text-center relative z-10">
                                <div className="relative mx-auto mb-6 w-24 h-24">
                                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-brand-teal rounded-full border-t-transparent animate-spin"></div>
                                    <Sparkles className="absolute inset-0 m-auto text-brand-teal animate-pulse" size={32}/>
                                </div>
                                <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Procesando...</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Leyendo Documento</p>
                            </div>
                        ) : step === 'success' ? (
                            <div className="text-center relative z-10">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20 animate-bounce">
                                    <CheckCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-black text-emerald-700 mb-2">¡Expediente Creado!</h3>
                                <p className="text-slate-500 mb-8 text-sm">Los datos se han guardado en la cartera.</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); navigate('clients', { clientIdToView: extractedData?.id }); }}
                                    className="px-8 py-3 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all w-full"
                                >
                                    Ver Cliente
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setStep('upload'); setSelectedFile(null); setExtractedData(null); setPreviewUrl(null); }}
                                    className="block w-full mt-4 text-slate-400 text-xs uppercase font-bold tracking-widest hover:text-slate-600"
                                >
                                    Escanear Otro
                                </button>
                            </div>
                        ) : (
                            <div className="text-center relative z-10 space-y-6 w-full max-w-xs">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                                    <UploadCloud size={32} className="text-brand-navy dark:text-slate-200" />
                                </div>
                                
                                <div>
                                    <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Cargar Documento</h3>
                                    <p className="text-slate-400 text-sm">Sube el PDF del RUC o una foto clara.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-brand-teal/10 hover:text-brand-teal transition-colors border border-slate-100 dark:border-slate-700">
                                        <FileText size={24} className="mb-2"/>
                                        <span className="text-xs font-bold uppercase">Archivo</span>
                                    </button>
                                    <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-brand-teal/10 hover:text-brand-teal transition-colors border border-slate-100 dark:border-slate-700">
                                        <Camera size={24} className="mb-2"/>
                                        <span className="text-xs font-bold uppercase">Cámara</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* REVIEW ZONE */}
                <div className="lg:col-span-7 h-full flex flex-col min-h-0">
                    {step === 'review' && extractedData ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl h-full flex flex-col animate-slide-in-right">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xl font-black text-brand-navy dark:text-white flex items-center gap-2">
                                    <ShieldCheck size={24} className="text-brand-teal"/> Validación
                                </h3>
                                {isUpdating && (
                                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                                        Fusión Detectada
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
                                {/* Form Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">RUC / ID</label>
                                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <CreditCard size={16} className="text-slate-400 mr-2"/>
                                            <input 
                                                value={extractedData.ruc || ''} 
                                                onChange={e => setExtractedData({...extractedData, ruc: e.target.value})}
                                                className="bg-transparent w-full font-mono font-bold text-slate-800 dark:text-white outline-none" 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Régimen</label>
                                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <Briefcase size={16} className="text-slate-400 mr-2"/>
                                            <select 
                                                value={extractedData.regime}
                                                onChange={e => setExtractedData({...extractedData, regime: e.target.value as TaxRegime})}
                                                className="bg-transparent w-full font-bold text-slate-800 dark:text-white outline-none text-sm"
                                            >
                                                {Object.values(TaxRegime).map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nombre / Razón Social</label>
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <User size={16} className="text-slate-400 mr-2"/>
                                        <input 
                                            value={extractedData.name || ''} 
                                            onChange={e => setExtractedData({...extractedData, name: e.target.value})}
                                            className="bg-transparent w-full font-bold text-slate-800 dark:text-white outline-none" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nombre Comercial</label>
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <Briefcase size={16} className="text-slate-400 mr-2"/>
                                        <input 
                                            value={extractedData.tradeName || ''} 
                                            onChange={e => setExtractedData({...extractedData, tradeName: e.target.value})}
                                            className="bg-transparent w-full font-medium text-slate-800 dark:text-white outline-none text-sm" 
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dirección Matriz</label>
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <MapPin size={16} className="text-slate-400 mr-2"/>
                                        <textarea 
                                            value={extractedData.address || ''} 
                                            onChange={e => setExtractedData({...extractedData, address: e.target.value})}
                                            rows={2}
                                            className="bg-transparent w-full text-sm text-slate-700 dark:text-slate-200 outline-none resize-none" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Email</label>
                                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <Mail size={16} className="text-slate-400 mr-2"/>
                                            <input 
                                                value={extractedData.email || ''} 
                                                onChange={e => setExtractedData({...extractedData, email: e.target.value})}
                                                className="bg-transparent w-full text-sm font-medium text-slate-800 dark:text-white outline-none" 
                                                placeholder="No detectado"
                                            />
                                        </div>
                                    </div>
                                     <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Teléfono</label>
                                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <Phone size={16} className="text-slate-400 mr-2"/>
                                            <input 
                                                value={(extractedData.phones || [])[0] || ''} 
                                                onChange={e => setExtractedData({...extractedData, phones: [e.target.value]})}
                                                className="bg-transparent w-full text-sm font-medium text-slate-800 dark:text-white outline-none" 
                                                placeholder="No detectado"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {extractedData.notes && (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                                        <p className="text-[10px] font-black text-yellow-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <FileJson size={12}/> Observaciones IA
                                        </p>
                                        <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">{extractedData.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                                <button 
                                    onClick={() => { setStep('upload'); setExtractedData(null); setPreviewUrl(null); }}
                                    className="flex-1 py-4 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-sm transition-colors uppercase tracking-wider"
                                >
                                    Descartar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className="flex-[2] py-4 bg-brand-navy text-white rounded-xl font-black text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-wide transform hover:scale-[1.02]"
                                >
                                    <Save size={18}/> {isUpdating ? 'Confirmar Fusión' : 'Crear Expediente'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                                <ArrowLeft size={24} className="text-slate-300"/>
                            </div>
                            <h4 className="text-lg font-bold text-slate-400">Esperando documento...</h4>
                            <p className="text-sm text-slate-400 max-w-xs mt-2 font-medium">La vista previa de los datos aparecerá aquí una vez que la IA termine el análisis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
