
import React, { useEffect, useState } from 'react';
import { 
    Music, Play, Pause, SkipBack, SkipForward, 
    ArrowLeft, Mic2, Disc, Star, Youtube, 
    Instagram, Mail, Headphones, Volume2,
    Activity, Sparkles, Globe, Heart, Target
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';

interface MusicPageProps {
    onBack: () => void;
}

export const MusicPage: React.FC<MusicPageProps> = ({ onBack }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTrack, setActiveTrack] = useState(0);

    const playlist = [
        { title: "Tactical Horizon", duration: "3:45", artist: "Santiago Cordova", tag: "Ambient" },
        { title: "Ecos del Sur", duration: "4:12", artist: "Santiago Cordova", tag: "Folklore Fusion" },
        { title: "Sinfonía Contable", duration: "3:10", artist: "Santiago Cordova", tag: "Experimental" },
        { title: "Elite Command", duration: "5:20", artist: "Santiago Cordova", tag: "Cinematic" },
    ];

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#050B18] text-white selection:bg-[#00A896]/30 overflow-x-hidden relative font-sans">
            {/* Background Orbs - Shared with Intelligence Core */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#00A896]/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
            </div>

            {/* Navigation Overlay */}
            <nav className="relative z-50 flex items-center justify-between p-6 px-8 max-w-7xl mx-auto backdrop-blur-md bg-black/10 border-b border-white/5 mb-10">
                <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="p-2 bg-gradient-to-br from-[#00A896] to-[#0B2149] rounded-xl shadow-lg border border-white/10 group-hover:scale-110 transition-transform">
                        <Music className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
                        SANTIAGO CORDOVA <span className="text-[#00A896] ml-2 font-light tracking-[0.3em] text-[10px]">ART</span>
                    </span>
                </div>
                <button
                    onClick={onBack}
                    className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft className="w-18 h-18 group-hover:-translate-x-1 transition-transform text-[#00A896]" />
                    <span className="text-xs font-black uppercase tracking-widest">Volver al Comando</span>
                </button>
            </nav>

            {/* Hero & Player Section */}
            <section className="relative z-10 pt-10 pb-20 px-6 max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-8 animate-in fade-in slide-in-from-left duration-1000">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#00A896]/10 border border-[#00A896]/20">
                        <Mic2 className="w-4 h-4 text-[#00A896]" />
                        <span className="text-[10px] font-black text-[#00A896] uppercase tracking-[0.3em]">Compositor Multidimensional</span>
                    </div>
                    
                    <h1 className="text-6xl lg:text-9xl font-black mb-6 leading-[0.8] tracking-tight">
                        EL SONIDO DE <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00A896] via-white to-[#8B5CF6] animate-gradient-x">
                            LA EVOLUCIÓN
                        </span>
                    </h1>
                    
                    <p className="text-white/40 text-lg lg:text-xl max-w-xl mb-10 leading-relaxed font-medium">
                        Fusionando la precisión del mundo profesional con la libertad creativa de la música. Un viaje sonoro diseñado para trascender los límites convencionales.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button className="px-10 py-5 rounded-[2rem] bg-gradient-to-r from-[#00A896] to-[#0B2149] font-black tracking-widest uppercase text-xs hover:scale-105 transition-all shadow-2xl shadow-[#00A896]/20 flex items-center gap-3 border border-white/10">
                            <Play className="fill-current w-4 h-4" />
                            Escuchar Ahora
                        </button>
                        <button className="px-10 py-5 rounded-[2rem] bg-white/5 border border-white/10 font-black tracking-widest uppercase text-xs hover:bg-white/10 transition-all">
                            Ver Repertorio
                        </button>
                    </div>
                </div>

                {/* Glass Player Visualizer */}
                <div className="lg:col-span-5 relative animate-in fade-in zoom-in duration-1000">
                    <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 bg-black/40 backdrop-blur-3xl group/player">
                        <img
                            src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000"
                            alt="Visualizer"
                            className="absolute inset-0 object-cover w-full h-full opacity-40 grayscale group-hover/player:grayscale-0 group-hover/player:scale-110 transition-all duration-1000"
                        />
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                        <div className="absolute inset-x-8 bottom-10 p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <span className="text-[10px] font-black text-[#00A896] uppercase tracking-[0.2em] mb-1 block">{playlist[activeTrack].tag}</span>
                                    <h3 className="font-black text-2xl tracking-tight text-white">{playlist[activeTrack].title}</h3>
                                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{playlist[activeTrack].artist}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 animate-spin-slow">
                                    <Disc className="w-8 h-8 text-[#00A896]" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="w-full h-1.5 bg-white/5 rounded-full relative overflow-hidden group/progress cursor-pointer">
                                    <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#00A896] to-[#8B5CF6] rounded-full shadow-[0_0_10px_rgba(0,168,150,0.5)]" />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-white/30 tracking-widest">
                                    <span>01:45</span>
                                    <span>{playlist[activeTrack].duration}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-10 mt-8">
                                <SkipBack 
                                    className="w-6 h-6 cursor-pointer text-white/40 hover:text-white transition-colors" 
                                    onClick={() => setActiveTrack((prev) => (prev - 1 + playlist.length) % playlist.length)} 
                                />
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/10"
                                >
                                    {isPlaying ? <Pause className="fill-current w-6 h-6" /> : <Play className="fill-current ml-1 w-6 h-6" />}
                                </button>
                                <SkipForward 
                                    className="w-6 h-6 cursor-pointer text-white/40 hover:text-white transition-colors" 
                                    onClick={() => setActiveTrack((prev) => (prev + 1) % playlist.length)} 
                                />
                            </div>
                        </div>

                        {/* Audio Waveform Decoration */}
                        <div className="absolute top-10 right-10 flex gap-1 items-end h-12 opacity-30">
                            {[1,2,3,4,5,4,3,2,1,2,3,4,5,4,3,2,1].map((h, i) => (
                                <div 
                                    key={i} 
                                    className={`w-1 bg-[#00A896] rounded-full ${isPlaying ? 'animate-bounce' : 'h-1'}`}
                                    style={{ height: `${h * 20}%`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Tactical Stats Grid */}
            <section className="relative z-10 py-24 bg-white/[0.02] border-y border-white/5 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-12">
                    {[
                        { label: 'Obras Propias', value: '24+', icon: Activity },
                        { label: 'Años Evolución', value: '10', icon: Globe },
                        { label: 'Reconocimientos', value: 'Elite', icon: Sparkles },
                        { label: 'Presentaciones', value: '50+', icon: Target },
                    ].map((stat, i) => (
                        <div key={i} className="flex flex-col items-center text-center group">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-6 group-hover:bg-[#00A896]/10 group-hover:border-[#00A896]/30 transition-all">
                                <stat.icon className="w-8 h-8 text-[#00A896]" />
                            </div>
                            <p className="text-5xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30">{stat.value}</p>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Newsletter / Contact CTA */}
            <section className="relative z-10 py-32 px-6 max-w-5xl mx-auto">
                <div className="bg-gradient-to-br from-white/10 to-transparent p-1px rounded-[3rem]">
                    <div className="bg-[#0B1221] p-12 md:p-20 rounded-[3rem] text-center border border-white/10 relative overflow-hidden group">
                        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[#00A896]/10 blur-[100px] rounded-full" />
                        
                        <Star className="w-16 h-16 text-[#00A896]/30 mx-auto mb-10 animate-pulse" />
                        <h2 className="text-4xl lg:text-6xl font-black mb-10 tracking-tight leading-tight uppercase">
                            ¿Listos para elevar el <br />
                            <span className="text-[#00A896]">arte al combate?</span>
                        </h2>
                        <p className="text-white/40 text-lg mb-12 max-w-2xl mx-auto font-medium">
                            Para colaboraciones estratégicas, eventos de alto impacto o prensa especializada, mi equipo está listo para recibir sus propuestas.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-10 border-t border-white/5 pt-12">
                            <a href="mailto:art@santiagocordova.com" className="flex items-center gap-4 text-xl font-bold hover:text-[#00A896] transition-all group/mail">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 group-hover/mail:bg-[#00A896]/20 group-hover/mail:border-[#00A896]/30 transition-all">
                                    <Mail className="w-6 h-6" />
                                </div>
                                art@santiagocordova.com
                            </a>
                            <div className="flex items-center gap-8">
                                <Youtube className="w-7 h-7 cursor-pointer hover:text-red-500 transition-all hover:scale-125" />
                                <Instagram className="w-7 h-7 cursor-pointer hover:text-pink-500 transition-all hover:scale-125" />
                                <Volume2 className="w-7 h-7 cursor-pointer hover:text-[#00A896] transition-all hover:scale-125" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 py-16 px-6 border-t border-white/5 text-center bg-black/40 backdrop-blur-md">
                <div className="flex flex-col items-center gap-4 opacity-40 grayscale group hover:grayscale-0 transition-all">
                    <Logo className="w-8 h-8 invert" />
                    <span className="text-[10px] tracking-[0.4em] font-black uppercase">SANTIAGO CORDOVA • ART ENGINE v3.0</span>
                    <div className="h-1 w-20 bg-gradient-to-r from-transparent via-[#00A896] to-transparent" />
                </div>
                <p className="text-white/20 text-[9px] tracking-[0.2em] uppercase mt-10 font-bold italic">© 2026 Santiago Cordova Art. Precision and Creation.</p>
            </footer>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 15s linear infinite;
                }
                @keyframes gradient-x {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient-x {
                    animation: gradient-x 5s ease infinite;
                    background-size: 200% 200%;
                }
            `}</style>
        </div>
    );
};

export default MusicPage;
