import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { SERVICIOS, PUBLICOS, anunciosPara, guionesPara, type Servicio, type Angulo } from '../../services/marketing';

const ANGULOS: Record<Angulo, string> = {
    fecha: 'Por la fecha',
    tranquilidad: 'Por la tranquilidad',
    cercania: 'Por la cercanía',
};

const ORDEN: Servicio[] = ['iva_mensual', 'iva_semestral', 'renta', 'firma', 'facturacion'];

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-[#6E9BFF] dark:focus-visible:ring-offset-[#020617]';

const BTN = `inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${FOCO}`;

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#0F172A] sm:p-5';

/** Selecciona el contenido de un elemento (alternativa cuando el portapapeles falla). */
function seleccionar(id: string) {
    try {
        const el = document.getElementById(id);
        if (!el) return;
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(rango);
    } catch {
        /* sin selección posible */
    }
}

export const AnunciosYVideos: React.FC = () => {
    const serviceFees = useAppStore(s => s.serviceFees);
    const { toast } = useToast();
    const [servicio, setServicio] = useState<Servicio>('iva_mensual');

    const anuncios = useMemo(() => anunciosPara(servicio, serviceFees), [servicio, serviceFees]);
    const guiones = useMemo(() => guionesPara(servicio), [servicio]);
    const publicos = useMemo(() => PUBLICOS.filter(p => p.para.includes(servicio)), [servicio]);

    const copiar = async (texto: string, etiqueta: string, idOrigen: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            toast.success(`Copiado: ${etiqueta}`);
        } catch {
            seleccionar(idOrigen);
            toast.info('Selecciona y copia con Ctrl+C');
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
            <header>
                <h2 className="font-['Manrope',sans-serif] text-2xl font-extrabold text-slate-900 dark:text-white">Anuncios y videos para Meta</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Todo es para copiar y pegar. Nada se publica ni se envía solo.
                </p>
            </header>

            <section aria-label="Servicio">
                <div role="group" aria-label="Elige el servicio" className="flex flex-wrap gap-2">
                    {ORDEN.map(id => {
                        const activo = id === servicio;
                        return (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={activo}
                                onClick={() => setServicio(id)}
                                className={`min-h-[40px] rounded-full border px-4 py-2 text-left text-sm font-semibold ${FOCO} ${
                                    activo
                                        ? 'border-[#2B6AFF] bg-[#2B6AFF] text-white'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {SERVICIOS[id].nombre}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section aria-labelledby="sec-anuncios" className="space-y-4">
                <div>
                    <h3 id="sec-anuncios" className="font-['Manrope',sans-serif] text-lg font-bold text-slate-900 dark:text-white">Anuncios</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        En Meta elige el objetivo Mensajes → WhatsApp y pega el texto. El código entre corchetes te dice de qué anuncio vino cada cliente.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    {anuncios.map(a => {
                        const idTexto = `anuncio-texto-${a.id}`;
                        const idTitular = `anuncio-titular-${a.id}`;
                        const idEnlace = `anuncio-enlace-${a.id}`;
                        return (
                            <article key={a.id} className={`${CARD} flex flex-col gap-3`}>
                                <span className="w-fit rounded-full bg-[#6366F1]/10 px-3 py-1 text-xs font-bold text-[#6366F1] dark:bg-[#6366F1]/20 dark:text-[#A5B4FC]">
                                    {ANGULOS[a.angulo]}
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Titular</p>
                                    <p id={idTitular} className="font-['Manrope',sans-serif] font-bold text-slate-900 dark:text-white">{a.titular}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Texto principal</p>
                                    <p id={idTexto} className="whitespace-pre-line break-words text-sm text-slate-800 dark:text-slate-200">{a.texto}</p>
                                </div>
                                <dl className="space-y-1 text-sm">
                                    <div className="flex flex-wrap gap-x-2">
                                        <dt className="text-slate-500 dark:text-slate-400">Botón sugerido:</dt>
                                        <dd className="font-semibold text-slate-900 dark:text-white">{a.boton}</dd>
                                    </div>
                                    <div className="flex flex-wrap gap-x-2">
                                        <dt className="text-slate-500 dark:text-slate-400">Código:</dt>
                                        <dd className="font-['JetBrains_Mono',monospace] font-semibold text-[#2B6AFF] dark:text-[#6E9BFF]">{a.codigo}</dd>
                                    </div>
                                    <div>
                                        <dt className="sr-only">Enlace</dt>
                                        <dd id={idEnlace} className="break-all font-['JetBrains_Mono',monospace] text-xs text-slate-500 dark:text-slate-400">{a.enlace}</dd>
                                    </div>
                                </dl>
                                <div className="mt-auto flex flex-col gap-2">
                                    <button type="button" className={BTN} onClick={() => copiar(a.texto, 'texto del anuncio', idTexto)}>Copiar texto</button>
                                    <button type="button" className={BTN} onClick={() => copiar(a.titular, 'titular', idTitular)}>Copiar titular</button>
                                    <button type="button" className={BTN} onClick={() => copiar(a.enlace, 'enlace de WhatsApp', idEnlace)}>Copiar enlace de WhatsApp</button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section aria-labelledby="sec-publicos" className="space-y-3">
                <div>
                    <h3 id="sec-publicos" className="font-['Manrope',sans-serif] text-lg font-bold text-slate-900 dark:text-white">Públicos sugeridos</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Son un punto de partida para probar, no datos de Meta. Ajústalos con lo que veas en tus resultados.
                    </p>
                </div>
                {publicos.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No hay públicos sugeridos para este servicio.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {publicos.map(p => (
                            <article key={p.nombre} className={CARD}>
                                <h4 className="font-['Manrope',sans-serif] font-bold text-slate-900 dark:text-white">{p.nombre}</h4>
                                <dl className="mt-2 space-y-1 text-sm">
                                    <div><dt className="inline text-slate-500 dark:text-slate-400">Ubicación: </dt><dd className="inline text-slate-800 dark:text-slate-200">{p.ubicacion}</dd></div>
                                    <div><dt className="inline text-slate-500 dark:text-slate-400">Edad: </dt><dd className="inline text-slate-800 dark:text-slate-200">{p.edad}</dd></div>
                                    <div>
                                        <dt className="mb-1 text-slate-500 dark:text-slate-400">Intereses:</dt>
                                        <dd>
                                            <ul className="flex flex-wrap gap-1.5">
                                                {p.intereses.map(i => (
                                                    <li key={i} className="rounded-full bg-[#04B17B]/10 px-2.5 py-0.5 text-xs font-semibold text-[#047857] dark:bg-[#04B17B]/20 dark:text-[#34D399]">{i}</li>
                                                ))}
                                            </ul>
                                        </dd>
                                    </div>
                                </dl>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section aria-labelledby="sec-videos" className="space-y-4">
                <div>
                    <h3 id="sec-videos" className="font-['Manrope',sans-serif] text-lg font-bold text-slate-900 dark:text-white">Videos (Reels e historias, 9:16)</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Pega el prompt en tu generador de video con IA (por ejemplo, el de Meta, CapCut o Veo) y agrega encima el texto de cada escena. Revisa siempre el video antes de publicarlo.
                    </p>
                </div>
                {guiones.map(g => {
                    const idPrompt = `guion-prompt-${g.id}`;
                    return (
                        <article key={g.id} className={`${CARD} space-y-3`}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h4 className="font-['Manrope',sans-serif] text-base font-bold text-slate-900 dark:text-white">{g.titulo}</h4>
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                    {g.segundos} segundos · código <span className="font-['JetBrains_Mono',monospace] font-semibold text-[#2B6AFF] dark:text-[#6E9BFF]">{g.codigo}</span>
                                </span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full min-w-[560px] text-left text-sm">
                                    <caption className="sr-only">Escenas de {g.titulo}</caption>
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        <tr>
                                            <th scope="col" className="px-3 py-2">Segundos</th>
                                            <th scope="col" className="px-3 py-2">Qué se ve</th>
                                            <th scope="col" className="px-3 py-2">Texto en pantalla</th>
                                            <th scope="col" className="px-3 py-2">Voz</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {g.escenas.map(e => (
                                            <tr key={`${e.desde}-${e.hasta}`} className="align-top text-slate-800 dark:text-slate-200">
                                                <td className="whitespace-nowrap px-3 py-2 font-['JetBrains_Mono',monospace] text-xs">{e.desde}–{e.hasta} s</td>
                                                <td className="px-3 py-2">{e.imagen}</td>
                                                <td className="px-3 py-2 font-semibold">{e.textoEnPantalla}</td>
                                                <td className="px-3 py-2">{e.voz}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prompt para el generador</p>
                                <pre
                                    id={idPrompt}
                                    className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#020617] p-3 font-['JetBrains_Mono',monospace] text-xs leading-relaxed text-slate-100"
                                >{g.prompt}</pre>
                            </div>
                            <button type="button" className={BTN} onClick={() => copiar(g.prompt, 'prompt del video', idPrompt)}>Copiar prompt</button>
                        </article>
                    );
                })}
            </section>
        </div>
    );
};
