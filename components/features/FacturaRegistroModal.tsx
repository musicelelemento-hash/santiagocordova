import React, { useState } from 'react';
import { 
    X, FileText, Plus, Upload, DollarSign, Calendar, 
    User, Check, AlertCircle, Save, ArrowRight
} from 'lucide-react';
import { Client, MonthlyInvoicingRecord, StoredFile } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SupabaseService } from '../../services/supabaseClientService';
import { v4 as uuidv4 } from 'uuid';

interface FacturaRegistroModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    currentPeriod: string; // e.g. "2026-08"
    onSaveInvoice: (clientId: string, invoiceData: {
        period: string;
        secuencial?: string;
        amount?: number;
        clientRecipient?: string;
        date: string;
        file?: StoredFile;
    }) => Promise<void> | void;
}

export const FacturaRegistroModal: React.FC<FacturaRegistroModalProps> = ({
    isOpen,
    onClose,
    client,
    currentPeriod,
    onSaveInvoice
}) => {
    const { toast } = useToast();
    const [secuencial, setSecuencial] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [recipient, setRecipient] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
                toast.error("Por favor selecciona un archivo PDF.");
                return;
            }
            setUploadedFile(file);
            toast.info(`Comprobante seleccionado: ${file.name}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let storedFile: StoredFile | undefined;

            if (uploadedFile) {
                toast.info("Subiendo PDF a la Nube...");
                const reader = new FileReader();
                const fileBase64Promise = new Promise<string>((resolve) => {
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsDataURL(uploadedFile);
                });

                const content = await fileBase64Promise;
                const path = `${client.id}/invoices_${currentPeriod}_${Date.now()}.pdf`;
                const { url, path: bucketPath } = await SupabaseService.uploadFileToStorage('clients-vault', path, content);

                storedFile = {
                    name: uploadedFile.name,
                    size: uploadedFile.size,
                    type: 'pdf',
                    lastModified: Date.now(),
                    url,
                    bucketPath,
                    metadata: {
                        secuencial: secuencial || 'N/A',
                        amount: typeof amount === 'number' ? amount : 0,
                        recipient: recipient || 'N/A',
                        period: currentPeriod,
                        uploadedAt: new Date().toISOString()
                    }
                };
            }

            await onSaveInvoice(client.id, {
                period: currentPeriod,
                secuencial: secuencial.trim() || undefined,
                amount: typeof amount === 'number' ? amount : undefined,
                clientRecipient: recipient.trim() || undefined,
                date,
                file: storedFile
            });

            toast.success(`✅ Factura registrada para ${client.name} en período ${currentPeriod}.`);
            onClose();
        } catch (err: any) {
            toast.error(`Error al registrar factura: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-lg bg-[#051424] border border-white/15 rounded-[2.5rem] shadow-2xl overflow-hidden font-sans"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-[#0b1326]/60 backdrop-blur-xl font-mono">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00A896] to-teal-600 flex items-center justify-center text-white shadow-lg shadow-[#00A896]/20">
                            <FileText size={20} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-widest">REGISTRO DE FACTURA EMITIDA</span>
                            <h2 className="text-base font-black text-white uppercase font-display leading-tight truncate max-w-xs">
                                {client.tradeName || client.name}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5 text-xs font-mono">
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                        <span className="text-slate-400">Período de Facturación:</span>
                        <span className="text-[#00A896] font-bold uppercase">{currentPeriod}</span>
                    </div>

                    {/* Secuencial & Monto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                No. Secuencial (Opcional)
                            </label>
                            <input
                                type="text"
                                value={secuencial}
                                onChange={e => setSecuencial(e.target.value)}
                                placeholder="001-100-000000123"
                                className="w-full px-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                Monto Facturado ($ USD)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder="45.00"
                                    className="w-full pl-8 pr-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Receptor / Cliente Comprador */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Nombre o RUC del Receptor (Comprador)
                        </label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            placeholder="Ej: Clínica San José / Consumidor Final..."
                            className="w-full px-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]"
                        />
                    </div>

                    {/* Fecha de Emisión */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Fecha de Emisión
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-white outline-none focus:border-[#00A896]"
                        />
                    </div>

                    {/* Subida Opcional de PDF / RIDE */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                            <span>Respaldo PDF / RIDE (Opcional)</span>
                            {uploadedFile && <span className="text-emerald-400 text-[9px]">Listo para subir</span>}
                        </label>
                        <label className="border border-dashed border-white/15 hover:border-[#00A896]/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#020b14] transition-all group">
                            <Upload size={18} className="text-slate-500 group-hover:text-[#00A896] transition-colors" />
                            <span className="text-[10px] text-slate-400 text-center font-sans">
                                {uploadedFile ? uploadedFile.name : 'Haz clic para adjuntar el PDF de la factura'}
                            </span>
                            <input 
                                type="file" 
                                accept=".pdf" 
                                className="hidden" 
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>

                    {/* Botones */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold uppercase transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold uppercase tracking-wider shadow-lg shadow-[#00A896]/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Save size={16} />
                            <span>{isSaving ? 'Registrando...' : 'Registrar Factura (+1)'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
