import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SriExtractionResult, Client, TaxRegime } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { Check, X, ChevronRight, ChevronLeft, UserPlus, UploadCloud, AlertCircle } from 'lucide-react';

interface BulkClientWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    extractedData: SriExtractionResult[];
    onApprove: (client: Client) => void;
}

export const BulkClientWizardModal: React.FC<BulkClientWizardModalProps> = ({ isOpen, onClose, extractedData, onApprove }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentClientData, setCurrentClientData] = useState<Partial<Client> | null>(null);

    useEffect(() => {
        if (extractedData.length > 0 && extractedData[currentIndex]) {
            const data = extractedData[currentIndex];
            setCurrentClientData({
                id: uuidv4(),
                name: data.apellidos_nombres,
                ruc: data.ruc,
                regime: data.regimen,
                phones: [data.contacto.celular].filter(Boolean),
                email: data.contacto.email,
                address: data.direccion,
                sriPassword: '',
                isActive: true,
                needsVerification: false,
                taxProfile: {
                    ivaFrequency: data.obligaciones_tributarias === 'semestral' ? 'Semestral' : 'Mensual',
                    requiresAnnualRenta: data.lista_obligaciones.includes('Impuesto a la Renta'),
                    requiresAnexosGastos: false,
                    hasActiveDevolucionIva: false,
                    hasActiveElderlyDevolucionIva: false,
                    requiresIce: false,
                    requiresAnexoPvp: false
                },
                declarations: [],
                vault: []
            });
        }
    }, [currentIndex, extractedData]);

    if (!isOpen || extractedData.length === 0 || !currentClientData) return null;

    const total = extractedData.length;
    const isLast = currentIndex === total - 1;

    const handleNext = () => {
        if (!isLast) setCurrentIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const handleApprove = () => {
        if (currentClientData) {
            onApprove(currentClientData as Client);
        }
        if (isLast) {
            onClose();
        } else {
            handleNext();
        }
    };

    const handleDiscard = () => {
        if (isLast) {
            onClose();
        } else {
            handleNext();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Carga Masiva de Clientes (RUC)" size="3xl">
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <UserPlus className="text-primary" />
                        Revisión de Cliente {currentIndex + 1} de {total}
                    </h3>
                    <div className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                        {currentIndex + 1} / {total}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Razón Social</label>
                            <input
                                type="text"
                                value={currentClientData.name || ''}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, name: e.target.value })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">RUC</label>
                            <input
                                type="text"
                                value={currentClientData.ruc || ''}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, ruc: e.target.value })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Correo Electrónico</label>
                            <input
                                type="email"
                                value={currentClientData.email || ''}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, email: e.target.value })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono / Celular</label>
                            <input
                                type="text"
                                value={currentClientData.phones?.[0] || ''}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, phones: [e.target.value] })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm font-mono"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dirección</label>
                            <input
                                type="text"
                                value={currentClientData.address || ''}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, address: e.target.value })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Régimen</label>
                            <select
                                value={currentClientData.regime || TaxRegime.General}
                                onChange={(e) => setCurrentClientData({ ...currentClientData, regime: e.target.value as TaxRegime })}
                                className="w-full p-2 glass-card-premium rounded-lg text-sm"
                            >
                                {Object.values(TaxRegime).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-8">
                    <button
                        onClick={handleDiscard}
                        className="px-6 py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-2"
                    >
                        <X size={18} />
                        Descartar
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className={`p-3 rounded-xl transition-all ${currentIndex === 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-white shadow-sm hover:shadow-md'}`}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        
                        <button
                            onClick={handleApprove}
                            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center gap-2"
                        >
                            <Check size={18} />
                            {isLast ? 'Aprobar y Finalizar' : 'Aprobar y Siguiente'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
