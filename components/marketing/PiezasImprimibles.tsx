import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { useAppStore } from '../../store/useAppStore';
import { MARCA, SERVICIOS, FORMATOS, DIA_POR_DIGITO, textoPrecio, enlaceWhatsApp, type Servicio, type Formato } from '../../services/marketing';

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

// ── Piezas compartidas ──────────────────────────────────────────────────────

const DIGITOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
/** Clave de acceso de factura electrónica (49 dígitos) sólo como textura: no valida. */
const CLAVE_DEMO = '2211202601070578774500120010010000001231234567810';

/** Check dibujado con SVG: el carácter ✓ lo descentraba html2canvas al exportar. */
const Check: React.FC<{ lado: number; color: string }> = ({ lado, color }) => (
    <svg aria-hidden="true" width={lado} height={lado} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }}>
        <circle cx="12" cy="12" r="12" fill={color} />
        <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const QrImg: React.FC<{ qr: string; lado: number }> = ({ qr, lado }) => (
    qr
        ? <img src={qr} alt="" width={lado} height={lado} style={{ display: 'block', width: lado, height: lado }} />
        : <div style={{ width: lado, height: lado }} />
);

// ── Tarjeta ─────────────────────────────────────────────────────────────────

/** Marca de agua técnica: la clave de acceso repetida, girada y casi invisible. */
const TexturaClave: React.FC<{ color: string; opacidad: number }> = ({ color, opacidad }) => (
    <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10%', top: -200, width: '130%', transform: 'rotate(-10deg)', transformOrigin: 'center', fontFamily: FUENTE_MONO, fontSize: 22, lineHeight: '42px', color, opacity: opacidad, whiteSpace: 'nowrap', overflow: 'hidden', pointerEvents: 'none' }}
    >
        {Array.from({ length: 24 }, (_, i) => (
            <div key={i}>{CLAVE_DEMO.repeat(3).slice((i * 11) % 49)}</div>
        ))}
    </div>
);

interface DatosTarjeta { persona: string; cargo: string; empresa: string; telefono: string; web: string }

const TarjetaFrente: React.FC<{ t: Tema; d: DatosTarjeta; qr: string; opacidadTextura: number }> = ({ t, d, qr, opacidadTextura }) => (
    <div style={{ width: '100%', height: '100%', background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, padding: '52px 60px', display: 'flex', alignItems: 'stretch', gap: 40, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <TexturaClave color={t.texto} opacidad={opacidadTextura} />
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 5, textTransform: 'uppercase', color: t.acento }}>{d.empresa}</div>
            <div>
                <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{d.persona}</div>
                <div style={{ marginTop: 22, width: 150, height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${C.azure}, ${C.emerald})` }} />
                <div style={{ marginTop: 20, fontSize: 30, fontWeight: 600, color: t.suave }}>{d.cargo}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: t.acento }}>WhatsApp</span>
                    <span style={{ fontFamily: FUENTE_MONO, fontSize: 36, fontWeight: 700 }}>{d.telefono}</span>
                </div>
                <div style={{ fontFamily: FUENTE_MONO, fontSize: 26, fontWeight: 500, color: t.suave }}>{d.web}</div>
            </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ background: '#FFFFFF', padding: 14, borderRadius: 22, boxShadow: '0 10px 30px rgba(2,6,23,0.25)' }}>
                <QrImg qr={qr} lado={210} />
            </div>
            <div style={{ marginTop: 14, fontSize: 20, fontWeight: 700, color: t.suave }}>WhatsApp</div>
        </div>
    </div>
);

const DATOS_FACTURA = [
    'Nombre o razón social',
    'RUC / C.I.',
    'Correo',
    'Teléfono',
    'Dirección',
];

/**
 * Siempre clara: se llena a mano con esfero, aunque el frente sea oscuro.
 * La etiqueta va a la izquierda, sobre la misma línea (como un formulario):
 * así cada renglón deja ~80 px (≈7 mm impreso) para escribir, no 45.
 */
const TarjetaReversoDatos: React.FC<{ qr: string; empresa: string; web: string }> = ({ qr, empresa, web }) => (
    <div style={{ width: '100%', height: '100%', background: '#F8FAFC', color: C.navy, fontFamily: FUENTE_TITULAR, padding: '30px 56px 22px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 8, background: `linear-gradient(90deg, ${C.azure}, ${C.emerald})` }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: '40px', letterSpacing: -0.5 }}>Mis datos para la factura</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B' }}>La factura electrónica llega a tu correo</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 2, marginBottom: 12 }}>
            {DATOS_FACTURA.map(etiqueta => (
                <div key={etiqueta} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                    <div style={{ width: 200, flexShrink: 0, paddingBottom: 6, fontSize: 17, fontWeight: 700, color: '#475569', lineHeight: '20px' }}>{etiqueta}</div>
                    <div style={{ flex: 1, height: '100%', borderBottom: '2px solid #94A3B8', boxSizing: 'border-box' }} />
                </div>
            ))}
        </div>
        <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: '#334155' }}>Pide siempre tu factura: te sirve para tus gastos personales.</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: C.azure }}>{empresa} · {web}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: 4, borderRadius: 10, border: '1px solid #CBD5E1', flexShrink: 0 }}>
                <QrImg qr={qr} lado={86} />
            </div>
        </div>
    </div>
);

const TarjetaReversoCalendario: React.FC<{ t: Tema; qr: string; empresa: string; telefono: string }> = ({ t, qr, empresa, telefono }) => (
    <div style={{ width: '100%', height: '100%', background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, padding: '38px 56px 30px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 8, background: `linear-gradient(90deg, ${C.azure}, ${C.emerald})` }} />
        <div style={{ fontSize: 44, fontWeight: 800, lineHeight: '52px', letterSpacing: -0.5 }}>¿Cuándo vence tu IVA?</div>
        <div style={{ marginTop: 2, fontSize: 24, fontWeight: 600, color: t.suave }}>Mira el 9.º dígito de tu RUC</div>
        <div style={{ flex: 1, minHeight: 0, marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 12 }}>
            {DIGITOS.map(dg => (
                <div key={dg} style={{ background: t.tarjetaBeneficio, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: FUENTE_MONO, fontSize: 56, fontWeight: 800, lineHeight: 1, color: t.acento }}>{dg}</div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: t.texto }}>día {DIA_POR_DIGITO[dg]}</div>
                </div>
            ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 18, fontWeight: 600, color: t.suave }}>Si cae en fin de semana, pasa al lunes.</div>
        <div style={{ marginTop: 10, height: 84, borderTop: `2px solid ${t.linea}`, paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{empresa}</div>
                <div style={{ marginTop: 4, fontFamily: FUENTE_MONO, fontSize: 24, fontWeight: 700, color: t.acento }}>{telefono}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: 4, borderRadius: 10, flexShrink: 0 }}>
                <QrImg qr={qr} lado={100} />
            </div>
        </div>
    </div>
);

type Reverso = 'datos' | 'calendario';
const REVERSOS: { id: Reverso; nombre: string }[] = [
    { id: 'datos', nombre: 'Datos para factura' },
    { id: 'calendario', nombre: 'Calendario del SRI' },
];

const TabTarjeta: React.FC = () => {
    const [persona, setPersona] = useState<string>(MARCA.persona);
    const [cargo, setCargo] = useState<string>('Asesor Tributario');
    const [empresa, setEmpresa] = useState<string>(MARCA.nombre);
    const [telefono, setTelefono] = useState<string>(MARCA.telefonoVisible);
    const [web, setWeb] = useState<string>(MARCA.web);
    const [estilo, setEstilo] = useState<Estilo>('obsidiana');
    const [reverso, setReverso] = useState<Reverso>('datos');
    const t = TEMAS[estilo];
    const qrFrente = useQr(enlaceWhatsApp('TARJ'));
    const qrFactura = useQr(enlaceWhatsApp('TARJ-F'));
    const qrCalendario = useQr(enlaceWhatsApp('TARJ-C'));
    const { ancho, alto } = FORMATOS.tarjeta;
    const datos: DatosTarjeta = { persona, cargo, empresa, telefono, web };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Campo id="tj-persona" label="Nombre en la tarjeta" value={persona} onChange={setPersona} />
                <Campo id="tj-cargo" label="Cargo" value={cargo} onChange={setCargo} />
                <Campo id="tj-empresa" label="Empresa" value={empresa} onChange={setEmpresa} />
                <Campo id="tj-tel" label="Teléfono visible" value={telefono} onChange={setTelefono} mono />
                <Campo id="tj-web" label="Web" value={web} onChange={setWeb} mono />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                    <div className={claseLabel}>Estilo</div>
                    <Opciones nombre="Estilo de la tarjeta" valor={estilo} opciones={ESTILOS} onChange={v => setEstilo(v as Estilo)} />
                </div>
                <div>
                    <div className={claseLabel}>Reverso</div>
                    <Opciones nombre="Reverso de la tarjeta" valor={reverso} opciones={REVERSOS} onChange={v => setReverso(v as Reverso)} />
                </div>
            </div>
            <div className="flex flex-col gap-6 md:flex-row">
                <Vista etiqueta="Frente" ancho={ancho} alto={alto} fondo={t.fondo} archivo="tarjeta-frente.png">
                    <TarjetaFrente t={t} d={datos} qr={qrFrente} opacidadTextura={estilo === 'obsidiana' ? 0.08 : 0.06} />
                </Vista>
                {reverso === 'datos' ? (
                    <Vista etiqueta="Reverso · datos para factura (siempre claro para escribir)" ancho={ancho} alto={alto} fondo="#F8FAFC" archivo="tarjeta-reverso-datos.png">
                        <TarjetaReversoDatos qr={qrFactura} empresa={empresa} web={web} />
                    </Vista>
                ) : (
                    <Vista etiqueta="Reverso · calendario del SRI" ancho={ancho} alto={alto} fondo={t.fondo} archivo="tarjeta-reverso-calendario.png">
                        <TarjetaReversoCalendario t={t} qr={qrCalendario} empresa={empresa} telefono={telefono} />
                    </Vista>
                )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Para imprimir: tamaño 9 × 5 cm, 300 ppp. Pide a la imprenta corte con sangrado de 3 mm. El reverso «Datos para factura» va en papel que se pueda escribir con esfero (nada de laminado brillante).</p>
        </div>
    );
};

// ── Volante ─────────────────────────────────────────────────────────────────

type TipoVolante = Servicio | 'calendario' | 'requisitos';
const esServicio = (x: TipoVolante): x is Servicio => x in SERVICIOS;

const REQUISITOS = [
    'Tu RUC',
    'Tu clave del SRI (la guardamos con cuidado)',
    'Facturas de ventas del mes',
    'Facturas de compras y gastos',
    'Retenciones que te hicieron',
];

function medidas(formato: Formato) {
    const { ancho, alto } = FORMATOS[formato];
    const u = ancho / 100; // un 1 % del ancho
    const alta = alto / ancho > 1.3; // A5 e historia respiran más
    return { ancho, alto, u, alta, qrLado: Math.round(ancho * (alta ? 0.3 : 0.26)), pad: ancho * 0.07 };
}

/** Marco común: barra, marca arriba, contenido centrado y pie de contacto. */
const MarcoVolante: React.FC<{ t: Tema; formato: Formato; telefono: string; children: React.ReactNode }> = ({ t, formato, telefono, children }) => {
    const { ancho, alto, u, alta, pad } = medidas(formato);
    return (
        <div style={{ width: ancho, height: alto, background: t.fondoCss, color: t.texto, fontFamily: FUENTE_TITULAR, boxSizing: 'border-box', padding: `${pad * (formato === 'historia' ? 1.9 : 1)}px ${pad}px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: u * 1.4, background: `linear-gradient(90deg, ${C.azure}, ${C.emerald})` }} />
            <div style={{ fontSize: u * 2.7, fontWeight: 800, letterSpacing: u * 0.4, textTransform: 'uppercase', color: t.acento, marginTop: u * 1.5 }}>{MARCA.nombre}</div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * (alta ? 4 : 3) }}>
                {children}
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

const Encabezado: React.FC<{ t: Tema; u: number; alta: boolean; titular: string; subtitulo: string }> = ({ t, u, alta, titular, subtitulo }) => (
    <div>
        <div style={{ fontSize: u * (alta ? 8 : 7.4), fontWeight: 800, lineHeight: 1.08, letterSpacing: -u * 0.15 }}>{titular}</div>
        {subtitulo && <div style={{ marginTop: u * 2, fontSize: u * 3.2, fontWeight: 600, color: t.suave, lineHeight: 1.3 }}>{subtitulo}</div>}
    </div>
);

const ListaChecks: React.FC<{ t: Tema; u: number; items: string[]; fuente: number; vertical: number }> = ({ t, u, items, fuente, vertical }) => (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: u * 1.8 }}>
        {items.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: u * 2.2, background: t.tarjetaBeneficio, borderRadius: u * 2, padding: `${vertical}px ${u * 2.4}px` }}>
                <Check lado={u * 4.4} color={t.acento2} />
                <span style={{ fontSize: fuente, fontWeight: 600, lineHeight: 1.3 }}>{b}</span>
            </li>
        ))}
    </ul>
);

/** Franja inferior: mensaje principal (precio u otro), invitación y QR. */
const FranjaQr: React.FC<{ t: Tema; u: number; qr: string; qrLado: number; etiqueta?: string; principal: string; principalPx: number }> = ({ t, u, qr, qrLado, etiqueta, principal, principalPx }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u * 3, borderTop: `2px solid ${t.linea}`, paddingTop: u * 3 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
            {etiqueta && <div style={{ fontSize: u * 2.6, fontWeight: 700, color: t.suave, textTransform: 'uppercase', letterSpacing: u * 0.3 }}>{etiqueta}</div>}
            <div style={{ fontSize: principalPx, fontWeight: 800, color: t.acento, lineHeight: 1.1, marginTop: etiqueta ? u * 0.6 : 0 }}>{principal}</div>
            <div style={{ marginTop: u * 2.4, fontSize: u * 3, fontWeight: 700 }}>Escanea y escríbenos por WhatsApp</div>
        </div>
        <div style={{ background: '#FFFFFF', padding: u * 1.6, borderRadius: u * 2.4, flexShrink: 0 }}>
            <QrImg qr={qr} lado={qrLado} />
        </div>
    </div>
);

interface VolanteProps {
    t: Tema;
    formato: Formato;
    tipo: TipoVolante;
    titular: string;
    paraQuien: string;
    beneficios: string[];
    precio: string;
    qr: string;
    telefono: string;
}

const Volante: React.FC<VolanteProps> = ({ t, formato, tipo, titular, paraQuien, beneficios, precio, qr, telefono }) => {
    const { u, alta, qrLado } = medidas(formato);

    return (
        <MarcoVolante t={t} formato={formato} telefono={telefono}>
            {tipo === 'calendario' ? (
                <>
                    <Encabezado t={t} u={u} alta={alta} titular={titular} subtitulo="Mira el 9.º dígito de tu RUC" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: u * 1.6 }}>
                        {DIGITOS.map(dg => (
                            <div key={dg} style={{ background: t.tarjetaBeneficio, borderRadius: u * 2, padding: `${u * (alta ? 2.4 : 1.6)}px 0`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ fontFamily: FUENTE_MONO, fontSize: u * (alta ? 9 : 7.5), fontWeight: 800, lineHeight: 1, color: t.acento }}>{dg}</div>
                                <div style={{ marginTop: u * 1, fontSize: u * (alta ? 3.2 : 2.8), fontWeight: 700 }}>día {DIA_POR_DIGITO[dg]}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: u * 2.8, fontWeight: 600, color: t.suave, textAlign: 'center' }}>Si cae en fin de semana, pasa al lunes.</div>
                    <FranjaQr t={t} u={u} qr={qr} qrLado={qrLado} principal="Te avisamos antes de tu fecha" principalPx={u * 5.2} />
                </>
            ) : tipo === 'requisitos' ? (
                <>
                    <Encabezado t={t} u={u} alta={alta} titular={titular} subtitulo="" />
                    <ListaChecks t={t} u={u} items={REQUISITOS} fuente={u * (alta ? 3.4 : 3)} vertical={u * (alta ? 1.9 : 1.4)} />
                    <FranjaQr t={t} u={u} qr={qr} qrLado={qrLado} principal="Lo demás lo hacemos nosotros." principalPx={u * 5.2} />
                </>
            ) : (
                <>
                    <Encabezado t={t} u={u} alta={alta} titular={titular} subtitulo={paraQuien} />
                    <ListaChecks t={t} u={u} items={beneficios} fuente={u * 3.3} vertical={u * 1.8} />
                    <FranjaQr t={t} u={u} qr={qr} qrLado={qrLado} etiqueta="Tu inversión" principal={precio} principalPx={u * (precio.length > 18 ? 6 : 8.2)} />
                </>
            )}
        </MarcoVolante>
    );
};

const FORMATOS_VOLANTE: { id: Formato; nombre: string }[] = [
    { id: 'volanteA5', nombre: 'Volante A5 (imprimir)' },
    { id: 'post', nombre: 'Publicación 4:5' },
    { id: 'historia', nombre: 'Historia 9:16' },
];

const TITULAR_CALENDARIO = '¿Cuándo vence tu IVA?';
const TITULAR_REQUISITOS = '¿Qué necesito para declarar?';

function titularDe(tipo: TipoVolante): string {
    return esServicio(tipo) ? SERVICIOS[tipo].gancho : tipo === 'calendario' ? TITULAR_CALENDARIO : TITULAR_REQUISITOS;
}

function codigoDe(tipo: TipoVolante): string {
    return esServicio(tipo) ? `${SERVICIOS[tipo].codigo}F` : tipo === 'calendario' ? 'CAL-F' : 'REQ-F';
}

const TabVolante: React.FC = () => {
    const tarifas = useAppStore(s => s.serviceFees);
    const [tipo, setTipo] = useState<TipoVolante>('iva_mensual');
    const [formato, setFormato] = useState<Formato>('post');
    const [estilo, setEstilo] = useState<Estilo>('obsidiana');
    const [titular, setTitular] = useState<string>(SERVICIOS.iva_mensual.gancho);
    const [telefono, setTelefono] = useState<string>(MARCA.telefonoVisible);

    const t = TEMAS[estilo];
    const codigo = codigoDe(tipo);
    const qr = useQr(enlaceWhatsApp(codigo));
    const { ancho, alto } = FORMATOS[formato];
    const ficha = esServicio(tipo) ? SERVICIOS[tipo] : null;

    const cambiarTipo = (id: TipoVolante) => {
        setTipo(id);
        setTitular(titularDe(id));
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                    <label htmlFor="vl-servicio" className={claseLabel}>Tipo de volante</label>
                    <select id="vl-servicio" value={tipo} onChange={e => cambiarTipo(e.target.value as TipoVolante)} className={claseInput}>
                        {(Object.keys(SERVICIOS) as Servicio[]).map(id => <option key={id} value={id}>{SERVICIOS[id].nombre}</option>)}
                        <option value="calendario">Calendario del SRI</option>
                        <option value="requisitos">Qué necesito para declarar</option>
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
                archivo={`volante-${tipo}-${formato === 'volanteA5' ? 'a5' : formato}.png`}
                maxAncho={460}
            >
                <Volante
                    t={t}
                    formato={formato}
                    tipo={tipo}
                    titular={titular}
                    paraQuien={ficha ? ficha.paraQuien : ''}
                    beneficios={ficha ? ficha.beneficios : []}
                    precio={esServicio(tipo) ? textoPrecio(tipo, tarifas) : ''}
                    qr={qr}
                    telefono={telefono}
                />
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
