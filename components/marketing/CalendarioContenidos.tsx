import React, { useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { calendarioDelMes, enlaceWhatsApp, type Publicacion } from '../../services/marketing';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-[#6E9BFF] dark:focus-visible:ring-offset-[#020617]';
const BTN = `inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${FOCO}`;

const TIPOS: Record<Publicacion['tipo'], { etiqueta: string; clase: string }> = {
    vencimiento: { etiqueta: 'Vencimiento', clase: 'bg-[#2B6AFF]/10 text-[#2B6AFF] dark:bg-[#2B6AFF]/20 dark:text-[#6E9BFF]' },
    recordatorio: { etiqueta: 'Recordatorio', clase: 'bg-[#6366F1]/10 text-[#4F46E5] dark:bg-[#6366F1]/20 dark:text-[#A5B4FC]' },
    temporada: { etiqueta: 'Temporada', clase: 'bg-[#04B17B]/10 text-[#047857] dark:bg-[#04B17B]/20 dark:text-[#34D399]' },
    confianza: { etiqueta: 'Confianza', clase: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
};

const fechaCorta = (f: Date) => `${DIAS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const CalendarioContenidos: React.FC = () => {
    const { toast } = useToast();
    const hoy = useMemo(() => new Date(), []);
    const [año, setAño] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth());

    const publicaciones = useMemo(
        () => [...calendarioDelMes(año, mes)].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
        [año, mes],
    );

    const mover = (delta: number) => {
        const f = new Date(año, mes + delta, 1);
        setAño(f.getFullYear());
        setMes(f.getMonth());
    };

    const copiar = async (p: Publicacion, id: string) => {
        const texto = `${p.titulo}\n\n${p.texto}\n\n${enlaceWhatsApp(p.codigo)}`;
        try {
            await navigator.clipboard.writeText(texto);
            toast.success('Copiado: publicación');
        } catch {
            try {
                const el = document.getElementById(id);
                if (el) {
                    const rango = document.createRange();
                    rango.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel?.removeAllRanges();
                    sel?.addRange(rango);
                }
            } catch {
                /* sin selección posible */
            }
            toast.info('Selecciona y copia con Ctrl+C');
        }
    };

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            <header>
                <h2 className="font-['Manrope',sans-serif] text-2xl font-extrabold text-slate-900 dark:text-white">Calendario de publicaciones</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Qué publicar cada día del mes, según los vencimientos del SRI. Copia y pega: nada se publica solo.
                </p>
            </header>

            <div className="flex items-center justify-between gap-2" role="group" aria-label="Elegir mes">
                <button type="button" className={BTN} onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
                <p className="text-center font-['Manrope',sans-serif] text-lg font-bold capitalize text-slate-900 dark:text-white" aria-live="polite">
                    {MESES[mes]} {año}
                </p>
                <button type="button" className={BTN} onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
            </div>

            <ol className="space-y-3">
                {publicaciones.map(p => {
                    const esHoy = mismoDia(p.fecha, hoy);
                    const t = TIPOS[p.tipo];
                    const idTexto = `pub-${p.codigo}-${p.fecha.getTime()}`;
                    return (
                        <li
                            key={idTexto}
                            aria-current={esHoy ? 'date' : undefined}
                            className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#0F172A] ${
                                esHoy ? 'border-[#2B6AFF] ring-2 ring-[#2B6AFF]/40 dark:border-[#6E9BFF]' : 'border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-['JetBrains_Mono',monospace] text-sm font-semibold text-slate-900 dark:text-white">{fechaCorta(p.fecha)}</span>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${t.clase}`}>{t.etiqueta}</span>
                                {esHoy && (
                                    <span className="rounded-full bg-[#2B6AFF] px-2.5 py-0.5 text-xs font-bold text-white">Hoy</span>
                                )}
                            </div>
                            <div id={idTexto} className="mt-2">
                                <h3 className="font-['Manrope',sans-serif] font-bold text-slate-900 dark:text-white">{p.titulo}</h3>
                                <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">{p.texto}</p>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-['JetBrains_Mono',monospace] text-xs font-semibold text-[#2B6AFF] dark:text-[#6E9BFF]">{p.codigo}</span>
                                <button type="button" className={BTN} onClick={() => copiar(p, idTexto)}>Copiar publicación</button>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <p className="text-sm text-slate-600 dark:text-slate-300">
                Las fechas se mueven al lunes cuando caen en fin de semana. Los feriados no están incluidos: revísalos antes de publicar.
            </p>
        </div>
    );
};
