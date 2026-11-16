import React, { useState } from 'react';
import { Download, Smartphone, Share, X } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

/**
 * Botón "Instalar app" (PWA). En Android instala de verdad con el prompt del
 * navegador; en iPhone muestra los tres pasos de Safari.
 */
export const InstallAppButton: React.FC<{ compacto?: boolean }> = ({ compacto = false }) => {
    const { puedeInstalar, instalar, esIOS, esApp } = useInstallPrompt();
    const [ayudaIOS, setAyudaIOS] = useState(false);

    if (esApp) return null;
    // Sin prompt y sin iOS no hay nada útil que ofrecer.
    if (!puedeInstalar && !esIOS) return null;

    const alTocar = async () => {
        if (puedeInstalar) {
            const ok = await instalar();
            if (ok) return;
        }
        if (esIOS) setAyudaIOS(true);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => void alTocar()}
                title="Instalar la app en este dispositivo"
                className={`group flex items-center justify-center gap-2 rounded-xl border border-[#C9A96E]/40 bg-gradient-to-r from-[#C9A96E]/15 to-[#C9A96E]/5 text-[#C9A96E] transition-all hover:bg-[#C9A96E] hover:text-slate-950 active:scale-95 ${
                    compacto ? 'h-10 w-10 flex-none' : 'w-full px-3.5 py-2.5'
                }`}
            >
                <Download size={15} className="shrink-0 transition-transform group-hover:scale-110" />
                {!compacto && (
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Instalar app</span>
                )}
            </button>

            {ayudaIOS && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setAyudaIOS(false)}>
                    <div
                        className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0b1326] p-5 text-slate-200 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-start justify-between">
                            <p className="flex items-center gap-2 font-display text-sm font-bold text-white">
                                <Smartphone size={16} className="text-[#C9A96E]" /> Instalar en iPhone
                            </p>
                            <button onClick={() => setAyudaIOS(false)} aria-label="Cerrar" className="text-slate-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <ol className="space-y-2 text-[12px] text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="font-mono text-[#C9A96E]">1.</span>
                                <span>Tocá el botón <b>Compartir</b> de Safari.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-mono text-[#C9A96E]">2.</span>
                                <span>Elegí <b>Añadir a pantalla de inicio</b>.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-mono text-[#C9A96E]">3.</span>
                                <span>Tocá <b>Agregar</b>. Queda como una app.</span>
                            </li>
                        </ol>
                        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Share size={11} /> Abre a pantalla completa, sin barra del navegador.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallAppButton;
