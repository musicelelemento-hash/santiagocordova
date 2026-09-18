import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calculator,
  Calendar,
  Fingerprint,
  FileKey,
  FileSpreadsheet,
  Heart,
  Home as HomeIcon,
  HelpCircle,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
  Boxes,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Crystal3D } from '../components/3d/Crystal3D';
import { Reveal, CountUp, ActMedia } from '../components/lujo/LujoWidgets';
import { useLujoScroll } from '../hooks/useLujoScroll';
import { useAppStore } from '../store/useAppStore';
import { PublicUser } from '../types';
import { getIdentificacionInfo, IdentificacionInfo } from '../utils/sriCalculators';
import {
  ActividadTipo,
  calculateDetailedTax,
  calculatePenaltyRisk,
  getRucDeadlineInfo,
  PenaltyType,
} from '../utils/taxTools';

/**
 * "Landing 3D Lujo" — a standalone, editorial-tone marketing page ported
 * pixel-for-pixel from the Claude Design prototype `Landing 3D Lujo.dc.html`
 * (see the design export bundle's `chats/chat1.md` for the full design
 * conversation: scroll-act mechanics, media performance strategy, mobile
 * dock, reduced-motion handling).
 *
 * This is an ADDITIVE, separate landing — it does not replace or alter
 * `screens/LandingPage.tsx` (the site's current real landing, with the RUC
 * validator / tax simulator / penalty calculator / admin trigger / FAQ /
 * testimonials — all untouched). It is reachable only at its own route
 * (see App.tsx's `'lujo'` AppState).
 *
 * Real business data (pricing, stats, testimonials, FAQ, WhatsApp number)
 * is pulled from this same repo's `store/useAppStore.ts` / the same
 * copy already shipped in `screens/LandingPage.tsx`, not from the
 * prototype's own numbers — see the inline notes below for specifics.
 */

const WHATSAPP_NUMBER = '593978980722';
const wa = (message: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
const MEDIA = '/media/';

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '#blindaje', label: 'Blindaje' },
  { href: '#sistema', label: 'Sistema' },
  { href: '#herramientas', label: 'Herramientas' },
  { href: '#resultados', label: 'Resultados' },
  { href: '#cobertura', label: 'Cobertura' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#faq', label: 'FAQ' },
];

const REGIONS = [
  { tag: 'EL ORO · BASE', name: 'Pasaje', desc: 'Atención presencial y tu contabilidad siempre al día.' },
  { tag: 'EL ORO · CAPITAL', name: 'Machala', desc: 'Gestión tributaria para comercio, servicio y agro.' },
  { tag: 'NACIONAL · REMOTO', name: 'Guayaquil', desc: 'Soporte digital y declaraciones en línea.' },
  { tag: 'NACIONAL · REMOTO', name: 'Quito', desc: 'Asesoría fiscal a distancia, sin fricciones.' },
  { tag: 'NACIONAL · REMOTO', name: 'Cuenca', desc: 'Ingeniería tributaria para todo el Austro.' },
];

const AGRO_TAGS = ['AGRO & PRODUCCIÓN', 'COMERCIO & RETAIL', 'TRANSPORTE & LOGÍSTICA', 'PYMES & EMPRENDEDORES'];

// Per-panel poster opacity restored to match the prototype's own tuning per photo
// (`Landing 3D Lujo.dc.html`'s `#galeria` articles: 0.62 / 0.55 / 0.6 / 0.62) — the port had
// flattened all four to a single 0.6, which is close but not an exact copy.
const GALLERY_PANELS = [
  {
    poster: 'poster-shield-circuit.png',
    color: '#00A896',
    tag: '01 · CUMPLIMIENTO',
    title: 'IVA y retenciones al día',
    desc: 'Declaración mensual o semestral presentada antes del vencimiento, con el comprobante archivado y el aviso enviado.',
    border: 'rgba(255,255,255,0.10)',
    posterOpacity: 0.62,
  },
  {
    poster: 'poster-financial-bars.png',
    color: '#2B6AFF',
    tag: '02 · OPTIMIZACIÓN',
    title: 'Retenciones a favor recuperadas',
    desc: 'Cruce de comprobantes y encuadre en la tabla del SRI para que el saldo a favor no se quede en el aire.',
    border: 'rgba(255,255,255,0.10)',
    posterOpacity: 0.55,
  },
  {
    poster: 'poster-ecuador-map.png',
    color: '#00A896',
    tag: '03 · PRESENCIA',
    title: 'Presencial en El Oro, remoto en el país',
    desc: 'Visitas programadas en la provincia y atención digital para Guayaquil, Quito y Cuenca.',
    border: 'rgba(255,255,255,0.10)',
    posterOpacity: 0.6,
  },
  {
    poster: 'poster-cacao-fields.png',
    color: '#C9A96E',
    tag: '04 · SECTORES',
    title: 'Contabilidad que entiende el campo',
    desc: 'Banano, cacao, camarón y comercio mayorista, con las reglas que realmente les aplican.',
    border: 'rgba(201,169,110,0.28)',
    posterOpacity: 0.62,
  },
];

// Same real testimonials shown on the current landing (screens/LandingPage.tsx).
const TESTIMONIALS = [
  {
    name: 'Ing. Carlos Mendoza',
    role: 'Gerente Comercial · Sector Bananero',
    city: 'MACHALA',
    quote:
      'La tranquilidad que tengo ahora con mis declaraciones no tiene precio. Santiago automatizó todo mi esquema de retenciones y nunca más tuve una notificación del SRI.',
  },
  {
    name: 'Dra. Mariana Valarezo',
    role: 'Especialista Médica · Consulta Privada',
    city: 'PASAJE',
    quote:
      'Como profesional independiente no tenía tiempo para llevar el control contable. Con Soluciones Tributarias PRO todo está al día y recuperaron mis retenciones a favor.',
  },
  {
    name: 'Roberto Aguilar',
    role: 'Comerciante Mayorista · RIMPE',
    city: 'EL GUABO',
    quote:
      'Emitieron mi firma electrónica .P12 en horas y me configuraron la facturación electrónica. Excelente servicio, honesto, ágil y muy profesional.',
  },
  {
    name: 'Lcda. Sonia Carrión',
    role: 'Familiar de Adulto Mayor',
    city: 'SANTA ROSA',
    quote:
      'Gestionaron la devolución del IVA de mi abuelita en tiempo récord. Cada mes recibimos el depósito directo en la cuenta sin complicaciones.',
  },
];

// Same real FAQ copy shown on the current landing (screens/LandingPage.tsx).
const FAQS = [
  {
    tag: 'RÉGIMEN',
    color: '#00A896',
    q: '¿Cuáles son las diferencias y obligaciones del RIMPE 2026 en Ecuador?',
    a: 'El régimen RIMPE se divide en Negocio Popular (ingresos brutos hasta $20,000 anuales, emite notas de venta o facturas sin IVA y realiza declaración anual con tarifa progresiva base de $60) y RIMPE Emprendedor (ingresos entre $20,001 y $300,000 anuales, factura con IVA y declara de forma semestral). Diagnosticamos su caso para garantizar el régimen correcto y evitar multas del SRI.',
  },
  {
    tag: 'FIRMA',
    color: '#2B6AFF',
    q: '¿Cómo tramitar la Firma Electrónica .P12 en Pasaje y El Oro?',
    a: 'Emitimos firmas electrónicas en archivo .P12 válidas para facturación electrónica, Quipux y trámites legales en menos de 24 horas. El proceso es 100% digital con tu cédula y papeleta de votación vigentes, sin necesidad de hacer filas en el Registro Civil.',
  },
  {
    tag: 'IVA',
    color: '#C9A96E',
    q: '¿Cómo funciona la Devolución de IVA para Tercera Edad y Discapacidad?',
    a: 'Las personas de 65 años en adelante o con carnet de discapacidad tienen derecho por ley a recuperar mensualmente el IVA pagado en compras de bienes y servicios de primera necesidad. Realizamos la solicitud digital ante el SRI hasta la acreditación directa en su cuenta bancaria.',
  },
  {
    tag: 'MÉTODO',
    color: '#00A896',
    q: '¿Por qué elegir Soluciones Tributarias PRO frente a un contador tradicional?',
    a: 'Combinamos más de 10 años de experiencia fiscal con automatización algorítmica (sistema Nueva Luz 3.0): cero errores en casilleros de retenciones 615/617, sincronización inmediata de comprobantes electrónicos y blindaje fiscal continuo ante auditorías del SRI.',
  },
  {
    tag: 'ATRASOS',
    color: '#2B6AFF',
    q: '¿Qué hacer si tengo declaraciones atrasadas o multas acumuladas en el SRI?',
    a: 'Analizamos tu historial tributario sin costo inicial, estructuramos las declaraciones pendientes con cálculo exacto de intereses y gestionamos facilidades de pago o remisiones de ley para restablecer tu RUC en estado activo en menos de 48 horas.',
  },
];

// ── Modal genérico para las herramientas fiscales — mismo lenguaje visual
// (obsidiana + teal/azure/gold, JetBrains Mono + Manrope) que el resto de la
// página, en vez de reutilizar el <Modal> del panel administrativo.
//
// Accesibilidad de teclado (bug encontrado en esta pasada: ninguno de esto
// existía — Escape no hacía nada y el foco se quedaba flotando en el botón
// que abrió el modal en vez de entrar en él):
// - Escape cierra el modal.
// - Al abrir, el foco se mueve al botón de cerrar (primer elemento enfocable).
// - Al cerrar, el foco vuelve al elemento que tenía el foco antes de abrir
//   (la tarjeta "Abrir herramienta" que se pulsó), en vez de perderse en <body>.
const ToolModal: React.FC<{ title: string; tag: string; color: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  tag,
  color,
  onClose,
  children,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in"
      style={{ background: 'rgba(2,6,23,0.86)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] max-h-[86vh] overflow-y-auto no-scrollbar rounded-[26px]"
        style={{ padding: 30, border: '1px solid rgba(255,255,255,0.10)', background: '#051424', boxShadow: '0 50px 100px -30px rgba(0,0,0,0.9)' }}
      >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-5 right-5 flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
        <span className="font-mono text-[10px] font-bold tracking-[0.28em]" style={{ color }}>{tag}</span>
        <h3 className="font-display font-extrabold text-white" style={{ margin: '12px 0 0', fontSize: 'clamp(1.3rem,3vw,1.7rem)', letterSpacing: '-0.02em' }}>{title}</h3>
        <div style={{ marginTop: 22 }}>{children}</div>
      </div>
    </div>
  );
};

interface LandingLujoPageProps {
  /** Preserva compatibilidad con el mount anterior en /lujo (botón "volver"). Opcional ahora que esta página es la home. */
  onBack?: () => void;
  onAdminAccess: () => void;
  onNavigateToServices: () => void;
  currentUser: PublicUser | null;
  onLogin: (user: PublicUser) => void;
  onLogout: () => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const LandingLujoPage: React.FC<LandingLujoPageProps> = ({ onBack, onAdminAccess, onNavigateToServices }) => {
  const { registerAct, registerNav, progressRef, heroMediaRef, activeId } = useLujoScroll();
  const { serviceFees } = useAppStore();

  // ── Acceso administrativo oculto (equivalente a `handleProtectedAccess` de
  // screens/LandingPage.tsx): un icono discreto en el header, no un botón
  // "Iniciar sesión admin" visible, que dispara una breve transición antes
  // de delegar a onAdminAccess. Ver el overlay `showBiometric` más abajo.
  const [showBiometric, setShowBiometric] = useState(false);
  const handleProtectedAccess = () => {
    setShowBiometric(true);
    setTimeout(() => { setShowBiometric(false); onAdminAccess(); }, 2200);
  };

  // ── Herramientas fiscales (RUC/cédula, simulador, multas, calendario) ──
  const [activeTool, setActiveTool] = useState<null | 'ruc' | 'simulador' | 'multas' | 'calendario'>(null);

  const [rucInput, setRucInput] = useState('');
  const rucInfo: IdentificacionInfo | null = useMemo(
    () => (rucInput.trim() ? getIdentificacionInfo(rucInput) : null),
    [rucInput]
  );

  const [simIngresos, setSimIngresos] = useState(18000);
  const [simActividad, setSimActividad] = useState<ActividadTipo>('comercial');
  const taxDetails = useMemo(
    () => calculateDetailedTax(simIngresos, simActividad, serviceFees),
    [simIngresos, simActividad, serviceFees]
  );

  const [penaltyMeses, setPenaltyMeses] = useState(3);
  const [penaltyType, setPenaltyType] = useState<PenaltyType>('con_ventas');
  const [penaltyVentasEst, setPenaltyVentasEst] = useState(1500);
  const penaltyResult = useMemo(
    () => calculatePenaltyRisk(penaltyMeses, penaltyType, penaltyVentasEst),
    [penaltyMeses, penaltyType, penaltyVentasEst]
  );

  const [selectedRucDigit, setSelectedRucDigit] = useState(1);
  const deadlineInfo = useMemo(() => getRucDeadlineInfo(selectedRucDigit), [selectedRucDigit]);

  // Real current pricing (store/useAppStore.ts `serviceFees`, same fallbacks used by
  // screens/LandingPage.tsx's own service grid) — NOT the prototype's placeholder numbers.
  const services = useMemo(
    () => [
      {
        id: 'declaraciones',
        icon: FileSpreadsheet,
        color: '#00A896',
        tag: 'GESTIÓN FISCAL',
        price: serviceFees?.ivaMensual || 20,
        period: '/mes',
        title: 'Declaraciones SRI & Blindaje Mensual',
        desc: 'Presentación impecable de formularios 104 (IVA) y retenciones con validación matemática en casilleros 615/617.',
        bullets: ['Revisión de comprobantes electrónicos', 'Cálculo óptimo de crédito tributario', 'Sin riesgo de multas ni moras'],
      },
      {
        id: 'renta_rimpe',
        icon: Calculator,
        color: '#2B6AFF',
        tag: 'PLANIFICACIÓN',
        price: serviceFees?.rentaNP || 50,
        period: '/año',
        title: 'Declaración Renta anual & RIMPE',
        desc: 'Formulario 102/102A con cruce de retenciones para Negocio Popular, Emprendedor y régimen general.',
        bullets: ['Encuadre exacto en tabla SRI', 'Deducción de gastos personales', 'Certificado oficial de cumplimiento'],
      },
      {
        id: 'regularizacion_ruc',
        icon: ShieldAlert,
        color: '#C9A96E',
        tag: 'DEFENSA FISCAL',
        price: 60,
        period: 'base',
        title: 'Regularización de RUC & glosas',
        desc: 'Reactivación de RUC suspendido, declaraciones pendientes al día y solicitud de facilidades de pago.',
        bullets: ['Diagnóstico histórico sin costo', 'Eliminación de clausuras', 'Cálculo exacto de recargos mínimos'],
      },
      {
        id: 'devolucion_iva',
        icon: Heart,
        color: '#00A896',
        tag: 'GRUPOS PRIORITARIOS',
        price: serviceFees?.devolucionIva || 30,
        period: '/solicitud',
        title: 'Devolución de IVA tercera edad',
        desc: 'Recuperación mensual del IVA pagado en compras para personas de 65+ años y con discapacidad.',
        bullets: ['Solicitud digital ante el SRI', 'Seguimiento hasta acreditación', 'Atención humana y preferente'],
      },
      {
        id: 'firma_electronica',
        icon: FileKey,
        color: '#2B6AFF',
        tag: 'FIRMA ELECTRÓNICA',
        price: null,
        period: '24 h',
        title: 'Firma electrónica .P12 express',
        desc: 'Válida para facturación electrónica, Quipux y trámites legales. Proceso 100% digital, sin filas.',
        bullets: ['Cédula y papeleta vigentes', 'Emisión en menos de 24 horas', 'Instalación y respaldo incluidos'],
      },
      {
        id: 'facturacion_web',
        icon: Zap,
        color: '#00A896',
        tag: 'TECNOLOGÍA',
        price: 45,
        period: '/anual',
        title: 'Facturación electrónica & sistema web',
        desc: 'Software en la nube para emitir facturas, notas de crédito, retenciones y guías ilimitadas. Nueva Luz 3.0.',
        bullets: ['Envío automático de XML/PDF al cliente', 'Conexión directa SRI 2026', 'Compatible con celular y PC'],
      },
    ],
    [serviceFees]
  );

  // Belt-and-suspenders horizontal-scrollbar guard: applied to the real <body> (which already
  // scrolls vertically without issue) rather than to this component's own root wrapper — see the
  // note above the `.lujo-root` rule for why it can't live there.
  useEffect(() => {
    const prev = document.body.style.overflowX;
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = prev;
    };
  }, []);

  return (
    <div className="lujo-root" style={{ position: 'relative', background: '#020617', color: '#e2e8f0' }}>
      <style>{`
        /* NOTE: deliberately no \`overflow-x: hidden\` here — setting only overflow-x (and not
           overflow-y) on an ancestor forces overflow-y to compute as \`auto\` per the CSS spec,
           which turns this wrapper into a scroll container and breaks \`position: sticky\` for
           every act section below (they stop pinning and just scroll past like normal blocks).
           Horizontal overflow is instead contained per-section (each sticky act wrapper already
           has its own overflow:hidden), and as a last resort at the real <body> via a mount effect. */
        .lujo-root { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
        .lujo-root a { color: #00A896; text-decoration: none; }
        .lujo-root a:hover { color: #4edea3; }
        .lujo-root ::selection { background: rgba(0,168,150,0.32); color: #fff; }
        .lujo-root summary::-webkit-details-marker { display: none; }
        .lujo-root a:focus-visible, .lujo-root summary:focus-visible, .lujo-root details:focus-visible, .lujo-root button:focus-visible {
          outline: 2px solid #4edea3; outline-offset: 3px; border-radius: 10px;
        }
        @keyframes lujoPulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        @keyframes lujoDrift { 0% { transform: translateY(0) } 100% { transform: translateY(8px) } }
        @keyframes lujoShine { to { background-position: 200% center } }
        .lujo-card { transition: transform .45s cubic-bezier(.16,1,.3,1), border-color .45s, box-shadow .45s; }
        .lujo-card:hover { transform: translateY(-6px); border-color: rgba(0,168,150,0.4); box-shadow: 0 40px 80px -30px rgba(0,168,150,0.35); }
        .lujo-navlink[data-active="1"] { background: #00A896; color: #031310 !important; }
        .lujo-navlink:not([data-active="1"]):hover { background: rgba(255,255,255,0.08); color: #fff; }
        .lujo-docklink[data-active="1"] { color: #00A896 !important; background: rgba(0,168,150,0.12); }
        @media (prefers-reduced-motion: reduce) {
          .lujo-root * { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
        }
        /* Same reasoning as hiding this cue on narrow (<1040px) viewports, where the mobile dock
           already communicates "there's more below": on a short-but-wide desktop window there
           isn't vertical room for it next to the hero copy either, and (bug found in this pass)
           it could visually collide with the hero paragraph / CTA row. */
        @media (max-height: 700px) {
          .lujo-scrollcue { display: none !important; }
        }
        /* Bug found in this pass, pre-existing before any of this pass's other hero changes: on a
           short viewport (verified on real device sizes down to ~390x600, e.g. a phone with an
           on-screen keyboard or browser toolbar eating into the viewport) the hero's own vertical
           rhythm needs more room than is available above the fixed mobile dock / below the fixed
           header, so the CTA row could end up sitting underneath the dock at the initial,
           unscrolled position. Tightening the hero's margins and top/bottom padding at short
           heights reclaims exactly that room without touching spacing on any normal-height
           viewport (this query only matches when height, not width, is constrained). */
        @media (max-height: 700px) {
          /* padding-top must stay clear of the fixed header's own real height (~88px) — going
             below that (an earlier version of this fix tried 66px) hid the "PASAJE · EL ORO ·
             ECUADOR" badge partway behind the header itself, trading one overlap for another. */
          .lujo-hero { padding-top: 96px !important; padding-bottom: 78px !important; }
          .lujo-hero-title { margin-top: 12px !important; }
          .lujo-hero-desc { margin-top: 12px !important; }
          .lujo-hero-ctas { margin-top: 16px !important; }
        }
      `}</style>

      {/* ── HEADER: progress bar + desktop pill nav ─────────────────────── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px 0', pointerEvents: 'none' }}>
        <div style={{ width: '100%', maxWidth: 1160, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
          <div ref={progressRef} style={{ height: '100%', width: '0%', background: 'linear-gradient(90deg,#00A896,#2B6AFF 55%,#C9A96E)' }} />
        </div>
        <nav
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 1160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '10px 14px 10px 10px',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 999,
            background: 'rgba(5,20,36,0.72)',
            backdropFilter: 'blur(26px) saturate(180%)',
            boxShadow: '0 20px 60px -24px rgba(0,0,0,0.9)',
          }}
        >
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Volver al sitio principal"
                className="flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex-none"
              >
                <ArrowLeft size={15} className="text-slate-300" />
              </button>
            )}
            <a href="#top" className="flex items-center gap-2.5">
              <Logo className="w-9 h-9 flex-none" />
              <span className="flex flex-col leading-tight whitespace-nowrap">
                <span className="font-display font-extrabold text-[13px] tracking-tight text-white">SANTIAGO CÓRDOVA</span>
                <span className="hidden min-[900px]:block font-mono text-[9px] font-bold tracking-[0.22em] text-[#00A896] mt-0.5">SOLUCIONES TRIBUTARIAS PRO</span>
              </span>
            </a>
          </div>
          <div className="hidden min-[1040px]:flex items-center gap-1 p-1 rounded-full border border-white/[0.06] bg-black/25">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                ref={registerNav(link.href.slice(1))}
                data-active={activeId === link.href.slice(1) ? '1' : '0'}
                className="lujo-navlink px-3.5 py-1.5 rounded-full text-[12px] font-semibold text-slate-300 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex-none flex items-center gap-2">
            <button
              onClick={handleProtectedAccess}
              aria-label="Acceso administrativo"
              title="Panel Administrativo"
              className="hidden min-[480px]:flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/5 text-slate-500 hover:text-[#00A896] hover:border-[#00A896]/40 transition-colors flex-none"
            >
              <ShieldCheck size={15} />
            </button>
            <a
              href={wa('Hola Santiago Córdova, quiero agendar un diagnóstico tributario.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-[#00A896] text-[#031310] font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ boxShadow: '0 12px 30px -12px rgba(0,168,150,0.8)' }}
            >
              <MessageCircle size={14} />
              Diagnóstico
            </a>
          </div>
        </nav>
      </header>

      {/* ── BIOMETRIC OVERLAY (Admin Access) — equivalente al de screens/LandingPage.tsx ── */}
      {showBiometric && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in"
          role="status"
          aria-live="polite"
        >
          <div className="relative w-64 h-64 rounded-[26px] p-10 flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(5,20,36,0.92)', boxShadow: '0 40px 90px -30px rgba(0,168,150,0.35)' }}>
            <Fingerprint size={92} className="text-[#00A896] animate-pulse" />
          </div>
          <div className="mt-8 text-center">
            <div className="font-mono text-[10px] font-bold tracking-[0.5em] mb-2 animate-pulse" style={{ color: '#00A896' }}>AUTENTICACIÓN BIOMÉTRICA</div>
            <div className="font-display font-extrabold text-white text-2xl tracking-tight">CENTRO DE CONTROL TRIBUTARIO</div>
          </div>
        </div>
      )}

      {/* ── MOBILE DOCK (<1040px) ───────────────────────────────────────── */}
      <div
        className="min-[1040px]:hidden flex"
        style={{
          position: 'fixed',
          bottom: 14,
          left: 14,
          right: 14,
          zIndex: 92,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 999,
          background: 'rgba(5,20,36,0.94)',
          backdropFilter: 'blur(26px) saturate(180%)',
          boxShadow: '0 24px 60px -22px rgba(0,0,0,0.95)',
        }}
      >
        {[
          { href: '#top', icon: HomeIcon, label: 'INICIO' },
          { href: '#sistema', icon: Boxes, label: 'SISTEMA' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            ref={registerNav(item.href.slice(1))}
            data-active={activeId === item.href.slice(1) ? '1' : '0'}
            className="lujo-docklink flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full text-slate-400 font-mono text-[8.5px] font-bold tracking-[0.12em]"
            style={{ minHeight: 46 }}
          >
            <item.icon size={17} />
            {item.label}
          </a>
        ))}
        <a
          href={wa('Hola Santiago Córdova, quiero agendar un diagnóstico tributario.')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribir por WhatsApp"
          className="flex-none flex items-center justify-center rounded-full bg-[#00A896] text-[#031310]"
          style={{ width: 54, height: 54, marginTop: -22, border: '3px solid #051424', boxShadow: '0 0 26px -4px rgba(0,168,150,0.85)' }}
        >
          <MessageCircle size={22} />
        </a>
        {[
          { href: '#servicios', icon: LayoutGrid, label: 'SERVICIOS' },
          { href: '#faq', icon: HelpCircle, label: 'FAQ' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            ref={registerNav(item.href.slice(1))}
            data-active={activeId === item.href.slice(1) ? '1' : '0'}
            className="lujo-docklink flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full text-slate-400 font-mono text-[8.5px] font-bold tracking-[0.12em]"
            style={{ minHeight: 46 }}
          >
            <item.icon size={17} />
            {item.label}
          </a>
        ))}
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        id="top"
        className="lujo-hero relative overflow-hidden grid place-items-center pt-[104px] pb-[92px] min-[1040px]:pb-0"
        // Bug found in this pass: this used to be `minHeight: 'min(100vh, 620px)', height: '100vh'`
        // — an explicit `height` always wins over `min-height` when it's the larger value, and
        // `100vh` is >= `min(100vh, 620px)` by construction, so that `minHeight` never actually did
        // anything (true in the original prototype's identical markup too). The practical effect
        // only showed up on short-but-wide desktop windows (verified down to ~1366x560): the fixed
        // `height: 100vh` + `overflow: hidden` clipped the centered hero content instead of letting
        // it grow, which pushed the "Agendar diagnóstico" CTA button below the clipped box — not
        // just visually cut off, but genuinely unreachable, since scrolling the page can't reveal
        // content clipped inside a shorter in-flow box. `minHeight: '100vh'` with no explicit
        // `height` keeps the exact same full-bleed look on every normal viewport (content is always
        // far shorter than 100vh, so the box still floors at 100vh) and only grows taller than the
        // viewport — instead of clipping — on the rare short/cramped one.
        style={{ minHeight: '100vh' }}
      >
        <ActMedia
          webp={`${MEDIA}obsidian-crystal.webp`}
          poster={`${MEDIA}poster-obsidian-crystal.png`}
          eager
          imgRef={heroMediaRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.62, transform: 'scale(1.06)', willChange: 'transform' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(0,168,150,0.16), transparent 70%), linear-gradient(to bottom, rgba(2,6,23,0.82) 0%, rgba(2,6,23,0.42) 35%, rgba(2,6,23,0.94) 100%)',
          }}
        />
        <div className="relative z-[2] w-full max-w-[1100px] px-6 text-center">
          <Reveal index={0} className="inline-flex items-center gap-2.5 px-[15px] py-[7px] rounded-full" as="div">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 15px', borderRadius: 999, border: '1px solid rgba(201,169,110,0.42)', background: 'rgba(201,169,110,0.10)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#C9A96E', animation: 'lujoPulse 2.4s infinite' }} />
              <span className="font-mono text-[10px] font-bold tracking-[0.28em]" style={{ color: '#e6d3ab' }}>PASAJE · EL ORO · ECUADOR</span>
            </span>
          </Reveal>
          <Reveal index={1} as="h1" className="lujo-hero-title font-display font-extrabold text-white" style={{ margin: '26px 0 0', letterSpacing: '-0.035em', lineHeight: 1.02, fontSize: 'clamp(2.6rem,7.4vw,6.4rem)' }}>
            Ingeniería tributaria
            <br />
            <span
              style={{
                background: 'linear-gradient(100deg,#ffffff 0%,#00A896 45%,#C9A96E 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'lujoShine 9s linear infinite',
              }}
            >
              de precisión
            </span>
          </Reveal>
          <Reveal index={2} as="p" className="lujo-hero-desc font-light" style={{ margin: '26px auto 0', maxWidth: 620, fontSize: 'clamp(1rem,1.5vw,1.2rem)', lineHeight: 1.65, color: '#a9b6c9' }}>
            Contabilidad, declaraciones y blindaje fiscal para empresas y profesionales del Ecuador. Automatización algorítmica con revisión humana experta.
          </Reveal>
          <Reveal index={3} className="lujo-hero-ctas flex flex-wrap gap-3.5 justify-center" style={{ marginTop: 38 }}>
            <a
              href={wa('Hola Santiago Córdova, quiero agendar un diagnóstico tributario gratuito.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 h-14 px-7 rounded-2xl text-white font-mono text-xs font-bold uppercase tracking-[0.14em]"
              style={{ background: 'linear-gradient(135deg,#00A896,#028090)', boxShadow: '0 22px 50px -18px rgba(0,168,150,0.9)' }}
            >
              <MessageCircle size={17} />
              Agendar diagnóstico
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center gap-2.5 h-14 px-6 rounded-2xl text-slate-100 font-mono text-xs font-bold uppercase tracking-[0.14em]"
              style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)' }}
            >
              Ver servicios
            </a>
          </Reveal>
        </div>
        <div className="lujo-scrollcue hidden min-[1040px]:flex absolute bottom-[26px] left-1/2 -translate-x-1/2 z-[2] flex-col items-center gap-2.5">
          <span className="font-mono text-[9px] tracking-[0.34em] text-slate-500">SCROLL</span>
          <span style={{ width: 1, height: 46, background: 'linear-gradient(to bottom,#00A896,transparent)', animation: 'lujoDrift 2.2s ease-in-out infinite alternate' }} />
        </div>
      </section>

      {/* ── ACTO I · BLINDAJE ────────────────────────────────────────────── */}
      <section id="blindaje" ref={registerAct('blindaje')} className="relative" style={{ height: '300vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden grid place-items-center">
          <ActMedia
            webp={`${MEDIA}shield-circuit.webp`}
            poster={`${MEDIA}poster-shield-circuit.png`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: 0.5,
              transform: 'translate3d(calc(var(--p,0) * 5vw),0,0) scale(calc(1.26 - 0.18 * var(--p,0)))',
              clipPath: 'polygon(0 0, calc(34% + var(--p,0) * 76%) 0, calc(8% + var(--p,0) * 100%) 100%, 0 100%)',
              willChange: 'transform, clip-path',
            }}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 62% 50%, rgba(0,168,150,0.20), transparent 68%), linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.72) 48%, rgba(2,6,23,0.35) 100%)' }} />
          <span
            className="absolute inset-0 grid place-items-center font-display font-extrabold pointer-events-none select-none"
            style={{ fontSize: 'clamp(9rem,26vw,22rem)', color: 'rgba(255,255,255,0.035)', transform: 'translateY(calc((0.5 - var(--p,0)) * 70px))' }}
          >
            01
          </span>
          <div
            className="relative z-[2] w-full max-w-[1160px] px-6"
            style={{ boxSizing: 'border-box', opacity: 'calc(0.12 + 0.88 * var(--q,1))', transform: 'translate3d(calc((var(--p,0) - 0.5) * -90px), calc((0.5 - var(--p,0)) * -46px), 0)' }}
          >
            <div style={{ maxWidth: 620 }}>
              <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#00A896' }}>ACTO I — CIFRADO DE DATOS</span>
              <h2 className="font-display font-extrabold text-white" style={{ margin: '20px 0 0', letterSpacing: '-0.03em', lineHeight: 1.03, fontSize: 'clamp(2.1rem,5.2vw,4.4rem)' }}>
                Blindaje total de tu información fiscal
              </h2>
              <p className="font-light" style={{ margin: '22px 0 0', maxWidth: 520, fontSize: 'clamp(0.98rem,1.4vw,1.15rem)', lineHeight: 1.7, color: '#aebbcd' }}>
                Tu información contable y tributaria protegida con cifrado de nivel bancario y accesos auditados. Cero errores en los casilleros 615 y 617, cero notificaciones que nadie quiere recibir.
              </p>
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginTop: 34, maxWidth: 560 }}>
                {[
                  { k: 'CASILLEROS', v: '615 / 617 verificados' },
                  { k: 'ACCESOS', v: 'Bóveda de claves SRI' },
                ].map((item) => (
                  <div key={item.k} className="rounded-2xl" style={{ padding: '16px 18px', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px)' }}>
                    <div className="font-mono text-[10px] tracking-[0.18em]" style={{ color: '#00A896' }}>{item.k}</div>
                    <div className="font-display font-bold text-white text-[15px]" style={{ marginTop: 7 }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SISTEMA (3D crystal, fixed while steps scroll behind) ──────────── */}
      <section id="sistema" ref={registerNav('sistema')} className="relative px-6" style={{ padding: 'clamp(80px,12vh,150px) 24px', overflow: 'clip' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 40%, rgba(43,106,255,0.12), transparent 70%)' }} />
        <div className="relative max-w-[1160px] mx-auto grid items-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,340px), 1fr))', gap: 'clamp(32px,5vw,70px)' }}>
          <div>
            <Reveal index={0} as="span" className="inline-block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#C9A96E' }}>
              EL SISTEMA — NUEVA LUZ 3.0
            </Reveal>
            <Reveal index={1} as="h2" className="font-display font-extrabold text-white" style={{ margin: '20px 0 0', letterSpacing: '-0.03em', lineHeight: 1.05, fontSize: 'clamp(2rem,4.4vw,3.6rem)' }}>
              Un motor propio detrás de cada declaración
            </Reveal>
            <Reveal index={2} as="p" className="font-light" style={{ margin: '22px 0 0', fontSize: 'clamp(0.98rem,1.4vw,1.12rem)', lineHeight: 1.7, color: '#aebbcd' }}>
              Nueva Luz 3.0 sincroniza tus comprobantes electrónicos, calcula el formulario contra las reglas del SRI 2026 y deja el respaldo listo antes del vencimiento. La máquina propone; el criterio profesional decide.
            </Reveal>
            <Reveal index={3} className="grid gap-3" style={{ marginTop: 32 }}>
              <div className="grid gap-3">
                {[
                  { n: '01', c: '#00A896', t: 'Sincronización de comprobantes', d: 'Descarga y clasificación de documentos electrónicos recibidos y emitidos.' },
                  { n: '02', c: '#2B6AFF', t: 'Cálculo contra reglas SRI 2026', d: 'Encuadre exacto de régimen, retenciones e IVA, sin redondeos improvisados.' },
                  { n: '03', c: '#C9A96E', t: 'Respaldo y aviso al cliente', d: 'Comprobante archivado y notificación directa por WhatsApp cuando queda presentado.' },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3.5 items-start rounded-2xl" style={{ padding: '16px 18px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
                    <span className="flex-none font-mono text-[11px] font-bold" style={{ color: step.c, marginTop: 2 }}>{step.n}</span>
                    <div>
                      <div className="font-display font-bold text-white text-[15px]">{step.t}</div>
                      <div className="font-light text-[13.5px]" style={{ marginTop: 5, lineHeight: 1.6, color: '#9fadc0' }}>{step.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <div className="relative grid place-items-center" style={{ position: 'sticky', top: 'calc(50vh - min(26vh,280px))', alignSelf: 'start', minHeight: 'clamp(340px,52vh,560px)' }}>
            <div className="absolute" style={{ inset: '8%', borderRadius: 999, background: 'radial-gradient(circle, rgba(0,168,150,0.16), transparent 68%)', filter: 'blur(28px)' }} />
            <Crystal3D className="relative w-full" />
          </div>
        </div>
      </section>

      {/* ── HERRAMIENTAS (calculadoras fiscales interactivas) ───────────────
          Mismos motores que screens/LandingPage.tsx (utils/sriCalculators.ts
          + utils/taxTools.ts), reempaquetados como tarjetas que abren un
          panel modal en vez de un formulario largo en la página. */}
      <section id="herramientas" ref={registerNav('herramientas')} className="relative px-6" style={{ padding: 'clamp(80px,12vh,150px) 24px', background: '#020617' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(0,168,150,0.10), transparent 70%)' }} />
        <div className="relative max-w-[1160px] mx-auto">
          <Reveal index={0} as="span" className="inline-block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#2B6AFF' }}>
            HERRAMIENTAS
          </Reveal>
          <Reveal index={1} as="h2" className="font-display font-extrabold text-white" style={{ margin: '18px 0 0', maxWidth: 760, letterSpacing: '-0.03em', lineHeight: 1.05, fontSize: 'clamp(2rem,4.4vw,3.4rem)' }}>
            Calcula tu caso antes de escribirnos
          </Reveal>
          <Reveal index={2} as="p" className="font-light" style={{ margin: '18px 0 0', maxWidth: 640, fontSize: 'clamp(0.95rem,1.3vw,1.05rem)', lineHeight: 1.7, color: '#aebbcd' }}>
            Las mismas herramientas que usamos internamente para tus declaraciones, disponibles aquí: validación de RUC/cédula, simulación de régimen, riesgo por atraso y calendario de vencimiento.
          </Reveal>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,250px), 1fr))', marginTop: 40 }}>
            {(
              [
                { id: 'ruc', icon: Search, color: '#00A896', tag: 'VALIDACIÓN SRI', title: 'Validar RUC o cédula', desc: 'Módulo 10/11, provincia y tipo de contribuyente en segundos.' },
                { id: 'simulador', icon: Calculator, color: '#2B6AFF', tag: 'RIMPE 2026', title: 'Simular tu declaración', desc: 'Encuadre de régimen e impuesto estimado según tus ingresos.' },
                { id: 'multas', icon: ShieldAlert, color: '#C9A96E', tag: 'ATRASOS', title: 'Calcular multas', desc: 'Riesgo estimado por meses sin declarar, con o sin ventas.' },
                { id: 'calendario', icon: Calendar, color: '#00A896', tag: 'CALENDARIO SRI', title: 'Fecha límite por RUC', desc: 'Tu día exacto de vencimiento según el 9no dígito.' },
              ] as const
            ).map((tool, i) => (
              <Reveal key={tool.id} index={i}>
                <button
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className="lujo-card flex flex-col text-left w-full h-full rounded-[22px]"
                  style={{ padding: 26, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.025)' }}
                >
                  <span
                    className="grid place-items-center rounded-2xl"
                    style={{ width: 44, height: 44, marginBottom: 20, border: `1px solid ${tool.color}55`, background: `${tool.color}1a`, color: tool.color }}
                  >
                    <tool.icon size={21} strokeWidth={1.7} />
                  </span>
                  <span className="font-mono text-[9.5px] tracking-[0.2em]" style={{ color: tool.color }}>{tool.tag}</span>
                  <h3 className="font-display font-bold text-white text-[17px]" style={{ margin: '14px 0 0', lineHeight: 1.25 }}>{tool.title}</h3>
                  <p className="font-light flex-1 text-[13px]" style={{ margin: '10px 0 0', lineHeight: 1.6, color: '#9fadc0' }}>{tool.desc}</p>
                  <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ marginTop: 16, color: tool.color }}>
                    Abrir herramienta <ArrowRight size={13} />
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {activeTool === 'ruc' && (
        <ToolModal title="Validar RUC o cédula" tag="VALIDACIÓN SRI · MÓDULO 10/11" color="#00A896" onClose={() => setActiveTool(null)}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={13}
            value={rucInput}
            onChange={(e) => setRucInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 0703303632 o 0703303632001"
            className="w-full rounded-2xl font-mono text-sm tracking-wider outline-none text-white"
            style={{ padding: '14px 16px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)' }}
          />
          <div style={{ marginTop: 16 }}>
            {rucInput.trim() === '' && (
              <p className="font-light text-[13px]" style={{ color: '#7d8ca1' }}>Ingresa tu número de cédula (10 dígitos) o RUC (13 dígitos).</p>
            )}
            {rucInput.trim() !== '' && rucInfo?.valid && (
              <div className="rounded-2xl" style={{ padding: '16px 18px', border: '1px solid rgba(0,168,150,0.3)', background: 'rgba(0,168,150,0.08)' }}>
                <div className="font-display font-bold text-[14px]" style={{ color: '#4edea3' }}>✓ Identificación válida · {rucInfo.typeLabel}</div>
                <div className="font-mono text-[11px] tracking-[0.12em]" style={{ marginTop: 8, color: '#C9A96E' }}>📍 PROVINCIA: {rucInfo.province?.toUpperCase()}</div>
                <p className="font-light text-[12.5px]" style={{ marginTop: 8, lineHeight: 1.6, color: '#c3d0dd' }}>{rucInfo.details}</p>
              </div>
            )}
            {rucInput.trim().length >= 10 && rucInfo && !rucInfo.valid && (
              <div className="rounded-2xl" style={{ padding: '16px 18px', border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.08)' }}>
                <div className="font-display font-bold text-[14px]" style={{ color: '#fb7185' }}>✗ Identificación no válida</div>
                <p className="font-light text-[12.5px]" style={{ marginTop: 8, lineHeight: 1.6, color: '#c3d0dd' }}>
                  El número no supera el algoritmo de validación del SRI (módulos 10/11) o no tiene el formato ecuatoriano válido.
                </p>
              </div>
            )}
          </div>
          <a
            href={wa(`Hola Santiago Córdova, valide mi identificación (${rucInput}) y quiero confirmar mi situación tributaria.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-full"
            style={{ marginTop: 20, height: 48, background: '#00A896', color: '#031310' }}
          >
            <MessageCircle size={15} />
            Consultar por WhatsApp
          </a>
        </ToolModal>
      )}

      {activeTool === 'simulador' && (
        <ToolModal title="Simular tu declaración" tag="RIMPE 2026 · RÉGIMEN GENERAL" color="#2B6AFF" onClose={() => setActiveTool(null)}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(
              [
                { id: 'comercial', label: 'Comercial / RIMPE' },
                { id: 'profesional', label: 'Profesional' },
                { id: 'discapacidad_3ra_edad', label: '3ra Edad / Discapacidad' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSimActividad(opt.id)}
                className="rounded-xl font-mono text-[9.5px] font-bold uppercase tracking-wide leading-tight"
                style={
                  simActividad === opt.id
                    ? { padding: '10px 6px', background: '#2B6AFF', color: '#fff' }
                    : { padding: '10px 6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#9fadc0' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          {simActividad !== 'discapacidad_3ra_edad' && (
            <div style={{ marginTop: 20 }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.16em]" style={{ color: '#7d8ca1' }}>INGRESOS ANUALES ESTIMADOS</span>
                <span className="font-mono text-[15px] font-bold" style={{ color: '#00A896' }}>${simIngresos.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={0}
                max={320000}
                step={500}
                value={simIngresos}
                onChange={(e) => setSimIngresos(Number(e.target.value))}
                className="w-full mt-3"
                style={{ accentColor: '#00A896' }}
              />
            </div>
          )}
          <div className="rounded-2xl" style={{ marginTop: 22, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="font-mono text-[10px] tracking-[0.14em]" style={{ color: '#C9A96E' }}>{taxDetails.regimen.toUpperCase()}</div>
            <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
              <span className="font-light text-[13px]" style={{ color: '#9fadc0' }}>Impuesto estimado anual</span>
              <span className="font-mono font-bold text-[16px]" style={{ color: '#00A896' }}>${taxDetails.impuestoEstimadoAnual.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
              <span className="font-light text-[13px]" style={{ color: '#9fadc0' }}>Ahorro estimado con nosotros</span>
              <span className="font-mono font-bold text-[16px]" style={{ color: '#C9A96E' }}>${taxDetails.ahorroEstimado.toLocaleString()}</span>
            </div>
            <p className="font-light text-[12px]" style={{ marginTop: 12, lineHeight: 1.6, color: '#8b99ac' }}>{taxDetails.formularios}</p>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="font-display font-bold text-white text-[15px]">{taxDetails.planTitle}</div>
            <div className="font-mono font-extrabold text-[20px]" style={{ color: '#00A896' }}>${taxDetails.price} USD</div>
          </div>
          <a
            href={wa(`Hola Santiago Córdova, he realizado la simulación para ingresos de $${simIngresos.toLocaleString()} USD (${taxDetails.regimen}). Quisiera agendar el plan ${taxDetails.planTitle}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-full"
            style={{ marginTop: 18, height: 48, background: '#00A896', color: '#031310' }}
          >
            <MessageCircle size={15} />
            Agendar este plan
          </a>
        </ToolModal>
      )}

      {activeTool === 'multas' && (
        <ToolModal title="Calcular multas por atraso" tag="RIESGO ESTIMADO SRI" color="#C9A96E" onClose={() => setActiveTool(null)}>
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.16em]" style={{ color: '#7d8ca1' }}>MESES SIN DECLARAR</span>
              <span className="font-mono text-[15px] font-bold text-white">{penaltyMeses} {penaltyMeses === 1 ? 'mes' : 'meses'}</span>
            </div>
            <input
              type="range"
              min={1}
              max={36}
              step={1}
              value={penaltyMeses}
              onChange={(e) => setPenaltyMeses(Number(e.target.value))}
              className="w-full mt-3"
              style={{ accentColor: '#C9A96E' }}
            />
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setPenaltyType('sin_ventas')}
              className="rounded-xl font-mono text-[10px] font-bold uppercase tracking-wide"
              style={
                penaltyType === 'sin_ventas'
                  ? { padding: '10px 6px', background: '#C9A96E', color: '#1a1508' }
                  : { padding: '10px 6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#9fadc0' }
              }
            >
              Sin ventas
            </button>
            <button
              type="button"
              onClick={() => setPenaltyType('con_ventas')}
              className="rounded-xl font-mono text-[10px] font-bold uppercase tracking-wide"
              style={
                penaltyType === 'con_ventas'
                  ? { padding: '10px 6px', background: '#C9A96E', color: '#1a1508' }
                  : { padding: '10px 6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#9fadc0' }
              }
            >
              Con ventas
            </button>
          </div>
          {penaltyType === 'con_ventas' && (
            <div style={{ marginTop: 18 }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.16em]" style={{ color: '#7d8ca1' }}>VENTAS MENSUALES ESTIMADAS</span>
                <span className="font-mono text-[15px] font-bold text-white">${penaltyVentasEst.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20000}
                step={100}
                value={penaltyVentasEst}
                onChange={(e) => setPenaltyVentasEst(Number(e.target.value))}
                className="w-full mt-3"
                style={{ accentColor: '#C9A96E' }}
              />
            </div>
          )}
          <div className="rounded-2xl" style={{ marginTop: 22, padding: '18px 20px', border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.08)' }}>
            <div className="flex items-center justify-between">
              <span className="font-light text-[13px]" style={{ color: '#e6d3ab' }}>Riesgo total estimado</span>
              <span className="font-mono font-extrabold text-[20px]" style={{ color: '#C9A96E' }}>${penaltyResult.totalRiesgo.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              <span className="font-light text-[12px]" style={{ color: '#9fadc0' }}>Multa base + interés</span>
              <span className="font-mono text-[12px]" style={{ color: '#9fadc0' }}>${penaltyResult.multaBase} + ${penaltyResult.interes}</span>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
              <span className="font-light text-[12px]" style={{ color: '#9fadc0' }}>Ahorro gestionando con nosotros</span>
              <span className="font-mono font-bold text-[13px]" style={{ color: '#4edea3' }}>${penaltyResult.ahorroConNosotros.toLocaleString()}</span>
            </div>
          </div>
          <a
            href={wa(`Hola Santiago Córdova, tengo ${penaltyMeses} meses sin declarar en el SRI y necesito regularizar mi RUC de forma urgente.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-full"
            style={{ marginTop: 18, height: 48, background: '#C9A96E', color: '#1a1508' }}
          >
            <MessageCircle size={15} />
            Regularizar ahora
          </a>
        </ToolModal>
      )}

      {activeTool === 'calendario' && (
        <ToolModal title="Tu fecha límite en el SRI" tag="CALENDARIO POR 9NO DÍGITO" color="#00A896" onClose={() => setActiveTool(null)}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {Array.from({ length: 10 }, (_, digit) => digit).map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => setSelectedRucDigit(digit)}
                className="rounded-xl font-mono text-[13px] font-bold aspect-square flex items-center justify-center"
                style={
                  selectedRucDigit === digit
                    ? { background: '#00A896', color: '#031310' }
                    : { border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#9fadc0' }
                }
              >
                {digit}
              </button>
            ))}
          </div>
          <div className="rounded-2xl" style={{ marginTop: 20, padding: '18px 20px', border: '1px solid rgba(0,168,150,0.3)', background: 'rgba(0,168,150,0.08)' }}>
            <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: '#7d8ca1' }}>9NO DÍGITO {selectedRucDigit}</div>
            <div className="font-display font-extrabold text-white" style={{ marginTop: 6, fontSize: 'clamp(1.2rem,3vw,1.5rem)' }}>{deadlineInfo.label}</div>
            {deadlineInfo.isImminent ? (
              <div className="font-mono text-[12px] font-bold" style={{ marginTop: 8, color: '#fb7185' }}>⚠ Faltan {deadlineInfo.daysLeft} días. ¡Es inminente!</div>
            ) : (
              <div className="font-light text-[13px]" style={{ marginTop: 8, color: '#c3d0dd' }}>Faltan aproximadamente {deadlineInfo.daysLeft} días para tu vencimiento.</div>
            )}
          </div>
          <a
            href={wa(`Hola Santiago Córdova, mi RUC termina en dígito ${selectedRucDigit} (vence el ${deadlineInfo.label}) y deseo asegurar mi declaración a tiempo.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-full"
            style={{ marginTop: 20, height: 48, background: '#00A896', color: '#031310' }}
          >
            <MessageCircle size={15} />
            Asegurar mi declaración
          </a>
        </ToolModal>
      )}

      {/* ── ACTO II · RESULTADOS ─────────────────────────────────────────── */}
      <section id="resultados" ref={registerAct('resultados')} className="relative" style={{ height: '300vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden grid place-items-center">
          <ActMedia
            webp={`${MEDIA}financial-bars.webp`}
            poster={`${MEDIA}poster-financial-bars.png`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.46, transform: 'translate3d(calc(var(--p,0) * -6vw),0,0) scale(calc(1.1 + 0.16 * var(--p,0)))', willChange: 'transform' }}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 38% 50%, rgba(43,106,255,0.18), transparent 68%), linear-gradient(to left, rgba(2,6,23,0.94) 0%, rgba(2,6,23,0.7) 50%, rgba(2,6,23,0.4) 100%)' }} />
          <span
            className="absolute inset-0 grid place-items-center font-display font-extrabold pointer-events-none select-none"
            style={{ fontSize: 'clamp(9rem,26vw,22rem)', color: 'rgba(255,255,255,0.035)', transform: 'translateY(calc((0.5 - var(--p,0)) * 70px))' }}
          >
            02
          </span>
          <div
            className="relative z-[2] w-full max-w-[1160px] px-6 flex justify-end"
            style={{ boxSizing: 'border-box', opacity: 'calc(0.12 + 0.88 * var(--q,1))', transform: 'translate3d(calc((var(--p,0) - 0.5) * 90px), calc((0.5 - var(--p,0)) * -46px), 0)' }}
          >
            <div style={{ maxWidth: 620, textAlign: 'left' }}>
              <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#2B6AFF' }}>ACTO II — RESULTADOS MEDIBLES</span>
              <h2 className="font-display font-extrabold text-white" style={{ margin: '20px 0 0', letterSpacing: '-0.03em', lineHeight: 1.03, fontSize: 'clamp(2.1rem,5.2vw,4.4rem)' }}>
                Pagar lo correcto, ni un centavo de más
              </h2>
              <p className="font-light" style={{ margin: '22px 0 0', fontSize: 'clamp(0.98rem,1.4vw,1.15rem)', lineHeight: 1.7, color: '#aebbcd' }}>
                RIMPE, IVA y Renta optimizados con criterio técnico: recuperación de retenciones a favor, deducción correcta de gastos personales y facilidades de pago cuando el historial lo exige.
              </p>
              <div className="flex flex-wrap gap-[26px]" style={{ marginTop: 34 }}>
                <div>
                  <div className="font-mono font-bold text-white" style={{ fontSize: 'clamp(1.8rem,3.4vw,2.6rem)' }}><CountUp to={10} suffix="+" /></div>
                  <div className="font-mono text-[10px] tracking-[0.2em]" style={{ marginTop: 4, color: '#7d8ca1' }}>AÑOS DE EXPERIENCIA</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                <div>
                  <div className="font-mono font-bold text-white" style={{ fontSize: 'clamp(1.8rem,3.4vw,2.6rem)' }}><CountUp to={500} suffix="+" /></div>
                  <div className="font-mono text-[10px] tracking-[0.2em]" style={{ marginTop: 4, color: '#7d8ca1' }}>EMPRESAS Y PROFESIONALES</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                <div>
                  <div className="font-mono font-bold text-white" style={{ fontSize: 'clamp(1.8rem,3.4vw,2.6rem)' }}>24h</div>
                  <div className="font-mono text-[10px] tracking-[0.2em]" style={{ marginTop: 4, color: '#7d8ca1' }}>FIRMA ELECTRÓNICA .P12</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACTO III · COBERTURA ─────────────────────────────────────────── */}
      <section id="cobertura" ref={registerAct('cobertura')} className="relative" style={{ height: '320vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden grid place-items-center">
          <ActMedia
            webp={`${MEDIA}ecuador-map.webp`}
            poster={`${MEDIA}poster-ecuador-map.png`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.52, transform: 'scale(calc(1.18 - 0.14 * var(--p,0)))', willChange: 'transform' }}
          />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,168,150,0.14), transparent 72%), linear-gradient(to bottom, rgba(2,6,23,0.9) 0%, rgba(2,6,23,0.55) 45%, rgba(2,6,23,0.92) 100%)' }} />
          <div
            className="relative z-[2] w-full max-w-[1160px] px-6 text-center"
            style={{ boxSizing: 'border-box', opacity: 'calc(0.12 + 0.88 * var(--q,1))', transform: 'translateY(calc((0.5 - var(--p,0)) * -46px)) scale(calc(0.94 + var(--p,0) * 0.11))' }}
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#00A896' }}>ACTO III — COBERTURA NACIONAL</span>
            <h2
              className="font-display font-extrabold text-white mx-auto flex flex-wrap justify-center"
              style={{ margin: '20px auto 0', maxWidth: 900, letterSpacing: '-0.03em', lineHeight: 1.04, fontSize: 'clamp(2.1rem,5vw,4.2rem)', gap: '0 0.35em' }}
            >
              <span style={{ transform: 'translateX(min(0px, calc((var(--p,0) - 0.5) * 150px)))' }}>Base en Pasaje,</span>
              <span style={{ transform: 'translateX(max(0px, calc((0.5 - var(--p,0)) * 150px)))' }}>alcance en todo el Ecuador</span>
            </h2>
            <div className="grid text-left mx-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,220px), 1fr))', gap: 12, maxWidth: 940, marginTop: 38 }}>
              {REGIONS.map((r) => (
                <div key={r.name} className="rounded-[18px]" style={{ padding: 18, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(5,20,36,0.55)', backdropFilter: 'blur(16px)' }}>
                  <div className="font-mono text-[9.5px] tracking-[0.2em]" style={{ color: r.tag.startsWith('EL ORO') ? '#00A896' : '#C9A96E' }}>{r.tag}</div>
                  <div className="font-display font-bold text-white text-[17px]" style={{ marginTop: 8 }}>{r.name}</div>
                  <div className="font-light text-[13px]" style={{ marginTop: 6, lineHeight: 1.55, color: '#9fadc0' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ACTO IV · RAÍCES (AGRO) ──────────────────────────────────────── */}
      <section id="raices" ref={registerAct('raices')} className="relative" style={{ height: '300vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden grid place-items-center">
          <ActMedia
            webp={`${MEDIA}cacao-fields.webp`}
            poster={`${MEDIA}poster-cacao-fields.png`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.58, transform: 'translate3d(calc(var(--p,0) * -4vw),calc(var(--p,0) * 3vh),0) scale(calc(1.26 - 0.16 * var(--p,0)))', willChange: 'transform' }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.96) 0%, rgba(2,6,23,0.5) 45%, rgba(2,6,23,0.8) 100%)' }} />
          <span
            className="absolute inset-0 grid place-items-center font-display font-extrabold pointer-events-none select-none"
            style={{ fontSize: 'clamp(9rem,26vw,22rem)', color: 'rgba(255,255,255,0.035)', transform: 'translateY(calc((0.5 - var(--p,0)) * 70px))' }}
          >
            04
          </span>
          <div
            className="relative z-[2] w-full max-w-[1160px] px-6"
            style={{ boxSizing: 'border-box', opacity: 'calc(0.12 + 0.88 * var(--q,1))', transform: 'translate3d(calc((var(--p,0) - 0.5) * -70px), calc((0.5 - var(--p,0)) * -50px), 0)' }}
          >
            <div style={{ maxWidth: 640 }}>
              <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#C9A96E' }}>ACTO IV — RAÍCES PRODUCTIVAS</span>
              <h2 className="font-display font-extrabold text-white" style={{ margin: '20px 0 0', letterSpacing: '-0.03em', lineHeight: 1.03, fontSize: 'clamp(2.1rem,5.2vw,4.4rem)' }}>
                El Oro es agro, y el agro tiene su propia contabilidad
              </h2>
              <p className="font-light" style={{ margin: '22px 0 0', maxWidth: 540, fontSize: 'clamp(0.98rem,1.4vw,1.15rem)', lineHeight: 1.7, color: '#c4cddb' }}>
                Banano, cacao, camarón y comercio mayorista: producción, exportación y retenciones tratadas con las reglas que realmente les aplican. Contabilidad que entiende el ciclo del campo.
              </p>
              <div className="flex flex-wrap gap-2.5" style={{ marginTop: 30 }}>
                {AGRO_TAGS.map((tag, i) => (
                  <span
                    key={tag}
                    className="font-mono text-[10.5px] tracking-[0.14em] rounded-full"
                    style={
                      i === 0
                        ? { padding: '9px 15px', border: '1px solid rgba(201,169,110,0.35)', background: 'rgba(201,169,110,0.10)', color: '#e6d3ab' }
                        : { padding: '9px 15px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }
                    }
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RECORRIDO LATERAL (horizontal gallery act) ──────────────────── */}
      <section id="galeria" ref={registerAct('galeria')} className="relative" style={{ height: '420vh' }}>
        <div
          className="sticky top-0 h-screen overflow-hidden grid"
          style={{ background: '#020617', gridTemplateRows: 'auto minmax(0,1fr) auto', paddingTop: 'clamp(74px,12vh,120px)', paddingBottom: 'clamp(20px,4vh,44px)', boxSizing: 'border-box' }}
        >
          <div className="relative z-[3] flex justify-between items-end gap-5 pointer-events-none" style={{ padding: '0 clamp(20px,5vw,72px) clamp(16px,3vh,32px)' }}>
            <div>
              <span className="block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#C9A96E' }}>RECORRIDO LATERAL</span>
              <h2 className="font-display font-extrabold text-white" style={{ margin: '14px 0 0', letterSpacing: '-0.03em', lineHeight: 1.02, fontSize: 'clamp(1.7rem,3.6vw,3rem)' }}>
                Cuatro frentes, un solo criterio
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.26em] text-slate-500 whitespace-nowrap">SIGUE BAJANDO →</span>
          </div>
          <div className="relative flex items-center overflow-hidden" style={{ minHeight: 0 }}>
            {/* Explicit height:100% here (the prototype's markup omits it and relies on the
                flex parent stretching the item, which browsers resolve inconsistently when the
                parent uses `align-items:center` instead of the default `stretch` — verified via
                Playwright that without this, the panels below collapse to zero height). */}
            <div className="flex h-full" style={{ gap: '2vw', padding: '0 clamp(20px,5vw,72px)', willChange: 'transform', transform: 'translate3d(calc(var(--p,0) * -232vw),0,0)' }}>
              {GALLERY_PANELS.map((panel) => (
                <article
                  key={panel.title}
                  className="relative flex-none rounded-[26px] overflow-hidden"
                  style={{ width: '78vw', maxWidth: 1100, height: '100%', maxHeight: 'min(64vh,620px)', border: `1px solid ${panel.border}` }}
                >
                  <img src={`${MEDIA}${panel.poster}`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: panel.posterOpacity }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.94) 0%, rgba(2,6,23,0.25) 60%)' }} />
                  <div className="absolute left-0 right-0 bottom-0" style={{ padding: 'clamp(24px,3.4vw,44px)' }}>
                    <span className="font-mono text-[10px] tracking-[0.24em]" style={{ color: panel.color }}>{panel.tag}</span>
                    <h3 className="font-display font-extrabold text-white" style={{ margin: '12px 0 0', letterSpacing: '-0.025em', fontSize: 'clamp(1.5rem,3.2vw,2.6rem)' }}>{panel.title}</h3>
                    <p className="font-light" style={{ margin: '12px 0 0', maxWidth: 520, fontSize: 'clamp(0.92rem,1.2vw,1.05rem)', lineHeight: 1.65, color: '#cdd7e3' }}>{panel.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="relative z-[3] rounded-full overflow-hidden" style={{ margin: 'clamp(16px,3vh,32px) clamp(20px,5vw,72px) 0', height: 2, background: 'rgba(255,255,255,0.10)' }}>
            <div style={{ height: '100%', width: 'calc(var(--p,0) * 100%)', background: 'linear-gradient(90deg,#00A896,#C9A96E)' }} />
          </div>
        </div>
      </section>

      {/* ── INTERLUDIO CLARO · CRITERIO ──────────────────────────────────── */}
      <section id="criterio" ref={registerAct('criterio')} className="relative" style={{ height: '200vh', background: '#f2ece0' }}>
        <div className="sticky top-0 h-screen overflow-hidden grid place-items-center" style={{ background: '#f2ece0' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 70% 40%, rgba(201,169,110,0.30), transparent 68%)' }} />
          <div className="absolute top-0 left-0 right-0" style={{ height: 120, background: 'linear-gradient(to bottom, rgba(2,6,23,0.22), transparent)' }} />
          <div
            className="relative z-[2] w-full max-w-[1160px] px-6 grid items-center"
            style={{ boxSizing: 'border-box', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px), 1fr))', gap: 'clamp(28px,5vw,64px)' }}
          >
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#8a6b22' }}>INTERLUDIO — CRITERIO HUMANO</span>
              <h2 className="font-display font-extrabold" style={{ margin: '20px 0 0', letterSpacing: '-0.032em', lineHeight: 1.04, fontSize: 'clamp(2rem,4.6vw,3.6rem)', color: '#14110b' }}>
                La máquina calcula. La decisión sigue siendo profesional.
              </h2>
              <p style={{ margin: '22px 0 0', maxWidth: 520, fontSize: 'clamp(1rem,1.4vw,1.15rem)', lineHeight: 1.7, color: '#4a4335' }}>
                Ningún sistema firma por ti. Cada declaración se revisa con nombre y apellido antes de presentarse, y si algo no cuadra con tu realidad, se conversa antes del envío.
              </p>
              <div className="flex flex-wrap gap-6" style={{ marginTop: 32 }}>
                {[
                  { t: 'Revisión firmada', d: 'Un responsable identificable detrás de cada formulario.' },
                  { t: 'Respuesta directa', d: 'Sin call center: hablas con quien lleva tu contabilidad.' },
                ].map((item) => (
                  <div key={item.t} style={{ maxWidth: 220 }}>
                    <div className="font-display font-extrabold text-[16px]" style={{ color: '#14110b' }}>{item.t}</div>
                    <div className="text-[13.5px]" style={{ marginTop: 6, lineHeight: 1.6, color: '#5c5442' }}>{item.d}</div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="relative mx-auto rounded-full overflow-hidden"
              style={{
                aspectRatio: '1 / 1',
                maxWidth: 'min(78vw, 460px)',
                width: '100%',
                border: '1px solid rgba(20,17,11,0.12)',
                boxShadow: '0 40px 90px -40px rgba(20,17,11,0.45)',
                transform: 'translateY(calc((0.5 - var(--p,0)) * 70px)) rotate(calc(var(--p,0) * 6deg))',
              }}
            >
              <img
                src={`${MEDIA}poster-obsidian-crystal.png`}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.92, transform: 'scale(calc(1.08 + var(--p,0) * 0.12))' }}
              />
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(242,236,224,0.55) 100%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────────────────── */}
      <section id="servicios" ref={registerNav('servicios')} className="relative px-6" style={{ padding: 'clamp(80px,12vh,150px) 24px', background: 'linear-gradient(to bottom,#020617,#050a1b)' }}>
        <div className="absolute top-0 left-0 right-0" style={{ height: 'clamp(60px,10vh,140px)', background: 'linear-gradient(to bottom,#f2ece0,rgba(2,6,23,0))' }} />
        <div className="relative max-w-[1160px] mx-auto">
          <Reveal index={0} as="span" className="inline-block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#00A896' }}>
            SERVICIOS
          </Reveal>
          <Reveal index={1} as="h2" className="font-display font-extrabold text-white" style={{ margin: '18px 0 0', maxWidth: 760, letterSpacing: '-0.03em', lineHeight: 1.05, fontSize: 'clamp(2rem,4.4vw,3.4rem)' }}>
            Lo que resolvemos, con tarifa clara
          </Reveal>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px), 1fr))', marginTop: 44 }}>
            {services.map((service, i) => (
              <Reveal key={service.id} index={i} className="lujo-card flex flex-col rounded-[22px]" style={{ padding: 26, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.025)' }}>
                <span
                  className="grid place-items-center rounded-2xl"
                  style={{ width: 44, height: 44, marginBottom: 20, border: `1px solid ${service.color}55`, background: `${service.color}1a`, color: service.color }}
                >
                  <service.icon size={21} strokeWidth={1.7} />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[9.5px] tracking-[0.2em]" style={{ color: service.color }}>{service.tag}</span>
                  <span className="font-display font-extrabold text-white text-[22px]">
                    {service.price != null ? `$${service.price}` : service.period}
                    {service.price != null && <span className="font-medium text-[11px]" style={{ color: '#8b99ac' }}> {service.period}</span>}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white text-[19px]" style={{ margin: '16px 0 0', lineHeight: 1.25 }}>{service.title}</h3>
                <p className="font-light flex-1 text-[13.5px]" style={{ margin: '12px 0 0', lineHeight: 1.65, color: '#9fadc0' }}>{service.desc}</p>
                <ul className="grid gap-2" style={{ margin: '18px 0 0', padding: 0, listStyle: 'none' }}>
                  {service.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-[12.5px]" style={{ color: '#b8c3d2' }}>
                      <span style={{ color: service.color }}>·</span>{b}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
            <Reveal
              index={services.length}
              className="lujo-card flex flex-col rounded-[22px]"
              style={{ padding: 26, border: '1px solid rgba(0,168,150,0.35)', background: 'linear-gradient(140deg, rgba(0,168,150,0.12), rgba(43,106,255,0.08))' }}
            >
              <span className="grid place-items-center rounded-2xl" style={{ width: 44, height: 44, marginBottom: 20, border: '1px solid rgba(78,222,163,0.35)', background: 'rgba(78,222,163,0.12)', color: '#4edea3' }}>
                <Sparkles size={21} strokeWidth={1.7} />
              </span>
              <div className="font-mono text-[9.5px] tracking-[0.2em]" style={{ color: '#4edea3' }}>¿NO SABES DÓNDE ESTÁS PARADO?</div>
              <h3 className="font-display font-bold text-white text-[19px]" style={{ margin: '16px 0 0', lineHeight: 1.25 }}>Diagnóstico tributario sin costo</h3>
              <p className="font-light flex-1 text-[13.5px]" style={{ margin: '12px 0 0', lineHeight: 1.65, color: '#c3d0dd' }}>
                Revisamos tu historial en el SRI, tu régimen y tus pendientes. Te decimos exactamente qué falta y cuánto cuesta ponerlo al día.
              </p>
              <a
                href={wa('Hola Santiago Córdova, quiero mi diagnóstico tributario sin costo.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ marginTop: 20, height: 48, background: '#00A896', color: '#031310' }}
              >
                <MessageCircle size={15} />
                Escribir por WhatsApp
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ──────────────────────────────────────────────────── */}
      <section className="relative px-6" style={{ padding: 'clamp(70px,10vh,130px) 24px', background: '#050a1b' }}>
        <div className="max-w-[1160px] mx-auto">
          <Reveal index={0} as="span" className="inline-block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#C9A96E' }}>
            CLIENTES
          </Reveal>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', marginTop: 34 }}>
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} index={i} as="blockquote" className="rounded-[20px]" style={{ margin: 0, padding: 26, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <p className="font-light text-[14.5px]" style={{ margin: 0, lineHeight: 1.7, color: '#cdd7e3' }}>&ldquo;{t.quote}&rdquo;</p>
                <footer style={{ marginTop: 18 }}>
                  <div className="font-display font-bold text-white text-[14px]">{t.name}</div>
                  <div className="font-mono text-[10px] tracking-[0.14em]" style={{ marginTop: 3, color: '#00A896' }}>{t.city} · {t.role.toUpperCase()}</div>
                </footer>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" ref={registerNav('faq')} className="relative px-6" style={{ padding: 'clamp(70px,10vh,130px) 24px', background: 'linear-gradient(to bottom,#050a1b,#020617)' }}>
        <div className="max-w-[880px] mx-auto">
          <Reveal index={0} as="span" className="inline-block font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: '#00A896' }}>
            PREGUNTAS FRECUENTES
          </Reveal>
          <Reveal index={1} as="h2" className="font-display font-extrabold text-white" style={{ margin: '18px 0 36px', letterSpacing: '-0.03em', lineHeight: 1.06, fontSize: 'clamp(1.9rem,4vw,3rem)' }}>
            Lo que más nos preguntan del SRI
          </Reveal>
          <div className="grid gap-2.5">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} index={i} as="details" className="rounded-[18px]" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)', padding: '20px 22px' }}>
                <summary className="flex gap-3.5 items-start font-display font-bold text-white text-[16px]" style={{ cursor: 'pointer', listStyle: 'none', lineHeight: 1.4 }}>
                  <span className="flex-none font-mono text-[10px] tracking-[0.14em]" style={{ color: faq.color, marginTop: 5 }}>{faq.tag}</span>
                  {faq.q}
                </summary>
                <p className="font-light text-[14px]" style={{ margin: '14px 0 0', lineHeight: 1.75, color: '#a9b6c9' }}>{faq.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CIERRE ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-center px-6" style={{ padding: 'clamp(90px,14vh,170px) 24px' }}>
        <img src={`${MEDIA}poster-obsidian-crystal.png`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.3 }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,169,110,0.14), transparent 70%), linear-gradient(to bottom, rgba(2,6,23,0.92), rgba(2,6,23,0.97))' }} />
        <div className="relative z-[2] max-w-[760px] mx-auto">
          <Reveal index={0} as="h2" className="font-display font-extrabold text-white" style={{ margin: 0, letterSpacing: '-0.035em', lineHeight: 1.05, fontSize: 'clamp(2.1rem,5.4vw,4.2rem)' }}>
            Que el SRI sea el menor de tus problemas
          </Reveal>
          <Reveal index={1} as="p" className="font-light mx-auto" style={{ margin: '24px auto 0', maxWidth: 540, fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.7, color: '#aebbcd' }}>
            Cuéntanos tu caso por WhatsApp. El diagnóstico es gratuito y la respuesta, directa.
          </Reveal>
          <Reveal index={2}>
            <a
              href={wa('Hola Santiago Córdova, quiero agendar un diagnóstico tributario.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl text-white font-mono text-[12.5px] font-bold uppercase tracking-[0.14em]"
              style={{ marginTop: 36, height: 60, padding: '0 34px', background: 'linear-gradient(135deg,#00A896,#028090)', boxShadow: '0 26px 60px -20px rgba(0,168,150,0.9)' }}
            >
              <MessageCircle size={18} />
              Agendar diagnóstico tributario
            </a>
          </Reveal>
          <Reveal index={3} as="div" className="font-mono text-[11px] tracking-[0.18em]" style={{ marginTop: 18, color: '#7d8ca1' }}>
            +593 97 898 0722
          </Reveal>

          <Reveal index={0} style={{ marginTop: 52, paddingTop: 34, borderTop: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="font-mono text-[10px] tracking-[0.26em] text-slate-500">O ENTRA DIRECTO AL TEMA</div>
            <div className="flex flex-wrap gap-2.5 justify-center" style={{ marginTop: 20 }}>
              {[
                { label: 'Encuadre RIMPE 2026', color: '#4edea3', msg: 'Hola Santiago Córdova, deseo simular y encuadrar mi régimen RIMPE 2026.', gold: false, icon: FileSpreadsheet },
                { label: 'Firma electrónica .P12', color: '#7ea6ff', msg: 'Hola Santiago Córdova, requiero tramitar mi Firma Electrónica .P12 en 24h.', gold: false, icon: FileKey },
                { label: 'Devolución de IVA', color: '#4edea3', msg: 'Hola Santiago Córdova, deseo gestionar la devolución de IVA para adulto mayor o discapacidad.', gold: false, icon: Heart },
                { label: 'Declaraciones atrasadas', color: '#C9A96E', msg: 'Hola Santiago Córdova, tengo declaraciones pendientes y quiero regularizar mi RUC.', gold: true, icon: ShieldAlert },
              ].map((item) => (
                <a
                  key={item.label}
                  href={wa(item.msg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-[13px] text-[13px] font-medium"
                  style={
                    item.gold
                      ? { minHeight: 46, padding: '0 17px', border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.09)', color: '#e6d3ab' }
                      : { minHeight: 46, padding: '0 17px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#dbe3ec' }
                  }
                >
                  <item.icon size={17} color={item.color} strokeWidth={1.7} />
                  {item.label}
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative px-6" style={{ padding: '44px 24px 104px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#020617' }}>
        <div className="max-w-[1160px] mx-auto grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,220px), 1fr))', gap: 34 }}>
          <div>
            <span className="flex items-center gap-2.5">
              <Logo className="w-[34px] h-[34px] flex-none" />
              <span className="font-display font-extrabold text-white text-[13px]">SANTIAGO CÓRDOVA</span>
            </span>
            <p className="font-light text-[13px]" style={{ margin: '16px 0 0', maxWidth: 300, lineHeight: 1.65, color: '#8494a8' }}>
              Soluciones Tributarias PRO. Contabilidad, declaraciones y blindaje fiscal con criterio profesional.
            </p>
          </div>
          <div>
            <div className="font-mono text-[9.5px] tracking-[0.22em]" style={{ color: '#4a5a70' }}>NAVEGACIÓN</div>
            <div className="grid gap-2.5" style={{ marginTop: 16 }}>
              {NAV_LINKS.filter((l) => l.href !== '#resultados').map((link) => (
                <a key={link.href} href={link.href} className="text-[13px]" style={{ color: '#9fadc0' }}>{link.label === 'Sistema' ? 'El sistema' : link.label === 'FAQ' ? 'Preguntas frecuentes' : link.label}</a>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9.5px] tracking-[0.22em]" style={{ color: '#4a5a70' }}>CONTACTO</div>
            <div className="grid gap-3" style={{ marginTop: 16 }}>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 text-[13px]" style={{ color: '#00A896' }}>
                <MessageCircle size={16} />
                +593 97 898 0722
              </a>
              <span className="inline-flex items-center gap-2.5 text-[13px]" style={{ color: '#9fadc0' }}>
                <MapPin size={16} color="#C9A96E" />
                Pasaje · El Oro · Ecuador
              </span>
            </div>
          </div>
        </div>
        <div className="max-w-[1160px] mx-auto font-mono text-[9.5px] tracking-[0.18em]" style={{ margin: '34px auto 0', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', color: '#46566c' }}>
          SOLUCIONES TRIBUTARIAS PRO · SISTEMA NUEVA LUZ 3.0
        </div>
      </footer>
    </div>
  );
};
