import React, { useState, useEffect, useRef } from 'react';
import { 
    Box, Sparkles, Sliders, Layers, Eye, RefreshCw, ChevronDown, 
    Zap, ArrowRight, ShieldCheck, Download, Code, Cpu, Play
} from 'lucide-react';
import { Scroll3DCanvas } from '../components/3d/Scroll3DCanvas';
import { Alpha3DMcpPanel } from '../components/3d/Alpha3DMcpPanel';

export const ThreeDStudioScreen: React.FC = () => {
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
    const [customGlbUrl, setCustomGlbUrl] = useState<string | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track vertical scroll inside the studio view
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const element = containerRef.current;
            const scrollTop = element.scrollTop;
            const scrollHeight = element.scrollHeight - element.clientHeight;
            const progress = Math.min(Math.max(scrollTop / (scrollHeight || 1), 0), 1);
            setScrollProgress(progress);
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-[calc(100vh-4rem)] overflow-y-auto bg-slate-950 text-slate-100 scroll-smooth selection:bg-indigo-500 selection:text-white"
        >
            {/* Background 3D Scroll Canvas */}
            <div className="sticky top-0 h-screen w-full pointer-events-none z-0">
                <Scroll3DCanvas 
                    scrollProgress={scrollProgress}
                    customGlbUrl={customGlbUrl}
                />
            </div>

            {/* Content Overlays and Scroll Stages */}
            <div className="relative z-10 -mt-[100vh]">
                
                {/* HUD Top Controls Bar */}
                <div className="sticky top-4 left-4 right-4 mx-auto max-w-6xl z-40 bg-slate-900/80 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/20 border border-indigo-400/30 rounded-xl text-indigo-400">
                            <Box className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                                3D Scroll Studio & Alpha3D MCP
                            </h2>
                            <p className="text-xs text-slate-400">
                                Morphing 3D • React Three Fiber • GSAP • Alpha3D AI
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-indigo-300 font-mono">
                            <span>Scroll Progress:</span>
                            <span className="font-bold text-white">{Math.round(scrollProgress * 100)}%</span>
                        </div>

                        <button
                            onClick={() => setIsMcpModalOpen(true)}
                            className="py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all hover:scale-105"
                        >
                            <Sparkles className="w-4 h-4" />
                            Conectar Alpha3D MCP
                        </button>
                    </div>
                </div>

                {/* SECTION 1: HERO */}
                <section className="min-h-screen flex flex-col justify-center items-center px-6 text-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-6 animate-pulse">
                        <Zap className="w-3.5 h-3.5" /> Next-Gen 3D Interactive Design
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent mb-6">
                        Experiencias 3D Guiadas por Scroll
                    </h1>
                    <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-light mb-10 leading-relaxed">
                        Transforma la navegación tradicional en una escultura digital fluida. Los modelos cambian de geometría, material y trayectoria con cada movimiento del usuario.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <button
                            onClick={() => setIsMcpModalOpen(true)}
                            className="w-full sm:w-auto py-3.5 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-105"
                        >
                            <Sparkles className="w-5 h-5" /> Generar con Alpha3D AI
                        </button>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <ChevronDown className="w-4 h-4 animate-bounce text-indigo-400" /> Desliza hacia abajo para transformar el objeto 3D
                        </div>
                    </div>
                </section>

                {/* SECTION 2: GEOMETRY MORPHING */}
                <section className="min-h-screen flex items-center justify-start px-6 md:px-16 max-w-6xl mx-auto">
                    <div className="bg-slate-900/70 border border-slate-800 backdrop-blur-xl p-8 md:p-10 rounded-3xl max-w-lg shadow-2xl space-y-4">
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl w-fit text-cyan-400">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-bold text-white">
                            Fase 1: Transición de Torus Knot
                        </h2>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Al avanzar al 25% de desplazamiento, el núcleo 3D se desplaza lateralmente y se transmuta en un nudo tórico con material de transmisión cristalina y aberración cromática.
                        </p>
                        <div className="pt-2 flex items-center gap-3 text-xs text-cyan-300 font-mono">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Reflejos PBR & Transmisión de Luz Activa
                        </div>
                    </div>
                </section>

                {/* SECTION 3: DODECAHEDRON / ANALYTICS */}
                <section className="min-h-screen flex items-center justify-end px-6 md:px-16 max-w-6xl mx-auto">
                    <div className="bg-slate-900/70 border border-slate-800 backdrop-blur-xl p-8 md:p-10 rounded-3xl max-w-lg shadow-2xl space-y-4 text-right">
                        <div className="p-3 bg-pink-500/10 border border-pink-500/30 rounded-2xl w-fit text-pink-400 ml-auto">
                            <Sliders className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-bold text-white">
                            Fase 2: Geometría Dodecaédrica & Neón
                        </h2>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            En el 50% de scroll, la cámara encuadra una visión macro con efectos de dispersión de luz, iluminación de punto reactiva y anillos concéntricos flotantes.
                        </p>
                        <div className="pt-2 flex items-center justify-end gap-3 text-xs text-pink-300 font-mono">
                            <span>Sombra Dinámica & Matriz de Partículas</span>
                            <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping"></span>
                        </div>
                    </div>
                </section>

                {/* SECTION 4: ALPHA3D INTEGRATION & CTA */}
                <section className="min-h-screen flex flex-col justify-center items-center px-6 text-center max-w-5xl mx-auto">
                    <div className="bg-gradient-to-b from-indigo-950/80 to-slate-900/90 border border-indigo-500/30 backdrop-blur-2xl p-10 md:p-14 rounded-3xl shadow-2xl space-y-6 max-w-3xl">
                        <div className="p-4 bg-indigo-600/30 border border-indigo-400/40 rounded-2xl w-fit mx-auto text-indigo-300">
                            <Cpu className="w-8 h-8 animate-pulse" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-white">
                            Conecta tus Modelos Alpha3D vía MCP
                        </h2>
                        <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                            Gracias a la integración con el protocolo MCP (Model Context Protocol) de Alpha3D, puedes solicitar la generación de activos 3D a través de inteligencia artificial e integrarlos dinámicamente en tu flujo web sin compilar de nuevo.
                        </p>
                        <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button
                                onClick={() => setIsMcpModalOpen(true)}
                                className="w-full sm:w-auto py-3.5 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-105"
                            >
                                <Sparkles className="w-5 h-5" /> Configurar Alpha3D MCP
                            </button>
                        </div>
                    </div>
                </section>

            </div>

            {/* Alpha3D MCP Modal */}
            <Alpha3DMcpPanel 
                isOpen={isMcpModalOpen}
                onClose={() => setIsMcpModalOpen(false)}
                onSelectModelGlb={(url) => {
                    setCustomGlbUrl(url);
                    setIsMcpModalOpen(false);
                }}
            />
        </div>
    );
};
