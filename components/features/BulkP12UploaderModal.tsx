import React, { useState, useRef } from 'react';
import {
    UploadCloud, KeyRound, CheckCircle2, AlertTriangle, Lock, Unlock,
    FileKey, Trash2, Check, RefreshCw, UserCheck, UserPlus, HelpCircle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { extractP12Metadata } from '../../utils/p12Reader';
import { useToast } from '../../context/ToastContext';
import { Client, StoredFile, TaxRegime } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '../ui/Modal';

interface BulkP12UploaderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface P12ItemQueue {
    id: string;
    file: File;
    base64Content: string;
    fileName: string;
    passwordInput: string;
    status: 'pending' | 'unlocked' | 'error';
    errorMessage?: string;
    metadata?: {
        ruc?: string;
        commonName?: string;
        issuerName?: string;
        notBefore?: Date;
        notAfter?: Date;
    };
    matchedClient?: Client;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Retornar base64 limpio sin encabezado data:...
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export const BulkP12UploaderModal: React.FC<BulkP12UploaderModalProps> = ({ isOpen, onClose }) => {
    const { clients, updateClient, addClient } = useAppStore();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [queue, setQueue] = useState<P12ItemQueue[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Intentar descifrar un archivo .p12 con una contraseña dada
    const tryUnlockItem = (item: P12ItemQueue, passwordToTest: string): P12ItemQueue => {
        try {
            const meta = extractP12Metadata(item.base64Content, passwordToTest);

            // Buscar coincidencia de cliente en la base de datos por RUC extraído
            const matched = meta.ruc ? clients.find(c => !c.isDeleted && c.ruc.trim() === meta.ruc?.trim()) : undefined;

            return {
                ...item,
                passwordInput: passwordToTest,
                status: 'unlocked',
                errorMessage: undefined,
                metadata: {
                    ruc: meta.ruc,
                    commonName: meta.commonName,
                    issuerName: meta.issuerName,
                    notBefore: meta.notBefore,
                    notAfter: meta.notAfter
                },
                matchedClient: matched
            };
        } catch (err: any) {
            return {
                ...item,
                passwordInput: passwordToTest,
                status: 'error',
                errorMessage: 'Contraseña incorrecta o firma inválida'
            };
        }
    };

    // Procesar la selección masiva de archivos
    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        const newQueueItems: P12ItemQueue[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
                continue;
            }

            try {
                const b64 = await fileToBase64(file);
                let item: P12ItemQueue = {
                    id: uuidv4(),
                    file,
                    base64Content: b64,
                    fileName: file.name,
                    passwordInput: '',
                    status: 'pending'
                };

                // 1. Intentar probar si el cliente ya tiene contraseña de firma guardada en la BD
                // Buscar cliente coincidente por nombre en el archivo (ej: "julio_mosquera.p12")
                const lowerFileName = file.name.toLowerCase();
                const possibleClient = clients.find(c => {
                    if (!c.electronicSignaturePassword) return false;
                    const cleanName = c.name.toLowerCase().replace(/\s+/g, '');
                    const cleanRuc = c.ruc;
                    return lowerFileName.includes(cleanRuc) || lowerFileName.includes(cleanName.split(' ')[0]);
                });

                if (possibleClient && possibleClient.electronicSignaturePassword) {
                    const unlocked = tryUnlockItem(item, possibleClient.electronicSignaturePassword);
                    if (unlocked.status === 'unlocked') {
                        item = unlocked;
                    }
                }

                newQueueItems.push(item);
            } catch (err) {
                console.error("Error reading p12 file:", err);
            }
        }

        setQueue(prev => [...prev, ...newQueueItems]);
        setIsProcessing(false);
        toast.success(`Cargados ${newQueueItems.length} archivos .p12 a la cola de verificación.`);
    };

    // Probar contraseña manual para un elemento de la cola
    const handleTestPassword = (itemId: string, passwordValue: string) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return tryUnlockItem(item, passwordValue);
        }));
    };

    // Remover de la cola
    const handleRemoveItem = (itemId: string) => {
        setQueue(prev => prev.filter(i => i.id !== itemId));
    };

    // Aplicar y Vincular todas las firmas desbloqueadas a la base de datos
    const handleApplyAllUnlocked = async () => {
        const unlockedItems = queue.filter(i => i.status === 'unlocked' && i.metadata?.ruc);
        if (unlockedItems.length === 0) {
            toast.error("No hay firmas descifradas y listas para guardar.");
            return;
        }

        setIsSaving(true);
        let updatedCount = 0;
        let createdCount = 0;

        for (const item of unlockedItems) {
            const { ruc, commonName, issuerName, notBefore, notAfter } = item.metadata!;
            const signatureFileObj: StoredFile = {
                name: item.fileName,
                type: 'p12',
                size: item.file.size,
                lastModified: item.file.lastModified,
                content: item.base64Content
            };

            const expDate = notAfter ? notAfter.toISOString().split('T')[0] : '';
            const issueDate = notBefore ? notBefore.toISOString().split('T')[0] : '';

            // Buscar si cliente ya existe
            const existingClient = clients.find(c => !c.isDeleted && c.ruc.trim() === ruc?.trim());

            if (existingClient) {
                await updateClient(existingClient.id, {
                    signatureFile: signatureFileObj,
                    electronicSignaturePassword: item.passwordInput,
                    signatureExpirationDate: expDate,
                    signatureIssueDate: issueDate,
                    signatureProvider: issuerName
                });
                updatedCount++;
            } else {
                // Crear cliente nuevo automáticamente con la información del certificado
                const newClient: Client = {
                    id: uuidv4(),
                    name: commonName || 'Contribuyente Nuevo',
                    ruc: ruc || '',
                    sriPassword: '',
                    email: '',
                    phones: [],
                    declarations: [],
                    notes: `Creado automáticamente desde Subida Masiva de Firma .p12.\nEmisor: ${issuerName}`,
                    isActive: true,
                    regime: TaxRegime.General,
                    address: '',
                    signatureFile: signatureFileObj,
                    electronicSignaturePassword: item.passwordInput,
                    signatureExpirationDate: expDate,
                    signatureIssueDate: issueDate,
                    signatureProvider: issuerName,
                    taxProfile: {
                        ivaFrequency: 'Mensual',
                        requiresAnnualRenta: true,
                        requiresAnexosGastos: false,
                        hasActiveDevolucionIva: false,
                        hasActiveElderlyDevolucionIva: false,
                        requiresIce: false,
                        requiresAnexoPvp: false
                    }
                };
                await addClient(newClient);
                createdCount++;
            }
        }

        setIsSaving(false);
        toast.success(`🎉 Proceso completado: ${updatedCount} firmas actualizadas y ${createdCount} clientes creados.`);
        setQueue([]);
        onClose();
    };

    if (!isOpen) return null;

    const unlockedCount = queue.filter(q => q.status === 'unlocked').length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📥 Subidor Masivo de Firmas Electrónicas (.p12)" size="4xl">
            <div className="space-y-6 p-2 md:p-4 text-white">

                {/* Header Explicativo */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent border border-teal-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                Asignación Masiva Inteligente
                            </span>
                        </div>
                        <h3 className="text-base font-black text-white">Carga Múltiples Archivos .p12 de Golpe</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Arrastra todas tus firmas digitales. El sistema leerá el <strong>RUC y Nombre del Titular</strong> de cada firma y te solicitará la clave para desencriptarla y vincularla al cliente.
                        </p>
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-teal-500/25 active:scale-95 shrink-0 flex items-center gap-2"
                    >
                        <UploadCloud size={18} />
                        <span>Seleccionar Firmas (.p12)</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFilesSelected(e.target.files)}
                        multiple
                        accept=".p12,.pfx"
                        className="hidden"
                    />
                </div>

                {/* Zona de Drop & Status de Cola */}
                {queue.length === 0 ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/20 hover:border-teal-400/50 rounded-3xl p-12 text-center bg-slate-900/40 hover:bg-slate-900/60 transition-all cursor-pointer space-y-4 group"
                    >
                        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400 group-hover:text-teal-400 group-hover:scale-110 transition-all shadow-xl">
                            <FileKey size={32} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white">Haz clic o arrastra tus archivos .p12 aquí</p>
                            <p className="text-xs text-slate-400 mt-1">Puedes seleccionar 5, 10, 20 o más archivos simultáneamente.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                                Cola de Procesamiento ({queue.length} archivos · {unlockedCount} desencriptados)
                            </span>
                            <button
                                onClick={() => setQueue([])}
                                className="text-[10px] text-rose-400 hover:underline uppercase font-bold"
                            >
                                Limpiar Cola
                            </button>
                        </div>

                        {/* Lista Interactiva de Firmas */}
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                            {queue.map((item, idx) => {
                                const isUnlocked = item.status === 'unlocked';
                                const isError = item.status === 'error';

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                            isUnlocked
                                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                                : isError
                                                ? 'bg-rose-950/20 border-rose-500/30'
                                                : 'bg-slate-900/60 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                                            <div className={`p-2.5 rounded-xl border ${
                                                isUnlocked ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                isError ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                                'bg-slate-800 text-slate-400 border-white/10'
                                            }`}>
                                                {isUnlocked ? <Unlock size={18} /> : <Lock size={18} />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-bold text-white font-mono truncate">{item.fileName}</p>
                                                    {isUnlocked && (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase">
                                                            Desbloqueada
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Detalle si ya fue unlocked */}
                                                {isUnlocked && item.metadata && (
                                                    <div className="mt-1 space-y-0.5 text-[11px]">
                                                        <p className="font-bold text-emerald-300 uppercase truncate">
                                                            {item.metadata.commonName || 'Titular Extraído'}
                                                        </p>
                                                        <p className="font-mono text-slate-400 text-[10px]">
                                                            RUC: <strong className="text-white">{item.metadata.ruc || 'No disponible'}</strong> · Emisor: {item.metadata.issuerName || 'N/A'}
                                                        </p>

                                                        {item.matchedClient ? (
                                                            <div className="flex items-center gap-1 text-[10px] text-teal-400 font-bold mt-1">
                                                                <UserCheck size={12} />
                                                                <span>Vinculado a Cliente Registrado: {item.matchedClient.name}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold mt-1">
                                                                <UserPlus size={12} />
                                                                <span>Cliente Nuevo (Se creará automáticamente en el sistema)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {isError && (
                                                    <p className="text-[10px] text-rose-400 mt-1 font-bold">
                                                        ⚠️ {item.errorMessage}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Input de Contraseña e Interacción */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    value={item.passwordInput}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, passwordInput: val } : q));
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleTestPassword(item.id, item.passwordInput);
                                                    }}
                                                    placeholder="Ingresa la contraseña .p12..."
                                                    className="w-48 sm:w-56 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 outline-none font-mono"
                                                />
                                            </div>

                                            <button
                                                onClick={() => handleTestPassword(item.id, item.passwordInput)}
                                                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md active:scale-95"
                                                title="Probar contraseña y descifrar firma"
                                            >
                                                {isUnlocked ? <Check size={14} /> : <Unlock size={14} />}
                                            </button>

                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
                                                title="Eliminar de la cola"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Modal con Botón de Guardado Masivo */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-slate-400">
                        {unlockedCount > 0 ? (
                            <span className="text-emerald-400 font-bold">
                                Listas para guardar: {unlockedCount} de {queue.length} firmas
                            </span>
                        ) : (
                            <span>Ingresa la contraseña de cada firma para descifrarla</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApplyAllUnlocked}
                            disabled={unlockedCount === 0 || isSaving}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            <span>Guardar {unlockedCount} Firmas en el Sistema</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
