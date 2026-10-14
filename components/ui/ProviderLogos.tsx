import React from 'react';

interface ProviderLogoProps {
    providerKey?: string;
    programName?: string;
    size?: number;
    className?: string;
    showLabel?: boolean;
}

/**
 * 💎 Logo Oficial de Talonario Amigo (Propio SC)
 * Concepto de diseño: Talonario digital de lujo, talonario con hojas doradas perforadas,
 * estrella de emisión verificada y acabado oro líquido sobre obsidiana mate.
 */
export const TalonarioAmigoLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Logo Talonario Amigo"
    >
        <defs>
            <linearGradient id="ta-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1C1917" />
                <stop offset="100%" stopColor="#0C0A09" />
            </linearGradient>
            <linearGradient id="ta-gold" x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="40%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="ta-gold-light" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="ta-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        {/* Base redondeada obsidiana */}
        <rect width="48" height="48" rx="12" fill="url(#ta-bg)" stroke="url(#ta-gold)" strokeWidth="1.5" />
        
        {/* Cuerpo del Talonario de Facturas */}
        <g filter="url(#ta-glow)">
            {/* Hoja trasera (profundidad) */}
            <rect x="15" y="8" width="23" height="30" rx="3" fill="#78350F" opacity="0.5" />
            
            {/* Hoja principal del talonario */}
            <rect x="11" y="11" width="24" height="28" rx="3" fill="#1C1917" stroke="url(#ta-gold)" strokeWidth="1.5" />
            
            {/* Línea de perforación desprendible del talonario */}
            <line x1="17" y1="12" x2="17" y2="38" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
            
            {/* Micro-anillos / espiral del talonario */}
            <circle cx="14" cy="16" r="1.5" fill="url(#ta-gold)" />
            <circle cx="14" cy="22" r="1.5" fill="url(#ta-gold)" />
            <circle cx="14" cy="28" r="1.5" fill="url(#ta-gold)" />
            <circle cx="14" cy="34" r="1.5" fill="url(#ta-gold)" />

            {/* Líneas de factura / comprobante */}
            <line x1="21" y1="17" x2="31" y2="17" stroke="url(#ta-gold-light)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="21" y1="22" x2="29" y2="22" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
            <line x1="21" y1="27" x2="27" y2="27" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
            
            {/* Sello de Aprobación Fiscal / Diamante */}
            <path d="M30 31L33 34L37 28" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Monograma "TA" o chispa dorada superior derecha */}
        <path d="M38 7L39 10L42 11L39 12L38 15L37 12L34 11L37 10L38 7Z" fill="#FDE68A" />
    </svg>
);

/**
 * 🏛️ Logo Oficial del SRI (Servicio de Rentas Internas)
 * Isotipo vectorial oficial: los 3 arcos corporativos dinámicos en Azul Marino y Celeste
 * con el punto rojo institucional y tipografía SRI en alto contraste.
 */
export const SriLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Logo SRI"
    >
        <defs>
            <linearGradient id="sri-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0B132B" />
                <stop offset="100%" stopColor="#1C2541" />
            </linearGradient>
            <linearGradient id="sri-blue-1" x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
        </defs>

        {/* Marco base institucional */}
        <rect width="48" height="48" rx="12" fill="url(#sri-bg)" stroke="#1E40AF" strokeWidth="1.5" />
        
        {/* Los 3 arcos característicos del SRI */}
        <g transform="translate(6, 6)">
            {/* Arco 1 (azul cielo) */}
            <path 
                d="M6 22C6 13.1634 13.1634 6 22 6" 
                stroke="#38BDF8" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
            />
            {/* Arco 2 (azul institucional) */}
            <path 
                d="M11 25C11 18.3726 16.3726 13 23 13" 
                stroke="#2563EB" 
                strokeWidth="3" 
                strokeLinecap="round" 
            />
            {/* Arco 3 (azul profundo) */}
            <path 
                d="M16 28C16 23.5817 19.5817 20 24 20" 
                stroke="#1D4ED8" 
                strokeWidth="2.8" 
                strokeLinecap="round" 
            />
            {/* Punto / Acento rojo institucional del SRI */}
            <circle cx="28" cy="8" r="3" fill="#DC2626" />
        </g>

        {/* Texto "SRI" estilizado al pie */}
        <text 
            x="24" 
            y="41" 
            textAnchor="middle" 
            fill="#FFFFFF" 
            fontFamily="system-ui, -apple-system, sans-serif" 
            fontWeight="900" 
            fontSize="10" 
            letterSpacing="1.5"
        >
            SRI
        </text>
    </svg>
);

/**
 * 📄 Logo Vectorial de Ecuafact
 * Estilo icónico: Hoja de factura cloud en Cyan eléctrico con flecha/onda dinámica.
 */
export const EcuafactLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Logo Ecuafact"
    >
        <defs>
            <linearGradient id="ef-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#082F49" />
                <stop offset="100%" stopColor="#0C4A6E" />
            </linearGradient>
            <linearGradient id="ef-cyan" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
        </defs>

        {/* Base */}
        <rect width="48" height="48" rx="12" fill="url(#ef-bg)" stroke="#0284C7" strokeWidth="1.5" />

        {/* Hoja digital de factura */}
        <path 
            d="M14 12C14 10.8954 14.8954 10 16 10H27L34 17V36C34 37.1046 33.1046 38 32 38H16C14.8954 38 14 37.1046 14 36V12Z" 
            fill="#0369A1" 
            stroke="url(#ef-cyan)" 
            strokeWidth="1.5" 
        />
        {/* Esquina doblada */}
        <path d="M27 10V17H34" fill="#0284C7" stroke="url(#ef-cyan)" strokeWidth="1.2" />

        {/* Líneas de factura */}
        <line x1="19" y1="21" x2="28" y2="21" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="19" y1="26" x2="25" y2="26" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" />
        
        {/* Onda / Swoosh dinámico Ecuafact */}
        <path 
            d="M12 32C18 28 26 34 36 29" 
            stroke="#38BDF8" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
        />
        <circle cx="36" cy="29" r="2" fill="#7DD3FC" />
    </svg>
);

/**
 * ⚡ Logo Vectorial de Zifact
 * Estilo icónico: Hexágono tecnológico en Verde Esmeralda / Mint con rayo de emisión ultra-rápida.
 */
export const ZifactLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Logo Zifact"
    >
        <defs>
            <linearGradient id="zf-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#052E16" />
                <stop offset="100%" stopColor="#064E3B" />
            </linearGradient>
            <linearGradient id="zf-mint" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6EE7B7" />
                <stop offset="50%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <filter id="zf-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        {/* Base */}
        <rect width="48" height="48" rx="12" fill="url(#zf-bg)" stroke="#10B981" strokeWidth="1.5" />

        {/* Escudo / Hexágono interno */}
        <path 
            d="M24 10L35 16V28L24 35L13 28V16L24 10Z" 
            fill="#064E3B" 
            stroke="url(#zf-mint)" 
            strokeWidth="1.2" 
            opacity="0.6"
        />

        {/* Rayo de alta velocidad Zifact */}
        <g filter="url(#zf-glow)">
            <path 
                d="M26 12L17 25H25L22 36L32 23H24L26 12Z" 
                fill="url(#zf-mint)" 
                stroke="#A7F3D0" 
                strokeWidth="1" 
                strokeLinejoin="round" 
            />
        </g>
    </svg>
);

/**
 * 🌐 Logo Genérico / Por Defecto
 */
export const DefaultFacturadorLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        aria-label="Logo Facturador General"
    >
        <rect width="48" height="48" rx="12" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="10" stroke="#94A3B8" strokeWidth="2" />
        <line x1="14" y1="24" x2="34" y2="24" stroke="#94A3B8" strokeWidth="2" />
        <ellipse cx="24" cy="24" rx="5" ry="10" stroke="#94A3B8" strokeWidth="1.5" />
    </svg>
);

/**
 * 🧭 Resolvedor Automático de Logos por Proveedor
 */
export const ProviderLogo: React.FC<ProviderLogoProps> = ({
    providerKey,
    programName,
    size = 24,
    className = ''
}) => {
    const raw = (providerKey || programName || '').toLowerCase();
    
    if (raw.includes('talonario')) {
        return <TalonarioAmigoLogo size={size} className={className} />;
    }
    if (raw.includes('ecuafact')) {
        return <EcuafactLogo size={size} className={className} />;
    }
    if (raw.includes('zifac')) {
        return <ZifactLogo size={size} className={className} />;
    }
    if (raw.includes('sri')) {
        return <SriLogo size={size} className={className} />;
    }
    return <DefaultFacturadorLogo size={size} className={className} />;
};
