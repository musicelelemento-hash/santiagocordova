import React, { useState, useRef, useMemo } from 'react';
import {
    UploadCloud, KeyRound, CheckCircle2, AlertTriangle, Lock, Unlock,
    FileKey, Trash2, Check, RefreshCw, UserCheck, UserPlus, HelpCircle, Sparkles, Lightbulb, Search, ShieldCheck, Archive, ArrowUpRight, CopyCheck, AlertCircle, Laptop, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../../store/useAppStore';
import { extractP12Metadata } from '../../utils/p12Reader';
import { useToast } from '../../context/ToastContext';
import { Client, StoredFile, TaxRegime } from '../../types';
import { UnifiedStorageService } from '../../services/unifiedStorageService';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '../ui/Modal';

interface BulkP12UploaderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SaveModeOption = 'create_client' | 'system_only' | 'signature_only' | 'backup_only' | 'omit';

interface P12ItemQueue {
    id: string;
    file: File;
    base64Content: string;
    fileName: string;
    passwordInput: string;
    manualRucInput: string;
    saveMode: SaveModeOption;
    status: 'pending' | 'unlocked' | 'error';
    errorMessage?: string;
    unlockedViaPattern?: string;
    candidateSuggestions?: string[];
    possibleClientHint?: Client;
    extractedNameFromCert?: string;
    isBatchDuplicate?: boolean;
    expirationComparison?: {
        status: 'renewal' | 'duplicate' | 'older' | 'new_client';
        newStr: string;
        existingStr: string;
    };
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

const cleanFileName = (filename?: string): string => {
    if (!filename) return '';
    return filename
        .toLowerCase()
        .replace(/\s*\(\d+\)/g, '')
        .replace(/\.p12|\.pfx/gi, '')
        .trim();
};

const extractPossibleRucOrCedula = (filename: string): string[] => {
    const matches = filename.match(/\d{9,13}/g) || [];
    return Array.from(new Set(matches));
};

// Extraer nombre limpio desde patrones del SRI: cert-CORDOVA-RAMIREZ-ROBERTO-SANTIAGO44 -> "CORDOVA RAMIREZ ROBERTO SANTIAGO"
const parseNameFromFileName = (filename: string): string => {
    let clean = filename.replace(/\.p12|\.pfx/gi, '');
    clean = clean.replace(/^[A-Za-z0-9]+_cert-/, 'cert-');
    
    if (clean.toLowerCase().includes('cert-')) {
        const afterCert = clean.split(/cert-/i)[1];
        if (afterCert) {
            const withoutNumbers = afterCert.replace(/\d+\s*\(\d+\)$|\d+$/g, '');
            const formatted = withoutNumbers.replace(/[-_]+/g, ' ').trim();
            if (formatted.length >= 4) {
                return formatted.toUpperCase();
            }
        }
    }
    return '';
};

const extractValidPasswordNameTokens = (fullName: string): string[] => {
    if (!fullName) return [];
    
    const cleanName = fullName.replace(/[\.\-_]+/g, ' ').trim();
    const parts = cleanName.split(/\s+/).filter(w => w.length >= 2 && !/^\d+$/.test(w) && !['cert', 'p12', 'pfx', 'identity', 'keystore', 'sri', 'firma'].includes(w.toLowerCase()));
    
    return Array.from(new Set(parts));
};

// Coincidencia estricta por RUC exacto/subcadena O por 1er Apellido AND Nombre de pila
const findMatchingClient = (filename: string, manualRuc: string, clients: Client[], metaRuc?: string): Client | undefined => {
    const rucTarget = (metaRuc || manualRuc || '').replace(/\D/g, '');
    if (rucTarget.length >= 9) {
        const matchedByRuc = clients.find(c => {
            const cRucClean = c.ruc.replace(/\D/g, '');
            return cRucClean.includes(rucTarget.slice(0, 10)) || rucTarget.includes(cRucClean.slice(0, 10));
        });
        if (matchedByRuc) return matchedByRuc;
    }

    const numbersInFile = extractPossibleRucOrCedula(filename);
    for (const num of numbersInFile) {
        const cleanNum = num.replace(/\D/g, '');
        if (cleanNum.length >= 9) {
            const matched = clients.find(c => {
                const rucClean = c.ruc.replace(/\D/g, '');
                return rucClean.includes(cleanNum.slice(0, 10)) || cleanNum.includes(rucClean.slice(0, 10));
            });
            if (matched) return matched;
        }
    }

    const targetClean = cleanFileName(filename);
    if (targetClean && targetClean.length >= 4) {
        const matchedByFile = clients.find(c => {
            if (!c.signatureFile?.name) return false;
            const existingClean = cleanFileName(c.signatureFile.name);
            return existingClean && (existingClean === targetClean || existingClean.includes(targetClean));
        });
        if (matchedByFile) return matchedByFile;
    }

    const extractedName = parseNameFromFileName(filename);
    if (extractedName) {
        const certTokens = extractedName.split(/\s+/).filter(w => w.length >= 3);
        
        if (certTokens.length >= 3) {
            const surname1 = certTokens[0].toUpperCase();
            const firstName1 = certTokens[2]?.toUpperCase();
            const firstName2 = certTokens[3]?.toUpperCase();

            const matched = clients.find(c => {
                const clientUpper = c.name.toUpperCase();
                const clientTokens = clientUpper.split(/\s+/);
                
                const hasSurname = clientTokens.includes(surname1);
                const hasFirstName = (firstName1 && clientTokens.includes(firstName1)) || (firstName2 && clientTokens.includes(firstName2));

                return hasSurname && hasFirstName;
            });
            if (matched) return matched;
        } else if (certTokens.length >= 2) {
            const matched = clients.find(c => {
                const clientTokens = c.name.toUpperCase().split(/\s+/);
                return certTokens.every(t => clientTokens.includes(t));
            });
            if (matched) return matched;
        }
    }

    return undefined;
};

// Normalizador estricto de fecha YYYY-MM-DD para evitar desfases de zonas horarias (UTC vs Local Time -05:00)
const normalizeDateKey = (dateInput?: Date | string): string => {
    if (!dateInput) return '';
    try {
        let dateObj: Date;
        if (typeof dateInput === 'string') {
            dateObj = new Date(dateInput.includes('T') ? dateInput : `${dateInput}T12:00:00Z`);
        } else {
            dateObj = dateInput;
        }
        if (isNaN(dateObj.getTime())) return '';

        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return '';
    }
};

const formatNormalizedDateStr = (dateInput?: Date | string): string => {
    if (!dateInput) return '—';
    const key = normalizeDateKey(dateInput);
    if (!key) return '—';
    const [y, m, d] = key.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    return format(dateObj, "d MMM yyyy", { locale: es });
};

// Evaluador preciso de fecha de expiracion sin falsos desbordes de 1 dia por hora
const evaluateExpirationComparison = (newExpDate?: Date, existingClient?: Client, fileName?: string) => {
    const backupList: any[] = JSON.parse(localStorage.getItem('sri_backup_signatures') || '[]');
    const inBackup = backupList.find(b => (b.ruc && existingClient && b.ruc.trim() === existingClient.ruc.trim()) || (fileName && cleanFileName(b.fileName) === cleanFileName(fileName)));

    const refDateStr = existingClient?.signatureExpirationDate || inBackup?.expirationDate;

    if (!newExpDate || !refDateStr) {
        return {
            status: 'new_client' as const,
            newStr: formatNormalizedDateStr(newExpDate),
            existingStr: 'Sin firma previa'
        };
    }

    const newKey = normalizeDateKey(newExpDate);
    const existingKey = normalizeDateKey(refDateStr);

    const newStr = formatNormalizedDateStr(newExpDate);
    const existingStr = formatNormalizedDateStr(refDateStr);

    if (newKey === existingKey) {
        return { status: 'duplicate' as const, newStr, existingStr };
    }

    const newTime = new Date(`${newKey}T12:00:00Z`).getTime();
    const existingTime = new Date(`${existingKey}T12:00:00Z`).getTime();

    if (newTime > existingTime) {
        return { status: 'renewal' as const, newStr, existingStr };
    } else {
        return { status: 'older' as const, newStr, existingStr };
    }
};

const generatePasswordCandidates = (client?: Client, fileName?: string, rucOrCedula?: string, storedPasswords?: (string | undefined)[]): string[] => {
    const candidates = new Set<string>();

    (storedPasswords || []).forEach(p => {
        if (p && p.trim()) candidates.add(p.trim());
    });

    if (client && client.sriPassword) candidates.add(client.sriPassword.trim());
    if (client && client.electronicSignaturePassword) candidates.add(client.electronicSignaturePassword.trim());

    const nameFromCert = parseNameFromFileName(fileName || '');
    const clientName = client ? client.name : '';
    
    // Extraer tokens también del propio nombre de archivo
    const fileNameClean = (fileName || '').replace(/\.p12|\.pfx/gi, '');
    const fileNameWords = fileNameClean.replace(/[\._\-\(\)\d]+/g, ' ').split(/\s+/).filter(w => w.length >= 3);

    const tokensClient = extractValidPasswordNameTokens(clientName);
    const tokensCert = extractValidPasswordNameTokens(nameFromCert);
    const tokensFile = extractValidPasswordNameTokens(fileNameWords.join(' '));
    
    const allTokens = Array.from(new Set([...tokensClient, ...tokensCert, ...tokensFile]));

    const cleanRuc = (rucOrCedula || (client ? client.ruc : '') || '').replace(/\D/g, '');
    const first4Ruc = cleanRuc.length >= 4 ? cleanRuc.slice(0, 4) : '';
    const last4Ruc = cleanRuc.length >= 4 ? cleanRuc.slice(-4) : '';
    const cedula = cleanRuc.length >= 10 ? cleanRuc.slice(0, 10) : '';

    const formattedTokens = allTokens.map(clean => clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());

    const years = ['2026', '2025', '2024', '2023', '2027'];
    const specialSymbols = ['', '#@', '#', '@', '.', '*', '!', '$'];

    // 1. Cédula y RUC con y sin caracteres especiales
    if (cleanRuc) {
        candidates.add(cleanRuc);
        if (cedula) candidates.add(cedula);
        specialSymbols.forEach(sym => {
            if (sym) {
                candidates.add(`${cleanRuc}${sym}`);
                if (cedula) candidates.add(`${cedula}${sym}`);
            }
        });
    }

    // 2. Patrones Estándar SRI / Empresas Certificadoras
    const sriPrefixes = ['Sri', 'Sri.', 'Firma', 'Clave', 'Ecuafact', 'Security', 'Anf', 'Consejo'];
    sriPrefixes.forEach(pref => {
        years.forEach(y => {
            specialSymbols.forEach(sym => {
                candidates.add(`${pref}${y}${sym}`);
            });
        });
    });

    // 3. Nombres / Apellidos + Años + Símbolos (ej: Malla2026, Pillco1972#@, Ortega2026#@, Jose2026)
    formattedTokens.forEach(t => {
        years.forEach(y => {
            specialSymbols.forEach(sym => {
                candidates.add(`${t}${y}${sym}`);
            });
        });

        // Combinaciones con los 4 primeros/últimos dígitos de Cédula/RUC
        if (first4Ruc) {
            specialSymbols.forEach(sym => {
                candidates.add(`${t}${first4Ruc}${sym}`);
            });
        }
        if (last4Ruc) {
            specialSymbols.forEach(sym => {
                candidates.add(`${t}${last4Ruc}${sym}`);
            });
        }
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
    const [queueFilterTab, setQueueFilterTab] = useState<'unlocked' | 'locked' | 'omitted' | 'all'>('unlocked');

    const filteredQueue = useMemo(() => {
        if (queueFilterTab === 'unlocked') {
            return queue.filter(q => q.status === 'unlocked' && q.saveMode !== 'omit');
        }
        if (queueFilterTab === 'locked') {
            return queue.filter(q => q.status !== 'unlocked');
        }
        if (queueFilterTab === 'omitted') {
            return queue.filter(q => q.saveMode === 'omit');
        }
        return queue;
    }, [queue, queueFilterTab]);

    const countAll = queue.length;
    const countUnlocked = queue.filter(q => q.status === 'unlocked' && q.saveMode !== 'omit').length;
    const countLocked = queue.filter(q => q.status !== 'unlocked').length;
    const countOmitted = queue.filter(q => q.saveMode === 'omit').length;

    const activeClientsList = useMemo(() => {
        return clients
            .filter(c => !c.isDeleted && c.isActive)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [clients]);

    const tryUnlockItem = (item: P12ItemQueue, passwordToTest: string): P12ItemQueue => {
        try {
            const meta = extractP12Metadata(item.base64Content, passwordToTest);
            const matched = meta.ruc ? clients.find(c => c.ruc.trim() === meta.ruc?.trim()) : item.possibleClientHint;
            const expComp = evaluateExpirationComparison(meta.notAfter, matched, item.fileName);

            const defaultSaveMode = expComp.status === 'duplicate' ? 'omit' : item.saveMode;

            return {
                ...item,
                passwordInput: passwordToTest,
                status: 'unlocked',
                errorMessage: undefined,
                saveMode: defaultSaveMode,
                expirationComparison: expComp,
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

    const processQueueItemMatching = (item: P12ItemQueue, manualRucOverride?: string, clientOverride?: Client): P12ItemQueue => {
        const rucToUse = manualRucOverride !== undefined ? manualRucOverride : item.manualRucInput;
        const matchedClient = clientOverride || findMatchingClient(item.fileName, rucToUse, clients, item.metadata?.ruc);
        const extractedName = parseNameFromFileName(item.fileName);
        
        const possibleNumbers = extractPossibleRucOrCedula(item.fileName);
        const rucForPattern = item.metadata?.ruc || rucToUse || (possibleNumbers[0] || '');

        const candidates = generatePasswordCandidates(matchedClient, item.fileName, rucForPattern);

        let updatedItem: P12ItemQueue = {
            ...item,
            manualRucInput: rucToUse,
            possibleClientHint: matchedClient,
            extractedNameFromCert: extractedName,
            candidateSuggestions: candidates.slice(0, 12)
        };

        for (const candPassword of candidates) {
            const res = tryUnlockItem(updatedItem, candPassword);
            if (res.status === 'unlocked') {
                let finalMatched = matchedClient;
                if (res.metadata?.ruc) {
                    const rucClean = res.metadata.ruc.replace(/\D/g, '');
                    if (rucClean.length >= 9) {
                        const matchedByMeta = clients.find(c => {
                            const cRucClean = c.ruc.replace(/\D/g, '');
                            return cRucClean.includes(rucClean.slice(0, 10)) || rucClean.includes(cRucClean.slice(0, 10));
                        });
                        if (matchedByMeta) finalMatched = matchedByMeta;
                    }
                }

                const expCompFinal = evaluateExpirationComparison(res.metadata?.notAfter, finalMatched, item.fileName);

                return {
                    ...res,
                    matchedClient: finalMatched,
                    expirationComparison: expCompFinal,
                    saveMode: (expCompFinal.status === 'duplicate' || expCompFinal.status === 'older') ? 'omit' : item.saveMode,
                    unlockedViaPattern: candPassword
                };
            }
        }

        return updatedItem;
    };

    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        await new Promise(res => setTimeout(res, 500));

        const newQueueItems: P12ItemQueue[] = [];
        const seenSignaturesInBatch = new Set<string>();
        let discardedDuplicatesCount = 0;

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
                    saveMode: 'create_client',
                    status: 'pending'
                };

                const processed = processQueueItemMatching(item);

                const isDuplicateInDB = processed.expirationComparison?.status === 'duplicate';
                const signatureSignatureHash = `${processed.metadata?.ruc || ''}_${processed.metadata?.notAfter?.getTime() || ''}_${cleanFileName(processed.fileName)}`;
                const isDuplicateInBatch = seenSignaturesInBatch.has(signatureSignatureHash) && processed.status === 'unlocked';

                if (isDuplicateInDB || isDuplicateInBatch) {
                    processed.saveMode = 'omit';
                    if (!processed.errorMessage) {
                        processed.errorMessage = isDuplicateInDB 
                            ? '⚠️ FIRMA YA REGISTRADA: Esta fecha de caducidad coincide con la firma activa en el sistema.' 
                            : '⚠️ DUPLICADA EN LOTE: Firma repetida dentro del mismo lote subido.';
                    }
                    discardedDuplicatesCount++;
                }

                if (processed.status === 'unlocked' && signatureSignatureHash) {
                    seenSignaturesInBatch.add(signatureSignatureHash);
                }
                newQueueItems.push(processed);
            } catch (err) {
                console.error("Error reading p12 file:", err);
            }
        }

        setQueue(prev => [...prev, ...newQueueItems]);
        setIsProcessing(false);

        if (newQueueItems.length > 0) {
            if (discardedDuplicatesCount > 0) {
                toast.success(`⚡ ${newQueueItems.length} firmas cargadas. Se marcaron ${discardedDuplicatesCount} firmas como Omitidas/Duplicadas.`);
            } else {
                toast.success(`⚡ Cargadas ${newQueueItems.length} firmas a la cola.`);
            }
        } else if (discardedDuplicatesCount > 0) {
            toast.info(`ℹ️ Las ${discardedDuplicatesCount} firmas seleccionadas ya existen en el sistema con la misma caducidad. Se descartaron automáticamente.`);
        }
    };

    const handleSelectClientForQueueItem = (itemId: string, selectedClient?: Client) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return processQueueItemMatching(item, selectedClient ? selectedClient.ruc : '', selectedClient);
        }));
    };

    const handleSearchRucForQueueItem = (itemId: string) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return processQueueItemMatching(item);
        }));
    };

    const handleTestPassword = (itemId: string, passwordValue: string) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return tryUnlockItem(item, passwordValue);
        }));
    };

    const handleToggleSaveMode = (itemId: string, mode: SaveModeOption) => {
        setQueue(prev => prev.map(item => item.id === itemId ? { ...item, saveMode: mode } : item));
    };

    const handleRemoveItem = (itemId: string) => {
        setQueue(prev => prev.filter(i => i.id !== itemId));
    };

    const handleApplyAllUnlocked = async () => {
        const unlockedItems = queue.filter(i => i.status === 'unlocked' && i.metadata?.ruc && i.saveMode !== 'omit');
        if (unlockedItems.length === 0) {
            toast.error("No hay firmas descifradas marcadas para guardar.");
            return;
        }

        setIsSaving(true);
        let updatedCount = 0;
        let createdCount = 0;
        let backupCount = 0;

        const backupList: any[] = JSON.parse(localStorage.getItem('sri_backup_signatures') || '[]');

        for (const item of unlockedItems) {
            const { ruc, commonName, issuerName, notBefore, notAfter } = item.metadata!;
            const signatureFileObj: StoredFile = await UnifiedStorageService.uploadFile(
                item.file,
                item.fileName,
                'firmas'
            );

            const expDate = notAfter ? notAfter.toISOString().split('T')[0] : '';
            const issueDate = notBefore ? notBefore.toISOString().split('T')[0] : '';

            const existingClient = clients.find(c => c.ruc.trim() === ruc?.trim()) || item.possibleClientHint;

            if (existingClient && !existingClient.isDeleted) {
                const isOlderThanClient = item.expirationComparison?.status === 'older';
                
                if (!isOlderThanClient) {
                    await updateClient(existingClient.id, {
                        signatureFile: signatureFileObj,
                        electronicSignaturePassword: item.passwordInput,
                        signatureExpirationDate: expDate,
                        signatureIssueDate: issueDate,
                        signatureProvider: issuerName
                    });
                    updatedCount++;
                } else {
                    backupList.push({
                        id: uuidv4(),
                        titular: existingClient.name,
                        ruc: existingClient.ruc,
                        fileName: item.fileName,
                        password: item.passwordInput,
                        provider: issuerName,
                        expirationDate: expDate,
                        fileContent: item.base64Content,
                        note: 'Respaldo de firma previa (caducidad menor a la activa)',
                        savedAt: new Date().toISOString()
                    });
                    backupCount++;
                }
            } else if (item.saveMode === 'backup_only') {
                backupList.push({
                    id: uuidv4(),
                    titular: commonName || item.extractedNameFromCert || 'Cliente Esporádico',
                    ruc: ruc || '',
                    fileName: item.fileName,
                    password: item.passwordInput,
                    provider: issuerName,
                    expirationDate: expDate,
                    fileContent: item.base64Content,
                    category: 'Venta Esporádica de Firma',
                    savedAt: new Date().toISOString()
                });
                backupCount++;
            } else {
                const categoryNote = item.saveMode === 'system_only' 
                    ? 'Categoría: Solo Venta de Facturador / Sistema Ecuafact'
                    : item.saveMode === 'signature_only'
                    ? 'Categoría: Solo Venta de Firma Electrónica'
                    : 'Categoría: Cliente Contable Completo';

                const isSoloPlan = item.saveMode === 'system_only';
                const isSoloFirma = item.saveMode === 'signature_only';
                const clientType: 'completo' | 'solo_plan' = isSoloPlan ? 'solo_plan' : 'completo';
                const requiresDeclarations = item.saveMode === 'create_client';

                const newClient: Client = {
                    id: uuidv4(),
                    name: commonName || item.extractedNameFromCert || 'Contribuyente Nuevo',
                    ruc: ruc || '',
                    sriPassword: '',
                    email: '',
                    phones: [],
                    declarations: [],
                    clientType,
                    requiresDeclarations,
                    notes: `${categoryNote}\nCreado desde Subida Masiva de Firma .p12.\nEmisor: ${issuerName}`,
                    isActive: true,
                    isDeleted: false,
                    regime: TaxRegime.General,
                    address: '',
                    signatureFile: signatureFileObj,
                    electronicSignaturePassword: item.passwordInput,
                    signatureExpirationDate: expDate,
                    signatureIssueDate: issueDate,
                    signatureProvider: issuerName,
                    taxProfile: {
                        ivaFrequency: requiresDeclarations ? 'Mensual' : 'Ninguno',
                        requiresAnnualRenta: requiresDeclarations,
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

        const uniqueBackupMap = new Map<string, any>();
        backupList.forEach((b: any) => {
            const rucClean = b.ruc ? b.ruc.trim() : '';
            const key = rucClean ? `${rucClean}_${b.expirationDate || ''}` : `${(b.titular || '').toLowerCase().trim()}_${b.fileName}`;
            if (!uniqueBackupMap.has(key) || (!uniqueBackupMap.get(key)?.password && b.password)) {
                uniqueBackupMap.set(key, b);
            }
        });

        localStorage.setItem('sri_backup_signatures', JSON.stringify(Array.from(uniqueBackupMap.values())));

        setIsSaving(false);
        toast.success(`🎉 Proceso completado: ${updatedCount} actualizadas, ${createdCount} creados y ${backupCount} en respaldos.`);
        setQueue([]);
        onClose();
    };

    if (!isOpen) return null;

    const unlockedCount = queue.filter(q => q.status === 'unlocked' && q.saveMode !== 'omit').length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📥 Subidor Masivo de Firmas Electrónicas (.p12)" size="4xl">
            <div className="space-y-6 p-2 md:p-4 text-white relative overflow-hidden">

                {/* OVERLAY DE ANIMACIÓN HOLOGRÁFICA */}
                {isProcessing && (
                    <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/80 animate-[spin_6s_linear_infinite] shadow-[0_0_30px_rgba(34,211,238,0.6)]" />
                            <div className="absolute inset-3 rounded-full border-2 border-dashed border-emerald-400/80 animate-[spin_4s_linear_infinite_reverse] shadow-[0_0_20px_rgba(52,211,153,0.6)]" />
                            <div className="relative p-6 rounded-3xl bg-slate-900/90 border border-white/20 shadow-2xl text-teal-300 flex items-center justify-center">
                                <FileKey size={42} className="animate-pulse text-cyan-300" />
                                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,1)] animate-bounce top-3" />
                            </div>
                        </div>

                        <div className="space-y-2 max-w-md">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-[10px] font-black uppercase tracking-[0.25em] shadow-lg">
                                <Sparkles size={13} className="animate-spin text-teal-400" /> ESCÁNER Y DESCARTE DE DUPLICADOS EXACTOS
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight font-display">
                                Verificando Fechas de Caducidad Normalizadas
                            </h3>
                            <p className="text-xs text-slate-300 font-mono leading-relaxed">
                                Normalizando fechas de expiración UTC/Local para descartar firmas duplicadas sin desfases de huso horario...
                            </p>
                        </div>

                        <div className="w-full max-w-xs h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10 p-0.5">
                            <div className="h-full bg-gradient-to-r from-teal-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse shadow-[0_0_20px_rgba(45,212,191,0.9)] w-full" />
                        </div>
                    </div>
                )}

                {isSaving && (
                    <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-emerald-400/90 animate-[spin_3s_linear_infinite] shadow-[0_0_35px_rgba(52,211,153,0.7)]" />
                            <div className="relative p-6 rounded-3xl bg-emerald-950/90 border border-emerald-500/40 shadow-2xl text-emerald-400">
                                <ShieldCheck size={48} className="animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-2 max-w-md">
                            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/40">
                                Sincronización de Bóveda y Categorización
                            </span>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight font-display">
                                Guardando Firmas y Categorías de Cliente
                            </h3>
                        </div>
                    </div>
                )}

                {/* Header Explicativo */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent border border-teal-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                                <Sparkles size={11} /> Auto-Descarte por Fecha de Caducidad Normalizada
                            </span>
                        </div>
                        <h3 className="text-base font-black text-white">Filtro de Descarte con Precisión de Fecha</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Descarta firmas con la misma fecha de caducidad (evitando desfases por huso horario) y conserva únicamente renovaciones nuevas.
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
                            <p className="text-xs text-slate-400 mt-1">Soporta firmas descargadas del SRI (cert-NOMBRE...) e identity_CEDULA.p12.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* BARRA DE FILTROS DE PESTAÑAS (ORDEN DE FLUJO PRO) */}
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900/90 p-2 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                                <button
                                    onClick={() => setQueueFilterTab('unlocked')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        queueFilterTab === 'unlocked'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>🟢 1. Listas (Nuevas & Renovaciones)</span>
                                    <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[9px]">{countUnlocked}</span>
                                </button>

                                <button
                                    onClick={() => setQueueFilterTab('locked')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        queueFilterTab === 'locked'
                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>🔒 2. Clave Pendiente</span>
                                    <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[9px]">{countLocked}</span>
                                </button>

                                <button
                                    onClick={() => setQueueFilterTab('omitted')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        queueFilterTab === 'omitted'
                                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>⏭️ 3. Repetidas / Ya Registradas</span>
                                    <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[9px]">{countOmitted}</span>
                                </button>

                                <button
                                    onClick={() => setQueueFilterTab('all')}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        queueFilterTab === 'all'
                                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>📋 4. Ver Lote Completo</span>
                                    <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[9px]">{countAll}</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setQueue([])}
                                className="text-[10px] text-rose-400 hover:underline uppercase font-bold px-2 py-1"
                            >
                                Limpiar Cola
                            </button>
                        </div>

                        {/* Lista Interactiva de Firmas */}
                        <div className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredQueue.length === 0 ? (
                                <div className="p-8 text-center bg-slate-900/40 rounded-3xl border border-white/5 text-slate-400 text-xs font-mono">
                                    No hay firmas en la pestaña "{queueFilterTab === 'omitted' ? 'Omitidas / Descartadas' : queueFilterTab === 'unlocked' ? 'Listas para guardar' : queueFilterTab === 'locked' ? 'Clave Pendiente' : 'Todas'}".
                                </div>
                            ) : (
                                <>
                                    {filteredQueue.map((item, idx) => {
                                const isUnlocked = item.status === 'unlocked';
                                const isError = item.status === 'error';
                                const expComp = item.expirationComparison;

                                const displayCandidateName = item.possibleClientHint
                                    ? item.possibleClientHint.name.split(' ')[0]
                                    : item.extractedNameFromCert
                                    ? item.extractedNameFromCert.split(' ')[0]
                                    : 'Nombre';

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4.5 rounded-3xl border transition-all duration-500 flex flex-col justify-between gap-3.5 ${
                                            isUnlocked
                                                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in-95'
                                                : isError
                                                ? 'bg-slate-900/80 border-white/10 hover:border-amber-500/30'
                                                : 'bg-slate-900/60 border-white/10'
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <span className="text-xs font-mono font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                                                <div className={`p-2.5 rounded-xl border transition-all ${
                                                    isUnlocked ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
                                                    isError ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                    'bg-slate-800 text-slate-400 border-white/10'
                                                }`}>
                                                    {isUnlocked ? <Unlock size={18} className="animate-bounce" /> : <Lock size={18} />}
                                                </div>

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-xs font-bold text-white font-mono truncate">{item.fileName}</p>
                                                        {isUnlocked && (
                                                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase flex items-center gap-1 shrink-0 border border-emerald-500/30 shadow-sm">
                                                                <Check size={10} /> Desbloqueada {item.unlockedViaPattern ? `(${item.unlockedViaPattern})` : ''}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* EVALUACIÓN INTELIGENTE DE RENOVACIÓN / DUPLICADOS / ANTIGÜEDAD */}
                                                    {isUnlocked && expComp && (
                                                        <div className="pt-2">
                                                            {expComp.status === 'renewal' && (
                                                                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs space-y-2 shadow-lg">
                                                                    <div className="flex items-center justify-between gap-2 font-black uppercase text-[10px] text-emerald-400">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <ArrowUpRight size={15} className="text-emerald-400 animate-bounce" />
                                                                            🎉 ¡RENOVACIÓN DE FIRMA DETECTADA!
                                                                        </span>
                                                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[9px] border border-emerald-400/40">Más Reciente</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                                                                        <div className="p-2.5 rounded-xl bg-black/50 border border-emerald-500/40">
                                                                            <span className="text-[9px] text-emerald-400/90 block uppercase font-sans font-bold">📄 Fecha Caducidad Subida (Nueva):</span>
                                                                            <strong className="text-emerald-300 font-bold text-xs">{expComp.newStr}</strong>
                                                                        </div>
                                                                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 opacity-75">
                                                                            <span className="text-[9px] text-slate-400 block uppercase font-sans font-bold">📁 Fecha Caducidad Sistema:</span>
                                                                            <strong className="text-slate-300 font-bold text-xs">{expComp.existingStr}</strong>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-[10px] text-emerald-300/90 font-sans leading-tight">
                                                                        ✨ Esta firma extenderá la fecha de vencimiento y actualizará el perfil del cliente automáticamente.
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {expComp.status === 'older' && (
                                                                <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs space-y-2 shadow-lg">
                                                                    <div className="flex items-center justify-between gap-2 font-black uppercase text-[10px] text-amber-400">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <AlertCircle size={15} className="text-amber-400" />
                                                                            ⚠️ ARCHIVO DE FIRMA ANTIGUO (CADUCADO / HISTÓRICO)
                                                                        </span>
                                                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-[9px] border border-amber-400/40">Omitida por Seguridad</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                                                                        <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/50">
                                                                            <span className="text-[9px] text-amber-400/90 block uppercase font-sans font-bold">📄 Fecha Caducidad Subida (Vieja):</span>
                                                                            <strong className="text-amber-300 font-bold text-xs">{expComp.newStr}</strong>
                                                                        </div>
                                                                        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50">
                                                                            <span className="text-[9px] text-emerald-400 block uppercase font-sans font-bold">📁 Fecha Caducidad Sistema (Vigente):</span>
                                                                            <strong className="text-emerald-300 font-bold text-xs">{expComp.existingStr}</strong>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-[10px] text-amber-300/90 font-sans leading-tight">
                                                                        🔒 Tu cliente ya tiene su firma renovada con fecha de caducidad {expComp.existingStr} activa. Este archivo viejo no sobreescribirá su perfil.
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {expComp.status === 'duplicate' && (
                                                                <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs space-y-1">
                                                                    <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-cyan-300">
                                                                        <CopyCheck size={14} className="text-cyan-400" />
                                                                        <span>ℹ️ FIRMA IDÉNTICA YA REGISTRADA (Fecha de Caducidad: <strong>{expComp.existingStr}</strong>) · Omitida</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Detalle del cliente asignado */}
                                                    {isUnlocked && item.metadata && (
                                                        <div className="space-y-1 text-[11px] pt-1">
                                                            <p className="font-bold text-emerald-300 uppercase truncate">
                                                                {item.metadata.commonName || item.extractedNameFromCert || 'Titular Extraído'}
                                                            </p>
                                                            <p className="font-mono text-slate-400 text-[10px]">
                                                                RUC: <strong className="text-white">{item.metadata.ruc || 'No disponible'}</strong> · Emisor: {item.metadata.issuerName || 'N/A'}
                                                            </p>

                                                            {item.matchedClient ? (
                                                                <div className="flex items-center justify-between gap-2 text-[10px] text-teal-400 font-bold">
                                                                    <div className="flex items-center gap-1">
                                                                        <UserCheck size={12} />
                                                                        <span>
                                                                            Cliente Activo: {item.matchedClient.name} ({item.matchedClient.ruc})
                                                                            {item.matchedClient.isDeleted && <span className="text-amber-400 ml-1">(Papelera)</span>}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'create_client')}
                                                                            className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                                                                item.saveMode === 'create_client'
                                                                                    ? 'bg-teal-500 text-slate-950'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            {expComp?.status === 'renewal' ? '🎉 Aplicar Renovación' : 'Guardar en Perfil'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'omit')}
                                                                            className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                                                                item.saveMode === 'omit'
                                                                                    ? 'bg-slate-700 text-slate-200'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            Omitir
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                                    <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                                                                        <AlertTriangle size={11} className="text-amber-400" /> Cliente no registrado. Selecciona la categoría de guardado:
                                                                    </span>

                                                                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 flex-wrap">
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'create_client')}
                                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${
                                                                                item.saveMode === 'create_client'
                                                                                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            <UserPlus size={11} /> 📊 Contable Completo
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'system_only')}
                                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${
                                                                                item.saveMode === 'system_only'
                                                                                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            <Laptop size={11} /> 💻 Solo Facturador/Ecuafact
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'signature_only')}
                                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${
                                                                                item.saveMode === 'signature_only'
                                                                                    ? 'bg-purple-400 text-slate-950 shadow-sm'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            <Shield size={11} /> 🔑 Solo Firma Esporádica
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleToggleSaveMode(item.id, 'backup_only')}
                                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${
                                                                                item.saveMode === 'backup_only'
                                                                                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                                                                                    : 'text-slate-400 hover:text-white'
                                                                            }`}
                                                                        >
                                                                            <Archive size={11} /> 📦 Solo Bóveda Respaldo
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Selector de Cliente o Buscador RUC */}
                                                    {!isUnlocked && (
                                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                                            <select
                                                                value={item.possibleClientHint?.id || ''}
                                                                onChange={(e) => {
                                                                    const selectedId = e.target.value;
                                                                    const selectedClientObj = activeClientsList.find(c => c.id === selectedId);
                                                                    handleSelectClientForQueueItem(item.id, selectedClientObj);
                                                                }}
                                                                className="px-3 py-1.5 bg-black/50 border border-white/15 rounded-xl text-[11px] text-teal-300 font-bold focus:ring-2 focus:ring-teal-500/30 outline-none max-w-[260px] cursor-pointer font-mono"
                                                            >
                                                                <option value="" className="bg-slate-900 text-slate-400">
                                                                    {item.extractedNameFromCert
                                                                        ? `-- ${item.extractedNameFromCert} (Sin Cliente Registrado) --`
                                                                        : '-- Seleccionar Cliente (1 Clic) --'}
                                                                </option>
                                                                {activeClientsList.map(c => (
                                                                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                                                                        {c.name} ({c.ruc})
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={item.manualRucInput}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, manualRucInput: val } : q));
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSearchRucForQueueItem(item.id);
                                                                    }}
                                                                    placeholder="Buscar RUC o Nombre..."
                                                                    className="w-28 sm:w-36 px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-teal-500/40 outline-none font-mono"
                                                                />
                                                                <button
                                                                    onClick={() => handleSearchRucForQueueItem(item.id)}
                                                                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all text-[10px] font-bold"
                                                                    title="Buscar RUC e intentar claves"
                                                                >
                                                                    <Search size={13} />
                                                                </button>
                                                            </div>
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

                                        {/* PILDORAS DE SUGERENCIAS DE CLAVE STRICT TitleCase */}
                                        {!isUnlocked && item.candidateSuggestions && item.candidateSuggestions.length > 0 && (
                                            <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
                                                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1">
                                                    <Sparkles size={10} className="text-amber-400 animate-pulse" /> Sugerencias ({displayCandidateName}):
                                                </span>
                                                {item.candidateSuggestions.map((sug, sIdx) => (
                                                    <button
                                                        key={sIdx}
                                                        onClick={() => handleTestPassword(item.id, sug)}
                                                        className="px-2.5 py-1 bg-white/5 hover:bg-teal-500/25 hover:text-teal-200 text-slate-200 rounded-lg text-[10px] font-mono font-bold border border-white/10 hover:border-teal-500/40 transition-all active:scale-95 shadow-sm"
                                                    >
                                                        {sug}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
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
                            <span>Desencripta las firmas para guardarlas en clientes o respaldos</span>
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
