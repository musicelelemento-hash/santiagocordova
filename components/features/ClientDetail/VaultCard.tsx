import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { StoredFile } from '../../../types/client';
import { UnifiedStorageService } from '../../../services/unifiedStorageService';

interface VaultCardProps {
    icon: any;
    label: string;
    file?: StoredFile;
    onUpload?: (file: StoredFile) => void;
    onDownload?: () => void;
    onDelete?: () => void;
    isPassword?: boolean;
    value?: string;
    isEditing?: boolean;
    onChange?: (value: string) => void;
    ruc?: string;
}

export const VaultCard: React.FC<VaultCardProps> = ({ 
    icon: Icon, 
    label, 
    file, 
    onUpload, 
    onDownload, 
    onDelete, 
    isPassword, 
    value, 
    isEditing, 
    onChange,
    ruc 
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const hasData = !!(file || value);

    // Auto-hide password timer (12s countdown for security)
    useEffect(() => {
        let timer: any;
        if (showPassword && !isEditing) {
            setCountdown(12);
            timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(timer);
                        setShowPassword(false);
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setCountdown(null);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showPassword, isEditing]);

    const handleCopyValue = () => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openSriPortal = () => {
        if (ruc) {
            navigator.clipboard.writeText(ruc);
        }
        window.open('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT', '_blank');
    };

    return (
        <div className="bg-white/80 dark:bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-slate-200/80 dark:border-white/10 dark:border-t-white/20 hover:border-blue-400/40 dark:hover:border-[#2B6AFF]/50 transition-all duration-500 group relative overflow-hidden text-left">
            {/* Tonal Accent - Top Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] transition-all duration-700 ${hasData ? 'bg-gradient-to-r from-[#00A896] via-[#2B6AFF] to-teal-300 shadow-[0_0_8px_#00A896]' : 'bg-slate-200 dark:bg-white/5'}`}></div>

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-700 border ${hasData ? 'bg-[#2B6AFF]/10 dark:bg-[#2B6AFF]/15 text-[#2B6AFF] dark:text-[#bfc6e0] border-[#2B6AFF]/30 shadow-md shadow-[#2B6AFF]/10' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'}`}>
                        <Icon size={26} strokeWidth={hasData ? 2 : 1.2} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                            {countdown !== null && (
                                <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full animate-pulse border border-amber-400/30">
                                    Ocultando en {countdown}s
                                </span>
                            )}
                        </div>
                        <div className="mt-1.5 min-h-[1.75rem] flex items-center">
                            {isPassword ? (
                                isEditing ? (
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={value || ''}
                                        onChange={e => onChange && onChange(e.target.value)}
                                        className="bg-transparent text-[15px] font-black tracking-wider font-mono outline-none border-b border-[#2B6AFF]/40 pb-0.5 focus:border-[#2B6AFF] text-slate-900 dark:text-white max-w-[160px]"
                                        placeholder="Ingrese clave"
                                    />
                                ) : (
                                    <p className={`text-[15px] font-black tracking-[0.2em] font-mono ${showPassword ? 'text-slate-900 dark:text-white select-all' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {showPassword ? value : '••••••••••••'}
                                    </p>
                                )
                            ) : file ? (
                                <p className="text-[13px] font-black text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] uppercase tracking-tight font-display">
                                    {file.name}
                                </p>
                            ) : (
                                <p className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest italic opacity-60">NO_ENTRY</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 relative z-10 font-mono">
                    {file ? (
                        <>
                            <button
                                onClick={onDownload}
                                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-[#2B6AFF] hover:text-white text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                title="Descargar archivo"
                            >
                                <LucideIcons.Download size={16} strokeWidth={2.5} />
                            </button>
                            <button 
                                onClick={onDelete}
                                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer" 
                                title="Eliminar archivo"
                            >
                                <LucideIcons.Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        </>
                    ) : isPassword ? (
                        <>
                            {value && !isEditing && (
                                <button
                                    onClick={handleCopyValue}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-[#00A896] hover:text-white text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                    title="Copiar contraseña"
                                >
                                    {copied ? <LucideIcons.Check size={16} className="text-[#00A896]" /> : <LucideIcons.Copy size={16} strokeWidth={2.5} />}
                                </button>
                            )}
                            <button
                                onClick={() => setShowPassword(!showPassword)}
                                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-[#2B6AFF] hover:text-white text-slate-600 dark:text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                title={showPassword ? "Ocultar" : "Mostrar contraseña"}
                            >
                                {showPassword ? <LucideIcons.EyeOff size={16} strokeWidth={2.5} /> : <LucideIcons.Eye size={16} strokeWidth={2.5} />}
                            </button>
                        </>
                    ) : (
                        <label className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-[#00A896] hover:text-white text-slate-600 dark:text-slate-300 cursor-pointer transition-all rounded-xl active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm">
                            <LucideIcons.UploadCloud size={16} strokeWidth={2.5} />
                            <input 
                                type="file" 
                                accept="image/*,application/pdf,.p12,.pfx" 
                                className="hidden" 
                                onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (f && onUpload) {
                                        const category = f.name.toLowerCase().endsWith('.p12') || f.name.toLowerCase().endsWith('.pfx') ? 'firmas' : 'comprobantes';
                                        const uploadedFile = await UnifiedStorageService.uploadFile(f, f.name, category);
                                        onUpload(uploadedFile);
                                    }
                                }} 
                            />
                        </label>
                    )}
                </div>
            </div>

            {hasData && (
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 dark:border-white/5 relative z-10">
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#00A896]/10 dark:bg-[#00A896]/15 rounded-full border border-[#00A896]/30 group-hover:bg-[#00A896]/20 transition-all duration-500">
                        <LucideIcons.ShieldCheck size={13} className="text-[#00A896]" strokeWidth={3} />
                        <span className="text-[9px] font-mono font-bold text-[#00A896] uppercase tracking-wider">SECURE_VALID</span>
                    </div>

                    {isPassword && (
                        <button
                            onClick={openSriPortal}
                            className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#2B6AFF] hover:underline cursor-pointer"
                        >
                            <span>Abrir SRI en Línea</span>
                            <LucideIcons.ExternalLink size={12} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
