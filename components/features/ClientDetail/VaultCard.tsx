import React from 'react';
import * as LucideIcons from 'lucide-react';
import { StoredFile } from '../../../types/client';
import { fileToBase64 } from '../../../services/pdfExtraction';


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
}

export const VaultCard: React.FC<VaultCardProps> = ({ icon: Icon, label, file, onUpload, onDownload, onDelete, isPassword, value, isEditing, onChange }) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const hasData = !!(file || value);

    return (
        <div className="bg-white dark:bg-surface/40 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-architect hover:shadow-2xl border border-slate-100 dark:border-white/10 hover:border-blue-200 dark:hover:border-primary/30 transition-all duration-700 group relative overflow-hidden">
            {/* Tonal Accent - Top Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] transition-all duration-1000 ${hasData ? 'bg-primary dark:bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)] dark:shadow-primary/20' : 'bg-slate-50 dark:bg-white/5'}`}></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-1000 border ${hasData ? 'bg-blue-50/50 dark:bg-primary/10 text-blue-600 dark:text-primary-low border-blue-100 dark:border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-white/5'}`}>
                        <Icon size={26} strokeWidth={hasData ? 2 : 1.2} />
                    </div>
                    <div>
                        <p className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">{label}</p>
                        <div className="mt-1.5 min-h-[1.75rem] flex items-center">
                            {isPassword ? (
                                isEditing ? (
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={value || ''}
                                        onChange={e => onChange && onChange(e.target.value)}
                                        className="bg-transparent text-[15px] font-black tracking-wider font-mono outline-none border-b border-primary/30 pb-0.5 focus:border-primary text-slate-900 dark:text-white max-w-[150px]"
                                        placeholder="Ingrese clave"
                                    />
                                ) : (
                                    <p className={`text-[15px] font-black tracking-[0.2em] font-mono ${showPassword ? 'text-slate-950 dark:text-slate-50' : 'text-slate-200 dark:text-slate-800'}`}>
                                        {showPassword ? value : '••••••••••••'}
                                    </p>
                                )
                            ) : file ? (
                                <p className="text-[13px] font-black text-slate-900 dark:text-slate-50 truncate max-w-[120px] sm:max-w-[200px] uppercase tracking-tighter font-premium">
                                    {file.name}
                                </p>
                            ) : (
                                <p className="text-[9px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest italic opacity-60">NO_ENTRY</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 relative z-10">
                    {file ? (
                        <>
                             <button
                                onClick={onDownload}
                                className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-surface-low hover:bg-slate-900 dark:hover:bg-primary hover:text-white dark:hover:text-white text-slate-500 dark:text-slate-400 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/5"
                                title="Descargar"
                            >
                                <LucideIcons.Download size={18} strokeWidth={2.5} />
                            </button>
                            <button 
                                onClick={onDelete}
                                className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-surface-low hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-400 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/5" 
                                title="Eliminar"
                            >
                                <LucideIcons.Trash2 size={18} strokeWidth={2.5} />
                            </button>
                        </>
                    ) : isPassword ? (
                         <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-surface-low hover:bg-slate-900 dark:hover:bg-primary hover:text-white dark:hover:text-white text-slate-500 dark:text-slate-400 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/5"
                        >
                            {showPassword ? <LucideIcons.EyeOff size={18} strokeWidth={2.5} /> : <LucideIcons.Eye size={18} strokeWidth={2.5} />}
                        </button>
                     ) : (
                        <label className="w-11 h-11 flex items-center justify-center bg-slate-100 dark:bg-surface-low hover:bg-primary dark:hover:bg-primary hover:text-white dark:hover:text-white text-slate-500 dark:text-slate-400 cursor-pointer transition-all rounded-xl active:scale-95 border border-slate-200 dark:border-white/5">
                            <LucideIcons.UploadCloud size={18} strokeWidth={2.5} />
                            <input 
                                type="file" 
                                accept="image/*,application/pdf,.p12,.pfx" 
                                className="hidden" 
                                onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (f && onUpload) {
                                        const content = await fileToBase64(f);
                                        const fileType = f.type.startsWith('image/') ? 'image' : 'pdf';
                                        onUpload({ name: f.name, type: fileType, size: f.size, lastModified: f.lastModified, content });
                                    }
                                }} 
                            />
                        </label>
                    )}
                </div>
            </div>

             {hasData && (
                <div className="flex items-center gap-4 mt-2 relative z-10">
                    <div className="flex items-center gap-2.5 px-3 py-1 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 group-hover:bg-emerald-100/50 dark:group-hover:bg-emerald-500/20 transition-all duration-700">
                        <LucideIcons.ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                        <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.2em]">SECURE_VALID</span>
                    </div>
                </div>
            )}
        </div>
    );
};
