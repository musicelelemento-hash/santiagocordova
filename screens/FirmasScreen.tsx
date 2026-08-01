import React, { useMemo, useState } from 'react';
import {
    KeyRound, ShieldCheck, ShieldOff, PhoneCall, AlertTriangle,
    CheckCircle2, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store/useAppStore';
import { Screen } from '../types';
import { Modal } from '../components/ui/Modal';

interface FirmasScreenProps {
    navigate: (screen: Screen, options?: any) => void;
}

type FirmasTab = 'vigentes' | 'sin-firma';

export const FirmasScreen: React.FC<FirmasScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const [tab, setTab] = useState<FirmasTab>('vigentes');
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);

    const signatureData = useMemo(() => {
        const active = clients.filter(c => !c.isDeleted && c.isActive);

        const getDaysLeft = (expirationDate?: string): number | null => {
            if (!expirationDate) return null;
            const exp = new Date(expirationDate);
            exp.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
        };

        const withSignature = active
            .filter(c => c.signatureFile)
            .sort((a, b) => {
                const dA = a.signatureExpirationDate ? new Date(a.signatureExpirationDate).getTime() : Infinity;
                const dB = b.signatureExpirationDate ? new Date(b.signatureExpirationDate).getTime() : Infinity;
                return dA - dB;
            });

        const withoutSignature = active
            .filter(c => !c.signatureFile)
            .sort((a, b) => a.name.localeCompare(b.name));

        const expired = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d !== null && d < 0;
        });
        const expiringSoon = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d !== null && d >= 0 && d <= 30;
        });
        const ok = withSignature.filter(c => {
            const d = getDaysLeft(c.signatureExpirationDate);
            return d === null || d > 30;
        });

        return { withSignature, withoutSignature, getDaysLeft, expired, expiringSoon, ok };
    }, [clients]);

    const formatExpiry = (date?: string) => {
        if (!date) return '—';
        const d = new Date(date);
        return isNaN(d.getTime()) ? date : format(d, "d MMM yyyy", { locale: es });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">

            {/* ── HEADER ── */}
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-teal-500/8 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl shadow-teal-500/30">
                            <KeyRound size={24} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                                <span className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em]">Control de Firmas</span>
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Firmas Electrónicas</h1>
                            <p className="text-sm text-slate-400 mt-1">Gestión y control de firmas .p12 de clientes</p>
                        </div>
                    </div>

                    {/* KPI MINI STRIP */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                            <span className="text-2xl font-black text-teal-400">{signatureData.ok.length}</span>
                            <span className="text-[9px] font-bold text-teal-500 uppercase tracking-widest mt-0.5">Activas</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-amber-400/10 border border-amber-400/20">
                            <span className="text-2xl font-black text-amber-400">{signatureData.expiringSoon.length}</span>
                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Por Vencer</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                            <span className="text-2xl font-black text-rose-400">{signatureData.expired.length}</span>
                            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Caducadas</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-3 rounded-2xl bg-slate-400/10 border border-slate-400/20">
                            <span className="text-2xl font-black text-slate-400">{signatureData.withoutSignature.length}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Sin Firma</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="flex items-center gap-2 bg-white/[0.03] dark:bg-white/[0.02] p-1.5 rounded-2xl border border-white/[0.06] w-fit">
                <button
                    onClick={() => setTab('vigentes')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                        tab === 'vigentes'
                            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <ShieldCheck size={13} />
                    <span>Por Caducidad</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${tab === 'vigentes' ? 'bg-white/20' : 'bg-teal-500/15 text-teal-400'}`}>
                        {signatureData.withSignature.length}
                    </span>
                </button>
                <button
                    onClick={() => setTab('sin-firma')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                        tab === 'sin-firma'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <ShieldOff size={13} />
                    <span>Sin Firma</span>
                    {signatureData.withoutSignature.length > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${tab === 'sin-firma' ? 'bg-white/20' : 'bg-rose-500/15 text-rose-400'}`}>
                            {signatureData.withoutSignature.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── TAB: POR CADUCIDAD ── */}
            {tab === 'vigentes' && (
                <div className="space-y-2">
                    {(signatureData.expired.length > 0 || signatureData.expiringSoon.length > 0) && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-400/[0.06] border border-amber-400/20 mb-4">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                            <p className="text-[11px] text-amber-300 font-bold">
                                {signatureData.expired.length > 0 && `${signatureData.expired.length} firma(s) caducada(s). `}
                                {signatureData.expiringSoon.length > 0 && `${signatureData.expiringSoon.length} firma(s) vence(n) en ≤30 días. `}
                                Contáctelos para gestionar la renovación.
                            </p>
                        </div>
                    )}

                    {signatureData.withSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                                <KeyRound size={32} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">Ningún cliente tiene firma cargada.</p>
                        </div>
                    ) : (
                        signatureData.withSignature.map((c, idx) => {
                            const daysLeft = signatureData.getDaysLeft(c.signatureExpirationDate);
                            const isExpired = daysLeft !== null && daysLeft < 0;
                            const isWarn = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

                            const statusColor = isExpired ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-teal-400';
                            const dotClass = isExpired ? 'bg-rose-500' : isWarn ? 'bg-amber-400 animate-pulse' : 'bg-teal-500';
                            const dotGlow = isExpired ? '0 0 8px rgba(239,68,68,0.7)' : isWarn ? '0 0 8px rgba(251,191,36,0.7)' : '0 0 8px rgba(20,184,166,0.7)';
                            const borderClass = isExpired
                                ? 'border-rose-500/20 bg-rose-500/[0.03] hover:border-rose-500/40'
                                : isWarn
                                ? 'border-amber-400/20 bg-amber-400/[0.03] hover:border-amber-400/40'
                                : 'border-white/[0.05] bg-white/[0.02] hover:border-teal-400/20';

                            const statusLabel = isExpired
                                ? `Caducada hace ${Math.abs(daysLeft!)} días`
                                : isWarn ? `Vence en ${daysLeft} días`
                                : daysLeft === null ? 'Fecha desconocida'
                                : `Activa · ${daysLeft} días`;

                            return (
                                <div key={c.id} className={`group flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg ${borderClass}`}>
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <span className="text-[9px] font-black text-slate-700 w-5 text-center tabular-nums shrink-0">{idx + 1}</span>
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} style={{ boxShadow: dotGlow }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white uppercase tracking-wide truncate">{c.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono text-slate-500">{c.ruc}</span>
                                                <span className="text-[9px] font-bold text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-md uppercase">
                                                    {c.regime === 'Régimen General' ? 'General' : c.regime === 'Rimpe Emprendedor' ? 'Emprendedor' : 'Popular'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex flex-col items-end shrink-0 mr-2">
                                        <p className={`text-[11px] font-black uppercase tracking-wide ${statusColor}`}>{statusLabel}</p>
                                        <p className="text-[9px] text-slate-600 font-mono mt-0.5">Vence: {formatExpiry(c.signatureExpirationDate)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {c.phones?.length ? (
                                            <button
                                                onClick={() => {
                                                    const expiryStr = formatExpiry(c.signatureExpirationDate);
                                                    const msg = `Hola ${c.name.split(' ')[0]}, le informamos que su firma electrónica ${isExpired ? 'ha caducado' : `vence el ${expiryStr}`}. Contáctenos para gestionar la renovación y mantener su facturación activa.`;
                                                    setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g, ''), message: msg });
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all text-[9px] font-black uppercase active:scale-95"
                                            >
                                                <PhoneCall size={12} />
                                                <span className="hidden sm:inline">WhatsApp</span>
                                            </button>
                                        ) : null}
                                        <button
                                            onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-teal-600 text-slate-300 hover:text-white border border-white/10 transition-all text-[9px] font-black uppercase active:scale-95"
                                        >
                                            <ArrowRight size={12} />
                                            <span>Bóveda</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── TAB: SIN FIRMA ── */}
            {tab === 'sin-firma' && (
                <div className="space-y-2">
                    {signatureData.withoutSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-teal-500/10 border border-teal-500/20">
                                <CheckCircle2 size={32} className="text-teal-400" />
                            </div>
                            <p className="text-sm font-bold text-teal-400">¡Todos los clientes activos tienen firma cargada!</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 mb-4">
                                <div className="flex items-center gap-3">
                                    <ShieldOff size={16} className="text-rose-400 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-rose-300 font-black">{signatureData.withoutSignature.length} clientes sin firma electrónica</p>
                                        <p className="text-[10px] text-rose-500 mt-0.5">Oportunidad de venta — régimen General y Emprendedor requieren firma para facturar.</p>
                                    </div>
                                </div>
                            </div>

                            {signatureData.withoutSignature.map((c, idx) => (
                                <div key={c.id} className="group flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:border-rose-400/20 transition-all duration-200">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <span className="text-[9px] font-black text-slate-700 w-5 text-center tabular-nums shrink-0">{idx + 1}</span>
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white uppercase truncate">{c.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono text-slate-500">{c.ruc}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                                                    c.regime === 'Régimen General' ? 'bg-blue-500/10 text-blue-400'
                                                    : c.regime === 'Rimpe Emprendedor' ? 'bg-purple-500/10 text-purple-400'
                                                    : 'bg-slate-500/10 text-slate-400'
                                                }`}>
                                                    {c.regime === 'Régimen General' ? 'General' : c.regime === 'Rimpe Emprendedor' ? 'Emprendedor' : 'Popular'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {c.phones?.length ? (
                                            <button
                                                onClick={() => {
                                                    const msg = `Hola ${c.name.split(' ')[0]}, le recordamos que para emitir facturas electrónicas necesita una firma digital vigente. Podemos ayudarle a obtenerla. ¿Le interesa que lo gestionemos?`;
                                                    setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g, ''), message: msg });
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all text-[9px] font-black uppercase active:scale-95"
                                            >
                                                <PhoneCall size={12} />
                                                <span className="hidden sm:inline">Propuesta</span>
                                            </button>
                                        ) : null}
                                        <button
                                            onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border border-rose-500/30 transition-all text-[9px] font-black uppercase active:scale-95 shadow-sm shadow-rose-500/20"
                                        >
                                            <ArrowRight size={12} />
                                            <span>+ Subir</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* WhatsApp Modal */}
            <Modal isOpen={!!whatsAppPrompt} onClose={() => setWhatsAppPrompt(null)} title="📲 Notificar por WhatsApp" size="2xl">
                {whatsAppPrompt && (
                    <div className="space-y-5 p-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Destinatario</p>
                            <p className="text-sm font-bold text-white">{whatsAppPrompt.clientName} · {whatsAppPrompt.phone}</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Mensaje</label>
                            <textarea
                                value={whatsAppPrompt.message}
                                onChange={e => setWhatsAppPrompt({ ...whatsAppPrompt, message: e.target.value })}
                                className="w-full h-36 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 outline-none focus:ring-2 focus:ring-teal-500/20 text-white text-sm leading-relaxed resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="flex-1 py-3 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <a
                                href={`https://wa.me/${whatsAppPrompt.phone}?text=${encodeURIComponent(whatsAppPrompt.message)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setWhatsAppPrompt(null)}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center shadow-lg shadow-emerald-500/25 active:scale-95"
                            >
                                📲 Abrir WhatsApp
                            </a>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
