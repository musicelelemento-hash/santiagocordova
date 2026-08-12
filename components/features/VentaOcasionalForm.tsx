import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { extractDataFromSriPdf } from '../../services/pdfExtraction';
import { generateEcuafactContract } from '../../utils/docxGenerator';
import { SupabaseService } from '../../services/supabaseClientService';
import { Client, TaxRegime } from '../../types';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, FileSignature } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const VentaOcasionalForm: React.FC<{ 
  onBuyerDataExtracted: (name: string, ruc: string, email: string, phone: string, address: string) => void;
  buyerName: string;
  buyerRuc: string;
}> = ({ onBuyerDataExtracted, buyerName, buyerRuc }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    toast.info(`Procesando ${file.name}...`);
    
    try {
      const extracted = await extractDataFromSriPdf(file);
      if (extracted && extracted.ruc) {
        onBuyerDataExtracted(
          extracted.apellidos_nombres, 
          extracted.ruc, 
          extracted.email || '', 
          extracted.telefono || '', 
          extracted.direccion_corta || ''
        );
        toast.success(`Datos de ${extracted.apellidos_nombres} extraídos correctamente.`);
      } else {
        toast.warning("No se encontró RUC válido en el PDF.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar el PDF.");
    } finally {
      setIsProcessing(false);
    }
  }, [onBuyerDataExtracted, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  const handleGenerateDocx = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!buyerName || !buyerRuc) {
      toast.warning('Debe existir al menos Nombre y Cédula/RUC para generar el contrato.');
      return;
    }
    
    setIsGeneratingDocx(true);
    try {
      // 1. Guardar o actualizar el cliente silenciosamente en BD como "Solo Plan"
      const newClient: Client = {
        id: buyerRuc, // usamos el RUC como ID o Supabase se encargará
        name: buyerName,
        tradeName: buyerName,
        ruc: buyerRuc,
        email: '',
        phone: '',
        regime: TaxRegime.General, // Valor por defecto
        taxProfile: {
          ivaFrequency: 'Ninguno',
          requiresAnnualRenta: false
        },
        requiresDeclarations: false,
        clientType: 'solo_plan',
        isActive: true,
        declarations: [],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await SupabaseService.upsertClient(newClient);
      toast.success('Cliente guardado en directorio (Solo Plan).');

      // 2. Generar el contrato
      await generateEcuafactContract({
        nombres: buyerName,
        cedula: buyerRuc
      });
      toast.success('Contrato Ecuafact descargado con éxito.');
    } catch (error) {
      console.error(error);
      toast.error('Error al generar la plantilla DOCX o guardar el cliente.');
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 mt-6 relative overflow-hidden group shadow-inner">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 relative z-10 gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <FileSignature className="text-primary" size={18} />
            Auto-Registro de Plan / Ecuafact
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Sin obligaciones tributarias en la plataforma
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Dropzone Area */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[140px]
            ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-primary/50'}`}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
             <div className="flex flex-col items-center gap-2 animate-pulse text-primary">
                <FileText size={32} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Extrayendo Datos...</span>
             </div>
          ) : (
            <>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-slate-400 group-hover:text-primary transition-colors">
                <UploadCloud size={24} />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">
                {isDragActive ? 'Suelta el RUC aquí' : 'Arrastra o haz clic para subir el RUC (PDF)'}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 text-center">
                Extracción automática de variables
              </p>
            </>
          )}
        </div>

        {/* Action Panel */}
        <div className="flex flex-col justify-center gap-4">
          <button
            onClick={handleGenerateDocx}
            disabled={isGeneratingDocx || !buyerName || !buyerRuc}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg
              ${(isGeneratingDocx || !buyerName || !buyerRuc) 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30 hover:scale-[1.02]'}`}
          >
            {isGeneratingDocx ? (
              <span className="animate-spin mr-1">↻</span>
            ) : (
              <FileText size={16} />
            )}
            Generar Autorización Ecuafact (.docx)
          </button>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider leading-relaxed">
              El recibo (PDF) para imprimir y firmar se generará normalmente con el botón principal "Generar Factura" de la derecha, usando estos datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
