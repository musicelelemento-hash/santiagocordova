import React, { useState } from 'react';
import { Lightbulb, Send, X, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';

/**
 * Buzón de sugerencias.
 *
 * Cada entrada lleva un **nivel de exigencia** (idea → solucionar) para que la
 * próxima versión sepa qué atacar primero, y un área para ubicarla. El agente
 * lo lee con `tools/buzon.mjs`, en una línea por entrada (gasto mínimo de
 * contexto).
 */

const NIVELES = [
    { id: 'idea', etiqueta: 'Idea', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300' },
    { id: 'sugerencia', etiqueta: 'Sugerencia', color: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
    { id: 'mejora', etiqueta: 'Mejorar', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
    { id: 'aplicar', etiqueta: 'Aplicar', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    { id: 'solucionar', etiqueta: 'Solucionar ya', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
    { id: 'revisar', etiqueta: 'Revisar', color: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
] as const;

const AREAS = ['general', 'boveda', 'cobranza', 'declaraciones', 'anulador', 'extension', 'facturacion'];

const SuggestionBox: React.FC = () => {
    const { toast } = useToast();
    const [abierto, setAbierto] = useState(false);
    const [nivel, setNivel] = useState<string>('sugerencia');
    const [area, setArea] = useState('general');
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviada, setEnviada] = useState(false);

    const enviar = async () => {
        const limpio = texto.trim();
        if (limpio.length < 5) {
            toast.error('Escribí al menos una frase.');
            return;
        }
        setEnviando(true);
        try {
            const { error } = await supabase.from('suggestions').insert({
                level: nivel,
                area,
                texto: limpio,
                source: 'web',
            });
            if (error) throw error;
            setEnviada(true);
            setTexto('');
            toast.success('Sugerencia guardada. La próxima versión la lee.');
            setTimeout(() => {
                setEnviada(false);
                setAbierto(false);
            }, 1200);
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || 'revisá la tabla suggestions'}`);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setAbierto(true)}
                title="Buzón de sugerencias"
                className="fixed bottom-24 right-4 z-[9998] flex h-11 w-11 items-center justify-center rounded-full border border-[#C9A96E]/40 bg-[#051424]/90 text-[#C9A96E] shadow-xl backdrop-blur transition-transform hover:scale-105 sm:bottom-6"
            >
                <Lightbulb size={18} />
            </button>

            {abierto && (
                <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1c2e] p-4 text-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C9A96E]">
                                <Lightbulb size={14} /> Buzón de sugerencias
                            </h3>
                            <button type="button" onClick={() => setAbierto(false)} className="text-slate-500 hover:text-slate-200">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {NIVELES.map((n) => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => setNivel(n.id)}
                                    className={`rounded-lg border px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider transition-colors ${n.color} ${nivel === n.id ? 'ring-2 ring-white/25' : 'opacity-70 hover:opacity-100'}`}
                                >
                                    {n.etiqueta}
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {AREAS.map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => setArea(a)}
                                    className={`rounded-lg border px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider ${area === a
                                        ? 'border-[#00A896]/45 bg-[#00A896]/12 text-[#4edea3]'
                                        : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                                >
                                    {a}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            rows={4}
                            placeholder="¿Qué te molesta o qué falta? Cuanto más concreto, mejor se ataca."
                            className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#C9A96E]/50"
                        />

                        <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-[9.5px] text-slate-500">{texto.trim().length} caracteres</span>
                            <button
                                type="button"
                                onClick={enviar}
                                disabled={enviando || enviada}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A896] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-50"
                            >
                                {enviada ? <Check size={13} /> : <Send size={13} />}
                                {enviada ? 'Guardada' : enviando ? 'Enviando…' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SuggestionBox;
