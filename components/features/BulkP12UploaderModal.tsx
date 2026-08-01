import React, { useState, useRef } from 'react';
import {
    UploadCloud, KeyRound, CheckCircle2, AlertTriangle, Lock, Unlock,
    FileKey, Trash2, Check, RefreshCw, UserCheck, UserPlus, HelpCircle, Sparkles, Lightbulb, Search
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
    manualRucInput: string;
    status: 'pending' | 'unlocked' | 'error';
    errorMessage?: string;
    unlockedViaPattern?: string;
    candidateSuggestions?: string[];
    possibleClientHint?: Client;
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
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

// Extraer secuencias de 9 a 13 dígitos del nombre del archivo (ej: 0701893687 en 23927282_identity_0701893687.p12)
const extractPossibleRucOrCedula = (filename: string): string[] => {
    const matches = filename.match(/\d{9,13}/g) || [];
    return Array.from(new Set(matches));
};

// Encontrar cliente por RUC en nombre de archivo o entrada manual
const findMatchingClient = (filename: string, manualRuc: string, clients: Client[]): Client | undefined => {
    const activeClients = clients.filter(c => !c.isDeleted && c.isActive);

    // 1. Probar RUC ingresado manualmente por el usuario
    if (manualRuc && manualRuc.trim().length >= 3) {
        const cleanReq = manualRuc.trim().toLowerCase();
        const matched = activeClients.find(c => {
            return c.ruc.toLowerCase().includes(cleanReq) || c.name.toLowerCase().includes(cleanReq);
        });
        if (matched) return matched;
    }

    // 2. Extraer números de 9-13 dígitos del nombre del archivo (ej: 0701893687 -> RUC 0701893687001)
    const numbersInFile = extractPossibleRucOrCedula(filename);
    for (const num of numbersInFile) {
        const matched = activeClients.find(c => {
            const rucClean = c.ruc.trim();
            return rucClean === num || rucClean.startsWith(num) || num.startsWith(rucClean.slice(0, 10));
        });
        if (matched) return matched;
    }

    // 3. Probar por coincidencia de apellido de cliente en el nombre del archivo
    const lowerFileName = filename.toLowerCase();
    return activeClients.find(c => {
        const words = c.name.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        return words.some(w => lowerFileName.includes(w));
    });
};

// Generar sugerencias de contraseñas EXCLUSIVAMENTE basadas en el nombre del CLIENTE real
const generatePasswordCandidates = (client?: Client, storedPasswords?: (string | undefined)[]): string[] => {
    const candidates = new Set<string>();

    (storedPasswords || []).forEach(p => {
        if (p && p.trim()) candidates.add(p.trim());
    });

    if (client && client.sriPassword) candidates.add(client.sriPassword.trim());
    if (client && client.electronicSignaturePassword) candidates.add(client.electronicSignaturePassword.trim());

    if (!client) return Array.from(candidates);

    // Extraer palabras del nombre real del cliente (evitando números y palabras genéricas)
    const words = client.name.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
    const years = ['2026', '2025', '2027', '2024'];

    words.forEach(w => {
        const clean = w.trim();
        const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        const lower = clean.toLowerCase();
        const upper = clean.toUpperCase();

        years.forEach(yr => {
            candidates.add(`${capitalized}${yr}`);
            candidates.add(`${lower}${yr}`);
            candidates.add(`${upper}${yr}`);
        });
    });

    return Array.from(candidates);
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
            const matched = meta.ruc ? clients.find(c => !c.isDeleted && c.ruc.trim() === meta.ruc?.trim()) : item.possibleClientHint;

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
                errorMessage: 'Contraseña incorrecta'
            };
        }
    };

    // Evaluar y probar candidatos de clave para un elemento de la cola
    const processQueueItemMatching = (item: P12ItemQueue, manualRucOverride?: string): P12ItemQueue => {
        const rucToUse = manualRucOverride !== undefined ? manualRucOverride : item.manualRucInput;
        const matchedClient = findMatchingClient(item.fileName, rucToUse, clients);
        const candidates = generatePasswordCandidates(matchedClient);

        let updatedItem: P12ItemQueue = {
            ...item,
            manualRucInput: rucToUse,
            possibleClientHint: matchedClient,
            candidateSuggestions: candidates.slice(0, 8)
        };

        // Probar candidatos de forma finita (si encuentra coincidencia con Arce2026, desbloquea e interrumpe)
        for (const candPassword of candidates) {
            const res = tryUnlockItem(updatedItem, candPassword);
            if (res.status === 'unlocked') {
                return {
                    ...res,
                    unlockedViaPattern: candPassword
                };
            }
        }

        return updatedItem;
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
                    manualRucInput: '',
                    status: 'pending'
                };

                const processed = processQueueItemMatching(item);
                newQueueItems.push(processed);
            } catch (err) {
                console.error("Error reading p12 file:", err);
            }
        }

        setQueue(prev => [...prev, ...newQueueItems]);
        setIsProcessing(false);
        toast.success(`Cargados ${newQueueItems.length} archivos .p12 a la cola.`);
    };

    const handleManualRucChange = (itemId: string, rucValue: string) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return processQueueItemMatching(item, rucValue);
        }));
    };

    const handleTestPassword = (itemId: string, passwordValue: string) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return tryUnlockItem(item, passwordValue);
        }));
    };

    const handleRemoveItem = (itemId: string) => {
        setQueue(prev => prev.filter(i => i.id !== itemId));
    };

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

            const existingClient = clients.find(c => !c.isDeleted && c.ruc.trim() === ruc?.trim()) || item.possibleClientHint;

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
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                                <Sparkles size={11} /> Auto-Detección por RUC (0701893687 ➔ Arce2026)
                            </span>
                        </div>
                        <h3 className="text-base font-black text-white">Detección por RUC del Archivo + Sugerencias Reales</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Lee los 10 o 13 dígitos de RUC contenidos en el nombre del archivo (ej: <code>0701893687</code>), identifica al cliente <strong>(ELADIO ARCE)</strong> y sugiere su patrón de clave verdadero (<strong>Arce2026</strong>).
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
                            <p className="text-xs text-slate-400 mt-1">Soporta selección de múltiples archivos simultáneamente.</p>
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
                        <div className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                            {queue.map((item, idx) => {
                                const isUnlocked = item.status === 'unlocked';
                                const isError = item.status === 'error';

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4.5 rounded-3xl border transition-all duration-300 flex flex-col justify-between gap-3.5 ${
                                            isUnlocked
                                                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg'
                                                : isError
                                                ? 'bg-slate-900/80 border-white/10 hover:border-amber-500/30'
                                                : 'bg-slate-900/60 border-white/10'
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                                                <div className={`p-2.5 rounded-xl border ${
                                                    isUnlocked ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                    isError ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                    'bg-slate-800 text-slate-400 border-white/10'
                                                }`}>
                                                    {isUnlocked ? <Unlock size={18} /> : <Lock size={18} />}
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-bold text-white font-mono truncate">{item.fileName}</p>
                                                        {isUnlocked && (
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase flex items-center gap-1 shrink-0">
                                                                <Check size={10} /> Desbloqueada {item.unlockedViaPattern ? `(${item.unlockedViaPattern})` : ''}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Detalle si ya fue unlocked */}
                                                    {isUnlocked && item.metadata && (
                                                        <div className="space-y-0.5 text-[11px]">
                                                            <p className="font-bold text-emerald-300 uppercase truncate">
                                                                {item.metadata.commonName || 'Titular Extraído'}
                                                            </p>
                                                            <p className="font-mono text-slate-400 text-[10px]">
                                                                RUC: <strong className="text-white">{item.metadata.ruc || 'No disponible'}</strong> · Emisor: {item.metadata.issuerName || 'N/A'}
                                                            </p>

                                                            {item.matchedClient ? (
                                                                <div className="flex items-center gap-1 text-[10px] text-teal-400 font-bold mt-0.5">
                                                                    <UserCheck size={12} />
                                                                    <span>Vinculado a Cliente: {item.matchedClient.name} ({item.matchedClient.ruc})</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold mt-0.5">
                                                                    <UserPlus size={12} />
                                                                    <span>Cliente Nuevo (Se creará en el sistema)</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Buscador / Asignador Rápido de RUC o Cliente si no ha desbloqueado */}
                                                    {!isUnlocked && (
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <div className="relative flex-1 max-w-md">
                                                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    value={item.manualRucInput}
                                                                    onChange={(e) => handleManualRucChange(item.id, e.target.value)}
                                                                    placeholder="Pista RUC / Nombre del Cliente (ej: 0701893687 o Arce)..."
                                                                    className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-teal-500/40 outline-none font-mono"
                                                                />
                                                            </div>

                                                            {item.possibleClientHint && (
                                                                <span className="px-2 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[10px] font-bold truncate max-w-[220px]">
                                                                    👤 {item.possibleClientHint.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Input de Contraseña e Interacción */}
                                            <div className="flex items-center gap-2 shrink-0">
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
                                                    placeholder="Ingresa la clave..."
                                                    className="w-36 sm:w-44 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 outline-none font-mono"
                                                />

                                                <button
                                                    onClick={() => handleTestPassword(item.id, item.passwordInput)}
                                                    className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md active:scale-95 flex items-center gap-1"
                                                    title="Probar contraseña manual"
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

                                        {/* PILDORAS DE SUGERENCIAS DE CLAVE SI HAY CLIENTE VINCULADO */}
                                        {!isUnlocked && item.candidateSuggestions && item.candidateSuggestions.length > 0 && (
                                            <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
                                                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1">
                                                    <Sparkles size={10} className="text-amber-400" /> Sugerencias de cliente ({item.possibleClientHint?.name.split(' ')[0]}):
                                                </span>
                                                {item.candidateSuggestions.map((sug, sIdx) => (
                                                    <button
                                                        key={sIdx}
                                                        onClick={() => handleTestPassword(item.id, sug)}
                                                        className="px-2.5 py-1 bg-white/5 hover:bg-teal-500/20 hover:text-teal-300 text-slate-200 rounded-lg text-[10px] font-mono font-bold border border-white/10 transition-all active:scale-95"
                                                    >
                                                        {sug}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Modal */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-slate-400">
                        {unlockedCount > 0 ? (
                            <span className="text-emerald-400 font-bold">
                                Listas para guardar: {unlockedCount} de {queue.length} firmas
                            </span>
                        ) : (
                            <span>Ingresa el RUC/Nombre para sugerir claves de clientes reales</span>
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
