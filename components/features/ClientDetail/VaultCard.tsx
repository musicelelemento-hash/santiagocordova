import React from 'react';
import { Download, Trash2, UploadCloud, Eye, EyeOff, Lock, Shield, FileText, ShieldCheck } from 'lucide-react';
import { StoredFile } from '../../../types/client';
import { fileToBase64 } from '../../../services/pdfExtraction';


interface VaultCardProps {
    icon: any;
    label: string;
    file?: StoredFile;
    onUpload?: (file: StoredFile) => void;
    onDownload?: () => void;
    isPassword?: boolean;
    value?: string;
}

export const VaultCard: React.FC<VaultCardProps> = ({ icon: Icon, label, file, onUpload, isPassword, value, onDownload }) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const hasData = !!(file || value);

    return (
        <div className="bg-surface-lowest dark:bg-surface-lowest rounded-[2rem] p-6 sm:p-8 shadow-architect hover:bg-surface-low transition-all duration-500 group relative overflow-hidden">
            {/* Tonal Accent - Top Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] ${hasData ? 'bg-primary' : 'bg-surface-low'}`}></div>

            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-700 ${hasData ? 'bg-primary/5 text-primary' : 'bg-surface-low text-secondary'}`}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.25em] font-premium">{label}</p>
                        <div className="mt-1 min-h-[1.75rem] flex items-center">
                            {isPassword ? (
                                <p className={`text-sm font-bold tracking-[0.15em] font-mono ${showPassword ? 'text-on-surface' : 'text-on-surface/30'}`}>
                                    {showPassword ? value : '••••••••••••'}
                                </p>
                            ) : file ? (
                                <p className="text-sm font-bold text-on-surface truncate max-w-[120px] sm:max-w-[180px] uppercase tracking-tight font-premium">
                                    {file.name}
                                </p>
                            ) : (
                                <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest italic">Sin Sincronizar</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2.5">
                    {file ? (
                        <>
                            <button
                                onClick={onDownload}
                                className="p-3 bg-surface-low hover:bg-primary hover:text-white text-secondary rounded-xl transition-all shadow-sm active:scale-95"
                                title="Descargar"
                            >
                                <Download size={18} />
                            </button>
                            <button className="p-3 bg-surface-low hover:bg-rose-500 hover:text-white text-secondary rounded-xl transition-all shadow-sm active:scale-95" title="Eliminar">
                                <Trash2 size={18} />
                            </button>
                        </>
                    ) : isPassword ? (
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-3 bg-surface-low hover:bg-primary hover:text-white text-secondary rounded-xl transition-all shadow-sm active:scale-95"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    ) : (
                        <label className="p-3 bg-surface-low hover:bg-primary hover:text-white text-secondary cursor-pointer transition-all rounded-xl shadow-sm active:scale-95 flex items-center justify-center">
                            <UploadCloud size={18} />
                            <input type="file" className="hidden" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f && onUpload) {
                                    const content = await fileToBase64(f);
                                    onUpload({ name: f.name, type: 'pdf', size: f.size, lastModified: f.lastModified, content });
                                }
                            }} />
                        </label>
                    )}
                </div>
            </div>

            {hasData && (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-tertiary-fixed/20 rounded-lg border border-tertiary-fixed/30">
                        <ShieldCheck size={12} className="text-tertiary" />
                        <span className="text-[9px] font-bold text-tertiary uppercase tracking-[0.2em] font-premium">Sincronización Validada</span>
                    </div>
                </div>
            )}

            {/* Background Architectural Mark */}
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-on-surface transform rotate-12 group-hover:rotate-6 transition-all duration-1000">
                <Icon size={120} />
            </div>
        </div>
    );
};
