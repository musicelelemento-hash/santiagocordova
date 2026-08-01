import React, { useMemo, useState } from 'react';
import {
    KeyRound, ShieldCheck, ShieldOff, PhoneCall, AlertTriangle,
    CheckCircle2, ArrowRight, Search, FileText, Check, Copy, ExternalLink,
    List, LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store/useAppStore';
import { Screen, TaxRegime } from '../types';
import { Modal } from '../components/ui/Modal';

interface FirmasScreenProps {
    navigate: (screen: Screen, options?: any) => void;
}

type FirmasTab = 'vigentes' | 'sin-firma';
type ViewMode = 'lineal' | 'tarjetas';

export const FirmasScreen: React.FC<FirmasScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const [tab, setTab] = useState<FirmasTab>('vigentes');
    const [viewMode, setViewMode] = useState<ViewMode>('lineal');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [whatsAppPrompt, setWhatsAppPrompt] = useState<{ clientName: string; phone: string; message: string } | null>(null);

    const signatureData = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        const active = clients.filter(c => {
            if (c.isDeleted || !c.isActive) return false;
            if (!q) return true;
            const matchName = c.name.toLowerCase().includes(q) || (c.tradeName && c.tradeName.toLowerCase().includes(q));
            const matchRuc = c.ruc.includes(q);
            const matchProvider = c.signatureProvider && c.signatureProvider.toLowerCase().includes(q);
            return matchName || matchRuc || matchProvider;
        });

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
    }, [clients, searchTerm]);

    const formatExpiry = (date?: string) => {
        if (!date) return '—';
        const d = new Date(date);
        return isNaN(d.getTime()) ? date : format(d, "d MMM yyyy", { locale: es });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-24">

            {/* ── HEADER DE CONTROL DE FIRMAS ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-to-tr from-purple-500/10 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl shadow-teal-500/30 text-white shrink-0">
                            <KeyRound size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
                                <span className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em]">Auditoría de Certificados</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Verificación de Firmas Electrónicas (.p12)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Monitoreo y control de firmas digitales emitidas por entidades certificadoras (ArgosData, FirmaSegura, Uanataca, Security Data).
                            </p>
                        </div>
                    </div>

                    {/* KPI RESUMEN VITAL */}
                    <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-teal-400 font-mono">{signatureData.ok.length}</span>
                            <span className="text-[9px] font-bold text-teal-300 uppercase tracking-widest mt-0.5">Válidas / Activas</span>
                        </div>
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-amber-400 font-mono">{signatureData.expiringSoon.length}</span>
                            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mt-0.5">Por Vencer (≤30d)</span>
                        </div>
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-rose-400 font-mono">{signatureData.expired.length}</span>
                            <span className="text-[9px] font-bold text-rose-300 uppercase tracking-widest mt-0.5">Caducadas</span>
                        </div>
                        <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl bg-slate-400/10 border border-slate-400/20 backdrop-blur-md">
                            <span className="text-2xl font-black text-slate-300 font-mono">{signatureData.withoutSignature.length}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sin Firma</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BARRA DE BÚSQUEDA, PESTAÑAS Y SWITCHER DE VISTA ── */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Pestañas de Estado */}
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/10 w-fit">
                        <button
                            onClick={() => setTab('vigentes')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                                tab === 'vigentes'
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <ShieldCheck size={14} />
                            <span>Por Caducidad</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${tab === 'vigentes' ? 'bg-white/20 text-white' : 'bg-teal-500/15 text-teal-400'}`}>
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
                            <ShieldOff size={14} />
                            <span>Sin Firma</span>
                            {signatureData.withoutSignature.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${tab === 'sin-firma' ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-400'}`}>
                                    {signatureData.withoutSignature.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* SELECTOR DE MODO DE VISTA (LINEAL MINIMALISTA VS TARJETAS) */}
                    <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-2xl p-1 rounded-2xl border border-white/10">
                        <button
                            onClick={() => setViewMode('lineal')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'lineal'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Vista Lineal Minimalista (Tabla Limpia)"
                        >
                            <List size={14} />
                            <span>Lineal</span>
                        </button>
                        <button
                            onClick={() => setViewMode('tarjetas')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'tarjetas'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Vista Tarjetas (Cuadros Ejecutivos)"
                        >
                            <LayoutGrid size={14} />
                            <span>Tarjetas</span>
                        </button>
                    </div>
                </div>

                {/* Buscador de Clientes / RUC / Entidad */}
                <div className="relative min-w-[260px] sm:w-80">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por Nombre, RUC o Entidad..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all outline-none"
                    />
                </div>
            </div>

            {/* ── TAB: VIGENTES / POR CADUCIDAD ── */}
            {tab === 'vigentes' && (
                <div className="space-y-6">
                    {(signatureData.expired.length > 0 || signatureData.expiringSoon.length > 0) && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-400/[0.08] border border-amber-400/25 shadow-lg">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-200 font-medium">
                                {signatureData.expired.length > 0 && <strong className="text-rose-400">{signatureData.expired.length} firma(s) caducada(s). </strong>}
                                {signatureData.expiringSoon.length > 0 && <strong className="text-amber-300">{signatureData.expiringSoon.length} firma(s) vencen en ≤30 días. </strong>}
                                Haz clic en WhatsApp para notificar la renovación al cliente.
                            </p>
                        </div>
                    )}

                    {signatureData.withSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                                <KeyRound size={32} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">No se encontraron firmas para esta búsqueda.</p>
                        </div>
                    ) : (
                        /* VISTA CONDICIONAL: LINEAL MINIMALISTA VS TARJETAS */
                        viewMode === 'lineal' ? (
                            /* ── VISTA LINEAL MINIMALISTA (TABLA ULTRA LIMPIA) ── */
                            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <th className="py-4 px-5 text-center w-12">#</th>
                                                <th className="py-4 px-5">Titular / Contribuyente</th>
                                                <th className="py-4 px-5">Estado de Firma (.p12)</th>
                                                <th className="py-4 px-5">Entidad Certificadora (Emisor)</th>
                                                <th className="py-4 px-5">Caducidad</th>
                                                <th className="py-4 px-5 text-right">Acciones Directas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-xs">
                                            {signatureData.withSignature.map((c, idx) => {
                                                const daysLeft = signatureData.getDaysLeft(c.signatureExpirationDate);
                                                const isExpired = daysLeft !== null && daysLeft < 0;
                                                const isWarn = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

                                                const statusColor = isExpired ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-teal-400';
                                                const dotClass = isExpired ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : isWarn ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]';

                                                return (
                                                    <tr key={c.id} className="hover:bg-white/[0.03] transition-colors group">
                                                        <td className="py-4 px-5 text-center text-[10px] font-mono text-slate-500 font-bold">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-4 px-5">
                                                            <div>
                                                                <p className="font-bold text-white uppercase tracking-wide group-hover:text-teal-300 transition-colors">
                                                                    {c.name}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-400">
                                                                    <span>RUC: {c.ruc}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-5">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                                isExpired ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' :
                                                                isWarn ? 'bg-amber-400/15 border-amber-400/30 text-amber-300' :
                                                                'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                                            }`}>
                                                                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                                                                {isExpired ? 'Caducada' : isWarn ? 'Por Vencer' : 'Válida / Activa'}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-5 font-mono text-xs font-bold text-amber-300 truncate max-w-[220px]">
                                                            {c.signatureProvider || 'AUTORIDAD DE CERTIFICACION SUBCA-1 FIRMASEGURA S.A.S.'}
                                                        </td>
                                                        <td className="py-4 px-5 font-mono text-xs">
                                                            <span className={`font-bold ${statusColor}`}>
                                                                {formatExpiry(c.signatureExpirationDate)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 block">
                                                                {isExpired ? `(Hace ${Math.abs(daysLeft!)}d)` : isWarn ? `(${daysLeft}d restantes)` : `(${daysLeft ?? '—'}d)`}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {c.phones?.length ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            const expiryStr = formatExpiry(c.signatureExpirationDate);
                                                                            const msg = `Hola ${c.name.split(' ')[0]}, le informamos que su firma electrónica ${isExpired ? 'ha caducado' : `vence el ${expiryStr}`}. Contáctenos para gestionar la renovación.`;
                                                                            setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g, ''), message: msg });
                                                                        }}
                                                                        className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 transition-all text-[10px] font-bold uppercase active:scale-95 flex items-center gap-1.5"
                                                                        title="WhatsApp Notificación"
                                                                    >
                                                                        <PhoneCall size={13} />
                                                                        <span className="hidden lg:inline">WhatsApp</span>
                                                                    </button>
                                                                ) : null}
                                                                <button
                                                                    onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                                                    className="p-2 rounded-xl bg-white/10 hover:bg-teal-600 text-white border border-white/15 transition-all text-[10px] font-bold uppercase active:scale-95 flex items-center gap-1.5"
                                                                    title="Ir a Bóveda del Cliente"
                                                                >
                                                                    <ArrowRight size={13} />
                                                                    <span className="hidden lg:inline">Bóveda</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            /* ── VISTA TARJETAS (CUADROS EJECUTIVOS) ── */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {signatureData.withSignature.map((c) => {
                                    const daysLeft = signatureData.getDaysLeft(c.signatureExpirationDate);
                                    const isExpired = daysLeft !== null && daysLeft < 0;
                                    const isWarn = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

                                    const statusColor = isExpired ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-teal-400';
                                    const dotClass = isExpired ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : isWarn ? 'bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]';
                                    const borderClass = isExpired
                                        ? 'border-rose-500/30 bg-rose-950/20 hover:border-rose-500/50'
                                        : isWarn
                                        ? 'border-amber-400/30 bg-amber-950/20 hover:border-amber-400/50'
                                        : 'border-slate-800 bg-slate-900/60 hover:border-teal-500/40';

                                    const statusText = isExpired
                                        ? `Caducada hace ${Math.abs(daysLeft!)} días`
                                        : isWarn
                                        ? `Vence en ${daysLeft} días`
                                        : daysLeft === null
                                        ? 'Válida / Fecha desconocida'
                                        : `Válida / Activa (quedan ${daysLeft} días)`;

                                    return (
                                        <div
                                            key={c.id}
                                            className={`p-6 rounded-[2.5rem] border transition-all duration-300 backdrop-blur-xl shadow-xl flex flex-col justify-between gap-6 relative overflow-hidden group ${borderClass}`}
                                        >
                                            {/* HEADER SUPERIOR: ESTADO DE VERIFICACIÓN (.p12) */}
                                            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${statusColor}`}>
                                                        <ShieldCheck size={22} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verificación de Firma Electrónica (.p12)</p>
                                                        <h3 className="text-base font-black text-white uppercase tracking-tight mt-0.5 font-display truncate max-w-[220px] sm:max-w-[280px]">
                                                            {c.name}
                                                        </h3>
                                                    </div>
                                                </div>

                                                {/* BADGE VISUAL DE ESTADO ESTILO VERIFICACIÓN */}
                                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 shrink-0 ${
                                                    isExpired ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' :
                                                    isWarn ? 'bg-amber-400/20 border-amber-400/40 text-amber-300' :
                                                    'bg-teal-500/20 border-teal-500/40 text-teal-300'
                                                }`}>
                                                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                                                    {isExpired ? 'Caducada' : isWarn ? 'Por Vencer' : 'Válida / Activa'}
                                                </span>
                                            </div>

                                            {/* CERTIFICADO EMITIDO POR */}
                                            <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-1">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Certificado emitido por</span>
                                                <p className="text-xs font-mono font-bold text-amber-300 truncate">
                                                    {c.signatureProvider || 'AUTORIDAD DE CERTIFICACION SUBCA-1 FIRMASEGURA S.A.S.'}
                                                </p>
                                            </div>

                                            {/* BLOQUE DE TITULAR, CÉDULA/RUC Y CADUCIDAD */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Titular</span>
                                                    <span className="font-bold text-white uppercase truncate block">{c.name}</span>
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cédula / RUC</span>
                                                    <span className="font-mono font-black text-slate-200 block">{c.ruc}</span>
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Caducidad</span>
                                                    <span className={`font-mono font-black block ${statusColor}`}>
                                                        {formatExpiry(c.signatureExpirationDate)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* ACCIONES Y DETALLE DE DÍAS */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-mono font-bold ${statusColor}`}>
                                                        {statusText}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {c.phones?.length ? (
                                                        <button
                                                            onClick={() => {
                                                                const expiryStr = formatExpiry(c.signatureExpirationDate);
                                                                const msg = `Hola ${c.name.split(' ')[0]}, le informamos que su firma electrónica ${isExpired ? 'ha caducado' : `vence el ${expiryStr}`}. Contáctenos para gestionar la renovación y mantener su facturación activa.`;
                                                                setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g, ''), message: msg });
                                                            }}
                                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 transition-all text-[10px] font-black uppercase active:scale-95 shadow-sm"
                                                        >
                                                            <PhoneCall size={14} />
                                                            <span>WhatsApp</span>
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-teal-600 text-white border border-white/15 transition-all text-[10px] font-black uppercase active:scale-95 shadow-sm"
                                                    >
                                                        <ArrowRight size={14} />
                                                        <span>Ir a Bóveda</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ── TAB: SIN FIRMA ── */}
            {tab === 'sin-firma' && (
                <div className="space-y-6">
                    {signatureData.withoutSignature.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="p-6 rounded-3xl bg-teal-500/10 border border-teal-500/20">
                                <CheckCircle2 size={32} className="text-teal-400" />
                            </div>
                            <p className="text-sm font-bold text-teal-400">¡Todos los clientes activos de la búsqueda tienen firma cargada!</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/[0.08] border border-rose-500/20">
                                <div className="flex items-center gap-3">
                                    <ShieldOff size={18} className="text-rose-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-rose-300 font-black">{signatureData.withoutSignature.length} clientes sin firma electrónica cargada</p>
                                        <p className="text-[10px] text-rose-400/80 mt-0.5">Régimen General y Emprendedor requieren firma digital para emitir comprobantes en el SRI.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {signatureData.withoutSignature.map((c) => (
                                    <div key={c.id} className="group p-5 rounded-3xl border border-white/10 bg-slate-900/60 hover:border-rose-400/30 transition-all duration-300 flex flex-col justify-between gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                                                    <ShieldOff size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-white uppercase truncate max-w-[200px]">{c.name}</h4>
                                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{c.ruc}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                                                c.regime === TaxRegime.General ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                : c.regime === TaxRegime.RimpeEmprendedor ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                                {c.regime === TaxRegime.General ? 'Régimen General' : c.regime === TaxRegime.RimpeEmprendedor ? 'Emprendedor' : 'Negocio Popular'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                                            {c.phones?.length ? (
                                                <button
                                                    onClick={() => {
                                                        const msg = `Hola ${c.name.split(' ')[0]}, le recordamos que para emitir facturas electrónicas necesita una firma digital (.p12) vigente. Podemos ayudarle a obtenerla. ¿Le interesa que lo gestionemos?`;
                                                        setWhatsAppPrompt({ clientName: c.name, phone: c.phones![0].replace(/\D/g, ''), message: msg });
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all text-[10px] font-black uppercase active:scale-95"
                                                >
                                                    <PhoneCall size={12} />
                                                    <span>Propuesta WhatsApp</span>
                                                </button>
                                            ) : null}
                                            <button
                                                onClick={() => navigate('clients', { clientIdToView: c.id, initialTab: 'vault' })}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border border-rose-500/30 transition-all text-[10px] font-black uppercase active:scale-95 shadow-sm shadow-rose-500/20"
                                            >
                                                <ArrowRight size={12} />
                                                <span>+ Cargar .p12</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setWhatsAppPrompt(null)}
                                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const encoded = encodeURIComponent(whatsAppPrompt.message);
                                    window.open(`https://wa.me/593${whatsAppPrompt.phone.replace(/^0/, '')}?text=${encoded}`, '_blank');
                                    setWhatsAppPrompt(null);
                                }}
                                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Abrir WhatsApp Web
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
