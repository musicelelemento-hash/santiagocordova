import React, { useCallback, useEffect, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, Wifi, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

/**
 * Estado de los canales de notificación (Resend / WhatsApp / despachador).
 *
 * Consulta al bot (`GET /notificaciones/estado`), que es el único que tiene
 * las claves. Acá sólo se muestran estados: nunca una clave.
 */

const URL_DEFECTO = 'https://santiagocordova.onrender.com';

type Estado = {
    ok?: boolean;
    resend?: { configurado: boolean; dominio: string | null; estado: string };
    whatsapp?: { proveedor: string; configurado: boolean };
    despachador?: boolean;
    gmail?: boolean;
};

const chip = (ok: boolean, texto: string) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ok
        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
        : 'border-amber-500/35 bg-amber-500/10 text-amber-300'}`}>
        {ok ? <CheckCircle2 size={10} /> : <Clock3 size={10} />} {texto}
    </span>
);

const NotificationChannelsCard: React.FC = () => {
    const [url, setUrl] = useState<string>(() => {
        try { return localStorage.getItem('notif_api_url') || URL_DEFECTO; } catch { return URL_DEFECTO; }
    });
    const [estado, setEstado] = useState<Estado | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const consultar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const base = url.trim().replace(/\/+$/, '');
            const res = await fetch(`${base}/notificaciones/estado`, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setEstado(await res.json());
        } catch (e: any) {
            setEstado(null);
            setError(e?.message || 'No se pudo consultar el bot');
        } finally {
            setCargando(false);
        }
    }, [url]);

    useEffect(() => { void consultar(); }, [consultar]);

    return (
        <div className="rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl overflow-hidden font-mono">
            <div className="p-6 sm:p-8 border-b border-white/10 bg-[#0b1326]/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-[#C9A96E]/15 border border-[#C9A96E]/30 rounded-2xl text-[#C9A96E]">
                        <Wifi size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl sm:text-2xl font-bold font-display text-white">Canales de envío</h3>
                        <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">Resend · WhatsApp · despachador</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void consultar()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                >
                    <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Consultar
                </button>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
                <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500">URL del bot</label>
                    <input
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); try { localStorage.setItem('notif_api_url', e.target.value); } catch { /* sin storage */ } }}
                        onBlur={() => void consultar()}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100 outline-none transition-colors focus:border-[#C9A96E]/50"
                    />
                </div>

                {error && (
                    <p className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                        <AlertCircle size={13} /> {error}
                    </p>
                )}

                {estado && (
                    <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                            <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500"><Mail size={11} /> Resend</p>
                            <div className="mt-1.5">{chip(Boolean(estado.resend?.configurado), estado.resend?.configurado ? (estado.resend?.estado || 'configurado') : 'sin clave')}</div>
                            <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={estado.resend?.dominio || ''}>{estado.resend?.dominio || 'sin dominio'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                            <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500"><MessageCircle size={11} /> WhatsApp</p>
                            <div className="mt-1.5">{chip(Boolean(estado.whatsapp?.configurado), estado.whatsapp?.proveedor || '—')}</div>
                            <p className="mt-1 font-mono text-[10px] text-slate-400">{estado.whatsapp?.configurado ? 'listo para enviar' : 'falta el gateway'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                            <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500"><Clock3 size={11} /> Despachador</p>
                            <div className="mt-1.5">{chip(Boolean(estado.despachador), estado.despachador ? 'cada 60 s' : 'apagado')}</div>
                            <p className="mt-1 font-mono text-[10px] text-slate-400">{estado.gmail ? 'Gmail de respaldo' : 'sin Gmail'}</p>
                        </div>
                    </div>
                )}

                <p className="text-[10px] leading-relaxed text-slate-500">
                    Cuando Resend diga <b className="text-slate-300">verified</b> y WhatsApp tenga su gateway,
                    la bandeja de Notificaciones se envía sola. Mientras tanto, las filas quedan pendientes y no se pierden.
                </p>
            </div>
        </div>
    );
};

export default NotificationChannelsCard;
