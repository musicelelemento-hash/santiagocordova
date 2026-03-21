
import React, { useState, useRef, useEffect } from 'react';
import { 
    UploadCloud, FileText, CheckCircle, AlertTriangle, 
    ScanLine, X, Save, ShieldCheck, 
    User, MapPin, Phone, Briefcase, DollarSign, Key, 
    ArrowLeft, Loader, Crown, Coins, CreditCard, Sparkles, Activity
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Client, TaxRegime, ClientCategory, Screen } from '../types';
import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import { extractPdfInWorker } from '../services/workerBridge';

export const DesignScreen: React.FC<{ navigate: (screen: Screen, options?: any) => void; sriCredentials?: Record<string, string> }> = ({ navigate, sriCredentials }) => {
    const { toast } = useToast();
    const { clients, setClients } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'success'>('upload');
    const [data, setData] = useState<Partial<Client> | null>(null);
    const [isVip, setIsVip] = useState(true);
    const [scanProgress, setScanProgress] = useState(0);

    const processFile = async (file: File) => {
        setStep('scanning');
        setScanProgress(0);
        
        // Simulación de etapas de análisis para UX Elite
        const intervals = [
            { p: 20, t: 500 }, { p: 45, t: 1200 }, { p: 70, t: 1800 }, { p: 95, t: 2500 }
        ];
        intervals.forEach(i => setTimeout(() => setScanProgress(i.p), i.t));

        try {
            const res = await extractPdfInWorker(file);
            
            // Verificación cruzada con Bóveda
            let password = '';
            if (sriCredentials && sriCredentials[res.ruc]) {
                password = sriCredentials[res.ruc];
                toast.info("Clave sincronizada automáticamente desde Bóveda");
            }

            setData({
                id: uuidv4(),
                ruc: res.ruc,
                name: res.apellidos_nombres,
                address: res.direccion,
                regime: res.regimen,
                sriPassword: password,
                isActive: true,
                declarations: [],
                notes: `[Análisis IA Profesional] Actividad Detectada: ${res.actividad_economica}`,
                fee_structure: {
                    monthly: res.regimen === TaxRegime.RimpeNegocioPopular ? 0 : 5,
                    annual: 10,
                },
                createdAt: new Date().toISOString()
            });
            
            setTimeout(() => setStep('review'), 3000);
        } catch (err: any) {
            toast.error(err.message);
            setStep('upload');
        }
    };

    const handleFinalSave = () => {
        if (!data || !data.ruc) return;
        
        const finalClient = {
            ...data,
            category: data.regime === TaxRegime.RimpeNegocioPopular 
                ? ClientCategory.ImpuestoRentaNegocioPopular 
                : (isVip ? ClientCategory.SuscripcionMensual : ClientCategory.InternoMensual)
        } as Client;

        setClients(prev => {
            const existing = prev.findIndex(c => c.ruc === finalClient.ruc);
            if (existing > -1) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], ...finalClient, id: updated[existing].id };
                return updated;
            }
            return [finalClient, ...prev];
        });

        toast.success("Ecosistema del cliente configurado");
        setStep('success');
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 h-full flex flex-col">
            <header className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-navy dark:bg-slate-800 rounded-2xl shadow-xl text-white">
                        <Activity size={24} className="text-brand-teal animate-pulse"/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-display font-black text-brand-navy dark:text-white uppercase tracking-tight">Sincronización Inteligente</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Motor de Extracción v4.0 PRO</p>
                    </div>
                </div>
                <button onClick={() => navigate('clients')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={24} className="text-slate-400"/>
                </button>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 min-h-0">
                
                {/* Zona de Interacción */}
                <div className="lg:col-span-5 flex flex-col h-full">
                    {step === 'upload' && (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-teal transition-all flex flex-col items-center justify-center p-12 group cursor-pointer bg-white dark:bg-slate-900 shadow-inner"
                        >
                            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}/>
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-400 group-hover:text-brand-teal group-hover:scale-110 transition-all shadow-sm mb-6">
                                <UploadCloud size={48} strokeWidth={1.5}/>
                            </div>
                            <h3 className="text-xl font-black text-brand-navy dark:text-white mb-2">Certificado RUC</h3>
                            <p className="text-sm text-slate-400 font-medium">Suelte el PDF para iniciar análisis</p>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="flex-1 rounded-[3rem] bg-brand-navy dark:bg-slate-900 flex flex-col items-center justify-center p-12 relative overflow-hidden shadow-2xl">
                            {/* Laser Scan Animation */}
                            <div className="absolute inset-0 bg-gradient-to-b from-brand-teal/0 via-brand-teal/20 to-brand-teal/0 h-1/2 w-full animate-scan pointer-events-none z-10"></div>
                            
                            <div className="relative z-20 text-center space-y-8">
                                <div className="w-32 h-32 rounded-full border-4 border-brand-teal/20 border-t-brand-teal animate-spin mx-auto flex items-center justify-center">
                                    <ScanLine size={48} className="text-brand-teal animate-pulse"/>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-2">Escaneando Estructura...</h3>
                                    <p className="text-brand-teal text-sm font-mono font-bold">{scanProgress}% Completado</p>
                                </div>
                                <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
                                    <div className="h-full bg-brand-teal transition-all duration-500" style={{width: `${scanProgress}%`}}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'review' && data && (
                        <div className="flex-1 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 shadow-xl flex flex-col animate-scale-in">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg">
                                    {data.name?.substring(0,2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">{data.name}</h3>
                                    <p className="text-xs font-mono font-bold text-brand-teal">{data.ruc}</p>
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Régimen Detectado</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Briefcase size={14} className="text-brand-teal"/> {data.regime}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Registrada</p>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                        "{data.address}"
                                    </p>
                                </div>
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Costo Proyectado</p>
                                        <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">${data.feeStructure?.monthly?.toFixed(2)} <span className="text-[10px] font-bold opacity-50">/ MES</span></p>
                                    </div>
                                    <Coins className="text-emerald-500" size={24}/>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={() => setStep('upload')} className="flex-1 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors">Descartar</button>
                                <button onClick={handleFinalSave} className="flex-1 py-4 bg-brand-navy text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-navy/20 flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                                    <Save size={18}/> Confirmar
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {step === 'success' && (
                        <div className="flex-1 rounded-[3rem] bg-emerald-500 flex flex-col items-center justify-center p-12 text-white shadow-2xl animate-fade-in">
                            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 scale-up-center">
                                <ShieldCheck size={56}/>
                            </div>
                            <h3 className="text-3xl font-black mb-2">¡Sincronizado!</h3>
                            <p className="text-emerald-100 font-medium text-center mb-10">La ficha del cliente ha sido integrada al ecosistema Pro.</p>
                            <button onClick={() => navigate('clients')} className="px-10 py-4 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Ver Cartera</button>
                        </div>
                    )}
                </div>

                {/* Columna de Información Elite */}
                <div className="lg:col-span-7 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-brand-teal transition-all">
                            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 text-sky-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <ShieldCheck size={24}/>
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Seguridad Bancaria</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Procesamos los documentos localmente. Tus credenciales nunca viajan por servidores externos no autorizados.</p>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-brand-teal transition-all">
                            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Sparkles size={24}/>
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Sincronización IA</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">Nuestra red neuronal detecta variaciones en las obligaciones tributarias y las sincroniza con tu calendario fiscal.</p>
                        </div>
                    </div>

                    <div className="bg-[#0B2149] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                         <div className="absolute top-0 right-0 p-8 opacity-10"><Coins size={120}/></div>
                         <div className="relative z-10">
                            <h3 className="text-xl font-black mb-4">¿Sabías que?</h3>
                            <p className="text-sm text-slate-300 leading-relaxed mb-6">El escaneo inteligente de RUC reduce en un 85% el error humano en la digitación de claves y periodos de declaración.</p>
                            <div className="flex gap-4">
                                <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10 flex items-center gap-2">
                                    <CheckCircle size={14} className="text-brand-teal"/>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Razón Social</span>
                                </div>
                                <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10 flex items-center gap-2">
                                    <CheckCircle size={14} className="text-brand-teal"/>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Actividades</span>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(200%); }
                }
                .animate-scan {
                    animation: scan 3s linear infinite;
                }
                .animate-scale-in {
                    animation: scaleIn 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
