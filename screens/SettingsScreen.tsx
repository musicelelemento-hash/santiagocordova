
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BellRing, Briefcase, Calendar, CalendarClock, Check, CheckCircle, ChevronDown, ChevronRight, ChevronUp, Clock, Cloud, Crown, Database, DatabaseBackup, DollarSign, Download, Edit, Edit3, ExternalLink, FileEdit, FileSearch, Fingerprint, Globe, History, Info, Key, Link, Loader, Loader2, Lock, MessageSquare, Package, Palette, Pencil, Plus, RefreshCw, RotateCw, Save, Settings as SettingsIcon, Share2, ShieldCheck, ShoppingBag, Target, ToggleLeft, ToggleRight, Trash2, Upload, UploadCloud, UserX, Wrench, Zap, FileText, CreditCard, Pin, Activity } from 'lucide-react';
import { getDefaultStartScreen, setDefaultStartScreen, getMostUsedScreens } from '../services/usageStatsService';
import { Client, TaxRegime, ServiceFeesConfig, Screen, Task, DeclarationStatus, Declaration, ReminderConfig, WebOrder, SystemSettings, SystemComboConfig } from '../types';
import { exportClientsToCSV, parseClientsFromCSV, parseBrowserPasswordsCSV, parseCredentialsCSV } from '../services/csv';
import { getClientServiceFee } from '../services/clientService';
import { Modal } from '../components/ui/Modal';
import { isPast } from 'date-fns';
import { getDueDateForPeriod, formatPeriodForDisplay, getIdentifierSortKey, validateRuc, safeFormat } from '../services/sri';
import { v4 as uuidv4 } from 'uuid';
import { getBackendUrl, syncDataToSheet } from '../services/sheetApi';
import { extractDataFromSriPdf } from '../services/pdfExtraction';
import { MigrationUtility } from '../services/migrationUtility';
import { SriExtensionsStore } from '../components/features/SriExtensionsStore';
import { SriPasswordChangerModal } from '../components/features/SriPasswordChangerModal';
import { db } from '../services/db';

// Function to parse CSV content. Placed here to be self-contained within the component logic.
const importClientsFromCSV = (
    fileContent: string,
    existingClients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>
) => {
    const result = parseClientsFromCSV(fileContent, existingClients);

    if (result.errors.length > 0) {
        const errorMsg = result.errors.slice(0, 5).map(e => `Línea ${e.lineNumber}: ${e.message}`).join('\n');
        alert(`Se encontraron errores:\n${errorMsg}\n${result.errors.length > 5 ? '...' : ''}`);
    }

    if (result.clientsToCreate.length === 0 && result.clientsToUpdate.length === 0) {
        alert("No se encontraron datos válidos para importar.");
        return;
    }

    let newClientsList = [...existingClients];

    // Apply updates
    result.clientsToUpdate.forEach(({ existingClient, updates }) => {
        newClientsList = newClientsList.map(c => c.id === existingClient.id ? { ...c, ...updates } : c);
    });

    // Add new
    newClientsList = [...newClientsList, ...result.clientsToCreate];

    setClients(newClientsList);
    alert(`Importación completada:\n${result.clientsToCreate.length} clientes nuevos.\n${result.clientsToUpdate.length} clientes actualizados.`);
};

// Replaced with dedicated credentials logic, but kept if user wants to use browser export to create clients
const importBrowserPasswordsToClients = (
    fileContent: string,
    existingClients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>
) => {
    const result = parseBrowserPasswordsCSV(fileContent, existingClients);

    if (result.clientsToCreate.length === 0 && result.clientsToUpdate.length === 0) {
        alert("No se encontraron claves del SRI válidas en el archivo.");
        return;
    }

    let newClientsList = [...existingClients];

    // Apply updates (Passwords)
    result.clientsToUpdate.forEach(({ existingClient, updates }) => {
        newClientsList = newClientsList.map(c => c.id === existingClient.id ? { ...c, ...updates } : c);
    });

    // Agregar clientes nuevos creados desde el CSV (pendientes de completar nombre)
    newClientsList = [...newClientsList, ...result.clientsToCreate];

    setClients(newClientsList);
    alert(`Clientes Actualizados:\n${result.clientsToCreate.length} nuevos registros (pendientes de nombre).\n${result.clientsToUpdate.length} claves actualizadas.`);
};

import { useAppStore } from '../store/useAppStore';
import { TaxCertificateGeneratorModal } from '../components/features/TaxCertificateGeneratorModal';
import { DigitalBusinessCardModal } from '../components/features/DigitalBusinessCardModal';

interface SettingsScreenProps {
    navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}


const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 text-xs font-display text-on-surface bg-surface-low border border-foreground/10 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {text}
            </div>
        </div>
    )
}

const CollapsibleGuide: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-foreground/10 rounded-xl overflow-hidden transition-all duration-300">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 bg-surface-low hover:bg-surface-lowest transition-colors">
                <h4 className="font-display font-semibold text-gold flex items-center text-md">
                    <Icon size={18} className="mr-3 text-gold" />
                    <span>{title}</span>
                </h4>
                <ChevronRight className={`w-5 h-5 transition-transform text-on-surface-variant ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <div className="p-4 bg-surface text-sm text-on-surface-variant border-t border-foreground/10">
                    {children}
                </div>
            </div>
        </div>
    );
};


export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigate }) => {
    const {
        clients, setClients,
        updateClient, bulkUpdateClients, bulkAddClients, removeClient,
        tasks, setTasks,
        serviceFees, setServiceFees,
        reminderConfig, setReminderConfig,
        webOrders, setWebOrders,
        sriCredentials, setSriCredentials,
        exportData, syncFromSheets, resetApp,
        systemSettings, setSystemSettings
    } = useAppStore();
    
    // ─── Estado local: Configuración de Sistema (Combos & Huella) ────────────
    const [localSystemSettings, setLocalSystemSettings] = useState<SystemSettings>(systemSettings);
    const [editingCombo, setEditingCombo] = useState<SystemComboConfig | null>(null);
    const [isEditingCombos, setIsEditingCombos] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'all' | 'flow' | 'cloud' | 'fees' | 'reminders' | 'combos' | 'backup'>('all');
    const [startScreen, setStartScreen] = useState<Screen>(() => getDefaultStartScreen());
    const [usageStatsList, setUsageStatsList] = useState(() => getMostUsedScreens(10));
    const [startScreenSaved, setStartScreenSaved] = useState(false);

    const handleSaveStartScreen = (screen: Screen) => {
        setDefaultStartScreen(screen);
        setStartScreen(screen);
        setStartScreenSaved(true);
        setTimeout(() => setStartScreenSaved(false), 2500);
    };

    const [isSavingSystem, setIsSavingSystem] = useState(false);
    const [systemSaved, setSystemSaved] = useState(false);

    const handleSaveSystemSettings = () => {
        setIsSavingSystem(true);
        setSystemSettings(localSystemSettings);
        setTimeout(() => {
            setIsSavingSystem(false);
            setSystemSaved(true);
            setIsEditingCombos(false);
            setTimeout(() => setSystemSaved(false), 3000);
        }, 500);
    };

    const handleAddCombo = () => {
        const newCombo: SystemComboConfig = {
            id: `combo-${Date.now()}`,
            name: 'Nuevo Combo',
            price: 0,
            category: 'otro',
            isActive: true,
            accessUrl: '',
            notes: ''
        };
        setEditingCombo(newCombo);
    };

    const handleSaveCombo = (combo: SystemComboConfig) => {
        const existing = localSystemSettings.combos.find(c => c.id === combo.id);
        if (existing) {
            setLocalSystemSettings(prev => ({
                ...prev,
                combos: prev.combos.map(c => c.id === combo.id ? combo : c)
            }));
        } else {
            setLocalSystemSettings(prev => ({
                ...prev,
                combos: [...prev.combos, combo]
            }));
        }
        setEditingCombo(null);
    };

    const handleDeleteCombo = (id: string) => {
        setLocalSystemSettings(prev => ({
            ...prev,
            combos: prev.combos.filter(c => c.id !== id)
        }));
    };

    // Sync if store changes externally
    React.useEffect(() => {
        setLocalSystemSettings(systemSettings);
    }, [systemSettings]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const passwordFileInputRef = useRef<HTMLInputElement>(null);
    const bulkPdfInputRef = useRef<HTMLInputElement>(null);
    const [fees, setFees] = useState<ServiceFeesConfig>(serviceFees);
    // Dos herramientas que existian sin forma de abrirse.
    const [isCertOpen, setIsCertOpen] = useState(false);
    const [isTarjetaOpen, setIsTarjetaOpen] = useState(false);
    const [isClavesModalOpen, setIsClavesModalOpen] = useState(false);
    const [isEditingFees, setIsEditingFees] = useState(false);
    const [isUploadingPdfs, setIsUploadingPdfs] = useState(false);
    const [pdfUploadResults, setPdfUploadResults] = useState<{ total: number, success: number, error: number, existed: number } | null>(null);
    const { importData } = useAppStore();
    const jsonFileInputRef = useRef<HTMLInputElement>(null);
    const [localReminderConfig, setLocalReminderConfig] = useState<ReminderConfig>(reminderConfig || {
        isEnabled: true,
        daysBefore: 3,
        onDueDate: true,
        overdueInterval: 7,
        template: ''
    });

    // Sync with prop when it arrives (e.g. cloud load)
    useEffect(() => {
        if (reminderConfig) {
            setLocalReminderConfig(reminderConfig);
        }
    }, [reminderConfig]);

    // Guard for rendering
    if (!localReminderConfig) return null;

    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [currentService, setCurrentService] = useState<{ id?: string; name: string; price: number } | null>(null);
    const [serviceModalFeedback, setServiceModalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [includeRentaAdvance, setIncludeRentaAdvance] = useState(false);

    // Cloud Config State
    const [backendUrl, setBackendUrl] = useState(getBackendUrl());
    const [isSavingUrl, setIsSavingUrl] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationResult, setMigrationResult] = useState<{ clients: number, tasks: number } | null>(null);

    useEffect(() => {
        setFees(serviceFees);
    }, [serviceFees]);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => {
            const sortKeyA = getIdentifierSortKey(a.ruc);
            const sortKeyB = getIdentifierSortKey(b.ruc);
            if (sortKeyA !== sortKeyB) {
                return sortKeyA - sortKeyB;
            }
            return a.name.localeCompare(b.name);
        });
    }, [clients]);



    // Handle saving the custom backend URL
    const handleSaveBackendUrl = () => {
        setIsSavingUrl(true);
        // Basic validation
        if (backendUrl && !backendUrl.startsWith('http')) {
            alert('Por favor ingrese una URL válida (https://...)');
            setIsSavingUrl(false);
            return;
        }

        localStorage.setItem('sc_pro_backend_url', backendUrl);

        setTimeout(() => {
            setIsSavingUrl(false);
            alert('Conexión guardada. Se intentará sincronizar ahora.');
            window.location.reload(); // Force reload to re-init sync
        }, 500);
    };

    const handleExport = () => {
        const activeClients = clients.filter(c => (c.isActive ?? true));
        exportClientsToCSV(activeClients, serviceFees);
    };

    const handleExportJSON = async () => {
        try {
            const data = await exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = safeFormat(new Date(), 'yyyy-MM-dd_HH-mm');
            link.download = `backup_santiago_cordova_${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            alert('Copia de seguridad (JSON) descargada con éxito. Guárdela en un lugar seguro.');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            alert('Error al generar la copia de seguridad.');
        }
    };

    const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                if (window.confirm("¿Está seguro de que desea restaurar esta copia de seguridad? Se sobrescribirán los datos actuales en este navegador y en la nube.")) {
                    await importData(data);
                    alert("¡Datos restaurados con éxito! La página se recargará para aplicar los cambios.");
                    window.location.reload();
                }
            } catch (err) {
                console.error("Error importing JSON:", err);
                alert("Error al procesar el archivo. Asegúrese de que sea un archivo de respaldo .json válido.");
            }
        };
        reader.readAsText(file);
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
    };

    const handleImportJSONClick = () => {
        jsonFileInputRef.current?.click();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handlePasswordImportClick = () => {
        passwordFileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                importClientsFromCSV(content, clients, setClients);
            };
            reader.readAsText(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePasswordFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;
                if (!content) return;

                const credentials = parseCredentialsCSV(content);
                const credKeys = Object.keys(credentials);
                if (credKeys.length === 0) {
                    alert("No se encontraron claves del SRI válidas en el archivo.\n\nAsegúrese de exportar el archivo CSV desde Google Chrome (chrome://password-manager/settings) o su navegador.");
                    return;
                }

                // 1. Guardar en la base de credenciales Bóveda
                if (setSriCredentials) {
                    setSriCredentials(prev => ({ ...prev, ...credentials }));
                }

                // 2. Asociar y actualizar clientes existentes de la cartera
                const nowIso = new Date().toISOString();
                let updatedCount = 0;
                let alreadyMatchingCount = 0;
                const clientsToSync: Client[] = [];

                const updatedClients = clients.map(client => {
                    const cleanRuc = (client.ruc || '').trim();
                    const vaultPassword = credentials[cleanRuc] || credentials[cleanRuc.slice(0, 10)];
                    if (vaultPassword) {
                        if (client.sriPassword !== vaultPassword) {
                            updatedCount++;
                            const updated: Client = {
                                ...client,
                                sriPassword: vaultPassword,
                                sriPasswordUpdatedAt: nowIso,
                                updatedAt: nowIso
                            };
                            clientsToSync.push(updated);
                            return updated;
                        } else {
                            alreadyMatchingCount++;
                        }
                    }
                    return client;
                });

                if (updatedCount > 0) {
                    setClients(updatedClients);
                    // Persistencia granular en Supabase Postgres
                    try {
                        await db.bulkUpdate('sc_pro_clients', clientsToSync);
                    } catch (err) {
                        console.warn("Error en bulkUpdate cloud sync al importar claves:", err);
                    }
                }

                const noEstan = credKeys.filter(k => k.length === 13 && !clients.some(c => c.ruc === k));

                alert(
                    `🔐 SINCRONIZACIÓN DE CONTRASEÑAS EXITOSA:\n\n` +
                    `• ${credKeys.length} credenciales detectadas en el archivo CSV.\n` +
                    `• ${updatedCount} clientes actualizados con nueva clave en el sistema y en la nube (Supabase).\n` +
                    `• ${alreadyMatchingCount} clientes ya tenían la clave correcta.\n` +
                    (noEstan.length > 0 ? `• ${noEstan.length} RUCs guardados en la Bóveda para futuros clientes.\n` : '') +
                    `\nLas claves se han sincronizado con la extensión Nueva Luz 3.0.`
                );
            };
            reader.readAsText(file);
        }
        if (passwordFileInputRef.current) passwordFileInputRef.current.value = "";
    };

    const handleAutoLinkPasswords = async () => {
        if (!sriCredentials || Object.keys(sriCredentials).length === 0) {
            alert("La base de credenciales del SRI está vacía.\n\nPor favor, suba un archivo CSV de contraseñas de su navegador primero usando el botón 'SUBIR CSV CONTRASEÑAS NAVEGADOR'.");
            return;
        }

        let updatedCount = 0;
        const nowIso = new Date().toISOString();
        const clientsToSync: Client[] = [];

        const updatedClients = clients.map(client => {
            const cleanRuc = (client.ruc || '').trim();
            const vaultPassword = sriCredentials[cleanRuc] || sriCredentials[cleanRuc.slice(0, 10)];
            if (vaultPassword && client.sriPassword !== vaultPassword) {
                updatedCount++;
                const updated: Client = {
                    ...client,
                    sriPassword: vaultPassword,
                    sriPasswordUpdatedAt: nowIso,
                    updatedAt: nowIso
                };
                clientsToSync.push(updated);
                return updated;
            }
            return client;
        });

        if (updatedCount === 0) {
            alert("No se encontraron claves nuevas o faltantes para vincular. Todos los clientes coinciden con la base de credenciales de la Bóveda.");
            return;
        }

        setClients(updatedClients);
        try {
            await db.bulkUpdate('sc_pro_clients', clientsToSync);
        } catch (err) {
            console.warn("Error en bulkUpdate cloud sync en auto-link:", err);
        }

        alert(`✅ Sincronización Exitosa: Se vincularon/actualizaron las claves de ${updatedCount} clientes en el sistema y en la nube.`);
    };

    const handleBulkPdfClick = () => {
        bulkPdfInputRef.current?.click();
    };

    const handleBulkPdfChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingPdfs(true);
        setPdfUploadResults(null);

        let newlyCreatedClients: Client[] = [];
        let errorCount = 0;
        let existedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type !== 'application/pdf') {
                errorCount++;
                continue;
            }

            try {
                const extracted = await extractDataFromSriPdf(file);
                if (extracted && extracted.ruc) {
                    const exists = clients.some(c => c.ruc === extracted.ruc) ||
                        newlyCreatedClients.some(nc => nc.ruc === extracted.ruc);
                    if (!exists) {
                        let ivaFrequency: 'Mensual' | 'Semestral' | 'Ninguno' = 'Mensual';
                        const requiresAnnualRenta = true; // Por defecto casi todos hacen renta
                        if (extracted.regimen === TaxRegime.RimpeNegocioPopular) {
                            ivaFrequency = 'Ninguno';
                        } else if (extracted.obligaciones_tributarias === 'semestral') {
                            ivaFrequency = 'Semestral';
                        }

                        const newClient: Client = {
                            id: uuidv4(),
                            name: extracted.apellidos_nombres || 'Cliente Nuevo',
                            ruc: extracted.ruc,
                            sriPassword: '',
                            email: extracted.contacto?.email || '',
                            phones: extracted.contacto?.celular ? [extracted.contacto.celular] : [],
                            declarations: [],
                            notes: `Importado masivamente de PDF.\nActividad: ${extracted.actividad_economica || 'N/A'}\nObligaciones: ${extracted.lista_obligaciones?.join(', ') || 'N/A'}`,
                            isActive: true,
                            regime: extracted.regimen || TaxRegime.General,
                            address: extracted.direccion || '',
                            taxProfile: {
                                ivaFrequency,
                                requiresAnnualRenta,
                                requiresAnexosGastos: false,
                                hasActiveDevolucionIva: false,
                                hasActiveElderlyDevolucionIva: false,
                                requiresIce: false,
                                requiresAnexoPvp: false
                            }
                        };
                        newlyCreatedClients.push(newClient);
                    } else {
                        existedCount++;
                    }
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error("Error extrayendo PDF en lote:", err);
                errorCount++;
            }
        }

        if (newlyCreatedClients.length > 0) {
            bulkAddClients(newlyCreatedClients);
        }

        setPdfUploadResults({
            total: files.length,
            success: newlyCreatedClients.length,
            existed: existedCount,
            error: errorCount
        });
        setIsUploadingPdfs(false);

        if (bulkPdfInputRef.current) bulkPdfInputRef.current.value = "";
    };

    const handleFeeChange = (feeType: keyof ServiceFeesConfig, value: string) => {
        setFees(prev => ({ ...prev, [feeType]: parseFloat(value) || 0 }));
    };

    const handleSaveFees = () => {
        setServiceFees(fees);
        setIsEditingFees(false);
        alert('Tarifas actualizadas correctamente.');
    };

    const handleCancelEditFees = () => {
        setFees(serviceFees);
        setIsEditingFees(false);
    }

    const handleSaveReminderConfig = () => {
        setReminderConfig(localReminderConfig);
        alert('Configuración de recordatorios guardada.');
    };



    const feeFields = {
        declarations: [
            { key: 'ivaMensual' as const, label: 'IVA Mensual', tooltip: 'Se aplica a clientes de Régimen General y Emprendedor con declaraciones mensuales.' },
            { key: 'ivaSemestral' as const, label: 'IVA Semestral', tooltip: 'Se aplica a clientes de Régimen General y Emprendedor con declaraciones semestrales.' },
            { key: 'rentaNP' as const, label: 'Renta (Negocio Popular)', tooltip: 'Se aplica a la declaración anual de clientes RIMPE Negocio Popular.' },
            { key: 'rentaGeneral' as const, label: 'Renta (General/Emprendedor)', tooltip: 'Se aplica a la declaración anual de Renta gestionada desde Tareas.' },
            { key: 'devolucionIva' as const, label: 'Devolución IVA 3ra Edad', tooltip: 'Tarifa para el trámite mensual de devolución de IVA para tercera edad.' },
        ],
        tasks: [
            { key: 'devolucionRenta' as const, label: 'Devolución de Renta', tooltip: 'Tarifa para el trámite de devolución de retenciones de impuesto a la renta.' },
            { key: 'anexoGastosPersonales' as const, label: 'Anexo de Gastos Personales', tooltip: 'Tarifa para la preparación y presentación del anexo de gastos personales.' },
        ]
    }

    const handleAddService = () => {
        setCurrentService({ name: '', price: 0 });
        setServiceModalFeedback(null);
        setIsServiceModalOpen(true);
    };

    const handleEditService = (service: { id: string; name: string; price: number }) => {
        setCurrentService(service);
        setServiceModalFeedback(null);
        setIsServiceModalOpen(true);
    };

    const handleSaveService = () => {
        if (!currentService || !currentService.name.trim() || currentService.price === undefined || currentService.price < 0) {
            setServiceModalFeedback({ message: "El nombre es requerido y el precio no puede ser negativo.", type: 'error' });
            return;
        }
        setFees(prev => {
            const customServices = [...(prev.customPunctualServices || [])];
            if (currentService.id) {
                const index = customServices.findIndex(s => s.id === currentService.id);
                if (index > -1) {
                    customServices[index] = { ...currentService, price: currentService.price ?? 0 } as { id: string; name: string; price: number };
                }
            } else {
                customServices.push({ ...currentService, price: currentService.price ?? 0, id: uuidv4() } as { id: string; name: string; price: number });
            }
            return { ...prev, customPunctualServices: customServices };
        });

        setServiceModalFeedback({ message: '¡Servicio guardado exitosamente!', type: 'success' });

        setTimeout(() => {
            setIsServiceModalOpen(false);
            setCurrentService(null);
        }, 1500);
    };

    const handleDeleteService = (serviceId: string) => {
        if (window.confirm("¿Está seguro de que desea eliminar este servicio? Esta acción no se puede deshacer.")) {
            setFees(prev => ({
                ...prev,
                customPunctualServices: (prev.customPunctualServices || []).filter(s => s.id !== serviceId)
            }));
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-300 relative font-sans min-h-screen">
            {/* ── TOP EXECUTIVE STRIPE ── */}
            <div className="relative z-20 px-4 sm:px-0">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 border-t-white/20 bg-[#051424]/90 shadow-2xl backdrop-blur-2xl p-6 sm:p-10 transition-all duration-500">
                    {/* Mesh Gradient */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-radial from-[#2B6AFF]/15 to-transparent blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-gradient-radial from-[#00A896]/15 to-transparent blur-3xl" />
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="w-full sm:w-auto font-mono">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 shadow-[0_0_10px_rgba(0,168,150,0.2)]">
                                    <div className="relative w-2 h-2 rounded-full bg-[#00A896]">
                                        <div className="absolute inset-0 rounded-full bg-[#00A896] animate-ping opacity-60" />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#00A896] uppercase tracking-[0.25em]">CENTRO DE CONTROL & INFRAESTRUCTURA</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">• Protocolo Santiago Córdova</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-black text-white leading-none tracking-tight font-display">
                                CONFIGURACIÓN & <span className="bg-gradient-to-r from-[#00A896] via-teal-400 to-[#2B6AFF] bg-clip-text text-transparent">SISTEMA</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-sm text-slate-300 font-sans font-medium max-w-2xl">
                                Gestión de infraestructura, honorarios profesionales, sincronización en la nube, combos comerciales y blindaje de bóveda.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SETTINGS NAVIGATION PILLS ── */}
            <div className="flex justify-start sm:justify-center px-4 sm:px-0 overflow-x-auto no-scrollbar font-mono z-10 relative mb-2">
                <div className="inline-flex p-1.5 bg-[#0b1326] rounded-2xl border border-white/10 gap-1 shrink-0">
                    {[
                        { id: 'all', label: 'General / Todo', icon: SettingsIcon },
                        { id: 'flow', label: 'Flujo & Inicio', icon: Zap },
                        { id: 'cloud', label: 'Nube & SRI', icon: Cloud },
                        { id: 'fees', label: 'Honorarios', icon: DollarSign },
                        { id: 'combos', label: 'Combos & Planes', icon: ShoppingBag },
                        { id: 'reminders', label: 'Recordatorios', icon: MessageSquare },
                        { id: 'backup', label: 'Bóveda & Backups', icon: DatabaseBackup },
                    ].map((tab) => {
                        const isActive = settingsTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSettingsTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? 'bg-white/15 text-white shadow-md border border-white/20'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Icon size={14} className={isActive ? 'text-[#00A896]' : ''} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-8 px-4 sm:px-0">
                {/* --- MÓDULO: FLUJO DE TRABAJO, INICIO AUTOMÁTICO & MÉTRICAS --- */}
                {(settingsTab === 'all' || settingsTab === 'flow') && (
                    <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden group">
                        <div className="relative z-10 font-mono">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400">
                                    <Pin size={24} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Flujo de Trabajo & Pantalla de Inicio</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Inicio Automático & Análisis de Uso</p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed font-sans">
                                Configure a qué pantalla debe ingresar el sistema automáticamente al iniciar sesión o cargar el panel. Analice los módulos más utilizados para acoplar el flujo de trabajo diario.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Pantalla de Inicio */}
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                            <Pin size={14} className="text-amber-400" />
                                            Pantalla de Inicio Predeterminada
                                        </label>
                                        {startScreenSaved && (
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">
                                                ¡Guardado!
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-sans">
                                        El panel se abrirá inmediatamente en esta pantalla al iniciar sesión:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {[
                                            { screen: 'declaraciones' as Screen, label: 'Declaraciones SRI', badge: 'Recomendado' },
                                            { screen: 'home' as Screen, label: 'Centro de Control (Dashboard)' },
                                            { screen: 'clients' as Screen, label: 'Directorio de Clientes' },
                                            { screen: 'cobranza' as Screen, label: 'Módulo de Cobranza' },
                                            { screen: 'firmas' as Screen, label: 'Firmas Electrónicas' },
                                            { screen: 'sri_facturacion' as Screen, label: 'Facturador SRI' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.screen}
                                                onClick={() => handleSaveStartScreen(opt.screen)}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                    startScreen === opt.screen
                                                        ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-lg'
                                                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <span className="font-bold text-xs">{opt.label}</span>
                                                {opt.badge && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mt-1">
                                                        ★ {opt.badge}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Módulos más utilizados */}
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                            <Activity size={14} className="text-[#00A896]" />
                                            Módulos Más Utilizados
                                        </label>
                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('sc_module_usage_stats');
                                                setUsageStatsList([]);
                                            }}
                                            className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors uppercase tracking-wider font-bold cursor-pointer"
                                            title="Reiniciar historial de uso"
                                        >
                                            Reiniciar
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-sans">
                                        Frecuencia de acceso a cada herramienta en este dispositivo:
                                    </p>
                                    {usageStatsList.length > 0 ? (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {usageStatsList.map((stat, idx) => {
                                                const maxCount = Math.max(...usageStatsList.map(s => s.count), 1);
                                                const pct = Math.round((stat.count / maxCount) * 100);
                                                return (
                                                    <div key={stat.screen} className="p-2.5 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <span className="w-5 text-[10px] font-bold text-slate-500 font-mono">#{idx + 1}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-bold text-slate-200 capitalize truncate block">
                                                                    {stat.screen.replace('_', ' ')}
                                                                </span>
                                                                <div className="w-full bg-white/5 rounded-full h-1 mt-1 overflow-hidden">
                                                                    <div className="bg-[#00A896] h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0 ml-3">
                                                            <span className="font-bold font-mono text-[#00A896]">{stat.count}</span>
                                                            <span className="text-[9px] text-slate-400 block font-mono">visitas</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-xs text-slate-500 font-mono">
                                            No hay datos de navegación registrados aún.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO: STORE DE EXTENSIONES SRI & NUBE --- */}
                {(settingsTab === 'all' || settingsTab === 'cloud') && (
                    <>
                        <SriExtensionsStore />

                        <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden group">
                            <div className="relative z-10 font-mono">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3.5 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                                        <Cloud size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-3">
                                            Sincronización en la Nube
                                            <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/20 uppercase tracking-widest font-mono">
                                                Google Sheets (Legacy)
                                            </span>
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Nube Activa: Supabase Postgres v5.0 (Automática)</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed font-sans">
                                    <strong>Nota Importante:</strong> El sistema ahora opera de forma nativa e instantánea con <strong>Supabase Postgres v5.0</strong>. La sincronización de clientes, declaraciones y comprobantes se realiza automáticamente en segundo plano. La URL de Google Apps Script a continuación es un enlace heredado de versiones anteriores y no es necesaria para la operación diaria.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-grow">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Link size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={backendUrl}
                                            onChange={(e) => setBackendUrl(e.target.value)}
                                            placeholder="https://script.google.com/macros/s/... (Opcional - Legacy)"
                                            className="w-full pl-11 pr-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveBackendUrl}
                                        disabled={isSavingUrl}
                                        className="px-6 py-3 bg-white/10 hover:bg-white/15 text-slate-300 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                                    >
                                        {isSavingUrl ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        <span>Guardar URL Legacy</span>
                                    </button>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/10">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <History size={14} className="text-[#C9A96E]" />
                                        Protocolo Histórico (Solo para rescate de datos de versiones antiguas)
                                    </h4>
                                    <div className="p-4 bg-[#020b14] border border-amber-500/20 rounded-2xl mb-4">
                                        <p className="text-xs text-amber-300/80 leading-relaxed font-sans">
                                            ⚠️ <strong>Precaución:</strong> No ejecutes esta recuperación a menos que estés migrando datos antiguos (2024 o anteriores) desde una hoja de cálculo Google Sheets. Si ejecutas esto sin necesitarlo, podrías sobreescribir datos limpios de Supabase con información vieja.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("⚠️ ADVERTENCIA: Esta acción descargará datos de Google Sheets (Versión Antigua) e intentará fusionarlos con su base actual. ¿Desea continuar?")) {
                                                try {
                                                    await syncFromSheets();
                                                    alert("¡Sincronización completada!");
                                                    window.location.reload();
                                                } catch (e) {
                                                    alert("Error en la recuperación: Verifique su URL de conexión.");
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-white/10 cursor-pointer"
                                    >
                                        <RotateCw size={14} />
                                        Recuperación Forzada (Sheets)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* --- MÓDULO: ARQUITECTURA DE HONORARIOS --- */}
                {(settingsTab === 'all' || settingsTab === 'fees') && (
                    <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden font-mono">
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                                {/* Herramientas del estudio: dos entregables que ya
                                    existían y no tenían desde dónde abrirse. */}
                                <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3.5 bg-[#2B6AFF]/15 border border-[#2B6AFF]/30 rounded-2xl text-[#2B6AFF]">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Herramientas del Estudio</h3>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#2B6AFF] mt-0.5">Documentos que se entregan al cliente</p>
                                        </div>
                                    </div>
                                    <p className="text-slate-300 text-xs sm:text-sm mb-5 leading-relaxed font-sans max-w-2xl">
                                        Genere el certificado de paz y salvo de un contribuyente, o comparta sus datos bancarios para transferencias.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => setIsCertOpen(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#2B6AFF]/15 hover:bg-[#2B6AFF]/25 text-[#7DA6FF] border border-[#2B6AFF]/40 transition-all cursor-pointer"
                                        >
                                            <FileText size={14} />
                                            <span>Certificado de paz y salvo</span>
                                        </button>
                                        <button
                                            onClick={() => setIsTarjetaOpen(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] border border-[#00A896]/40 transition-all cursor-pointer"
                                        >
                                            <CreditCard size={14} />
                                            <span>Datos bancarios</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 bg-[#C9A96E]/15 border border-[#C9A96E]/30 rounded-2xl text-[#C9A96E]">
                                        <DollarSign size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Arquitectura de Honorarios</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="w-2 h-2 bg-[#C9A96E] rounded-full animate-pulse" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A96E]">Tarifas Base Profesionales</p>
                                        </div>
                                    </div>
                                </div>
                                {!isEditingFees && (
                                    <button 
                                        onClick={() => setIsEditingFees(true)} 
                                        className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#C9A96E] hover:bg-[#C9A96E]/90 text-slate-950 transition-all shadow-lg cursor-pointer"
                                    >
                                        <Edit3 size={14} />
                                        <span>Personalizar</span>
                                    </button>
                                )}
                            </div>
                            
                            <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed font-sans max-w-2xl">
                                Defina los parámetros base para la facturación automática de honorarios tributarios. Se aplican globalmente a menos que se especifique un contrato personalizado por cliente.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Declaraciones Sistemáticas */}
                                <div className="p-6 bg-[#020b14] rounded-2xl border border-white/10 relative overflow-hidden">
                                    <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#C9A96E] mb-5 flex items-center gap-2">
                                        <Calendar size={14} /> Declaraciones Sistemáticas
                                    </h4>
                                    <div className="space-y-4">
                                        {feeFields.declarations.map(item => (
                                            <div key={item.key} className="flex items-center justify-between">
                                                <label className="text-xs text-slate-300 font-sans font-medium flex items-center gap-2">
                                                    {item.label}
                                                    <Tooltip text={item.tooltip}>
                                                        <Info size={12} className="text-slate-500 cursor-help hover:text-[#C9A96E] transition-colors" />
                                                    </Tooltip>
                                                </label>
                                                <div className="relative w-28">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">$</span>
                                                    <input
                                                        type="number"
                                                        readOnly={!isEditingFees}
                                                        value={fees[item.key]}
                                                        onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                                        className={`w-full p-2 pl-6 bg-white/5 border text-xs font-mono font-bold text-right rounded-xl transition-all ${isEditingFees ? 'border-[#C9A96E]/50 text-white focus:border-[#C9A96E]' : 'border-white/5 text-slate-400 opacity-80 cursor-not-allowed'}`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Operaciones Especiales */}
                                <div className="p-6 bg-[#020b14] rounded-2xl border border-white/10 relative overflow-hidden">
                                    <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#00A896] mb-5 flex items-center gap-2">
                                        <Briefcase size={14} /> Operaciones Especiales & Trámites
                                    </h4>
                                    <div className="space-y-4">
                                        {feeFields.tasks.map(item => (
                                            <div key={item.key} className="flex items-center justify-between">
                                                <label className="text-xs text-slate-300 font-sans font-medium flex items-center gap-2">
                                                    {item.label}
                                                    <Tooltip text={item.tooltip}>
                                                        <Info size={12} className="text-slate-500 cursor-help hover:text-[#00A896] transition-colors" />
                                                    </Tooltip>
                                                </label>
                                                <div className="relative w-28">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">$</span>
                                                    <input
                                                        type="number"
                                                        readOnly={!isEditingFees}
                                                        value={fees[item.key]}
                                                        onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                                        className={`w-full p-2 pl-6 bg-white/5 border text-xs font-mono font-bold text-right rounded-xl transition-all ${isEditingFees ? 'border-[#00A896]/50 text-white focus:border-[#00A896]' : 'border-white/5 text-slate-400 opacity-80 cursor-not-allowed'}`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Catálogo de Inteligencia Adicional */}
                            <div className="p-6 bg-[#020b14] rounded-2xl border border-white/10">
                                <h4 className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-white">
                                        <Package size={14} className="text-[#00A896]" />
                                        Catálogo de Servicios Puntuales
                                    </div>
                                    {isEditingFees && (
                                        <button 
                                            onClick={handleAddService} 
                                            className="text-[10px] font-bold uppercase px-3 py-1.5 bg-[#00A896] text-white rounded-xl hover:scale-105 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus size={12} /> NUEVO SERVICIO
                                        </button>
                                    )}
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(fees.customPunctualServices || []).map(service => (
                                        <div key={service.id} className="flex flex-col p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-[#00A896]/40 transition-all group/service relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-bold uppercase text-[#00A896] bg-[#00A896]/15 px-2 py-0.5 rounded-md tracking-wider">Servicio</span>
                                                {isEditingFees && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleEditService(service)} className="p-1 text-slate-400 hover:text-white transition-all cursor-pointer"><Edit size={12} /></button>
                                                        <button onClick={() => handleDeleteService(service.id)} className="p-1 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"><Trash2 size={12} /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-white mb-3 truncate font-sans">{service.name}</span>
                                            <div className="flex items-baseline gap-1 mt-auto">
                                                <span className="text-base font-bold text-white font-mono">${service.price.toFixed(2)}</span>
                                                <span className="text-[10px] text-slate-400 ml-auto uppercase">Tarifa Base</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {isEditingFees && (
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button 
                                        onClick={handleSaveFees} 
                                        className="flex-grow p-4 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold uppercase tracking-wider text-xs rounded-2xl shadow-lg shadow-[#00A896]/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                                    >
                                        <Save size={16} />
                                        <span>Consolidar Tarifas</span>
                                    </button>
                                    <button 
                                        onClick={handleCancelEditFees} 
                                        className="px-8 p-4 bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all border border-white/10 cursor-pointer"
                                    >
                                        Descartar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MÓDULO: RECORDATORIOS DE COBRANZA (WHATSAPP) --- */}
                {(settingsTab === 'all' || settingsTab === 'reminders') && (
                    <div className="rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl overflow-hidden font-mono">
                        <div className="p-6 sm:p-8 border-b border-white/10 bg-[#0b1326]/50">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                                        <MessageSquare size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-bold font-display text-white">Alertas de <span className="text-[#00A896]">Cobranza</span></h3>
                                        <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">Automated Intelligence Reminders</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                                        localReminderConfig?.isEnabled 
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                        : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                    }`}>
                                        {localReminderConfig?.isEnabled ? 'ACTIVO' : 'STANDBY'}
                                    </span>
                                    <button 
                                        onClick={() => setLocalReminderConfig(c => c ? ({ ...c, isEnabled: !(c?.isEnabled ?? true) }) : c)}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${localReminderConfig?.isEnabled ? 'bg-[#00A896]' : 'bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${localReminderConfig?.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 sm:p-8 space-y-6 ${!(localReminderConfig?.isEnabled ?? true) ? 'opacity-40 pointer-events-none' : ''}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <BellRing size={12} className="text-[#00A896]" /> Ventana de Pre-Vencimiento
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={localReminderConfig?.daysBefore ?? 3}
                                            onChange={e => setLocalReminderConfig(c => c ? ({ ...c, daysBefore: parseInt(e.target.value) || 0 }) : c)}
                                            className="w-full p-3.5 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white outline-none focus:border-[#00A896]/50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">DÍAS ANTES</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={12} className="text-rose-400" /> Intervalo en Mora (Recurrencia)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={localReminderConfig?.overdueInterval ?? 7}
                                            onChange={e => setLocalReminderConfig(c => c ? ({ ...c, overdueInterval: parseInt(e.target.value) || 0 }) : c)}
                                            className="w-full p-3.5 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white outline-none focus:border-rose-400/50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">CADA X DÍAS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <FileEdit size={12} className="text-[#00A896]" /> Plantilla de Mensaje WhatsApp
                                    </label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['{clientName}', '{period}', '{amount}', '{dueDate}'].map(tag => (
                                            <span key={tag} className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-[#00A896]">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    rows={4}
                                    value={localReminderConfig?.template || ''}
                                    onChange={e => setLocalReminderConfig(c => c ? ({ ...c, template: e.target.value }) : c)}
                                    className="w-full p-4 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all leading-relaxed"
                                    placeholder="Estimado/a {clientName}, le recordamos que su declaración..."
                                />
                            </div>

                            <button 
                                onClick={handleSaveReminderConfig} 
                                className="w-full p-4 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00A896]/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                            >
                                <Save size={16} />
                                ACTUALIZAR PROTOCOLO DE RECORDATORIOS
                            </button>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO: COMBOS & SISTEMAS DE FACTURACIÓN --- */}
                {(settingsTab === 'all' || settingsTab === 'combos') && (
                    <div className="rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl overflow-hidden font-mono">
                        <div className="p-6 sm:p-8 bg-[#0b1326]/50 border-b border-white/10 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-[#C9A96E]/15 border border-[#C9A96E]/30 rounded-2xl text-[#C9A96E]">
                                    <ShoppingBag size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight flex items-center gap-3">
                                        Combos & Planes Comerciales
                                        {systemSaved && (
                                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                                                <CheckCircle size={13} /> Guardado
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-slate-400 text-xs font-sans mt-0.5">Configura planes, precios y accesos para facturadores.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isEditingCombos ? (
                                    <>
                                        <button onClick={() => { setIsEditingCombos(false); setLocalSystemSettings(systemSettings); }}
                                            className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white border border-white/10 rounded-xl transition-all cursor-pointer">
                                            Cancelar
                                        </button>
                                        <button onClick={handleSaveSystemSettings} disabled={isSavingSystem}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-[#00A896] hover:bg-[#00A896]/80 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg cursor-pointer">
                                            {isSavingSystem ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                                            Guardar Todo
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => setIsEditingCombos(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase border border-white/10 transition-all cursor-pointer">
                                        <SettingsIcon size={13} /> Configurar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="space-y-3">
                                {localSystemSettings.combos.map(combo => (
                                    <div key={combo.id}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${combo.isActive ? 'bg-[#020b14] border-white/10' : 'bg-black/20 border-white/5 opacity-50'}`}>
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
                                            {combo.category === 'firma' ? '🔑' : combo.category === 'ecuafact' ? '📄' : combo.category === 'zifact' ? '⚡' : '📦'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-white truncate">{combo.name}</span>
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-[#00A896]/15 text-[#00A896] border border-[#00A896]/30">
                                                    {combo.category}
                                                </span>
                                            </div>
                                            {combo.accessUrl && (
                                                <a href={combo.accessUrl} target="_blank" rel="noopener noreferrer"
                                                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 mt-0.5 truncate">
                                                    <ExternalLink size={10} /> {combo.accessUrl}
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-lg font-bold text-[#C9A96E] font-mono">${combo.price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO: GESTIÓN DE BÓVEDA & BACKUPS --- */}
                {(settingsTab === 'all' || settingsTab === 'backup') && (
                    <div className="space-y-8 font-mono">
                        {/* 1. BÓVEDA DE CONTRASEÑAS SRI & CARGA NAVEGADOR */}
                        <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-amber-500/20 border-t-amber-500/40 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
                                        <Key size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-3">
                                            Bóveda de Contraseñas SRI
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest font-mono">
                                                Navegador ➔ Sistema
                                            </span>
                                        </h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                                            Importación directa desde Chrome / Edge & Sincronización en Supabase
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsClavesModalOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-lg shadow-amber-500/20 cursor-pointer shrink-0"
                                >
                                    <Key size={14} />
                                    <span>Abrir Gestor de Claves SRI</span>
                                </button>
                            </div>

                            <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed font-sans max-w-3xl">
                                ¿Tus contraseñas del SRI están guardadas en tu navegador? Puedes exportarlas en un archivo CSV y subirlas aquí. El sistema detectará automáticamente cada RUC, actualizará la clave del cliente en Supabase Postgres y la sincronizará en tiempo real con la extensión <strong>Nueva Luz 3.0</strong>.
                            </p>

                            {/* Acciones de Claves */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <input
                                    type="file"
                                    ref={passwordFileInputRef}
                                    onChange={handlePasswordFileChange}
                                    accept=".csv"
                                    className="hidden"
                                />
                                <button
                                    onClick={handlePasswordImportClick}
                                    className="p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/50 rounded-2xl text-xs font-bold text-amber-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/5 text-center"
                                >
                                    <Upload size={16} className="text-amber-400 shrink-0" />
                                    <span>SUBIR CSV CONTRASEÑAS NAVEGADOR</span>
                                </button>

                                <button
                                    onClick={handleAutoLinkPasswords}
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 hover:border-[#00A896]/40 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <Zap size={16} className="text-[#00A896] shrink-0" />
                                    <span>VINCULAR CLAVES CON CLIENTES</span>
                                </button>

                                <button
                                    onClick={() => setIsClavesModalOpen(true)}
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 hover:border-amber-400/40 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                                    <span>ROTADOR & ASISTENTE (* ➔ @)</span>
                                </button>
                            </div>

                            {/* Guía Rápida: Cómo exportar de Chrome */}
                            <div className="p-4 bg-[#020b14]/80 border border-white/10 rounded-2xl text-xs text-slate-300 space-y-2">
                                <p className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                    <Info size={14} /> ¿Cómo exportar tus contraseñas desde Google Chrome?
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] font-sans pl-1">
                                    <li>En Google Chrome, abre una pestaña y escribe en la barra de direcciones: <code className="text-sky-400 bg-white/5 px-1.5 py-0.5 rounded font-mono">chrome://password-manager/settings</code></li>
                                    <li>En la sección <strong>"Exportar contraseñas"</strong>, haz clic en <strong>"Descargar archivo"</strong> (se descargará un archivo <code className="text-amber-300 font-mono">.csv</code>).</li>
                                    <li>Regresa aquí y presiona el botón ámbar <strong>"SUBIR CSV CONTRASEÑAS NAVEGADOR"</strong>.</li>
                                </ol>
                            </div>
                        </div>

                        {/* 2. GESTIÓN DE EXPEDIENTES & RESPALDOS GENERALES */}
                        <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3.5 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896] shrink-0">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Gestión de Expedientes & Backups</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Seguridad, Exportación y Restauración Integral</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <input type="file" ref={jsonFileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                <input type="file" ref={bulkPdfInputRef} onChange={handleBulkPdfChange} accept="application/pdf" multiple className="hidden" />

                                <button 
                                    onClick={handleExportJSON} 
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <Download size={16} className="text-[#00A896] shrink-0" />
                                    <span>RESPALDO JSON (TODO)</span>
                                </button>

                                <button 
                                    onClick={handleImportJSONClick} 
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <Upload size={16} className="text-[#2B6AFF] shrink-0" />
                                    <span>RESTAURAR JSON</span>
                                </button>

                                <button 
                                    onClick={handleExport} 
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <Download size={16} className="text-[#C9A96E] shrink-0" />
                                    <span>EXPORTAR CLIENTES CSV</span>
                                </button>

                                <button 
                                    onClick={handleImportClick} 
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <Upload size={16} className="text-emerald-400 shrink-0" />
                                    <span>IMPORTAR CLIENTES CSV</span>
                                </button>

                                <button 
                                    onClick={handleBulkPdfClick} 
                                    className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <FileSearch size={16} className="text-purple-400 shrink-0" />
                                    <span>{isUploadingPdfs ? 'EXTRAYENDO PDFS...' : 'CREAR CLIENTES DESDE PDFS'}</span>
                                </button>
                            </div>

                            {pdfUploadResults && (
                                <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                                    Resultados PDFs: Total {pdfUploadResults.total} • Nuevos {pdfUploadResults.success} • Existentes {pdfUploadResults.existed} • Errores {pdfUploadResults.error}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Editar Servicio */}
            <Modal
                isOpen={isServiceModalOpen}
                onClose={() => {
                    if (serviceModalFeedback?.type === 'success') return;
                    setIsServiceModalOpen(false)
                }}
                title={currentService?.id ? "Editar Servicio" : "Nuevo Servicio Puntual"}
            >
                <div className="space-y-4 p-2 font-mono">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre del Servicio</label>
                        <input
                            type="text"
                            placeholder="Ej: Anexo de Accionistas"
                            value={currentService?.name || ''}
                            onChange={(e) => setCurrentService(prev => prev ? { ...prev, name: e.target.value } : null)}
                            className="w-full p-3 bg-[#020b14] border border-white/10 rounded-xl text-xs font-mono text-white outline-none focus:border-[#00A896]/50"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio (USD)</label>
                        <input
                            type="number"
                            placeholder="20.00"
                            value={currentService?.price ?? ''}
                            onChange={(e) => setCurrentService(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                            className="w-full p-3 bg-[#020b14] border border-white/10 rounded-xl text-xs font-mono text-white outline-none focus:border-[#00A896]/50"
                        />
                    </div>
                    {serviceModalFeedback && (
                        <div className={`p-3 text-center text-xs rounded-xl ${serviceModalFeedback.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                            {serviceModalFeedback.message}
                        </div>
                    )}
                    <button onClick={handleSaveService} className="w-full py-3.5 bg-[#00A896] hover:bg-[#00A896]/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer">
                        Guardar Servicio
                    </button>
                </div>
            </Modal>
        <TaxCertificateGeneratorModal isOpen={isCertOpen} onClose={() => setIsCertOpen(false)} />
        <DigitalBusinessCardModal isOpen={isTarjetaOpen} onClose={() => setIsTarjetaOpen(false)} />
        <SriPasswordChangerModal isOpen={isClavesModalOpen} onClose={() => setIsClavesModalOpen(false)} />
        </div>
    );
};

export default SettingsScreen;
