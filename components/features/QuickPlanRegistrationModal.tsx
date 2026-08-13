import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Upload, FileText, Check, Loader, User, CreditCard, Download, Camera } from 'lucide-react';
import { extractDataFromSriPdf, fileToBase64 } from '../../services/pdfExtraction';
import { UnifiedStorageService } from '../../services/unifiedStorageService';
import { generateAutorizacionEcuafact } from '../../services/docxModifier';
import { v4 as uuidv4 } from 'uuid';
import { Client, TaxRegime, StoredFile } from '../../types';
import { useToast } from '../../context/ToastContext';

interface QuickPlanRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (client: Client) => void;
}

export const QuickPlanRegistrationModal: React.FC<QuickPlanRegistrationModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const { toast } = useToast();
    const rucInputRef = useRef<HTMLInputElement>(null);
    const frontInputRef = useRef<HTMLInputElement>(null);
    const backInputRef = useRef<HTMLInputElement>(null);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractedData, setExtractedData] = useState<{ nombre: string; ruc: string; regimen: TaxRegime } | null>(null);
    const [rucPdfFile, setRucPdfFile] = useState<StoredFile | null>(null);
    const [frontIdFile, setFrontIdFile] = useState<StoredFile | null>(null);
    const [backIdFile, setBackIdFile] = useState<StoredFile | null>(null);

    const handleRucUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error("Por favor suba un archivo PDF válido del RUC.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const extracted = await extractDataFromSriPdf(file);
            const uploadedFile = await UnifiedStorageService.uploadFile(file, file.name, 'rucs');
            
            setExtractedData({
                nombre: extracted.apellidos_nombres,
                ruc: extracted.ruc,
                regimen: extracted.regimen || TaxRegime.General
            });

            setRucPdfFile(uploadedFile);

            toast.success("Datos del RUC extraídos correctamente.");
        } catch (error) {
            console.error(error);
            toast.error("Error al leer el PDF del RUC.");
        } finally {
            setIsAnalyzing(false);
            if (rucInputRef.current) rucInputRef.current.value = '';
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Por favor suba una imagen válida.");
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const storedFile: StoredFile = {
                    name: file.name,
                    size: file.size,
                    type: 'image',
                    content,
                    lastModified: file.lastModified
                };
                if (side === 'front') setFrontIdFile(storedFile);
                else setBackIdFile(storedFile);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error(`Error al subir la foto ${side}.`);
        }
    };

    const handleRegisterAndDownload = async () => {
        if (!extractedData) {
            toast.error("Falta extraer los datos del RUC.");
            return;
        }

        try {
            const cedula = extractedData.ruc.substring(0, 10);
            
            // Format current date: Mes DD del YYYY
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const today = new Date();
            const fechaStr = `${months[today.getMonth()]} ${today.getDate()} del ${today.getFullYear()}`;

            // Generate DOCX
            toast.info("Generando Autorización de Ecuafact...");
            await generateAutorizacionEcuafact(extractedData.nombre, cedula, fechaStr);

            // Create client object
            const newClient: Client = {
                id: uuidv4(),
                ruc: extractedData.ruc,
                name: extractedData.nombre,
                sriPassword: '',
                regime: extractedData.regimen,
                clientType: 'solo_plan',
                requiresDeclarations: false,
                isActive: true,
                rucPdf: rucPdfFile || undefined,
                idCardFront: frontIdFile || undefined,
                idCardBack: backIdFile || undefined,
                facturadorConfig: {
                    programName: 'ECUAFACT',
                    documentStatus: 'Plan Registrado',
                    documentCount: 60, // default
                    username: extractedData.ruc,
                    password: ''
                },
                taxProfile: {
                    ivaFrequency: 'Ninguno',
                    requiresAnnualRenta: false,
                    requiresAnexosGastos: false,
                    hasActiveDevolucionIva: false,
                    hasActiveElderlyDevolucionIva: false,
                    requiresIce: false,
                    requiresAnexoPvp: false
                }
            };

            toast.success("¡Cliente registrado exitosamente!");
            onSuccess(newClient);
        } catch (error) {
            toast.error("Hubo un error en la generación del documento.");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="🚀 Registro Rápido Facturador" size="lg">
            <div className="space-y-6 p-4">
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-5 text-sm text-sky-700 dark:text-sky-300">
                    <p className="font-semibold mb-1">Registro Expreso sin Matriz Tributaria</p>
                    <p className="text-xs opacity-90">Sube el RUC para extraer los datos automáticamente. El cliente se registrará solo como comprador de plan/firma, sin generar alertas de impuestos.</p>
                </div>

                {/* Upload RUC Section */}
                <div 
                    onClick={() => !isAnalyzing && rucInputRef.current?.click()}
                    className={`
                        relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
                        ${isAnalyzing ? 'border-primary bg-primary/5' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-white/10 hover:border-primary/50'}
                    `}
                >
                    <input type="file" ref={rucInputRef} onChange={handleRucUpload} accept=".pdf" className="hidden" />
                    
                    {isAnalyzing ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-xs font-bold text-primary uppercase">Analizando RUC...</p>
                        </div>
                    ) : extractedData ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="bg-emerald-500/10 p-3 rounded-full text-emerald-500">
                                <Check size={24} />
                            </div>
                            <p className="text-xs font-bold text-emerald-600 uppercase">RUC Analizado</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="bg-primary/10 p-4 rounded-full text-primary">
                                <FileText size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold">Subir Certificado RUC (.pdf)</p>
                                <p className="text-xs text-slate-500 mt-1">Obligatorio para extraer datos</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Optional Photo Uploads */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Cédula Frente</span>
                        {frontIdFile ? (
                            <div className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><Check size={14}/> Subido</div>
                        ) : (
                            <button onClick={() => frontInputRef.current?.click()} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
                                <Camera size={14}/> Subir Foto
                            </button>
                        )}
                        <input type="file" ref={frontInputRef} onChange={(e) => handleImageUpload(e, 'front')} accept="image/*" className="hidden" />
                    </div>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Cédula Reverso</span>
                        {backIdFile ? (
                            <div className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><Check size={14}/> Subido</div>
                        ) : (
                            <button onClick={() => backInputRef.current?.click()} className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
                                <Camera size={14}/> Subir Foto
                            </button>
                        )}
                        <input type="file" ref={backInputRef} onChange={(e) => handleImageUpload(e, 'back')} accept="image/*" className="hidden" />
                    </div>
                </div>

                {/* Extracted Data Display */}
                {extractedData && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <User className="text-slate-400" size={18} />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500">Nombres Extraídos</p>
                                <p className="text-sm font-bold">{extractedData.nombre}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <CreditCard className="text-slate-400" size={18} />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500">Cédula Detectada</p>
                                <p className="text-sm font-mono font-bold">{extractedData.ruc.substring(0, 10)}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-white/10">
                    <button onClick={onClose} className="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-700 dark:hover:text-white">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleRegisterAndDownload}
                        disabled={!extractedData}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-primary/30 transition-all"
                    >
                        <Download size={16} />
                        Registrar y Generar DOCX
                    </button>
                </div>
            </div>
        </Modal>
    );
};
