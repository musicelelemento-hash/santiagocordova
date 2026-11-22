import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/useAppStore';
import { MARCA, SERVICIOS, FORMATOS, textoPrecio, enlaceWhatsApp, type Servicio, type Formato } from '../../services/marketing';

/**
 * Tarjetas de presentación y volantes (22-nov-2026).
 * Cada pieza se dibuja a su tamaño real en píxeles (FORMATOS); la vista previa
 * es ese mismo nodo escalado con transform: scale(). Al exportar se usa el nodo
 * a tamaño real (se quita la escala sólo en el clon que ve html2canvas).
 */

type Estilo = 'obsidiana' | 'claro';

const C = MARCA.colores;
const FUENTE_TITULAR = "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FUENTE_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

interface Tema {
    fondo: string;
    fondoCss: string;
    texto: string;
    suave: string;
    acento: string;
    acento2: string;
    linea: string;
    tarjetaBeneficio: string;
}

const TEMAS: Record<Estilo, Tema> = {
    obsidiana: {
        fondo: C.obsidian,
        fondoCss: `radial-gradient(120% 90% at 100% 0%, rgba(43,106,255,0.28) 0%, rgba(43,106,255,0) 55%), linear-gradient(160deg, ${C.navy} 0%, ${C.obsidian} 70%)`,
        texto: '#FFFFFF',
        suave: '#B6C2D9',
        acento: '#6E9BFF',
        acento2: C.emerald,
        linea: 'rgba(255,255,255,0.14)',
        tarjetaBeneficio: 'rgba(255,255,255,0.06)',
    },
    claro: {
        fondo: '#FFFFFF',
        fondoCss: `linear-gradient(160deg, #FFFFFF 0%, #F3F6FC 100%)`,
        texto: C.navy,
        suave: '#475569',
        acento: C.azure,
        acento2: C.emerald,
        linea: 'rgba(15,23,42,0.14)',
        tarjetaBeneficio: 'rgba(43,106,255,0.07)',
    },
};

const ESTILOS: { id: Estilo; nombre: string }[] = [
    { id: 'obsidiana', nombre: 'Obsidiana' },
    { id: 'claro', nombre: 'Claro' },
];

// ── Utilidades ──────────────────────────────────────────────────────────────

function useQr(enlace: string): string {
    const [url, setUrl] = useState('');
    useEffect(() => {
        let vivo = true;
        QRCode.toDataURL(enlace, { margin: 1, width: 512, color: { dark: '#020617', light: '#FFFFFF' } })
            .then(d => { if (vivo) setUrl(d); })
            .catch(() => { if (vivo) setUrl(''); });
        return () => { vivo = false; };
    }, [enlace]);
    return url;
}

/** Ancho disponible del contenedor, medido con ResizeObserver. */
function useAncho(ref: React.RefObject<HTMLElement>): number {
    const [ancho, setAncho] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        medir();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', medir);
            return () => window.removeEventListener('resize', medir);
        }
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return ancho;
}

async function exportarPng(nodo: HTMLElement, fondo: string, ancho: number, alto: number, nombre: string): Promise<void> {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch { /* sin fuentes: se exporta igual */ }
    }
    const canvas = await html2canvas(nodo, {
        scale: 1,
        backgroundColor: fondo,
        useCORS: true,
        width: ancho,
        height: alto,
        windowWidth: Math.max(ancho, document.documentElement.clientWidth),
        onclone: (doc) => {
            doc.querySelectorAll<HTMLElement>('[data-escala]').forEach(e => { e.style.transform = 'none'; });
        },
    });
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('El navegador no pudo generar la imagen.');
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
}

// ── Vista previa escalada + botón de descarga ───────────────────────────────

interface VistaProps {
    etiqueta: string;
    ancho: number;
    alto: number;
    fondo: string;
    archivo: string;
    maxAncho?: number;
    children: React.ReactNode;
}

const Vista: React.FC<VistaProps> = ({ etiqueta, ancho, alto, fondo, archivo, maxAncho, children }) => {
    const caja = useRef<HTMLDivElement>(null);
    const pieza = useRef<HTMLDivElement>(null);
    const disponible = useAncho(caja);
    const escala = disponible > 0 ? Math.min(1, disponible / ancho) : 0.2;
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState('');

    const descargar = async () => {
        if (!pieza.current || ocupado) return;
        setOcupado(true);
        setError('');
        try {
            await exportarPng(pieza.current, fondo, ancho, alto, archivo);
        } catch (e) {
            setError(e instanceof Error && e.message ? `No se pudo descargar: ${e.message}` : 'No se pudo descargar la imagen. Intenta de nuevo.');
        } finally {
            setOcupado(false);
        }
    };

    return (
        <figure className="m-0 min-w-0 flex-1" style={maxAncho ? { maxWidth: maxAncho } : undefined}>
            <figcaption className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{etiqueta}</figcaption>
            <div ref={caja} className="w-full">
                <div
                    className="overflow-hidden rounded-xl border border-slate-200 shadow-lg dark:border-white/10"
                    style={{ width: ancho * escala, height: alto * escala }}
                >
                    <div
                        data-escala
                        style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: 'top left' }}
                    >
                        <div ref={pieza} style={{ width: ancho, height: alto, position: 'relative', overflow: 'hidden', background: fondo }}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={descargar}
                disabled={ocupado}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2B6AFF] px-4 text-sm font-bold text-white hover:bg-[#1f55d6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6E9BFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
                {ocupado ? 'Preparando…' : 'Descargar PNG'}
            </button>
            {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </figure>
    );
};

// ── Controles ───────────────────────────────────────────────────────────────

const claseInput = 'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] dark:border-white/15 dark:bg-slate-900 dark:text-white dark:focus-visible:ring-[#6E9BFF]';
const claseLabel = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';

const Campo: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void; mono?: boolean }> = ({ id, label, value, onChange, mono }) => (
    <div className="min-w-0">
        <label htmlFor={id} className={claseLabel}>{label}</label>
        <input id={id} type="text" value={value} onChange={e => onChange(e.target.value)} className={`${claseInput} ${mono ? 'font-mono' : ''}`} />
    </div>
);

const Opciones: React.FC<{ nombre: string; valor: string; opciones: { id: string; nombre: string }[]; onChange: (v: string) => void }> = ({ nombre, valor, opciones, onChange }) => (
    <div role="radiogroup" aria-label={nombre} className="flex flex-wrap gap-2">
        {opciones.map(o => {
            const activo = o.id === valor;
            return (
                <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onChange(o.id)}
                    className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] dark:focus-visible:ring-[#6E9BFF] ${activo
                        ? 'border-[#2B6AFF] bg-[#2B6AFF] text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                >
                    {o.nombre}
                </button>
            );
        })}
    </div>
);

// ── Tarjeta ─────────────────────────────────────────────────────────────────

const TarjetaFrente: React.FC<{ t: Tema; persona: string; cargo: string; telefono: string }> = ({ t, persona, cargo, telefono }) => (
    <div style={{ width: '100%', height: '100%', background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: `linear-gradient(180deg, ${C.azure}, ${C.emerald})` }} />
        <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: t.acento }}>{MARCA.nombre}</div>
            <div style={{ marginTop: 40, fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{persona}</div>
            <div style={{ marginTop: 12, fontSize: 30, fontWeight: 600, color: t.suave }}>{cargo}</div>
        </div>
        <div style={{ borderTop: `2px solid ${t.linea}`, paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: FUENTE_MONO, fontSize: 38, fontWeight: 700, color: t.texto }}>WhatsApp {telefono}</div>
            <div style={{ fontSize: 26, color: t.suave }}>{MARCA.direccion}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.acento }}>{MARCA.web}</div>
        </div>
    </div>
);

const TarjetaReverso: React.FC<{ t: Tema; qr: string }> = ({ t, qr }) => (
    <div style={{ width: '100%', height: '100%', background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, padding: '56px 72px', display: 'flex', alignItems: 'center', gap: 56, boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, background: `linear-gradient(180deg, ${C.emerald}, ${C.azure})` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: t.acento }}>{MARCA.nombre}</div>
            <div style={{ marginTop: 28, fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5 }}>{MARCA.lema}</div>
            <div style={{ marginTop: 36, display: 'inline-block', background: C.emerald, color: '#FFFFFF', fontSize: 28, fontWeight: 800, padding: '12px 26px', borderRadius: 999 }}>Escanea y escríbenos</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 24, boxShadow: '0 10px 30px rgba(2,6,23,0.25)', flexShrink: 0 }}>
            {qr ? <img src={qr} alt="" width={340} height={340} style={{ display: 'block', width: 340, height: 340 }} /> : <div style={{ width: 340, height: 340 }} />}
        </div>
    </div>
);

const TabTarjeta: React.FC = () => {
    const [persona, setPersona] = useState<string>(MARCA.persona);
    const [cargo, setCargo] = useState<string>(MARCA.cargo);
    const [telefono, setTelefono] = useState<string>(MARCA.telefonoVisible);
    const [estilo, setEstilo] = useState<Estilo>('obsidiana');
    const t = TEMAS[estilo];
    const qr = useQr(enlaceWhatsApp('TARJ'));
    const { ancho, alto } = FORMATOS.tarjeta;

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <Campo id="tj-persona" label="Nombre en la tarjeta" value={persona} onChange={setPersona} />
                <Campo id="tj-cargo" label="Cargo" value={cargo} onChange={setCargo} />
                <Campo id="tj-tel" label="Teléfono visible" value={telefono} onChange={setTelefono} mono />
            </div>
            <div>
                <div className={claseLabel}>Estilo</div>
                <Opciones nombre="Estilo de la tarjeta" valor={estilo} opciones={ESTILOS} onChange={v => setEstilo(v as Estilo)} />
            </div>
            <div className="flex flex-col gap-6 md:flex-row">
                <Vista etiqueta="Frente" ancho={ancho} alto={alto} fondo={t.fondo} archivo="tarjeta-frente.png">
                    <TarjetaFrente t={t} persona={persona} cargo={cargo} telefono={telefono} />
                </Vista>
                <Vista etiqueta="Reverso" ancho={ancho} alto={alto} fondo={t.fondo} archivo="tarjeta-reverso.png">
                    <TarjetaReverso t={t} qr={qr} />
                </Vista>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Para imprimir: tamaño 9 × 5 cm, 300 ppp. Pide a la imprenta corte con sangrado de 3 mm.</p>
        </div>
    );
};

// ── Volante ─────────────────────────────────────────────────────────────────

interface VolanteProps {
    t: Tema;
    formato: Formato;
    titular: string;
    paraQuien: string;
    beneficios: string[];
    precio: string;
    qr: string;
    telefono: string;
}

const Volante: React.FC<VolanteProps> = ({ t, formato, titular, paraQuien, beneficios, precio, qr, telefono }) => {
    const { ancho, alto } = FORMATOS[formato];
    const u = ancho / 100; // un 1 % del ancho
    const alta = alto / ancho > 1.3; // A5 e historia respiran más
    const qrLado = Math.round(ancho * (alta ? 0.3 : 0.26));
    const pad = ancho * 0.07;

    return (
        <div style={{ width: ancho, height: alto, background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, boxSizing: 'border-box', padding: `${pad * (formato === 'historia' ? 1.9 : 1)}px ${pad}px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: u * 1.4, background: `linear-gradient(90deg, ${C.azure}, ${C.emerald})` }} />
            <div style={{ fontSize: u * 2.7, fontWeight: 800, letterSpacing: u * 0.4, textTransform: 'uppercase', color: t.acento, marginTop: u * 1.5 }}>{MARCA.nombre}</div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * (alta ? 4 : 3) }}>
                <div>
                    <div style={{ fontSize: u * (alta ? 8 : 7.4), fontWeight: 800, lineHeight: 1.08, letterSpacing: -u * 0.15 }}>{titular}</div>
                    <div style={{ marginTop: u * 2, fontSize: u * 3.2, fontWeight: 600, color: t.suave, lineHeight: 1.3 }}>{paraQuien}</div>
                </div>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: u * 1.8 }}>
                    {beneficios.map((b, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: u * 2.2, background: t.tarjetaBeneficio, borderRadius: u * 2, padding: `${u * 1.8}px ${u * 2.4}px` }}>
                            <span aria-hidden="true" style={{ flexShrink: 0, width: u * 4.4, height: u * 4.4, borderRadius: '50%', background: t.acento2, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: u * 2.8, fontWeight: 800, lineHeight: 1 }}>✓</span>
                            <span style={{ fontSize: u * 3.3, fontWeight: 600, lineHeight: 1.3, paddingTop: u * 0.3 }}>{b}</span>
                        </li>
                    ))}
                </ul>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u * 3, borderTop: `2px solid ${t.linea}`, paddingTop: u * 3 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: u * 2.6, fontWeight: 700, color: t.suave, textTransform: 'uppercase', letterSpacing: u * 0.3 }}>Tu inversión</div>
                        <div style={{ fontSize: u * (precio.length > 18 ? 6 : 8.2), fontWeight: 800, color: t.acento, lineHeight: 1.1, marginTop: u * 0.6 }}>{precio}</div>
                        <div style={{ marginTop: u * 2.4, fontSize: u * 3, fontWeight: 700 }}>Escanea y escríbenos por WhatsApp</div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: u * 1.6, borderRadius: u * 2.4, flexShrink: 0 }}>
                        {qr ? <img src={qr} alt="" width={qrLado} height={qrLado} style={{ display: 'block', width: qrLado, height: qrLado }} /> : <div style={{ width: qrLado, height: qrLado }} />}
                    </div>
                </div>
            </div>

            <div style={{ borderTop: `2px solid ${t.linea}`, paddingTop: u * 2.4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: u * 2, fontSize: u * 2.6, color: t.suave }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: t.texto, fontSize: u * 3 }}>{MARCA.nombre}</div>
                    <div style={{ marginTop: u * 0.6 }}>{MARCA.direccion}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: FUENTE_MONO, fontWeight: 700, color: t.texto, fontSize: u * 3.2 }}>{telefono}</div>
                    <div style={{ marginTop: u * 0.6, color: t.acento, fontWeight: 700 }}>{MARCA.web}</div>
                </div>
            </div>
        </div>
    );
};

const FORMATOS_VOLANTE: { id: Formato; nombre: string }[] = [
    { id: 'volanteA5', nombre: 'Volante A5 (imprimir)' },
    { id: 'post', nombre: 'Publicación 4:5' },
    { id: 'historia', nombre: 'Historia 9:16' },
];

const TabVolante: React.FC = () => {
    const tarifas = useAppStore(s => s.serviceFees);
    const [servicio, setServicio] = useState<Servicio>('iva_mensual');
    const [formato, setFormato] = useState<Formato>('post');
    const [estilo, setEstilo] = useState<Estilo>('obsidiana');
    const [titular, setTitular] = useState<string>(SERVICIOS.iva_mensual.gancho);
    const [telefono, setTelefono] = useState<string>(MARCA.telefonoVisible);

    const ficha = SERVICIOS[servicio];
    const t = TEMAS[estilo];
    const codigo = `${ficha.codigo}F`;
    const qr = useQr(enlaceWhatsApp(codigo));
    const { ancho, alto } = FORMATOS[formato];

    const cambiarServicio = (id: Servicio) => {
        setServicio(id);
        setTitular(SERVICIOS[id].gancho);
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                    <label htmlFor="vl-servicio" className={claseLabel}>Servicio</label>
                    <select id="vl-servicio" value={servicio} onChange={e => cambiarServicio(e.target.value as Servicio)} className={claseInput}>
                        {(Object.keys(SERVICIOS) as Servicio[]).map(id => <option key={id} value={id}>{SERVICIOS[id].nombre}</option>)}
                    </select>
                </div>
                <Campo id="vl-tel" label="Teléfono visible" value={telefono} onChange={setTelefono} mono />
            </div>
            <div>
                <label htmlFor="vl-titular" className={claseLabel}>Titular</label>
                <textarea id="vl-titular" rows={2} value={titular} onChange={e => setTitular(e.target.value)} className={`${claseInput} py-2`} />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                    <div className={claseLabel}>Formato</div>
                    <Opciones nombre="Formato del volante" valor={formato} opciones={FORMATOS_VOLANTE} onChange={v => setFormato(v as Formato)} />
                </div>
                <div>
                    <div className={claseLabel}>Estilo</div>
                    <Opciones nombre="Estilo del volante" valor={estilo} opciones={ESTILOS} onChange={v => setEstilo(v as Estilo)} />
                </div>
            </div>

            <Vista
                etiqueta={`${FORMATOS[formato].nombre} · ${ancho} × ${alto} px · código ${codigo}`}
                ancho={ancho}
                alto={alto}
                fondo={t.fondo}
                archivo={`volante-${servicio}-${formato === 'volanteA5' ? 'a5' : formato}.png`}
                maxAncho={460}
            >
                <Volante t={t} formato={formato} titular={titular} paraQuien={ficha.paraQuien} beneficios={ficha.beneficios} precio={textoPrecio(servicio, tarifas)} qr={qr} telefono={telefono} />
            </Vista>

            {formato === 'volanteA5' ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Para imprimir: tamaño A5 (14,8 × 21 cm), 300 ppp. Pide a la imprenta corte con sangrado de 3 mm.</p>
            ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">Listo para publicar en redes ({ancho} × {alto} px). El QR abre WhatsApp con el código {codigo} para saber de qué pieza llegó el cliente.</p>
            )}
        </div>
    );
};

// ── Pantalla ────────────────────────────────────────────────────────────────

export const PiezasImprimibles: React.FC = () => {
    const [tab, setTab] = useState<'tarjeta' | 'volante'>('tarjeta');
    const tabs: { id: 'tarjeta' | 'volante'; nombre: string }[] = [
        { id: 'tarjeta', nombre: 'Tarjeta' },
        { id: 'volante', nombre: 'Volante' },
    ];
    return (
        <section aria-label="Piezas imprimibles" className="space-y-5">
            <div role="tablist" aria-label="Tipo de pieza" className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-slate-900">
                {tabs.map(x => {
                    const activo = tab === x.id;
                    return (
                        <button
                            key={x.id}
                            type="button"
                            role="tab"
                            id={`piezas-tab-${x.id}`}
                            aria-selected={activo}
                            aria-controls={`piezas-panel-${x.id}`}
                            onClick={() => setTab(x.id)}
                            className={`min-h-[44px] rounded-lg px-5 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6AFF] dark:focus-visible:ring-[#6E9BFF] ${activo
                                ? 'bg-white text-[#2B6AFF] shadow dark:bg-slate-700 dark:text-white'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                        >
                            {x.nombre}
                        </button>
                    );
                })}
            </div>
            <div role="tabpanel" id={`piezas-panel-${tab}`} aria-labelledby={`piezas-tab-${tab}`}>
                {tab === 'tarjeta' ? <TabTarjeta /> : <TabVolante />}
            </div>
        </section>
    );
};

export default PiezasImprimibles;
