import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, ArrowRight, Loader, X, Save, ShieldCheck, 
    User, MapPin, Mail, Phone, Briefcase, FileJson, DollarSign, Key, 
    ToggleRight, ToggleLeft, ArrowLeft, FileUp, Download, Plus, Clock, Crown,
    Hammer, Building, RefreshCw, ArrowRightLeft, Coins, CreditCard
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, TaxRegime, Screen, Task, TaskStatus } from '../types';
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
    const [isActiveClient, setIsActiveClient] = useState(true);
    
    const [selectedFrequency, setSelectedFrequency] = useState<'MENSUAL' | 'SEMESTRAL' | 'ANUAL' | 'DEVOLUCION'>('MENSUAL');

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
        setExistingClient(null);

        try {
            const rawData = await extractDataFromSriPdf(file);
            
            if (!rawData || !rawData.ruc) {
                throw new Error("No se pudieron extraer datos del PDF.");
            }

            const cleanRuc = rawData.ruc.trim();
            const match = clients.find(c => c.ruc === cleanRuc);
            
            if (match) {
                setIsActiveClient(match.isActive ?? true);
            } else {
                setIsActiveClient(true);
            }
            
            let finalPassword = match?.sriPassword || '';
            if (!finalPassword && cleanRuc && sriCredentials && sriCredentials[cleanRuc]) {
                finalPassword = sriCredentials[cleanRuc];
            }

            if (rawData.regimen === TaxRegime.RimpeNegocioPopular) {
                setSelectedFrequency('ANUAL');
            } else if (rawData.obligaciones_tributarias === 'semestral') {
                setSelectedFrequency('SEMESTRAL');
            } else {
                setSelectedFrequency('MENSUAL');
            }

            setExtractedData({
                id: match?.id || uuidv4(),
                ruc: cleanRuc,
                name: rawData.apellidos_nombres,
                address: rawData.direccion,
                economicActivity: rawData.actividad_economica,
                email: rawData.contacto.email || match?.email || '',
                phones: rawData.contacto.celular ? [rawData.contacto.celular] : (match?.phones || []),
                regime: rawData.regimen,
                sriPassword: finalPassword,
                notes: `Obligaciones detectadas en PDF:\n${(rawData.lista_obligaciones || []).join('\n')}`,
                declarations: match?.declarations || [],
                // TARIFAS PREDETERMINADAS 5/10
                fee_structure: match?.fee_structure || {
                    monthly: 5,
                    annual: 10,
                    semestral: 5
                },
                isArtisan: rawData.es_artesano,
                establishmentCount: rawData.cantidad_establecimientos
            });

            setStep('review');

        } catch (error: any) {
            console.error(error);
            toast.error("Error: " + (error.message || "Formato desconocido"));
            setStep('upload');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = () => {
        if (!extractedData || !extractedData.ruc || !extractedData.name) {
            toast.error("Datos incompletos.");
            return;
        }

        const ivaFrequency = selectedFrequency === 'SEMESTRAL' ? 'Semestral' : selectedFrequency === 'MENSUAL' ? 'Mensual' : 'Ninguno';
        
        const finalClient: Client = {
            ...extractedData as Client,
            
            isActive: isActiveClient,
            taxProfile: {
                ivaFrequency,
                requiresAnnualRenta: true,
                requiresAnexosGastos: false,
                hasActiveDevolucionIva: selectedFrequency === 'DEVOLUCION',
                hasActiveElderlyDevolucionIva: false,
                requiresIce: false,
                requiresAnexoPvp: false
            }
        };

        setClients(prev => {
            const existingIndex = prev.findIndex(c => c.ruc === finalClient.ruc);
            if (existingIndex > -1) {
                const newClients = [...prev];
                newClients[existingIndex] = { 
                    ...prev[existingIndex], 
                    ...finalClient,
                    id: prev[existingIndex].id
                }; 
                return newClients;
            }
            return [...prev, finalClient];
        });

        toast.success(existingClient ? "Ficha actualizada con éxito" : "Cliente registrado exitosamente");
        setStep('success');
    };

    const ComparisonRow = ({ label, oldVal, newVal }: { label: string, oldVal?: string, newVal?: string }) => {
        if (!existingClient) return null;
        const isDiff = oldVal?.trim().toLowerCase() !== newVal?.trim().toLowerCase();

        return (
            <div className={`grid grid-cols-2 gap-2 text-xs p-3 rounded-xl border ${isDiff ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                <div className="text-slate-500 truncate">
                    <span className="block font-medium text-[9px] uppercase opacity-70 mb-1">{label} (Actual)</span>
                    <span className={isDiff ? "line-through opacity-60 italic" : ""}>{oldVal || 'Vacío'}</span>
                </div>
                <div className="text-slate-800 dark:text-white font-medium truncate">
                     <span className="block font-medium text-[9px] uppercase text-brand-teal mb-1">{label} (Escaneado)</span>
                    {newVal || 'No detectado'}
                    {isDiff && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-fade-in px-4 h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-6 pt-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-display font-semibold text-brand-navy dark:text-white flex items-center gap-2">
                        <ScanLine className="text-brand-teal"/> Escáner de RUC
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Sincronización profesional de datos fiscales.
                    </p>
                </div>
                <button onClick={() => navigate('clients')} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium text-xs uppercase tracking-wider transition-colors self-start md:self-auto">
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
                                <h3 className="text-xl font-semibold text-brand-navy dark:text-white mb-2">Procesando Certificado...</h3>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Validando identidad en SRI</p>
                            </div>
                        ) : step === 'success' ? (
                            <div className="text-center relative z-10">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                                    <CheckCircle size={48} />
                                </div>
                                <h3 className="text-2xl font-semibold text-emerald-700 mb-2">¡Sincronización Exitosa!</h3>
                                <p className="text-slate-500 mb-8 text-sm">Tarifas $5 mes / $10 renta configuradas.</p>
                                <button 
                                    onClick={() => navigate('clients', { clientIdToView: extractedData?.id })}
                                    className="px-8 py-3 bg-brand-navy text-white font-medium rounded-xl shadow-lg hover:bg-slate-800 transition-all text-xs uppercase"
                                >
                                    Ver Ficha del Cliente
                                </button>
                            </div>
                        ) : (
                            <div className="text-center relative z-10 space-y-6 w-full max-w-xs">
                                <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-red-100 dark:border-red-900/30">
                                    <FileText size={40} className="text-rose-400 dark:text-red-400" />
                                </div>
                                
                                <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-brand-teal text-white rounded-xl font-medium shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all flex items-center justify-center gap-2">
                                    <UploadCloud size={20}/>
                                    <span>Subir PDF RUC</span>
                                </button>
                                <p className="text-xs text-slate-400 font-medium px-4">Detectamos automáticamente razón social, dirección, régimen y obligaciones.</p>
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
                                    <h3 className="text-xl font-semibold text-brand-navy dark:text-white flex items-center gap-2">
                                        <ShieldCheck size={24} className="text-brand-teal"/> Revisión de Datos
                                    </h3>
                                    {existingClient && (
                                        <p className="text-amber-500 dark:text-amber-400 text-xs font-medium mt-1 uppercase flex items-center gap-1">
                                            <AlertTriangle size={12}/> Cliente existente detectado.
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 bg-brand-navy/5 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-brand-navy/10 dark:border-slate-700">
                                    <Coins size={14} className="text-amber-400"/>
                                    <span className="text-[10px] font-semibold text-brand-navy dark:text-amber-400 uppercase">Tarifas Pro Aplicadas</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5 pb-4">
                                {/* Comparación si el cliente ya existe */}
                                {existingClient && (
                                    <div className="space-y-2 p-4 bg-amber-50/30 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                                        <h4 className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest ml-1 mb-2">Comparativa de cambios</h4>
                                        <ComparisonRow label="Razón Social" oldVal={existingClient.name} newVal={extractedData.name} />
                                        <ComparisonRow label="Dirección" oldVal={existingClient.address} newVal={extractedData.address} />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">RUC</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                            <input value={extractedData.ruc || ''} readOnly className="w-full pl-10 p-3 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono font-medium text-slate-500 border border-slate-200 dark:border-slate-800 text-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">WhatsApp de contacto</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                            <input 
                                                value={(extractedData.phones || [])[0] || ''} 
                                                onChange={e => setExtractedData({...extractedData, phones: [e.target.value]})}
                                                className="w-full pl-10 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-brand-teal" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Dirección Detectada</label>
                                    <textarea 
                                        rows={2}
                                        value={extractedData.address || ''} 
                                        onChange={e => setExtractedData({...extractedData, address: e.target.value})}
                                        className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-medium text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 resize-none outline-none focus:ring-2 focus:ring-brand-teal" 
                                    />
                                </div>

                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-500 dark:text-emerald-400"><Coins size={18}/></div>
                                        <div>
                                            <p className="text-[10px] font-medium text-emerald-500 uppercase">Honorarios Sugeridos</p>
                                            <div className="flex gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase">Mensual</span>
                                                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">$5.00</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase">Anual</span>
                                                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">$10.00</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="p-2 rounded-xl bg-amber-100 text-amber-500"
                                            title="Plan VIP"
                                        >
                                            <Crown size={20} fill="currentColor"/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                                <button 
                                    onClick={() => { setStep('upload'); setExtractedData(null); }}
                                    className="flex-1 py-4 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium text-sm uppercase tracking-wider transition-colors"
                                >
                                    Descartar
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className={`flex-[2] py-4 rounded-xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide transform hover:scale-[1.02] ${existingClient ? 'bg-amber-400 text-white shadow-amber-400/20' : 'bg-brand-navy text-white shadow-brand-navy/20'}`}
                                >
                                    <Save size={18}/> {existingClient ? 'Actualizar Información' : 'Registrar Cliente VIP'}
                                </button>
                            </div>
                        </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="p-4 rounded-full bg-white dark:bg-slate-800 shadow-sm mb-4">
                                <ArrowLeft size={24} className="text-slate-300"/>
                            </div>
                            <h4 className="text-lg font-medium text-slate-400">Seleccione un certificado SRI</h4>
                            <p className="text-xs text-slate-400 mt-2 max-w-[200px]">Los datos se extraerán para tu revisión inmediata.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};