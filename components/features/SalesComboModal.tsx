import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, ShieldCheck, Zap, Key, FileText, ShoppingBag, Calendar, Lock, Camera, Upload } from 'lucide-react';
import { Client, FacturadorConfig, StoredFile } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';

interface SalesComboModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialClient?: Client | null;
    onEmitSriInvoice?: (client: Client, description: string, amount: number) => void;
}

export const SalesComboModal: React.FC<SalesComboModalProps> = ({
    isOpen,
    onClose,
    initialClient,
    onEmitSriInvoice
}) => {
    const { clients, updateClient, systemSettings } = useAppStore();
    const { toast } = useToast();
    const activeCombos = (systemSettings?.combos || []).filter(c => c.isActive);

    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedPackage, setSelectedPackage] = useState<'combo_zifac' | 'combo_ecuafact' | 'solo_firma' | 'custom'>('combo_ecuafact');
    const [cedulaFile, setCedulaFile] = useState<StoredFile | null>(null);

    // Form fields
    const [programName, setProgramName] = useState('ECUAFACT');
    const [documentCount, setDocumentCount] = useState<number | ''>(60);
    const [price, setPrice] = useState<number | ''>(35.00);
    const [expirationYears, setExpirationYears] = useState<number>(1);
    const [webUrl, setWebUrl] = useState('https://app.ecuafact.com');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [providerName, setProviderName] = useState('Santiago Córdova');

    useEffect(() => {
        if (initialClient) {
            setSelectedClientId(initialClient.id);
            setUsername(initialClient.ruc || '');
        } else if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
            setUsername(clients[0].ruc || '');
        }
    }, [initialClient, clients, isOpen]);

    // Presets — usa el combo seleccionado del store
    const handlePackageSelect = (pkg: 'combo_zifac' | 'combo_ecuafact' | 'solo_firma' | 'custom', comboFromStore?: any) => {
        setSelectedPackage(pkg);
        if (comboFromStore) {
            // Usar datos del store directamente
            setProgramName(comboFromStore.name);
            setPrice(comboFromStore.price ?? '');
            setWebUrl(comboFromStore.accessUrl || '');
            setDocumentCount(comboFromStore.notes?.match(/(\d+)\s*doc/i)?.[1] ? parseInt(comboFromStore.notes.match(/(\d+)\s*doc/i)[1]) : '');
            setProviderName('Santiago Córdova');
        } else if (pkg === 'combo_zifac') {
            setProgramName('ZIFAC');
            setDocumentCount(0);
            setPrice(activeCombos.find(c => c.category === 'zifact')?.price ?? 55);
            setWebUrl(systemSettings?.zifactUrl || 'https://sistema.zifac.com');
            setProviderName('Santiago Córdova');
        } else if (pkg === 'combo_ecuafact') {
            setProgramName('ECUAFACT');
            setDocumentCount(60);
            setPrice(activeCombos.find(c => c.category === 'ecuafact')?.price ?? 45);
            setWebUrl(systemSettings?.ecuafactUrl || 'https://app.ecuafact.com');
            setProviderName('Santiago Córdova');
        } else if (pkg === 'solo_firma') {
            setProgramName('Firma Electrónica .p12');
            setDocumentCount(0);
            setPrice(activeCombos.find(c => c.category === 'firma')?.price ?? 25);
            setWebUrl('');
            setProviderName('Santiago Córdova');
        } else {
            setProgramName('Personalizado');
            setDocumentCount('');
            setPrice('');
        }
    };

    if (!isOpen) return null;

    const targetClient = clients.find(c => c.id === selectedClientId) || initialClient;

    const calculateExpirationDate = (): string => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + (expirationYears || 1));
        return d.toISOString().split('T')[0];
    };

    const handleSaveVault = (): FacturadorConfig | null => {
        if (!targetClient) {
            toast.error("Por favor seleccione un cliente.");
            return null;
        }

        const expDate = calculateExpirationDate();

        const newFacturadorConfig: FacturadorConfig = {
            programName,
            url: webUrl,
            username: username || targetClient.ruc,
            password: password || targetClient.sriPassword,
            expirationDate: expDate,
            documentStatus: selectedPackage === 'solo_firma' ? 'Firma Activa' : (documentCount ? `${documentCount} Docs / Anual` : 'Plan Anual Ilimitado'),
            documentCount: typeof documentCount === 'number' ? documentCount : undefined,
            price: typeof price === 'number' ? price : undefined,
            soldByMe: true,
            providerName: providerName || 'Santiago Córdova',
            freeSupportAndCancellation: true
        };

        const updatedClient = {
            ...targetClient,
            facturadorConfig: newFacturadorConfig,
            ...(cedulaFile ? { cedulaFile } : {})
        };

        updateClient(targetClient.id, updatedClient);
        toast.success(`Bóveda de ${targetClient.name} actualizada con el plan ${programName}`);
        return newFacturadorConfig;
    };

    const handleSaveAndEmitSri = () => {
        const config = handleSaveVault();
        if (!config || !targetClient) return;

        let description = `Venta de Plan ${programName}`;
        if (selectedPackage === 'combo_ecuafact') {
            description = `Combo ECUAFACT Plan Anual (${documentCount || 60} Comprobantes + Firma Electrónica)`;
        } else if (selectedPackage === 'combo_zifac') {
            description = `Combo ZIFAC Plan Anual (Facturación Ilimitada + Firma Electrónica)`;
        } else if (selectedPackage === 'solo_firma') {
            description = `Emisión de Firma Electrónica (.p12) - Vigencia ${expirationYears} Año(s)`;
        }

        const finalPrice = typeof price === 'number' ? price : 35.00;

        onClose();

        if (onEmitSriInvoice) {
            onEmitSriInvoice(targetClient, description, finalPrice);
        } else {
            toast.info(`Plan guardado en Bóveda. Puedes emitir la factura desde Facturación SRI.`);
        }
    };

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="w-full max-w-3xl bg-white dark:bg-slate-950 max-h-[92vh] flex flex-col shadow-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 relative overflow-hidden z-10 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shadow-md">
                            <ShoppingBag size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                                Nueva Venta de Sistema & Firma Electrónica
                                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase rounded-lg border border-amber-500/30">
                                    Combos Anuales
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 font-medium">
                                Asigna el plan a la Bóveda del cliente y emite su Factura SRI al instante
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Cliente Selector */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                            1. Seleccionar Cliente Receptor
                        </label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => {
                                setSelectedClientId(e.target.value);
                                const found = clients.find(c => c.id === e.target.value);
                                if (found) setUsername(found.ruc);
                            }}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} — RUC: {c.ruc} ({c.regime})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Paquetes / Combos */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-3">
                            2. Seleccionar Paquete / Combo Comercial
                        </label>
                        {/* Combos dinámicos del store */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {activeCombos.length > 0 ? activeCombos.map(combo => {
                                const pkgId = combo.category === 'ecuafact' ? 'combo_ecuafact'
                                    : combo.category === 'zifact' ? 'combo_zifac'
                                    : combo.category === 'firma' ? 'solo_firma'
                                    : 'custom';
                                const colorMap: Record<string, string> = {
                                    ecuafact: 'border-emerald-500/40 bg-emerald-500/5',
                                    zifact: 'border-blue-500/40 bg-blue-500/5',
                                    firma: 'border-purple-500/40 bg-purple-500/5',
                                    otro: 'border-slate-500/40 bg-slate-500/5',
                                };
                                const isSelected = selectedPackage === pkgId && programName === combo.name;
                                return (
                                    <button
                                        key={combo.id}
                                        type="button"
                                        onClick={() => handlePackageSelect(pkgId as any, combo)}
                                        className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                                            isSelected
                                                ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg'
                                                : `${colorMap[combo.category] || colorMap.otro} opacity-80 hover:opacity-100 hover:scale-[1.01]`
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                {combo.name}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-3">
                                            {combo.notes || combo.category.toUpperCase()}
                                        </p>
                                        <p className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                                            ${combo.price.toFixed(2)}
                                        </p>
                                        {combo.accessUrl && (
                                            <p className="text-[9px] text-slate-400 truncate mt-1">
                                                🔗 {combo.accessUrl}
                                            </p>
                                        )}
                                    </button>
                                );
                            }) : [
                                { id: 'combo_ecuafact', title: 'Combo ECUAFACT', desc: '60 Docs + Firma', badge: 'Más Vendido', price: 45, color: 'border-emerald-500/40 bg-emerald-500/5' },
                                { id: 'combo_zifac', title: 'Combo ZIFAC', desc: 'Ilimitado + Firma', badge: 'Plan Full', price: 55, color: 'border-blue-500/40 bg-blue-500/5' },
                                { id: 'solo_firma', title: 'Solo Firma .p12', desc: 'Archivo Firma', badge: '1-5 Años', price: 25, color: 'border-purple-500/40 bg-purple-500/5' },
                            ].map(pkg => (
                                <button key={pkg.id} type="button"
                                    onClick={() => handlePackageSelect(pkg.id as any)}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        selectedPackage === pkg.id ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg' : `${pkg.color} opacity-80 hover:opacity-100`
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{pkg.title}</span>
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[8px] font-bold uppercase rounded-md">{pkg.badge}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{pkg.desc}</p>
                                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">${pkg.price.toFixed(2)}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detalle de Configuración */}
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Sparkles size={14} className="text-amber-500" />
                            Detalles del Plan a Registrar en Bóveda
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    Nombre del Sistema
                                </label>
                                <input
                                    type="text"
                                    value={programName}
                                    onChange={(e) => setProgramName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    Cupo de Comprobantes (Docs)
                                </label>
                                <input
                                    type="number"
                                    value={documentCount}
                                    onChange={(e) => setDocumentCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                                    placeholder="Ej: 60 (0 para Ilimitado)"
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    Precio Cobrado ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder="35.00"
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    Vigencia del Plan
                                </label>
                                <select
                                    value={expirationYears}
                                    onChange={(e) => setExpirationYears(parseInt(e.target.value))}
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                    <option value={1}>1 Año (Plan Anual)</option>
                                    <option value={2}>2 Años</option>
                                    <option value={3}>3 Años</option>
                                    <option value={5}>5 Años</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Requisitos Opcionales (Foto de Cédula / Documentos para Firma - Cuando no estés de apuro) */}
                    <div className="p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                <Camera size={14} className="text-indigo-400" />
                                3. Documentos de Identidad (Opcional - Cuando no estés de apuro)
                            </h4>
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] font-bold uppercase rounded-md">
                                Trámite de Firma
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Si dispones de tiempo, puedes adjuntar las fotos de la cédula (anverso/reverso) o PDF del cliente para que queden archivados en su Bóveda para el trámite de la Firma Electrónica.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                            <input
                                type="file"
                                id="sales-cedula-upload"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !targetClient) return;
                                    try {
                                        toast.info('Cargando documento de identidad...');
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                            const base64 = reader.result as string;
                                            const storedDoc = {
                                                name: file.name,
                                                type: file.type.includes('pdf') ? 'pdf' : 'image',
                                                size: file.size,
                                                lastModified: file.lastModified,
                                                content: base64,
                                                metadata: { uploadedAt: new Date().toISOString(), formType: 'CEDULA_IDENTIDAD' }
                                            };
                                            setCedulaFile(storedDoc);
                                            toast.success('Documento de cédula cargado correctamente.');
                                        };
                                        reader.readAsDataURL(file);
                                    } catch {
                                        toast.error('Error al procesar el archivo.');
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => document.getElementById('sales-cedula-upload')?.click()}
                                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Upload size={14} />
                                <span>{cedulaFile ? `✓ ${cedulaFile.name}` : 'Subir Foto de Cédula / PDF'}</span>
                            </button>

                            {cedulaFile && (
                                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                    <CheckCircle2 size={14} /> Archivo Cédula Listo
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-3 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                        Cancelar
                    </button>

                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                handleSaveVault();
                                onClose();
                            }}
                            className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
                        >
                            Guardar solo en Bóveda
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveAndEmitSri}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                        >
                            <FileText size={16} />
                            <span>Guardar y Emitir Factura SRI (1-Clic)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
