import React from 'react';
import { X, CheckCircle2, AlertCircle, Copy, Download, FileWarning, Search, UserMinus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Modal } from '../ui/Modal';

export interface BulkUploadResult {
    fileName: string;
    status: 'success' | 'error' | 'duplicate' | 'new_client';
    clientName?: string;
    ruc?: string;
    period?: string;
    type?: string;
    amount?: number;
    error?: string;
    isPaid?: boolean;
    phones?: string[];
}

interface BulkUploadReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: BulkUploadResult[];
}

export const BulkUploadReportModal: React.FC<BulkUploadReportModalProps> = ({ isOpen, onClose, results }) => {
    const successCount = results.filter(r => r.status === 'success' || r.status === 'new_client').length;
    const duplicateCount = results.filter(r => r.status === 'duplicate').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    const [activeTab, setActiveTab] = React.useState<'success' | 'error' | 'duplicate'>(
        errorCount > 0 ? 'error' : (successCount > 0 ? 'success' : 'duplicate')
    );

    const filteredResults = results.filter(r => {
        if (activeTab === 'success') return r.status === 'success' || r.status === 'new_client';
        return r.status === activeTab;
    });

    const getWhatsAppLink = (res: BulkUploadResult) => {
        if (!res.phones || res.phones.length === 0) return null;
        const phone = res.phones[0].replace(/\D/g, '');
        const fullPhone = phone.startsWith('593') ? phone : `593${phone.substring(1)}`;

        const now = new Date();
        const hour = now.getHours();
        let greeting = "Buen día";
        if (hour >= 12 && hour < 19) greeting = "Buenas tardes";
        else if (hour >= 19 || hour < 5) greeting = "Buenas noches";

        const statusMsg = res.isPaid
            ? "Le informo que los honorarios por este trámite ya se encuentran cancelados. ¡Muchas gracias!"
            : "Le informo que el pago de honorarios por este trámite se encuentra pendiente de registro.";

        const message = `¡Hola ${res.clientName}! 👋 ${greeting}. Le informo que su declaración de ${res.type || 'Impuestos'} del periodo ${res.period || ''} fue procesada con éxito. Adjunto el comprobante de la declaración.\n\n${statusMsg}\n\n¡Gracias por su confianza!`;

        return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="REPORTE TÁCTICO: UNIDAD DE PROCESAMIENTO">
            <div className="flex flex-col h-[75vh] glass-elite dark:dark-glass rounded-3xl overflow-hidden border border-white/10 relative">
                {/* Scanline Animation Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                    <div className="w-full h-[2px] bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-scan-line-slow"></div>
                </div>

                {/* Executive Summary: Tactical KPI Grid */}
                <div className="p-6 bg-white/5 dark:bg-slate-900/50 border-b border-white/10 grid grid-cols-3 gap-4 relative z-10">
                    <div className="p-4 glass-elite border-emerald-500/30 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10">PROCESADOS</p>
                        <p className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] relative z-10">{successCount}</p>
                        <div className="absolute -bottom-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity whitespace-nowrap">
                            <CheckCircle2 size={40} />
                        </div>
                    </div>
                    <div className="p-4 glass-elite border-amber-500/30 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors"></div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 relative z-10">DUPLICADOS</p>
                        <p className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(245,158,11,0.5)] relative z-10">{duplicateCount}</p>
                        <div className="absolute -bottom-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity whitespace-nowrap">
                            <Copy size={40} />
                        </div>
                    </div>
                    <div className="p-4 glass-elite border-red-500/30 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 relative z-10">FALLIDOS</p>
                        <p className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] relative z-10">{errorCount}</p>
                        <div className="absolute -bottom-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity whitespace-nowrap">
                            <FileWarning size={40} />
                        </div>
                    </div>
                </div>

                {/* Tactical Tabs Toggle */}
                <div className="flex p-1.5 gap-1.5 glass-elite mx-6 mt-6 rounded-2xl border-white/5">
                    <button
                        onClick={() => setActiveTab('success')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden ${activeTab === 'success' ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] scale-[1.02]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <span className="relative z-10">EXITOSOS</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('duplicate')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden ${activeTab === 'duplicate' ? 'bg-white dark:bg-amber-500 text-slate-900 dark:text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <span className="relative z-10">OMITIDOS</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('error')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden ${activeTab === 'error' ? 'bg-white dark:bg-red-500 text-slate-900 dark:text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] scale-[1.02]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <span className="relative z-10">ERRORES</span>
                    </button>
                </div>

                {/* Tactical Results List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {filteredResults.length > 0 ? filteredResults.map((res, i) => (
                        <div key={i} className="glass-elite p-5 rounded-2xl border-white/10 flex items-center justify-between gap-4 animate-fade-in-down hover:border-sky-500/40 transition-all group">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden ${res.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                    res.status === 'duplicate' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-red-500/10 text-red-400'
                                    }`}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                                    {res.status === 'success' ? <CheckCircle2 size={28} className="relative z-10" /> :
                                        res.status === 'duplicate' ? <Copy size={28} className="relative z-10" /> : <FileWarning size={28} className="relative z-10" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h4 className="font-black text-white text-base tracking-tight truncate group-hover:text-sky-300 transition-colors uppercase">{res.clientName || res.fileName}</h4>
                                        {(res.status === 'success' || res.status === 'new_client') && (
                                            <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-lg ${
                                                res.status === 'new_client' ? 'bg-sky-500 text-white animate-pulse' :
                                                res.isPaid ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                                                }`}>
                                                {res.status === 'new_client' ? 'NUEVO OPERATIVO' : (res.isPaid ? 'LIQUIDACIÓN: ELITE' : 'COBRO PENDIENTE')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">{res.ruc || '0000000000000'}</span>
                                        <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></div>
                                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest font-mono">
                                            {res.type || 'DATA'} // {res.period || 'N/A'}
                                        </span>
                                        {res.amount !== undefined && (
                                            <>
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">${res.amount.toFixed(2)}</span>
                                            </>
                                        )}
                                    </div>

                                    {res.error && <p className="text-[10px] font-black text-red-400 italic mt-3 flex items-center gap-2 bg-red-900/20 p-2 rounded-lg border border-red-500/20">
                                        <AlertCircle size={12} /> <span className="uppercase tracking-tight">ERROR DETECTADO:</span> {res.error}
                                    </p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {res.status === 'success' && res.phones && res.phones.length > 0 && (
                                    <a
                                        href={getWhatsAppLink(res) || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-90 border border-emerald-500/30 group-hover:shadow-emerald-500/20"
                                        title="Sincronizar Comprobante"
                                    >
                                        <LucideIcons.MessageCircle size={22} />
                                    </a>
                                )}

                                {res.status === 'error' && res.error === 'Cliente no registrado' && (
                                    <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/30">
                                        <UserMinus size={22} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 opacity-40">
                            <Search size={64} className="mb-4 text-slate-500 animate-pulse" />
                            <p className="font-black uppercase tracking-[0.2em] text-xs text-slate-400 text-center">Sin Datos Disponibles en este Sector</p>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-black/20 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-12 py-4 bg-white dark:bg-sky-500 text-slate-900 dark:text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(56,189,248,0.2)] hover:scale-105 active:scale-95 transition-all border border-white/20"
                    >
                        EXPULSAR REPORTE
                    </button>
                </div>
            </div>
        </Modal>
    );
};
