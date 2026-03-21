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
        <div className="bg-slate-950/60 backdrop-blur-2xl rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:shadow-cyan-500/20 hover:border-cyan-500/40 transition-all group overflow-hidden relative border-l-4 border-l-slate-800 hover:border-l-cyan-500 duration-500 aura-premium">
            {/* Visual HUD line */}
            <div className="absolute top-0 right-0 w-32 h-[2px] bg-gradient-to-l from-cyan-500/40 to-transparent"></div>

            <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border flex items-center justify-center transition-all duration-700 ${hasData ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'bg-slate-900 border-white/5 text-slate-600 shadow-inner group-hover:text-cyan-500/50'}`}>
                        <Icon size={22} className="sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">{label}</p>
                        <div className="mt-2 min-h-[1.75rem] flex items-center">
                            {isPassword ? (
                                <p className={`text-xs sm:text-sm font-black tracking-[0.1em] sm:tracking-[0.2em] font-mono ${showPassword ? 'text-white' : 'text-slate-700'}`}>
                                    {showPassword ? value : '••••••••••••'}
                                </p>
                            ) : file ? (
                                <p className="text-xs sm:text-sm font-black text-white truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[160px] pr-2 uppercase tracking-tighter">
                                    {file.name}
                                </p>
                            ) : (
                                <p className="text-[10px] sm:text-[11px] font-black text-slate-700 uppercase tracking-widest italic">No Sincronizado</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {file ? (
                        <>
                            <button
                                onClick={onDownload}
                                className="p-3 bg-slate-900 hover:bg-cyan-500 text-slate-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-2xl hover:shadow-cyan-500/40 active:scale-95"
                                title="Descargar"
                            >
                                <Download size={18} />
                            </button>
                            <button className="p-3 bg-slate-900 hover:bg-red-500 text-slate-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-2xl hover:shadow-red-500/40 active:scale-95" title="Eliminar">
                                <Trash2 size={18} />
                            </button>
                        </>
                    ) : isPassword ? (
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-3 bg-slate-900 hover:bg-cyan-500 text-slate-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-2xl active:scale-95"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    ) : (
                        <label className="p-3 bg-slate-900 hover:bg-cyan-500 text-slate-500 hover:text-white cursor-pointer transition-all border border-white/5 rounded-xl shadow-3xl hover:shadow-cyan-500/40 active:scale-95 flex items-center justify-center">
                            <UploadCloud size={20} />
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
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <ShieldCheck size={12} className="text-emerald-400" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Verificado por Sistema</span>
                    </div>
                    {file && (
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest font-mono">
                            DATA: {(file.size / 1024).toFixed(1)} KB
                        </span>
                    )}
                </div>
            )}

            {/* Tactical design flourish */}
            <div className="absolute -right-6 -bottom-6 opacity-[0.04] text-cyan-400 group-hover:rotate-12 group-hover:scale-125 transition-all duration-1000">
                <Lock size={150} />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
        </div>
    );
};
