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
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-700 group relative overflow-hidden">
            {/* Tonal Accent - Top Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] transition-all duration-1000 ${hasData ? 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-50'}`}></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-1000 shadow-sm border ${hasData ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                        <Icon size={26} strokeWidth={hasData ? 2 : 1.2} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] font-premium">{label}</p>
                        <div className="mt-1.5 min-h-[1.75rem] flex items-center">
                            {isPassword ? (
                                <p className={`text-[15px] font-black tracking-[0.2em] font-mono ${showPassword ? 'text-slate-950' : 'text-slate-200'}`}>
                                    {showPassword ? value : '••••••••••••'}
                                </p>
                            ) : file ? (
                                <p className="text-[13px] font-black text-slate-900 truncate max-w-[120px] sm:max-w-[200px] uppercase tracking-tight font-premium">
                                    {file.name}
                                </p>
                            ) : (
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic font-premium opacity-60">SIN REGISTRO</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 relative z-10">
                    {file ? (
                        <>
                            <button
                                onClick={onDownload}
                                className="w-11 h-11 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-500 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-100"
                                title="Descargar"
                            >
                                <Download size={18} strokeWidth={2.5} />
                            </button>
                            <button className="w-11 h-11 flex items-center justify-center bg-slate-50 hover:bg-rose-500 hover:text-white text-slate-500 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-100" title="Eliminar">
                                <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                        </>
                    ) : isPassword ? (
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="w-11 h-11 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-500 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-100"
                        >
                            {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                        </button>
                    ) : (
                        <label className="w-11 h-11 flex items-center justify-center bg-slate-50 hover:bg-primary hover:text-white text-slate-500 cursor-pointer transition-all rounded-xl shadow-sm active:scale-95 border border-slate-100">
                            <UploadCloud size={18} strokeWidth={2.5} />
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
                <div className="flex items-center gap-4 mt-2 relative z-10">
                    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm transition-all duration-700 group-hover:bg-emerald-100/50">
                        <ShieldCheck size={14} className="text-emerald-600" strokeWidth={3} />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.2em] font-premium">SEGURIDAD VALIDADA</span>
                    </div>
                </div>
            )}
        </div>
    );
};
