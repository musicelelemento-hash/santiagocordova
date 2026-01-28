
import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 108 108" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Gestiones Tributarias Logo"
    >
      {/* Fondo Turquesa/Teal (Actualizado) */}
      <rect width="108" height="108" rx="24" fill="#14b8a6"/>
      
      {/* Iconografía en Blanco */}
      <g stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M36 88 H 72"/>
        <path d="M54 88 V 32"/>
        <path d="M24 38 H 84"/>
        <circle cx="54" cy="30" r="3.5" fill="white"/>
        <path d="M34 38 V 48"/>
        <path d="M22 62 C 28 72, 40 72, 46 62" fill="none"/>
        <path d="M74 38 V 48"/>
        <path d="M62 62 C 68 72, 80 72, 86 62" fill="none"/>
      </g>
    </svg>
  );
};
