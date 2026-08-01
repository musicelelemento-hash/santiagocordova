import React, { useState } from 'react';
import {
    Sparkles, Download, CheckCircle2, ExternalLink, HelpCircle,
    FileText, Trash2, Zap, ShieldCheck, Layers, Terminal, Chrome,
    Info, ChevronRight, Copy, Check, ArrowUpRight, FolderArchive, RefreshCw
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export interface ExtensionItem {
    id: string;
    name: string;
    version: string;
    category: string;
    description: string;
    zipFileName: string;
    zipPath: string;
    icon: any;
    color: string;
    gradient: string;
    badge: string;
    features: string[];
    connectionMethod: string;
    targetUrl: string;
}

export const SRI_EXTENSIONS_LIST: ExtensionItem[] = [
    {
        id: 'sri-anexo-gastos',
        name: 'SRI - Llenador Anexo Gastos Personales',
        version: '1.0.0',
        category: 'Anexo Gastos',
        description: 'Automatiza el llenado del Anexo de Gastos Personales en el portal del SRI. Clasifica facturas electrónicas en Salud, Educación, Alimentación, Vestimenta, Vivienda y Turismo, llenando automáticamente las casillas oficiales.',
        zipFileName: 'sri-anexo-gastos-personales.zip',
        zipPath: '/extensions/sri-anexo-gastos-personales.zip',
        icon: Sparkles,
        color: 'text-purple-400',
        gradient: 'from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30',
        badge: 'Anexo Gastos Personales',
        features: [
            'Llenado automático de casillas en el portal sriservicios.sri.gob.ec',
            'Soporte para cargas familiares (1, 2, 3, 4, 5+ cargas)',
            'Memoria inteligente de mapeos por proveedor y concepto',
            'Personalización visual de asistentes y resúmenes en pantalla'
        ],
        connectionMethod: 'Conecta con la Bóveda del Cliente para leer RUC y montos calculados por categoría.',
        targetUrl: 'https://sriservicios.sri.gob.ec/anexo-gastos-personales/'
    },
    {
        id: 'sri-anulador-pdf',
        name: 'SRI Llenador - Anulación de Comprobantes PDF',
        version: '1.0.0',
        category: 'Anulación Facturas',
        description: 'Sube una o varias facturas PDF. La extensión extrae la Clave de Acceso, Número de Autorización, RUC y Razón Social, llenando automáticamente la Solicitud de Anulación de Comprobantes en el SRI.',
        zipFileName: 'sri-anulador-pdf-comprobantes.zip',
        zipPath: '/extensions/sri-anulador-pdf-comprobantes.zip',
        icon: Trash2,
        color: 'text-rose-400',
        gradient: 'from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30',
        badge: 'Anulación Lote PDF',
        features: [
            'Procesamiento en lote (Drop & Go) de múltiples facturas PDF',
            'Lector nativo PDF.js integrado para extraer Claves de Acceso de 49 dígitos',
            'Auto-navegación guiada en el portal srienlinea.sri.gob.ec',
            'Bitácora de resultados y estado de anulación por comprobante'
        ],
        connectionMethod: 'Se integra con los comprobantes emitidos en el sistema y permite anulación en 1 clic.',
        targetUrl: 'https://srienlinea.sri.gob.ec/tuportal-internet/'
    },
    {
        id: 'sri-extractor-iva',
        name: 'SRI Extractor & Automatización Declaración IVA',
        version: '1.0.0',
        category: 'Declaración IVA',
        description: 'Extrae, suma y clasifica automáticamente las facturas emitidas y recibidas (con IVA 15%/12%, tarifa 0%, retenciones), autocompletando las casillas del formulario de IVA de personas naturales y sociedades.',
        zipFileName: 'sri-extractor-declaracion-iva.zip',
        zipPath: '/extensions/sri-extractor-declaracion-iva.zip',
        icon: Zap,
        color: 'text-emerald-400',
        gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30',
        badge: 'Extractor & IVA',
        features: [
            'Extracción instantánea de comprobantes del portal SRI',
            'Consolidado automático con discriminación de tarifas IVA y retenciones',
            'Inyección directa de totales al formulario de declaración de IVA',
            'Exportación de reportes limpios a Excel/JSON para sincronizar con la web'
        ],
        connectionMethod: 'Exporta la sabana de ventas/compras hacia el módulo de Declaraciones e IVA del sistema.',
        targetUrl: 'https://srienlinea.sri.gob.ec/'
    }
];

export const SriExtensionsStore: React.FC = () => {
    const { toast } = useToast();
    const [selectedExtension, setSelectedExtension] = useState<ExtensionItem | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleDownload = (ext: ExtensionItem) => {
        const link = document.createElement('a');
        link.href = ext.zipPath;
        link.download = ext.zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`Descargando ${ext.name}. Revisa tus descargas.`);
    };

    const handleCopyGuide = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("Enlace/Instrucción copiada");
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-16">
            {/* Header Principal Estilo App Store */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 md:p-10 border border-slate-700/50 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none -ml-20 -mb-20" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30 flex items-center gap-1.5">
                                <Chrome size={12} /> Google Chrome Web Store
                            </span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/30">
                                Manifest V3 Official
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-display">
                            Marketplace de Extensiones SRI
                        </h2>
                        <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
                            Herramientas oficiales para Google Chrome desarrolladas por <strong>Santiago Córdova</strong>. Automatiza la lectura de comprobantes, el llenado del Anexo de Gastos Personales, la anulación de facturas PDF y la declaración de IVA directamente en el portal del SRI.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        <div className="px-5 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                            <p className="text-2xl font-black text-white font-mono">3</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Extensiones Listas</p>
                        </div>
                        <a
                            href="chrome://extensions"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-5 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/30 active:scale-95"
                        >
                            <Chrome size={16} />
                            <span>Abrir chrome://extensions</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Grid de Extensiones (Tarjetas Estilo Google Play / Chrome Store) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {SRI_EXTENSIONS_LIST.map((ext) => {
                    const Icon = ext.icon;
                    return (
                        <div
                            key={ext.id}
                            className={`bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] p-7 md:p-8 border shadow-xl flex flex-col justify-between relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:border-slate-500/40 ${ext.gradient}`}
                        >
                            <div className="space-y-6 relative z-10">
                                {/* Encabezado de la Tarjeta */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className={`w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center ${ext.color} shadow-lg`}>
                                        <Icon size={28} />
                                    </div>
                                    <span className="px-3 py-1 bg-white/5 text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                                        {ext.badge}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{ext.category}</span>
                                        <span className="text-slate-600">•</span>
                                        <span className="text-[9px] font-mono font-bold text-emerald-400">{ext.version}</span>
                                    </div>
                                    <h3 className="text-lg font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">
                                        {ext.name}
                                    </h3>
                                    <p className="text-slate-300 text-xs mt-2 leading-relaxed font-medium">
                                        {ext.description}
                                    </p>
                                </div>

                                {/* Lista de Funcionalidades */}
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Características principales:</p>
                                    <ul className="space-y-1.5">
                                        {ext.features.map((feat, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
                                                <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Método de Conexión con el Sistema */}
                                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 text-xs text-slate-300">
                                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                                        <ShieldCheck size={13} />
                                        <span>Conexión con SantiagoCordova.com</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-snug">
                                        {ext.connectionMethod}
                                    </p>
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div className="pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row items-center gap-3 relative z-10">
                                <button
                                    onClick={() => handleDownload(ext)}
                                    className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
                                >
                                    <FolderArchive size={16} />
                                    <span>Descargar (.ZIP)</span>
                                </button>
                                <button
                                    onClick={() => setSelectedExtension(ext)}
                                    className="w-full sm:w-auto p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center"
                                    title="Ver Detalles de Conexión"
                                >
                                    <Info size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Guía Visual Paso a Paso de Instalación en Chrome */}
            <div className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 border border-slate-700/50 shadow-2xl space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg">
                            <Terminal size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wide">
                                Guía Rápida: Cómo Instalar las Extensiones en Chrome (3 Clics)
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Proceso de instalación única en Modo Desarrollador de Google Chrome en menos de 30 segundos.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                            1
                        </div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">1. Descargar el ZIP</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Haz clic en el botón <strong>"Descargar (.ZIP)"</strong> de la extensión deseada arriba y guarda el archivo en tu computadora.
                        </p>
                    </div>

                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                            2
                        </div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">2. Descomprimir</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Descomprime el archivo `.zip` haciendo clic derecho y seleccionando <strong>"Extraer en carpeta"</strong>.
                        </p>
                    </div>

                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                            3
                        </div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">3. Abrir chrome://extensions</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Abre Google Chrome e ingresa a <code className="text-amber-400 font-mono bg-black/40 px-1 py-0.5 rounded">chrome://extensions</code> en la barra de direcciones.
                        </p>
                    </div>

                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
                            4
                        </div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">4. Cargar Descomprimida</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Activa el <strong>"Modo de desarrollador"</strong> (arriba a la derecha), haz clic en <strong>"Cargar descomprimida"</strong> y selecciona la carpeta.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Detalle de Conexión de Extensión */}
            {selectedExtension && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] max-w-2xl w-full p-8 space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <selectedExtension.icon className={selectedExtension.color} size={24} />
                                <div>
                                    <h3 className="text-lg font-black text-white">{selectedExtension.name}</h3>
                                    <p className="text-xs text-slate-400">Guía de integración con SantiagoCordova.com</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedExtension(null)}
                                className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                                <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                                    🔌 Arquitectura de Conexión Web App & Extensión:
                                </h4>
                                <p>
                                    {selectedExtension.connectionMethod}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                                    🌐 URL Objetivo en el portal del SRI:
                                </h4>
                                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl font-mono text-[11px] border border-white/10">
                                    <span className="truncate text-slate-300">{selectedExtension.targetUrl}</span>
                                    <button
                                        onClick={() => window.open(selectedExtension.targetUrl, '_blank')}
                                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[10px] font-bold flex items-center gap-1"
                                    >
                                        Abrir <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={() => {
                                    handleDownload(selectedExtension);
                                    setSelectedExtension(null);
                                }}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25"
                            >
                                Descargar Extensión (.ZIP)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
