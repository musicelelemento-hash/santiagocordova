import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as xlsx from 'xlsx';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProcessedFile {
    name: string;
    type: 'productos' | 'clientes';
    data: any[];
    status: 'success' | 'error';
    message?: string;
}

export const AdaptadorConvert: React.FC = () => {
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsProcessing(true);
        const newProcessedFiles: ProcessedFile[] = [];

        for (const file of acceptedFiles) {
            try {
                const data = await file.arrayBuffer();
                const workbook = xlsx.read(data);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = xlsx.utils.sheet_to_json(worksheet);

                // Determinar si es cliente o producto (heurística simple)
                const isProductos = file.name.toLowerCase().includes('producto') || (jsonData[0] && (jsonData[0] as any)['codigo'] !== undefined);
                const isClientes = file.name.toLowerCase().includes('cliente') || (jsonData[0] && (jsonData[0] as any)['identificacion'] !== undefined);

                let type: 'productos' | 'clientes' = 'productos';
                let mappedData: any[] = [];

                if (isClientes) {
                    type = 'clientes';
                    mappedData = jsonData.map((row: any) => ({
                        'Nombre': row['Nombre'] || row['Razon Social'] || row['razon_social'] || row['nombre_comercial'] || 'SIN NOMBRE',
                        'Tipo Identificacion': mapTipoIdentificacion(row['Tipo Identificacion'] || row['tipo_identificacion'] || row['Tipo'] || '04'),
                        'Identificacion': String(row['Identificacion'] || row['identificacion'] || row['RUC'] || row['Cedula'] || row['RUC/CI'] || ''),
                        'Direccion': row['Direccion'] || row['direccion'] || 'SN',
                        'Celular': String(row['Celular'] || row['celular'] || row['Telefono'] || row['telefono'] || '9999999999'),
                        'Correo': row['Correo'] || row['correo'] || row['Email'] || row['email'] || 'correo@ejemplo.com',
                    }));
                } else {
                    type = 'productos';
                    mappedData = jsonData.map((row: any) => ({
                        'Nombre': row['Nombre'] || row['nombre'] || row['Descripcion'] || row['descripcion'] || 'Producto General',
                        'Código Principal': String(row['Código Principal'] || row['codigo_principal'] || row['Codigo'] || row['codigo'] || '001'),
                        'Código Auxiliar': String(row['Código Auxiliar'] || row['codigo_auxiliar'] || row['Auxiliar'] || ''),
                        'Precio Unitario': parseFloat(row['Precio Unitario'] || row['precio_unitario'] || row['Precio'] || row['precio'] || '0').toFixed(2),
                        'Código IVA': mapCodigoIva(row['Código IVA'] || row['codigo_iva'] || row['IVA'] || row['Tarifa IVA'] || '5'),
                        'Código ICE': String(row['Código ICE'] || row['codigo_ice'] || row['ICE'] || '0'),
                        'Código IRPNR': String(row['Código IRPNR'] || row['codigo_irpnr'] || '0'),
                        'Estado (A/I)': 'A'
                    }));
                }

                newProcessedFiles.push({
                    name: file.name,
                    type,
                    data: mappedData,
                    status: 'success'
                });
            } catch (error) {
                console.error("Error processing file", file.name, error);
                newProcessedFiles.push({
                    name: file.name,
                    type: 'productos',
                    data: [],
                    status: 'error',
                    message: 'Error al procesar el archivo.'
                });
            }
        }

        setProcessedFiles(prev => [...prev, ...newProcessedFiles]);
        setIsProcessing(false);
    }, []);

    const mapTipoIdentificacion = (val: string | number) => {
        const v = String(val).toLowerCase();
        if (v.includes('ruc') || v === '04' || v === '4') return '04';
        if (v.includes('cedula') || v.includes('cédula') || v === '05' || v === '5') return '05';
        if (v.includes('pasaporte') || v === '06' || v === '6') return '06';
        if (v.includes('final') || v === '07' || v === '7') return '07';
        return '04'; // default
    };

    const mapCodigoIva = (val: string | number) => {
        const v = String(val).replace('%', '').trim();
        if (v === '5' || v === '5.00') return '5'; // 5%
        if (v === '4' || v === '15' || v === '15.00') return '4'; // 15%
        if (v === '0' || v === '0.00' || v.toLowerCase() === 'cero') return '0'; // 0%
        return '4'; // default to 15% (4) si es desconocido, Zifact maneja 4 como 15%. (En Ecuador era 12%, luego 15%). Zifact pide: 5 (5%), 4 (15%) o 0 (0%).
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        }
    });

    const downloadConverted = (file: ProcessedFile) => {
        const worksheet = xlsx.utils.json_to_sheet(file.data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, file.type === 'productos' ? 'Productos' : 'Clientes');
        // Zifact pide extensiones .xls o .xlsx. Le daremos .xlsx para mejor compatibilidad actual
        const outFileName = `Zifact_${file.type}_Migrado.xlsx`;
        xlsx.writeFile(workbook, outFileName);
    };

    const downloadAll = () => {
        processedFiles.filter(f => f.status === 'success').forEach(downloadConverted);
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#020617] text-white overflow-y-auto custom-scrollbar font-body">
            {/* Header */}
            <div className="p-6 md:p-10 border-b border-white/5 sticky top-0 bg-[#020617]/90 backdrop-blur-md z-20 flex justify-between items-end">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#2B6AFF]/10 border border-[#2B6AFF]/20 text-[#2B6AFF] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                        <LucideIcons.ArrowRightLeft size={12} /> Adaptador Convert
                    </div>
                    <h1 className="text-3xl md:text-5xl font-editorial tracking-tight text-white mb-2">
                        Migración a Zifact
                    </h1>
                    <p className="text-sm font-light text-slate-400">
                        Sube tus archivos de Productos o Clientes de Ecuafact y obtenlos listos para Zifact.
                    </p>
                </div>
                {processedFiles.length > 0 && (
                    <button
                        onClick={downloadAll}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#2B6AFF] to-[#6366F1] text-white text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(43,106,255,0.4)] flex items-center gap-2"
                    >
                        <LucideIcons.Download size={16} /> Descargar Todo
                    </button>
                )}
            </div>

            <div className="p-6 md:p-10 flex flex-col gap-8 flex-1 max-w-5xl mx-auto w-full">
                {/* Info Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-6 flex items-start gap-4 hover:translate-y-[-4px] transition-transform duration-300">
                        <div className="w-12 h-12 rounded-full bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                            <LucideIcons.Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Productos Zifact</h3>
                            <p className="text-xs text-slate-400 font-light">
                                Formato soportado: Nombre, Código Principal, Auxiliar, Precio, IVA, ICE, IRPNR, Estado (A/I).
                            </p>
                        </div>
                    </div>
                    <div className="glass-card-premium gradient-obsidian border border-white/10 rounded-3xl p-6 flex items-start gap-4 hover:translate-y-[-4px] transition-transform duration-300">
                        <div className="w-12 h-12 rounded-full bg-[#04B17B]/10 text-[#04B17B] flex items-center justify-center flex-shrink-0">
                            <LucideIcons.Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Clientes Zifact</h3>
                            <p className="text-xs text-slate-400 font-light">
                                Formato soportado: Nombre, Tipo de Identificación, Identificación, Dirección, Celular, Correo.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Dropzone */}
                <div
                    {...getRootProps()}
                    className={`
                        w-full h-64 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-300
                        ${isDragActive 
                            ? 'border-[#2B6AFF] bg-[#2B6AFF]/5 scale-[1.02]' 
                            : 'border-white/10 bg-white/5 hover:border-[#2B6AFF]/50 hover:bg-white/10'
                        }
                    `}
                >
                    <input {...getInputProps()} />
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2B6AFF]/20 to-[#6366F1]/20 flex items-center justify-center mb-6 text-[#2B6AFF]">
                        {isProcessing ? (
                            <LucideIcons.RefreshCw size={32} className="animate-spin" />
                        ) : (
                            <LucideIcons.UploadCloud size={32} />
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                        {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra los archivos de Ecuafact'}
                    </h3>
                    <p className="text-sm text-slate-400 font-light max-w-sm">
                        O haz clic para seleccionar. Aceptamos archivos .xls y .xlsx. Sube los archivos de Clientes y Productos juntos o por separado.
                    </p>
                </div>

                {/* File List */}
                <AnimatePresence>
                    {processedFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-4 border-b border-white/5 pb-2">
                                Archivos Procesados
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {processedFiles.map((file, idx) => (
                                    <div key={idx} className="glass-card-premium gradient-obsidian border border-white/10 rounded-2xl p-5 flex items-center justify-between group hover:border-[#04B17B]/40 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                                ${file.status === 'success' ? 'bg-[#04B17B]/20 text-[#04B17B]' : 'bg-red-500/20 text-red-400'}
                                            `}>
                                                {file.status === 'success' ? <LucideIcons.CheckCircle2 size={20} /> : <LucideIcons.AlertTriangle size={20} />}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white text-sm truncate max-w-[150px]" title={file.name}>
                                                    {file.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                    {file.type} • {file.status === 'success' ? `${file.data.length} registros` : 'Error'}
                                                </div>
                                            </div>
                                        </div>
                                        {file.status === 'success' && (
                                            <button
                                                onClick={() => downloadConverted(file)}
                                                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#2B6AFF] hover:border-[#2B6AFF] transition-all"
                                                title="Descargar Convertido"
                                            >
                                                <LucideIcons.Download size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
