import React, { useState } from 'react';
import { 
    QrCode, Phone, Mail, MapPin, Globe, Share2, Download, 
    Copy, Check, Sparkles, X, ShieldCheck, Briefcase, Award, ExternalLink
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface DigitalBusinessCardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DigitalBusinessCardModal: React.FC<DigitalBusinessCardModalProps> = ({ isOpen, onClose }) => {
    const { toast } = useToast();
    const [copiedBank, setCopiedBank] = useState(false);

    // Datos del Estudio Contable
    const profile = {
        name: 'Roberto Santiago Córdova Ramírez',
        title: 'Asesor Contable, Tributario & Soluciones Digitales',
        firm: 'Soluciones Contables & Tributarias PRO',
        ruc: '0705787745001',
        phone: '0978980722',
        email: 'info@santiagocordova.com',
        website: 'https://santiagocordova.com',
        address: 'Calle Colón y Sucre, Pasaje, El Oro, Ecuador',
        bankDetails: 'Banco Pichincha - Cta. Ahorros #2205789874 - RUC 0705787745001'
    };

    // Generar archivo vCard .vcf para descargar a la agenda del teléfono
    const handleDownloadVCard = () => {
        const vCardData = `BEGIN:VCARD
VERSION:3.0
FN:${profile.name}
ORG:${profile.firm}
TITLE:${profile.title}
TEL;TYPE=CELL,VOICE:${profile.phone}
EMAIL;TYPE=WORK:${profile.email}
URL:${profile.website}
ADR;TYPE=WORK:;;${profile.address};Pasaje;El Oro;;Ecuador
NOTE:Asesoría Tributaria, Declaraciones SRI, Firmas Electrónicas y Facturación. RUC: ${profile.ruc}
END:VCARD`;

        const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Santiago_Cordova_Contador.vcf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("📥 Tarjeta de contacto (.vcf) descargada para guardar en tu teléfono.");
    };

    const handleCopyBank = () => {
        navigator.clipboard.writeText(profile.bankDetails);
        setCopiedBank(true);
        toast.success("Datos bancarios copiados al portapapeles.");
        setTimeout(() => setCopiedBank(false), 2500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-md bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden text-white space-y-6 p-6 sm:p-8">
                
                {/* Botón cerrar */}
                <button 
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                >
                    <X size={18} />
                </button>

                {/* Banner de perfil */}
                <div className="text-center space-y-3 pt-2">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#00A896] via-teal-500 to-indigo-600 p-1 shadow-xl mx-auto flex items-center justify-center">
                            <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-teal-400 font-black text-2xl">
                                SC
                            </div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white shadow-lg">
                            <ShieldCheck size={14} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight font-display">
                            {profile.name}
                        </h2>
                        <p className="text-xs font-bold text-[#00A896] uppercase tracking-wider mt-0.5">
                            {profile.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                            RUC: {profile.ruc} • {profile.firm}
                        </p>
                    </div>
                </div>

                {/* Código QR Generado Dinámicamente */}
                <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-white rounded-2xl shadow-inner">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(profile.website)}`} 
                            alt="QR Contacto"
                            className="w-32 h-32"
                        />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                        Escanea el QR para guardar datos
                    </span>
                </div>

                {/* Enlaces de contacto rápido */}
                <div className="space-y-2 text-xs">
                    <a 
                        href={`https://wa.me/593${profile.phone.substring(1)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-300 font-bold flex items-center justify-between transition-all"
                    >
                        <div className="flex items-center gap-2.5">
                            <Phone size={16} />
                            <span>WhatsApp Directo ({profile.phone})</span>
                        </div>
                        <ExternalLink size={14} />
                    </a>

                    <button 
                        onClick={handleCopyBank}
                        className="w-full p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 font-bold flex items-center justify-between transition-all text-left"
                    >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                            <DollarSign size={16} className="text-amber-400 shrink-0" />
                            <span className="truncate text-[11px]">Datos Bancarios para Transferencias</span>
                        </div>
                        {copiedBank ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
                    </button>
                </div>

                {/* Botón Acción Principal: Descargar vCard */}
                <button
                    onClick={handleDownloadVCard}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-500 hover:from-teal-400 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#00A896]/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <Download size={16} />
                    <span>Guardar Contacto en Mi Celular (.vcf)</span>
                </button>
            </div>
        </div>
    );
};
