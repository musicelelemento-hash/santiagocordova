import React, { useState } from 'react';
import { Sparkles, Key, Server, Cpu, Check, AlertCircle, RefreshCw, X, Box, ExternalLink, ShieldCheck } from 'lucide-react';
import { alpha3dService } from '../../services/alpha3dService';

interface Alpha3DMcpPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectModelGlb?: (url: string) => void;
}

export const Alpha3DMcpPanel: React.FC<Alpha3DMcpPanelProps> = ({
    isOpen,
    onClose,
    onSelectModelGlb
}) => {
    const creds = alpha3dService.getCredentials();
    const [apiKey, setApiKey] = useState(creds.apiKey || '');
    const [mcpEndpoint, setMcpEndpoint] = useState(creds.mcpEndpoint || '');
    const [promptText, setPromptText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [generatedGlb, setGeneratedGlb] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'generate' | 'connection'>('generate');

    if (!isOpen) return null;

    const handleSaveConnection = () => {
        alpha3dService.setCredentials(apiKey, mcpEndpoint);
        setStatusMessage('Conexión MCP y API Key guardadas exitosamente.');
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleGenerate3D = async () => {
        if (!promptText.trim()) return;
        setIsGenerating(true);
        setStatusMessage('Enviando prompt a la API / MCP de Alpha3D con Bearer Token...');

        try {
            const result = await alpha3dService.generate3DModel({
                prompt: promptText,
                quality: 'hd'
            });

            if (result.glbUrl) {
                setGeneratedGlb(result.glbUrl);
                if (onSelectModelGlb) {
                    onSelectModelGlb(result.glbUrl);
                }
                setStatusMessage('¡Modelo 3D cargado en el Canvas en tiempo real!');
            } else {
                setStatusMessage('Solicitud enviada a Alpha3D API (Modelo asignado al lienzo procedimental).');
            }
        } catch (err: any) {
            setStatusMessage(`Error: ${err.message || 'Fallo de comunicación con Alpha3D'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-indigo-500/20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-400/30 text-indigo-400">
                            <Box className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                                    Studio 3D & Conector Alpha3D MCP
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Live Key: ANTIGRAVITY
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Integración API v1 / MCP Server con Webhook Secret X-Alpha3D-Token
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/50 px-5 pt-3 gap-3 text-sm font-medium">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-colors ${
                            activeTab === 'generate'
                                ? 'border-indigo-500 text-indigo-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Generar Modelo 3D
                    </button>
                    <button
                        onClick={() => setActiveTab('connection')}
                        className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-colors ${
                            activeTab === 'connection'
                                ? 'border-indigo-500 text-indigo-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Server className="w-4 h-4" />
                        Configurar MCP & API Key
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {statusMessage && (
                        <div className="p-3 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
                            <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <span>{statusMessage}</span>
                        </div>
                    )}

                    {activeTab === 'generate' ? (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                                    Prompt o Descripción del Objeto 3D (IA Alpha3D)
                                </label>
                                <textarea
                                    value={promptText}
                                    onChange={(e) => setPromptText(e.target.value)}
                                    placeholder="Ej: Un logo contable futurista de cristal flotante con engranajes dorados y luz de neón violeta..."
                                    className="w-full h-28 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <button
                                    onClick={() => setPromptText("Cubo de datos financieros con cristales translúcidos y resplandor azul cyan")}
                                    className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl text-left text-slate-300 transition-colors"
                                >
                                    💎 Preset: Cubo Financiero Neón
                                </button>
                                <button
                                    onClick={() => setPromptText("Escultura de zafiro flotante con anillos hiperbólicos de oro para landing page")}
                                    className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl text-left text-slate-300 transition-colors"
                                >
                                    🔱 Preset: Anillo Zafiro Luxury
                                </button>
                            </div>

                            <button
                                onClick={handleGenerate3D}
                                disabled={isGenerating || !promptText.trim()}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Procesando Solicitud en Alpha3D API...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Generar e Inyectar en Scroll Canvas 3D
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                                <div className="font-semibold text-emerald-400 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> API Key "ANTIGRAVITY" Activa
                                </div>
                                <div className="text-slate-400 font-mono text-[11px] truncate">
                                    {apiKey}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                                    <Server className="w-4 h-4 text-indigo-400" />
                                    URL del Servidor MCP / Endpoint Alpha3D
                                </label>
                                <input
                                    type="text"
                                    value={mcpEndpoint}
                                    onChange={(e) => setMcpEndpoint(e.target.value)}
                                    placeholder="https://api.alpha3d.io/v1/generate"
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-amber-400" />
                                    API Key de Alpha3D (Bearer Token)
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="ak_live_..."
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs"
                                />
                            </div>

                            <button
                                onClick={handleSaveConnection}
                                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-indigo-500/30 text-indigo-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <Check className="w-4 h-4" />
                                Actualizar Credenciales MCP
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
