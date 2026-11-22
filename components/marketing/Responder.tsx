import React, { useMemo, useState } from 'react';
import { Copy, CalendarClock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAppStore } from '../../store/useAppStore';
import { respuestasRapidas, respuestaVencimiento } from '../../services/marketing';

/**
 * «Responder» (22-nov-2026): con 35 conversaciones por día, responder rápido es
 * lo que convierte. Respuestas listas para copiar y la fecha exacta de
 * vencimiento a partir del RUC que manda el interesado.
 */
export const Responder: React.FC = () => {
    const { toast } = useToast();
    const serviceFees = useAppStore(s => s.serviceFees);
    const [ruc, setRuc] = useState('');
    const respuestas = useMemo(() => respuestasRapidas(serviceFees), [serviceFees]);
    const vence = respuestaVencimiento(ruc);
    const rucIncompleto = ruc.replace(/\D/g, '').length > 0 && !vence;

    const copiar = async (texto: string, que: string, idTexto: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            toast.success(`Copiado: ${que}`);
        } catch {
            const el = document.getElementById(idTexto);
            if (el) {
                const sel = window.getSelection();
                const r = document.createRange();
                r.selectNodeContents(el);
                sel?.removeAllRanges();
                sel?.addRange(r);
            }
            toast.info('Selecciona y copia con Ctrl+C');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <section aria-labelledby="resp-vence" className="rounded-3xl border border-[#2B6AFF]/30 bg-[#2B6AFF]/5 p-5 sm:p-6 flex flex-col gap-3">
                <h2 id="resp-vence" className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
                    <CalendarClock size={18} className="text-[#2B6AFF]" /> «¿Cuándo me vence?»
                </h2>
                <label htmlFor="resp-ruc" className="text-[13px] text-slate-600 dark:text-slate-300">Pega el RUC o la cédula que te mandó y copia la respuesta.</label>
                <input
                    id="resp-ruc"
                    value={ruc}
                    onChange={e => setRuc(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej: 0705787745001"
                    className="w-full max-w-[340px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 font-mono text-[15px] text-slate-900 dark:text-white outline-none focus:border-[#2B6AFF] focus:ring-2 focus:ring-[#2B6AFF]/25"
                />
                {vence && (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <p id="resp-vence-texto" className="flex-1 min-w-0 rounded-2xl bg-white dark:bg-[#051424]/80 border border-slate-200 dark:border-white/10 px-4 py-3 text-[14px] text-slate-800 dark:text-slate-100">{vence}</p>
                        <BotonCopiar onClick={() => copiar(vence, 'fecha de vencimiento', 'resp-vence-texto')} />
                    </div>
                )}
                {rucIncompleto && <p className="text-[13px] text-amber-600 dark:text-amber-400">Faltan dígitos: el 9.º dígito decide la fecha.</p>}
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Es la fecha del IVA mensual; si cae en fin de semana pasa al lunes. Los feriados no están incluidos.</p>
            </section>

            <section aria-labelledby="resp-listas" className="flex flex-col gap-3">
                <h2 id="resp-listas" className="text-lg font-extrabold text-slate-900 dark:text-white">Respuestas listas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {respuestas.map(r => (
                        <article key={r.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#051424]/80 p-4 sm:p-5 flex flex-col gap-3">
                            <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{r.pregunta}</h3>
                            <p id={`resp-${r.id}`} className="flex-1 whitespace-pre-line text-[14px] text-slate-800 dark:text-slate-100">{r.texto}</p>
                            <BotonCopiar onClick={() => copiar(r.texto, r.pregunta, `resp-${r.id}`)} />
                        </article>
                    ))}
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Los precios salen de Ajustes → tarifas. Cópialas y pégalas en WhatsApp; nada se envía solo.</p>
            </section>
        </div>
    );
};

const BotonCopiar: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="self-start shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#2B6AFF] hover:text-[#2B6AFF] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF]"
    >
        <Copy size={14} /> Copiar
    </button>
);

export default Responder;
