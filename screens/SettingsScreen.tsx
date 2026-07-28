
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
        <div className="space-y-6 pb-24 animate-fade-in relative pt-4 sm:pt-0">
            {/* ZENITH CONTROL HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-8">
                <div className="animate-fade-in-left w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal/10 border border-brand-teal/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>
                            <span className="text-xs font-semibold text-brand-teal uppercase tracking-widest">Master Protocol</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• Santiago Cordova Protocol</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-tight sm:leading-[0.85] tracking-tighter mb-2">
                        Centro de <span className="text-brand-teal">Control</span>
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium uppercase tracking-widest">
                        <ShieldCheck size={12} className="text-brand-teal" />
                        <span>Gestión de Infraestructura, Honorarios y Bóveda</span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">

                     {/* --- MÓDULO: CONEXIÓN ESTRATÉGICA --- */}
                <div className="p-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-all duration-700 hover:shadow-primary/5 hover:border-primary/20">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner text-primary">
                                <Cloud size={28} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h3 className="font-display font-bold text-2xl text-slate-900 dark:text-white tracking-tight">Sincronización Maestra</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/70">Google Workspace Sync v5.0</p>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                            Vínculo con la base de datos distribuida en la nube. Configure el punto de acceso (Web App URL) para la sincronización multi-dispositivo.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow group/input">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-sky-400 transition-colors">
                                    <Link size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={backendUrl}
                                    onChange={(e) => setBackendUrl(e.target.value)}
                                    placeholder="https://script.google.com/macros/s/..."
                                    className="w-full pl-10 p-3.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-xs font-mono focus:ring-4 focus:ring-sky-400/10 focus:border-sky-400/40 transition-all outline-none"
                                />
                            </div>
                            <button
                                onClick={handleSaveBackendUrl}
                                disabled={isSavingUrl}
                                className="px-8 py-4 bg-primary text-white font-bold uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 border border-primary/20"
                            >
                                {isSavingUrl ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} strokeWidth={2.5} />}
                                <span>Activar Enlace Zenith</span>
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                <History size={14} className="text-amber-400/70" />
                                Protocolos de Recuperación (Legacy)
                            </h4>
                            <div className="p-4 bg-amber-400/5 dark:bg-amber-400/5 border border-amber-400/20 rounded-2xl mb-4 group/alert">
                                <p className="text-[11px] text-amber-700 dark:text-amber-400/80 leading-relaxed font-medium italic">
                                    Si migró desde Google Sheets y detecta anomalías, ejecute una recuperación forzada para restaurar la coherencia de los registros transaccionales.
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (window.confirm("⚠️ ADVERTENCIA: Esta acción descargará datos de Google Sheets (Versión Antigua) e intentará fusionarlos con su base actual. Podría resultar en la pérdida temporal o permanente de PDFs subidos recientemente. ¿Está completamente seguro de continuar?")) {
                                        try {
                                            await syncFromSheets();
                                            alert("¡Sincronización (Fusión) completada! Sus PDFs locales han sido protegidos en la medida de lo posible.");
                                            window.location.reload();
                                        } catch (e) {
                                            alert("Error en la recuperación: Verifique su URL de conexión.");
                                        }
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-amber-400/10 hover:text-amber-500 dark:hover:text-amber-400 transition-all font-semibold text-xs uppercase tracking-widest border border-transparent hover:border-amber-400/30"
                            >
                                <RotateCw size={14} />
                                Recuperación Forzada (Sheets)
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- ZENITH DATA MIGRATION --- */}
                <div className="p-8 bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden relative group">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/10 transition-all duration-700" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                                <Database size={28} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h3 className="font-display font-bold text-2xl text-white tracking-tight">Estructura Documental (SQL)</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-500/70">Protocolo Postgres v2.0</p>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                            Transfiera toda su infraestructura de datos de <span className="text-white font-medium">Firebase (NoSQL)</span> a <span className="text-brand-teal font-medium">Supabase (SQL)</span>. 
                            Esta acción migrará clientes y tareas manteniendo la integridad relacional.
                        </p>

                        {!migrationResult ? (
                            <button
                                onClick={async () => {
                                    if (window.confirm("🚀 ¿Iniciar Migración Táctica? Sus datos se duplicarán en Supabase para validación. No se borrará nada de Firebase aún.")) {
                                        setIsMigrating(true);
                                        const result = await MigrationUtility.migrateAll();
                                        setIsMigrating(false);
                                        if (result.clients.success) {
                                            setMigrationResult({ 
                                                clients: result.clients.count || 0, 
                                                tasks: result.tasks.count || 0 
                                            });
                                        } else {
                                            alert(`Error: ${result.clients.error || 'Fallo desconocido'}`);
                                        }
                                    }
                                }}
                                disabled={isMigrating}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-brand-teal text-white font-semibold uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-teal/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                {isMigrating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Migrando Datos...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={20} strokeWidth={2.5} />
                                        <span>Iniciar Protocolo SQL</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="p-4 bg-emerald-400/10 border border-emerald-400/30 rounded-2xl text-center">
                                <CheckCircle className="text-emerald-400 mx-auto mb-2" size={32} />
                                <p className="text-white font-semibold text-sm uppercase mb-1">Migración Completada</p>
                                <p className="text-emerald-400 text-xs font-medium">
                                    {migrationResult.clients} Clientes y {migrationResult.tasks} Tareas transferidas exitosamente.
                                </p>
                            </div>
                        )}
                        
                        <div className="mt-4 flex items-center gap-2 justify-center">
                            <ShieldCheck size={14} className="text-slate-500" />
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Cifrado de Extremo a Extremo Activo</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden relative group transition-all duration-700 hover:shadow-primary/5 hover:border-primary/20">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner text-primary">
                                    <DollarSign size={28} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-2xl text-slate-900 dark:text-white tracking-tight">Arquitectura de Honorarios</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/70">Protocolo de Inversión v5.0 Professional</p>
                                    </div>
                                </div>
                            </div>
                            {!isEditingFees && (
                                <button 
                                    onClick={() => setIsEditingFees(true)} 
                                    className="flex items-center gap-2 px-6 py-2 text-xs font-semibold uppercase tracking-widest rounded-xl bg-gold text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20"
                                >
                                    <Edit3 size={12} />
                                    <span>Personalizar</span>
                                </button>
                            )}
                        </div>
                        
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed max-w-2xl">
                             Defina los parámetros base para la facturación automática. Estos valores representan su estándar de inversión profesional y se aplican globalmente a menos que se especifique un contrato personalizado por cliente.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="p-6 bg-slate-50/50 dark:bg-black/20 rounded-[1.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Calendar size={80} className="text-gold" />
                                </div>
                                <h4 className="font-semibold text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-gold/50 rounded-full" />
                                    Declaraciones Sistemáticas
                                </h4>
                                <div className="space-y-5 relative z-10">
                                    {feeFields.declarations.map(item => (
                                        <div key={item.key} className="flex items-center justify-between group/item">
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2 transition-colors group-hover/item:text-slate-900 dark:group-hover/item:text-white">
                                                {item.label}
                                                <Tooltip text={item.tooltip}>
                                                    <Info size={12} className="text-slate-300 dark:text-slate-600 cursor-help hover:text-gold transition-colors" />
                                                </Tooltip>
                                            </label>
                                            <div className="relative w-32 group/input">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 dark:text-slate-600 transition-colors group-focus-within/input:text-gold">$</span>
                                                <input
                                                    type="number"
                                                    readOnly={!isEditingFees}
                                                    value={fees[item.key]}
                                                    onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                                    className={`w-full p-2.5 pl-7 bg-white dark:bg-slate-900/60 border text-xs font-mono font-semibold text-right rounded-xl transition-all ${isEditingFees ? 'border-gold/30 focus:border-gold focus:ring-4 focus:ring-gold/10' : 'border-slate-100 dark:border-white/5 opacity-80 cursor-not-allowed text-slate-500'}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 dark:bg-black/20 rounded-[1.5rem] border border-slate-200 dark:border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Briefcase size={80} className="text-sky-400" />
                                </div>
                                <h4 className="font-semibold text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-sky-400/50 rounded-full" />
                                    Operaciones Especiales
                                </h4>
                                <div className="space-y-5 relative z-10">
                                    {feeFields.tasks.map(item => (
                                        <div key={item.key} className="flex items-center justify-between group/item">
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2 transition-colors group-hover/item:text-slate-900 dark:group-hover/item:text-white">
                                                {item.label}
                                                <Tooltip text={item.tooltip}>
                                                    <Info size={12} className="text-slate-300 dark:text-slate-600 cursor-help hover:text-sky-400 transition-colors" />
                                                </Tooltip>
                                            </label>
                                            <div className="relative w-32 group/input">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 dark:text-slate-600 transition-colors group-focus-within/input:text-sky-400">$</span>
                                                <input
                                                    type="number"
                                                    readOnly={!isEditingFees}
                                                    value={fees[item.key]}
                                                    onChange={(e) => handleFeeChange(item.key, e.target.value)}
                                                    className={`w-full p-2.5 pl-7 bg-white dark:bg-slate-900/60 border text-xs font-mono font-semibold text-right rounded-xl transition-all ${isEditingFees ? 'border-sky-400/30 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10' : 'border-slate-100 dark:border-white/5 opacity-80 cursor-not-allowed text-slate-500'}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* --- DYNAMIC SERVICES CATALOG --- */}
                        <div className="p-6 bg-white/40 dark:bg-black/20 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
                            <h4 className="font-semibold text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6 flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-3 bg-brand-teal rounded-full" />
                                    Catálogo de Inteligencia Adicional
                                </div>
                                {isEditingFees && (
                                    <button 
                                        onClick={handleAddService} 
                                        className="text-[11px] font-semibold px-4 py-2 bg-brand-teal text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-brand-teal/20 flex items-center gap-1.5"
                                    >
                                        <Plus size={12} />
                                        NUEVO SERVICIO
                                    </button>
                                )}
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(fees.customPunctualServices || []).map(service => (
                                    <div key={service.id} className="flex flex-col p-4 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 rounded-2xl hover:border-brand-teal/30 transition-all group/service relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[11px] font-semibold uppercase text-brand-teal/80 bg-brand-teal/10 px-2 py-0.5 rounded-lg tracking-wider">Servicio</span>
                                            {isEditingFees && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover/service:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditService(service)} className="p-1.5 text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"><Edit size={12} /></button>
                                                    <button onClick={() => handleDeleteService(service.id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"><Trash2 size={12} /></button>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-4 line-clamp-1">{service.name}</span>
                                        <div className="flex items-baseline gap-1 mt-auto">
                                            <span className="text-xs font-semibold text-slate-400">$</span>
                                            <span className="text-xl font-display font-semibold text-slate-900 dark:text-white leading-none">{service.price.toFixed(2)}</span>
                                            <span className="text-xs font-medium text-slate-400 ml-auto uppercase tracking-tighter">Costo Base</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {isEditingFees && (
                            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up-fade pt-4 px-1">
                                <button 
                                    onClick={handleSaveFees} 
                                    className="flex-grow p-4 bg-emerald-400 text-white font-semibold uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-400/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    <span>Consolidar Tarifas</span>
                                </button>
                                <button 
                                    onClick={handleCancelEditFees} 
                                    className="px-8 p-4 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all border border-transparent hover:border-slate-300 dark:hover:border-white/10"
                                >
                                    Descartar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RENTA VISIBILITY MODULE */}
                <div className="glass-tactical p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CalendarClock size={120} className="text-gold" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gold/10 rounded-xl border border-gold/20">
                                <CalendarClock className="text-gold" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-medium dark:text-white leading-tight">Control de Visibilidad <span className="text-gold">Renta</span></h3>
                                <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">Tax Visibility Protocol v2.0</p>
                            </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-relaxed max-w-2xl">
                            Especifique el umbral temporal para la activación de controles tácticos. Los botones de <span className="text-gold font-medium">"Declarar Renta"</span> y <span className="text-gold font-medium">"Pagar Renta"</span> se habilitarán automáticamente en las tarjetas de cliente a partir del mes seleccionado.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Target size={16} className="text-gold" />
                                Mes de Despliegue:
                            </label>
                            <div className="relative flex-1 w-full sm:w-auto">
                                <select
                                    value={fees.rentaButtonsStartMonth || 1}
                                    onChange={(e) => handleFeeChange('rentaButtonsStartMonth' as any, e.target.value)}
                                    disabled={!isEditingFees}
                                    className={`w-full p-3 rounded-xl border appearance-none font-medium transition-all ${
                                        isEditingFees 
                                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-gold/50 cursor-pointer' 
                                        : 'bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    <option value={1}>01 - ENERO (Ciclo Anual)</option>
                                    <option value={2}>02 - FEBRERO</option>
                                    <option value={3}>03 - MARZO (Pico Corporativo)</option>
                                    <option value={4}>04 - ABRIL</option>
                                    <option value={5}>05 - MAYO</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                </div>
                            </div>
                            
                            {!isEditingFees && (
                                <span className="text-xs font-medium text-amber-400/70 uppercase tracking-tighter flex items-center gap-1">
                                    <Lock size={10} /> Editar en Precios
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* AUTOMATED REMINDERS MODULE */}
                <div className="glass-tactical rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-brand-teal/10 rounded-xl border border-brand-teal/20">
                                    <MessageSquare className="text-brand-teal" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium dark:text-white">Alertas de <span className="text-brand-teal">Cobranza</span></h3>
                                    <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">Automated Intelligence Reminders</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                    localReminderConfig?.isEnabled 
                                    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' 
                                    : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                }`}>
                                    {localReminderConfig?.isEnabled ? 'SISTEMA ACTIVO' : 'SISTEMA STANDBY'}
                                </span>
                                <button 
                                    onClick={() => setLocalReminderConfig(c => c ? ({ ...c, isEnabled: !(c?.isEnabled ?? true) }) : c)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${localReminderConfig?.isEnabled ? 'bg-brand-teal' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localReminderConfig?.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={`p-6 space-y-6 transition-all duration-500 ${!(localReminderConfig?.isEnabled ?? true) ? 'grayscale opacity-40 pointer-events-none' : ''}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <BellRing size={14} className="text-brand-teal" />
                                    Ventana de Pre-Vencimiento
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localReminderConfig?.daysBefore ?? 3}
                                        onChange={e => setLocalReminderConfig(c => c ? ({ ...c, daysBefore: parseInt(e.target.value) || 0 }) : c)}
                                        className="w-full p-3 glass-card-premium rounded-xl font-medium focus:ring-2 focus:ring-brand-teal/50"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">DÍAS ANTES</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Clock size={14} className="text-rose-400" />
                                    Intervalo en Mora (Recurrencia)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localReminderConfig?.overdueInterval ?? 7}
                                        onChange={e => setLocalReminderConfig(c => c ? ({ ...c, overdueInterval: parseInt(e.target.value) || 0 }) : c)}
                                        className="w-full p-3 glass-card-premium rounded-xl font-medium focus:ring-2 focus:ring-rose-400/50"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">CADA X DÍAS</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setLocalReminderConfig(c => c ? ({ ...c, onDueDate: !(c?.onDueDate ?? true) }) : c)}>
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${localReminderConfig?.onDueDate ? 'bg-brand-teal border-brand-teal' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {localReminderConfig?.onDueDate && <Check size={14} className="text-white" />}
                                </div>
                                <span className="text-sm font-semibold dark:text-slate-200">Alertar el día exacto del vencimiento</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <FileEdit size={14} className="text-brand-teal" />
                                    Protocolo de Comunicación (Template)
                                </label>
                                <div className="flex gap-1">
                                    {['{clientName}', '{period}', '{amount}', '{dueDate}'].map(tag => (
                                        <span key={tag} className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                rows={5}
                                value={localReminderConfig?.template || ''}
                                onChange={e => setLocalReminderConfig(c => c ? ({ ...c, template: e.target.value }) : c)}
                                className="w-full p-4 glass-card-premium rounded-xl text-sm font-mono leading-relaxed focus:ring-2 focus:ring-brand-teal/50 outline-none"
                                placeholder="Escriba el protocolo de mensaje aquí..."
                            />
                        </div>

                        <button 
                            onClick={handleSaveReminderConfig} 
                            className="w-full p-4 bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold rounded-xl shadow-[0_4px_20px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-3 group active:scale-[0.98]"
                        >
                            <Save size={20} className="group-hover:rotate-12 transition-transform" />
                            ACTUALIZAR PROTOCOLO DE RECORDATORIOS
                        </button>
                    </div>
                </div>


                {/* DATA MANAGEMENT & TACTICAL LOGISTICS */}
                <div className="glass-tactical p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-brand-teal/10 rounded-xl border border-brand-teal/20">
                            <Database className="text-brand-teal" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-medium dark:text-white leading-tight">Gestión de <span className="text-brand-teal">Inteligencia</span></h3>
                            <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">Data Logistics & Support Protocol</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* LEGEND MODULE */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Palette size={14} className="text-brand-teal" />
                                Protocolo Visual (Leyenda)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <p className="text-xs font-medium mb-3 dark:text-slate-300 uppercase letter-spacing-wider">Segmentación por Borde</p>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-rose-400 rounded-full"></div>
                                            <span className="text-xs font-semibold dark:text-slate-400"><strong className="text-rose-400">OPERACIÓN VENCIDA:</strong> Acción correctiva inmediata</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-amber-400 rounded-full"></div>
                                            <span className="text-xs font-semibold dark:text-slate-400"><strong className="text-amber-400">CERCA DEL LÍMITE:</strong> En ventana de cumplimiento</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-slate-400 dark:bg-slate-600 rounded-full"></div>
                                            <span className="text-xs font-semibold dark:text-slate-400"><strong className="text-slate-500">STATUS QUO:</strong> Sin acciones pendientes</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <p className="text-xs font-medium mb-3 dark:text-slate-300 uppercase letter-spacing-wider">Capas de Fondo</p>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-400/10 border border-emerald-400/20"></div>
                                            <span className="text-xs font-semibold dark:text-slate-400"><strong className="text-emerald-400">ACTIVO TOTAL:</strong> Cliente con todas las obligaciones OK</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-amber-400/10 border border-amber-400/20"></div>
                                            <span className="text-xs font-semibold dark:text-slate-400"><strong className="text-amber-400">PROCESANDO:</strong> Trámites pendientes en curso</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* IMPORT/EXPORT TOOLBOX */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Share2 size={14} className="text-brand-teal" />
                                Logística de Transferencia
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                <button 
                                    onClick={handleImportClick} 
                                    className="px-6 py-3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <UploadCloud size={18} /> Importar CSV
                                </button>
                                <button 
                                    onClick={handleExport} 
                                    className="px-6 py-3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <Download size={18} /> Exportar CSV
                                </button>
                                <button
                                    onClick={() => {
                                        if (window.confirm('¿Deseas ascender/convertir a TODOS los clientes actuales a clientes VIP?')) {
                                            const idsToUpdate = clients.map(c => c.id);
                                            bulkUpdateClients(idsToUpdate, {  });
                                            alert('Protocolo VIP aplicado a todos los registros.');
                                        }
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-700 text-black font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-400/20"
                                >
                                    <Crown size={18} /> ASCENSIÓN MASIVA VIP
                                </button>
                            </div>
                        </div>

                        {/* BULK PROCESSING HUB */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                            {/* BROWSER KEYS */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Key size={14} className="text-brand-teal" />
                                    Base de Credenciales SRI
                                </h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-semibold">
                                        Importe contraseñas desde el CSV de su navegador (Actualmente: {Object.keys(sriCredentials || {}).length} claves en bóveda).
                                    </p>
                                    <input type="file" ref={passwordFileInputRef} onChange={handlePasswordFileChange} accept=".csv" className="hidden" />
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={handlePasswordImportClick} 
                                            className="w-full py-2.5 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal font-semibold rounded-lg border border-brand-teal/20 transition-all text-xs"
                                        >
                                            SINCRONIZAR CLAVES DEL NAVEGADOR
                                        </button>
                                        <button 
                                            onClick={handleAutoLinkPasswords} 
                                            className="w-full py-2.5 bg-brand-teal text-white hover:bg-brand-teal/95 font-semibold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-teal/10"
                                        >
                                            <RefreshCw size={12} />
                                            VINCULAR CLAVES A CLIENTES EXISTENTES
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* PDF EXTRACTION */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileSearch size={14} className="text-brand-teal" />
                                    Extracción Masiva PDF
                                </h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                        Suba múltiples PDFs del RUC. El motor de IA extraerá datos y creará perfiles automáticamente.
                                    </p>
                                    <input type="file" ref={bulkPdfInputRef} onChange={handleBulkPdfChange} accept="application/pdf" multiple className="hidden" />
                                    <button 
                                        onClick={handleBulkPdfClick} 
                                        disabled={isUploadingPdfs}
                                        className="w-full py-2.5 bg-brand-teal text-white font-medium rounded-lg shadow-md hover:bg-brand-teal/90 transition-all text-xs flex items-center justify-center gap-2"
                                    >
                                        {isUploadingPdfs ? <Loader className="animate-spin" size={14} /> : <Zap size={14} />}
                                        {isUploadingPdfs ? 'EXTRAYENDO...' : 'SUBIR LOTE PDF RUC'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* SECURITY & ARCHIVE MODULE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                            {/* BACKUP */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-400" />
                                    Blindaje y Backups
                                </h4>
                                <div className="p-5 bg-emerald-400/5 dark:bg-emerald-400/10 rounded-2xl border border-emerald-400/20 space-y-3">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleExportJSON} 
                                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/20 transition-all"
                                        >
                                            <Download size={16} /> RESPALDO JSON
                                        </button>
                                        <input type="file" ref={jsonFileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                                        <button 
                                            onClick={handleImportJSONClick} 
                                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-600 transition-all"
                                        >
                                            <Upload size={16} /> RESTAURAR
                                        </button>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            try {
                                                if(clients.length > 0) {
                                                    await syncDataToSheet({ clients, serviceFees, reminderConfig, webOrders, sriCredentials });
                                                    alert("Copia de seguridad enviada a Google Sheets exitosamente.");
                                                } else {
                                                    alert("No hay clientes para respaldar.");
                                                }
                                            } catch (e) {
                                                alert("Error al respaldar en Sheets. Verifica la consola.");
                                            }
                                        }} 
                                        className="w-full py-3 bg-[#0f9d58] hover:bg-[#0b8043] text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#0f9d58]/20 transition-all"
                                    >
                                        <DatabaseBackup size={16} /> FORZAR RESPALDO GOOGLE SHEETS
                                    </button>
                                </div>
                            </div>

                            {/* ARCHIVE */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <UserX size={14} className="text-rose-400" />
                                    Clientes Desactivados
                                </h4>
                                <div className="max-h-[120px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50 custom-scrollbar">
                                    {clients.filter(c => !c.isActive).length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-4">Sin registros en el archivo táctico.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {clients.filter(c => !c.isActive).map(client => (
                                                <div key={client.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <span className="text-xs font-medium dark:text-slate-300 truncate pr-2">{client.name}</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => updateClient(client.id, { isActive: true })} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded"><CheckCircle size={14} /></button>
                                                        <button onClick={() => window.confirm(`Eliminar ${client.name}?`) && removeClient(client.id)} className="p-1 text-rose-400 hover:bg-rose-400/10 rounded"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* MAINTENANCE MODULE */}
                        <div className="pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="bg-amber-400/5 dark:bg-amber-400/10 border border-amber-400/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-amber-400/20">
                                    <Wrench className="text-amber-400" size={32} />
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                                    <h5 className="font-semibold text-amber-800 dark:text-amber-400 text-sm mb-1 uppercase tracking-wider">Mantenimiento de Sincronización</h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0 leading-relaxed">
                                        Si detecta inconsistencias críticas, ejecute una <span className="text-amber-500 font-medium">Limpieza Profunda</span>. Los datos se reconstruirán desde la nube.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (window.confirm("⚠️ ¿Forzar reconstrucción total desde la nube?")) {
                                            await resetApp();
                                        }
                                    }}
                                    className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 text-xs"
                                >
                                    <RefreshCw size={16} className="animate-spin-slow" />
                                    FORZAR RECONSTRUCCIÓN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>



            <Modal
                isOpen={isServiceModalOpen}
                onClose={() => {
                    if (serviceModalFeedback?.type === 'success') return;
                    setIsServiceModalOpen(false)
                }}
                title={currentService?.id ? "Editar Servicio" : "Nuevo Servicio Puntual"}
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Servicio</label>
                        <input
                            type="text"
                            placeholder="Ej: Anexo de Accionistas"
                            value={currentService?.name || ''}
                            onChange={(e) => setCurrentService(prev => prev ? { ...prev, name: e.target.value } : null)}
                            className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 rounded"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Precio</label>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="20.00"
                                value={currentService?.price ?? ''}
                                onChange={(e) => setCurrentService(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                <button type="button" onClick={() => setCurrentService(prev => prev ? { ...prev, price: (prev.price ?? 0) + 1 } : null)} className="h-4 flex items-center justify-center text-gray-500 hover:text-gold transition-colors"><ChevronUp size={16} /></button>
                                <button type="button" onClick={() => setCurrentService(prev => prev ? { ...prev, price: Math.max(0, (prev.price ?? 0) - 1) } : null)} className="h-4 flex items-center justify-center text-gray-500 hover:text-gold transition-colors"><ChevronDown size={16} /></button>
                            </div>
                        </div>
                    </div>
                    {serviceModalFeedback && (
                        <div className={`p-3 text-center text-sm rounded-lg animate-fade-in-down ${serviceModalFeedback.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                            {serviceModalFeedback.message}
                        </div>
                    )}
                    <button onClick={handleSaveService} className="w-full mt-2 p-3 bg-gold text-black font-medium rounded-lg hover:bg-gold-dark transition-colors">
                        Guardar Servicio
                    </button>
                </div>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════
                SECCIÓN: Combos de Facturación & Configuración de Sistema
            ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-8 bg-slate-900 rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-slate-700/50 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                            <ShoppingBag className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-3">
                                Combos &amp; Sistemas de Facturación
                                {systemSaved && (
                                    <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold animate-in fade-in">
                                        <CheckCircle size={13} /> Guardado
                                    </span>
                                )}
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5">Configura combos, precios y URLs. Aparecen automáticamente en el modal de ventas.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditingCombos ? (
                            <>
                                <button onClick={() => { setIsEditingCombos(false); setLocalSystemSettings(systemSettings); }}
                                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white border border-slate-600 rounded-xl transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleSaveSystemSettings} disabled={isSavingSystem}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-60">
                                    {isSavingSystem ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                                    Guardar Todo
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingCombos(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase border border-white/10 hover:border-white/30 transition-all active:scale-95">
                                <SettingsIcon size={13} /> Configurar
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Tabla de Combos */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Package size={16} className="text-amber-400" />
                                Combos / Planes Comerciales
                            </h4>
                            {isEditingCombos && (
                                <button onClick={handleAddCombo}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/30 transition-all">
                                    <Plus size={12} /> Añadir Combo
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {localSystemSettings.combos.map(combo => (
                                <div key={combo.id}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${combo.isActive ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-900/40 border-slate-800/30 opacity-50'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${combo.category === 'ecuafact' ? 'bg-emerald-500/20' : combo.category === 'zifact' ? 'bg-blue-500/20' : combo.category === 'firma' ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
                                        {combo.category === 'firma' ? '🔑' : combo.category === 'ecuafact' ? '📄' : combo.category === 'zifact' ? '⚡' : '📦'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-white truncate">{combo.name}</span>
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${combo.category === 'ecuafact' ? 'bg-emerald-500/20 text-emerald-300' : combo.category === 'zifact' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                                {combo.category}
                                            </span>
                                        </div>
                                        {combo.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{combo.notes}</p>}
                                        {combo.accessUrl && (
                                            <a href={combo.accessUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 mt-0.5 truncate">
                                                <ExternalLink size={10} /> {combo.accessUrl}
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className="text-xl font-black text-amber-400 font-mono">${combo.price.toFixed(2)}</span>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">USD</p>
                                    </div>
                                    {isEditingCombos && (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => setEditingCombo(combo)}
                                                className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all">
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => setLocalSystemSettings(prev => ({ ...prev, combos: prev.combos.map(c => c.id === combo.id ? { ...c, isActive: !c.isActive } : c) }))}
                                                className={`p-2 rounded-xl transition-all ${combo.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                                {combo.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                                            </button>
                                            <button onClick={() => handleDeleteCombo(combo.id)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* URLs de Acceso Rápido */}
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Globe size={16} className="text-blue-400" />
                            URLs de Acceso Rápido
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {([
                                { key: 'ecuafactUrl', label: 'Ecuafact', icon: '📄' },
                                { key: 'zifactUrl', label: 'Zifact', icon: '⚡' },
                                { key: 'sriUrl', label: 'SRI en Línea', icon: '🏛️' },
                            ] as { key: 'ecuafactUrl' | 'zifactUrl' | 'sriUrl'; label: string; icon: string }[]).map(({ key, label, icon }) => (
                                <div key={key}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">{icon} {label}</label>
                                    <div className="flex items-center gap-2">
                                        <input type="url" value={localSystemSettings[key] || ''}
                                            onChange={(e) => isEditingCombos && setLocalSystemSettings(prev => ({ ...prev, [key]: e.target.value }))}
                                            readOnly={!isEditingCombos}
                                            className={`flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 transition-all ${!isEditingCombos ? 'opacity-70 cursor-default' : ''}`}
                                        />
                                        {localSystemSettings[key] && (
                                            <a href={localSystemSettings[key]} target="_blank" rel="noopener noreferrer"
                                                className="p-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all">
                                                <ExternalLink size={13} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dispositivo de Huella */}
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Fingerprint size={16} className="text-violet-400" />
                            Dispositivo de Huella Dactilar
                        </h4>
                        <div className="flex items-center gap-4 p-5 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                                <Fingerprint className="text-violet-400" size={24} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">ID / Número de Serie del Dispositivo</label>
                                <input type="text" value={localSystemSettings.fingerprintDeviceId || ''}
                                    onChange={(e) => isEditingCombos && setLocalSystemSettings(prev => ({ ...prev, fingerprintDeviceId: e.target.value }))}
                                    readOnly={!isEditingCombos}
                                    placeholder="Ej: FP-2024-001 / SN-A8B7C6D5"
                                    className={`w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-200 outline-none focus:ring-1 focus:ring-violet-500 transition-all ${!isEditingCombos ? 'opacity-70 cursor-default' : ''}`}
                                />
                                <p className="text-slate-500 text-[10px] mt-1.5">Número de serie o ID del lector biométrico para gestión de firmas electrónicas.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal editor de Combo */}
            {editingCombo && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div className="absolute inset-0" onClick={() => setEditingCombo(null)} />
                    <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-5 z-10">
                        <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                            <Package size={18} className="text-amber-400" />
                            {localSystemSettings.combos.find(c => c.id === editingCombo.id) ? 'Editar Combo' : 'Nuevo Combo'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nombre del Combo</label>
                                <input type="text" value={editingCombo.name}
                                    onChange={e => setEditingCombo(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-amber-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Precio (USD)</label>
                                <input type="number" step="0.01" min="0" value={editingCombo.price}
                                    onChange={e => setEditingCombo(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-amber-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Categoría</label>
                                <select value={editingCombo.category}
                                    onChange={e => setEditingCombo(prev => prev ? { ...prev, category: e.target.value as any } : null)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-amber-500">
                                    <option value="ecuafact">Ecuafact</option>
                                    <option value="zifact">Zifact</option>
                                    <option value="firma">Solo Firma</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">URL de Acceso</label>
                                <input type="url" value={editingCombo.accessUrl || ''}
                                    onChange={e => setEditingCombo(prev => prev ? { ...prev, accessUrl: e.target.value } : null)}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-amber-500" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Descripción / Notas</label>
                                <input type="text" value={editingCombo.notes || ''}
                                    onChange={e => setEditingCombo(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                    placeholder="Ej: Plan anual 60 documentos"
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-amber-500" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setEditingCombo(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white border border-slate-600 rounded-xl transition-all">
                                Cancelar
                            </button>
                            <button onClick={() => editingCombo && handleSaveCombo(editingCombo)}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg active:scale-95">
                                💾 Guardar Combo
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SettingsScreen;
