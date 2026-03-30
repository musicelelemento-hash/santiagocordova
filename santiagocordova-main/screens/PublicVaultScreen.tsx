
import React, { useState } from 'react';
import { Client, StoredFile } from '../types';
import { Copy, CheckCircle, Download, ShieldCheck, Key, FileText, Globe, FileKey, Share2, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Logo';

interface PublicVaultScreenProps {
    client: Client;
}

export const PublicVaultScreen: React.FC<PublicVaultScreenProps> = ({ client }) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
        
        // Haptic feedback if supported (mobile)
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const togglePassword = (key: string) => {
        setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDownload = (file: StoredFile) => {
        if (!file.content) return;
        const link = document.createElement("a");
        link.href = file.content;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white font-body selection:bg-[#D4AF37] selection:text-black flex flex-col items-center p-4 sm:p-8">
            
            {/* --- ELITE BACKGROUND --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[120px] -mr-40 -mt-40"></div>
                 <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px] -ml-20 -mb-20"></div>
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            </div>

            {/* --- HEADER --- */}
            <header className="relative z-10 w-full max-w-md text-center mb-12 animate-fade-in-down">
                <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-[#0B2149] to-slate-900 border border-white/10 shadow-2xl shadow-blue-900/30 mb-6">
                    <Logo className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-display font-black tracking-tight text-white mb-2">
                    Bóveda Digital
                </h1>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37]">
                    <ShieldCheck size={12} strokeWidth={3} />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Acceso Seguro Verificado</span>
                </div>
            </header>

            {/* --- MAIN CARD --- */}
            <main className="relative z-10 w-full max-w-md space-y-6 animate-fade-in-up">
                
                {/* WELCOME */}
                <div className="text-center mb-8">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Bienvenido</p>
                    <h2 className="text-2xl font-bold text-white">{client.name}</h2>
                </div>

                {/* --- RUC & SRI ACCESS --- */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl"><Globe size={20}/></div>
                            <span className="font-bold text-sm text-slate-200">SRI en Línea</span>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* RUC Field */}
                        <div className="group">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Número RUC</label>
                            <button 
                                onClick={() => handleCopy(client.ruc, 'ruc')}
                                className="w-full flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-2xl hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all group active:scale-[0.98]"
                            >
                                <span className="font-mono text-lg font-bold tracking-wider text-white">{client.ruc}</span>
                                <div className={`p-2 rounded-lg transition-colors ${copiedField === 'ruc' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-400 group-hover:text-[#D4AF37]'}`}>
                                    {copiedField === 'ruc' ? <CheckCircle size={20}/> : <Copy size={20}/>}
                                </div>
                            </button>
                        </div>

                        {/* Password Field */}
                        <div className="group">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Contraseña</label>
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-2xl">
                                    <span className="font-mono text-lg font-bold tracking-widest text-white">
                                        {visiblePasswords['sri'] ? client.sriPassword : '••••••••••••'}
                                    </span>
                                    <button onClick={() => togglePassword('sri')} className="text-slate-500 hover:text-white transition-colors p-2">
                                        {visiblePasswords['sri'] ? <EyeOff size={18}/> : <Eye size={18}/>}
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleCopy(client.sriPassword, 'sriPass')}
                                    className={`w-14 rounded-2xl flex items-center justify-center border transition-all active:scale-95 ${copiedField === 'sriPass' ? 'bg-green-500 text-white border-green-500' : 'bg-white/5 border-white/10 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37]'}`}
                                >
                                    {copiedField === 'sriPass' ? <CheckCircle size={24}/> : <Copy size={24}/>}
                                </button>
                            </div>
                        </div>

                         <a 
                            href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full py-3 mt-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
                        >
                            Ir al Portal SRI <Share2 size={14} className="ml-2"/>
                        </a>
                    </div>
                </div>

                {/* --- ELECTRONIC SIGNATURE --- */}
                <div className="bg-gradient-to-br from-[#0B2149] to-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative">
                    {/* Gold Glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-[60px] -mr-10 -mt-10"></div>
                    
                    <div className="p-6 border-b border-white/5 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-xl"><FileKey size={20}/></div>
                            <span className="font-bold text-sm text-white">Firma Electrónica</span>
                        </div>
                        {client.signatureExpirationDate && (
                            <span className="text-xs font-bold bg-white/10 text-slate-300 px-2 py-1 rounded-lg">
                                Expira: {client.signatureExpirationDate.split('T')[0]}
                            </span>
                        )}
                    </div>

                    <div className="p-6 space-y-6 relative z-10">
                        {/* Download File */}
                        {client.signatureFile ? (
                            <button 
                                onClick={() => handleDownload(client.signatureFile!)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-2xl transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                                        <FileText size={20}/>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">Descargar Archivo .P12</span>
                                        <span className="text-xs text-slate-400">{client.signatureFile.name}</span>
                                    </div>
                                </div>
                                <Download size={20} className="text-slate-500 group-hover:text-white"/>
                            </button>
                        ) : (
                            <div className="p-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 text-center">
                                <span className="text-xs text-slate-500 italic">Archivo no disponible en la nube.</span>
                            </div>
                        )}

                        {/* Signature Password */}
                         <div className="group">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Clave de Firma</label>
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-2xl">
                                    <span className="font-mono text-lg font-bold tracking-widest text-white">
                                        {visiblePasswords['sig'] ? (client.electronicSignaturePassword || 'No registrada') : '••••••••••••'}
                                    </span>
                                    <button onClick={() => togglePassword('sig')} className="text-slate-500 hover:text-white transition-colors p-2">
                                        {visiblePasswords['sig'] ? <EyeOff size={18}/> : <Eye size={18}/>}
                                    </button>
                                </div>
                                <button 
                                    onClick={() => client.electronicSignaturePassword && handleCopy(client.electronicSignaturePassword, 'sigPass')}
                                    disabled={!client.electronicSignaturePassword}
                                    className={`w-14 rounded-2xl flex items-center justify-center border transition-all active:scale-95 ${copiedField === 'sigPass' ? 'bg-green-500 text-white border-green-500' : 'bg-white/5 border-white/10 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37] disabled:opacity-30 disabled:cursor-not-allowed'}`}
                                >
                                    {copiedField === 'sigPass' ? <CheckCircle size={24}/> : <Copy size={24}/>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-8 pb-4 opacity-50">
                    <p className="text-xs font-medium text-slate-500">
                        Este enlace es seguro y privado. <br/>
                        Generado por Santiago Cordova - Asesoría Tributaria.
                    </p>
                </div>
                
            </main>
        </div>
    );
};
