
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    BellRing, Briefcase, Calendar, CalendarClock, Check, CheckCircle,
    ChevronDown, ChevronRight, ChevronUp, Clock, Cloud, Crown, Database,
    DatabaseBackup, DollarSign, Download, Edit, Edit3, ExternalLink, FileEdit,
    FileSearch, Fingerprint, Globe, History, Info, Key, Link, Loader, Loader2,
    Lock, MessageSquare, Package, Palette, Pencil, Plus, RefreshCw, RotateCw,
    Save, Settings as SettingsIcon, Share2, ShieldCheck, ShoppingBag, Target,
    ToggleLeft, ToggleRight, Trash2, Upload, UploadCloud, UserX, Wrench, Zap
} from 'lucide-react';
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

interface SettingsScreenProps {
    navigate: (screen: Screen, options?: { clientIdToView?: string }) => void;
}


const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {text}
            </div>
        </div>
    )
}

const CollapsibleGuide: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                <h4 className="font-medium text-gray-800 dark:text-gold flex items-center text-md">
                    <Icon size={18} className="mr-3 text-gold" />
                    <span>{title}</span>
                </h4>
                <ChevronRight className={`w-5 h-5 transition-transform text-gray-500 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <div className="p-4 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
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
    const [isEditingCombos, setIsEditingCombos] = useState(false);
    const [editingCombo, setEditingCombo] = useState<SystemComboConfig | null>(null);
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
            reader.onload = (e) => {
                const content = e.target?.result as string;
                // Updated: Now populates separate credentials DB
                if (setSriCredentials) {
                    const credentials = parseCredentialsCSV(content);
                    if (Object.keys(credentials).length === 0) {
                        alert("No se encontraron claves del SRI válidas en el archivo.");
                        return;
                    }
                    setSriCredentials(prev => ({ ...prev, ...credentials }));
                    alert(`Base de Datos Actualizada: ${Object.keys(credentials).length} claves importadas correctamente.`);
                } else {
                    // Fallback to old behavior if setSriCredentials not available (should not happen in app flow)
                    importBrowserPasswordsToClients(content, clients, setClients);
                }
            };
            reader.readAsText(file);
        }
        if (passwordFileInputRef.current) passwordFileInputRef.current.value = "";
    };

    const handleAutoLinkPasswords = () => {
        if (!sriCredentials || Object.keys(sriCredentials).length === 0) {
            alert("La base de credenciales del SRI está vacía. Por favor, suba un archivo CSV de claves primero.");
            return;
        }

        let updatedCount = 0;
        const updatedClients = clients.map(client => {
            const vaultPassword = sriCredentials[client.ruc];
            if (vaultPassword && client.sriPassword !== vaultPassword) {
                updatedCount++;
                return {
                    ...client,
                    sriPassword: vaultPassword,
                    updatedAt: new Date().toISOString()
                };
            }
            return client;
        });

        if (updatedCount === 0) {
            alert("No se encontraron claves nuevas o faltantes para vincular. Todos los clientes coinciden con la base de credenciales.");
            return;
        }

        setClients(updatedClients);
        alert(`Sincronización Exitosa: Se vincularon/actualizaron las claves de ${updatedCount} clientes.`);
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
                    const exists = clients.some(c => c.ruc === extracted.ruc);
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

            <div className="space-y-8 px-4 sm:px-0">
                {/* --- MÓDULO: STORE DE EXTENSIONES SRI --- */}
                <SriExtensionsStore />

                {/* --- MÓDULO: SINCRONIZACIÓN MAESTRA --- */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden group">
                    <div className="relative z-10 font-mono">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3.5 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                                <Cloud size={24} />
                            </div>
                            <div>
                                <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Sincronización Maestra en la Nube</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="w-2 h-2 bg-[#00A896] rounded-full animate-pulse" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#00A896]">Google Workspace & Supabase Sync v5.0</p>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed font-sans">
                            Punto de enlace con la base de datos distribuida en la nube. Configure la URL de acceso del backend para sincronización instantánea multi-dispositivo.
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
                                    placeholder="https://script.google.com/macros/s/..."
                                    className="w-full pl-11 pr-4 py-3 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-[#00A896]/50 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSaveBackendUrl}
                                disabled={isSavingUrl}
                                className="px-6 py-3 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-[#00A896] hover:to-teal-500 text-white font-bold uppercase tracking-wider text-xs rounded-2xl shadow-lg shadow-[#00A896]/20 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                            >
                                {isSavingUrl ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                                <span>Activar Enlace</span>
                            </button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <History size={14} className="text-[#C9A96E]" />
                                Protocolos de Recuperación (Legacy)
                            </h4>
                            <div className="p-4 bg-[#020b14] border border-amber-500/20 rounded-2xl mb-4">
                                <p className="text-xs text-amber-300/80 leading-relaxed font-sans">
                                    Si migró desde Google Sheets y detecta inconsistencias, ejecute una recuperación forzada para restaurar registros históricos.
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

                {/* --- MÓDULO: ARQUITECTURA DE HONORARIOS --- */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden font-mono">
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
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

                {/* --- MÓDULO: RECORDATORIOS DE COBRANZA (WHATSAPP) --- */}
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
                                className="w-full p-4 bg-[#020b14] border border-white/10 rounded-2xl text-xs font-mono text-white leading-relaxed focus:border-[#00A896]/50 outline-none"
                                placeholder="Escriba el protocolo de mensaje aquí..."
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

                {/* --- MÓDULO: COMBOS & SISTEMAS DE FACTURACIÓN --- */}
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

                {/* --- MÓDULO: GESTIÓN DE BÓVEDA & BACKUPS --- */}
                <div className="p-6 sm:p-8 rounded-[2.5rem] bg-[#051424]/90 border border-white/10 border-t-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden font-mono">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3.5 bg-[#00A896]/15 border border-[#00A896]/30 rounded-2xl text-[#00A896]">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Gestión de Bóveda & Backups</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Seguridad y Resguardo Integral</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <button 
                            onClick={handleExportJSON} 
                            className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <Download size={16} className="text-[#00A896]" /> RESPALDO JSON
                        </button>
                        <input type="file" ref={jsonFileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                        <button 
                            onClick={handleImportJSONClick} 
                            className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <Upload size={16} className="text-[#2B6AFF]" /> RESTAURAR JSON
                        </button>
                        <button 
                            onClick={handleExport} 
                            className="p-4 bg-[#020b14] hover:bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <Download size={16} className="text-[#C9A96E]" /> EXPORTAR CSV
                        </button>
                    </div>
                </div>
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
        </div>
    );
};

export default SettingsScreen;
