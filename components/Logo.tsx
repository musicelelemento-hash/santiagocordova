
import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 108 108" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Soluciones Contables Pro Logo"
    >
      <rect width="108" height="108" rx="24" fill="#00A896"/>
      <g stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 80 H 78"/>
        <path d="M54 80 V 30"/>
        <path d="M25 35 H 83"/>
        <circle cx="54" cy="25" r="5" fill="white"/>
        <path d="M35 35 V 45"/>
        <path d="M22 60 C 28 70, 42 70, 48 60" fill="none"/>
        <path d="M73 35 V 45"/>
        <path d="M60 60 C 66 70, 80 70, 86 60" fill="none"/>
      </g>
    </svg>
  );
};
