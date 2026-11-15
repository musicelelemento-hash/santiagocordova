import React from 'react';
import { Star } from 'lucide-react';

/**
 * Distintivo de SOCIEDAD (RUC con 3.er dígito 9).
 *
 * Por qué una estrella y no solo un color: las sociedades son pocas dentro de la
 * cartera (1 de 139), así que el marcador tiene que verse de un vistazo sin
 * competir con los estados. Dorado = acento de la casa; la estrella + el texto
 * «SOCIEDAD» quitan cualquier ambigüedad (no es «favorito»).
 */
const CompanyBadge: React.FC<{ compacto?: boolean; className?: string }> = ({ compacto, className = '' }) => (
    <span
        className={`inline-flex items-center gap-1 rounded-full border border-[#C9A96E]/45 bg-[#C9A96E]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#C9A96E] ${className}`}
        title="RUC de sociedad: lleva 1021 Renta, REBEFICS (febrero), ADI (mayo) y ATS mensual"
    >
        <Star size={9} fill="currentColor" strokeWidth={0} />
        {compacto ? 'S.A.S.' : 'Sociedad'}
    </span>
);

export default CompanyBadge;
