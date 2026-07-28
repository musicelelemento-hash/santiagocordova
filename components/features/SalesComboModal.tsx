import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Sparkles, CheckCircle2, ShieldCheck, Zap, Key, FileText,
    ShoppingBag, Calendar, Lock, Camera, Upload, Search, UserPlus,
    Printer, Download, Layers, ArrowRight, Check, Coins, FileCheck, Info
} from 'lucide-react';
import { Client, FacturadorConfig, StoredFile, TaxRegime } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { downloadEcuafactDocx, printEcuafactAuthorization, getFormattedCurrentDateSpanish } from '../../services/ecuafactDocxService';
import { v4 as uuidv4 } from 'uuid';

interface SalesComboModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialClient?: Client | null;
    onEmitSriInvoice?: (client: Client, description: string, amount: number) => void;
}

type MainCategory = 'firma' | 'zifact' | 'ecuafact' | 'talonario';

export const SalesComboModal: React.FC<SalesComboModalProps> = ({
    isOpen,
    onClose,
    initialClient,
    onEmitSriInvoice
}) => {
    const { clients, updateClient, addClient, systemSettings } = useAppStore();
    const { toast } = useToast();

    // Search & Client State
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [showQuickCreateClient, setShowQuickCreateClient] = useState(false);

    // Quick client creation state
    const [newClientName, setNewClientName] = useState('');
    const [newClientRuc, setNewClientRuc] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientRegime, setNewClientRegime] = useState<TaxRegime>(TaxRegime.General);

    // Active Category Step
    const [activeCategory, setActiveCategory] = useState<MainCategory>('ecuafact');

    // Selected Combo / Pricing State
    const [programName, setProgramName] = useState('ECUAFACT 60 Docs + Firma');
    const [documentCount, setDocumentCount] = useState<number | ''>(60);
    const [price, setPrice] = useState<number | ''>(55.00);
    const [expirationYears, setExpirationYears] = useState<number>(1);
    const [includesSignature, setIncludesSignature] = useState<boolean>(true);
    const [webUrl, setWebUrl] = useState('https://app.ecuafact.com');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [providerName, setProviderName] = useState('Santiago Córdova');

    // Identity Documents
    const [idCardFront, setIdCardFront] = useState<StoredFile | null>(null);
    const [idCardBack, setIdCardBack] = useState<StoredFile | null>(null);
    const [idCardSelfie, setIdCardSelfie] = useState<StoredFile | null>(null);

    // Document Generation state
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    useEffect(() => {
        if (initialClient) {
            setSelectedClientId(initialClient.id);
            setUsername(initialClient.ruc || '');
        } else if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
            setUsername(clients[0].ruc || '');
        }
    }, [initialClient, clients, isOpen]);

    // Filter clients for fast searching
    const filteredClients = useMemo(() => {
        if (!clientSearchQuery.trim()) return clients.filter(c => !c.isDeleted && c.isActive !== false).slice(0, 8);
        const q = clientSearchQuery.toLowerCase().trim();
        return clients.filter(c =>
            !c.isDeleted && c.isActive !== false &&
            (c.name.toLowerCase().includes(q) || c.ruc.includes(q) || (c.tradeName && c.tradeName.toLowerCase().includes(q)))
        ).slice(0, 10);
    }, [clients, clientSearchQuery]);

    const targetClient = clients.find(c => c.id === selectedClientId) || initialClient;

    // Fast inline client creation
    const handleQuickCreateClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim() || !newClientRuc.trim()) {
            toast.error("Por favor ingrese el Nombre y RUC del nuevo cliente.");
            return;
        }

        const created: Client = {
            id: uuidv4(),
            name: newClientName.trim().toUpperCase(),
            ruc: newClientRuc.trim(),
            sriPassword: '12345678a',
            phones: newClientPhone.trim() ? [newClientPhone.trim()] : [],
            regime: newClientRegime,
            isActive: true,
            declarations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        addClient(created);
        setSelectedClientId(created.id);
        setUsername(created.ruc);
        setShowQuickCreateClient(false);
        setNewClientName('');
        setNewClientRuc('');
        setNewClientPhone('');
        toast.success(`Cliente ${created.name} creado y seleccionado.`);
    };

    // Category Change Handler
    const handleCategoryChange = (cat: MainCategory) => {
        setActiveCategory(cat);
        if (cat === 'firma') {
            setProgramName('Firma Electrónica .p12 (1 Año + Soporte)');
            setDocumentCount('');
            setPrice(35.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl('');
        } else if (cat === 'zifact') {
            setProgramName('ZIFAC 50 Docs + Firma Electrónica');
            setDocumentCount(50);
            setPrice(45.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl(systemSettings?.zifactUrl || 'https://sistema.zifac.com');
        } else if (cat === 'ecuafact') {
            setProgramName('ECUAFACT 60 Docs + Firma Electrónica');
            setDocumentCount(60);
            setPrice(55.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl(systemSettings?.ecuafactUrl || 'https://app.ecuafact.com');
        } else {
            setProgramName('Talonario Físico / Servicio Personalizado');
            setDocumentCount('');
            setPrice(25.00);
            setExpirationYears(1);
            setIncludesSignature(false);
            setWebUrl('');
        }
    };

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
            documentStatus: activeCategory === 'firma' ? `Firma ${expirationYears} Año(s)` : (documentCount ? `${documentCount} Docs / Anual` : 'Plan Ilimitado'),
            documentCount: typeof documentCount === 'number' ? documentCount : undefined,
            price: typeof price === 'number' ? price : undefined,
            soldByMe: true,
            providerName: providerName || 'Santiago Córdova',
            freeSupportAndCancellation: true
        };

        const updatedClient = {
            ...targetClient,
            facturadorConfig: newFacturadorConfig,
            ...(idCardFront ? { idCardFront } : {}),
            ...(idCardBack ? { idCardBack } : {}),
            ...(idCardSelfie ? { idCardSelfie } : {}),
        };

        updateClient(targetClient.id, updatedClient);
        toast.success(`Bóveda de ${targetClient.name} actualizada con ${programName}`);
        return newFacturadorConfig;
    };

    const handleSaveAndEmitSri = () => {
        const config = handleSaveVault();
        if (!config || !targetClient) return;

        let description = `Venta de Plan ${programName}`;
        if (activeCategory === 'ecuafact') {
            description = `Combo ECUAFACT (${documentCount || 60} Comprobantes + Firma Electrónica)`;
        } else if (activeCategory === 'zifact') {
            description = `Combo ZIFAC (${documentCount || 50} Comprobantes ${includesSignature ? '+ Firma Electrónica' : ''})`;
        } else if (activeCategory === 'firma') {
            description = `Firma Electrónica .p12 — ${expirationYears} Año(s)`;
        }

        const finalPrice = typeof price === 'number' ? price : 35.00;

        onClose();

        if (onEmitSriInvoice) {
            onEmitSriInvoice(targetClient, description, finalPrice);
        } else {
            toast.info(`Plan guardado en Bóveda. Puedes emitir la factura desde Facturación SRI.`);
        }
    };

    const handleDownloadEcuaFactDocx = async () => {
        if (!targetClient) {
            toast.error("Seleccione un cliente para generar la autorización.");
            return;
        }
        try {
            setIsGeneratingDocx(true);
            await downloadEcuafactDocx(targetClient.name, targetClient.ruc);
            toast.success("Documento .docx descargado correctamente.");
        } catch (err: any) {
            toast.error("Error generando archivo: " + err.message);
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    const handlePrintEcuaFactAuth = () => {
        if (!targetClient) {
            toast.error("Seleccione un cliente para imprimir la autorización.");
            return;
        }
        printEcuafactAuthorization(targetClient.name, targetClient.ruc);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-250 overflow-y-auto">
            {/* Backdrop click */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Centered Modal Container */}
            <div className="relative z-10 w-full max-w-4xl my-auto bg-white dark:bg-slate-950 max-h-[92vh] flex flex-col shadow-2xl rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="px-6 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shadow-md">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                                Catálogo de Combos & Firma Electrónica
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase rounded-md border border-amber-500/30">
                                    Ventas Pro
                                </span>
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Asigna planes, autorizaciones EcuaFact y emite tu factura SRI en 1-Clic
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">

                    {/* ── PASO 1: SELECCIÓN / BÚSQUEDA DE CLIENTE CON "+ CREAR NUEVO CLIENTE" ── */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                                Seleccionar Cliente Receptor
                            </label>

                            <button
                                type="button"
                                onClick={() => setShowQuickCreateClient(!showQuickCreateClient)}
                                className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 transition-all"
                            >
                                <UserPlus size={14} />
                                {showQuickCreateClient ? 'Cancelar Registro' : '+ Crear Nuevo Cliente'}
                            </button>
                        </div>

                        {/* Inline Client Creation Drawer */}
                        {showQuickCreateClient ? (
                            <form onSubmit={handleQuickCreateClient} className="p-4 bg-white dark:bg-slate-950 border border-amber-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
                                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                                    <UserPlus size={14} /> Registrar Cliente al Vuelo
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Nombre o Razón Social *"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="RUC o Cédula (13 / 10 dígitos) *"
                                        value={newClientRuc}
                                        onChange={(e) => setNewClientRuc(e.target.value)}
                                        className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="Teléfono / WhatsApp (Opcional)"
                                        value={newClientPhone}
                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                        className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                    <select
                                        value={newClientRegime}
                                        onChange={(e) => setNewClientRegime(e.target.value as TaxRegime)}
                                        className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                                    >
                                        <option value={TaxRegime.General}>Régimen General</option>
                                        <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                        <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                                    >
                                        Guardar y Seleccionar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Live Search Bar + Selector */
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente por Nombre o RUC..."
                                        value={clientSearchQuery}
                                        onChange={(e) => setClientSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
                                    />
                                    {clientSearchQuery && (
                                        <button
                                            onClick={() => setClientSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <select
                                    value={selectedClientId}
                                    onChange={(e) => {
                                        setSelectedClientId(e.target.value);
                                        const found = clients.find(c => c.id === e.target.value);
                                        if (found) setUsername(found.ruc);
                                    }}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none cursor-pointer"
                                >
                                    {filteredClients.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} — RUC: {c.ruc} ({c.regime})
                                        </option>
                                    ))}
                                </select>

                                {targetClient && (
                                    <div className="flex items-center justify-between px-2 text-[11px] text-slate-400 font-medium">
                                        <span>Cliente seleccionado: <strong className="text-white">{targetClient.name}</strong></span>
                                        <span className="font-mono text-amber-400">RUC: {targetClient.ruc}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── PASO 2: MAPA CONCEPTUAL DE CATEGORÍAS Y PRODUCTOS ── */}
                    <div>
                        <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider block mb-3 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                            Seleccionar Categoría de Producto / Servicio
                        </label>

                        {/* Category Tabs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            {[
                                { id: 'firma', title: 'Solo Firma (.p12)', icon: Key, color: 'text-purple-400' },
                                { id: 'zifact', title: 'ZiFact (Software)', icon: Zap, color: 'text-blue-400' },
                                { id: 'ecuafact', title: 'EcuaFact (Combo)', icon: Sparkles, color: 'text-emerald-400' },
                                { id: 'talonario', title: 'Talonario / Otros', icon: FileText, color: 'text-amber-400' },
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategoryChange(cat.id as MainCategory)}
                                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                        activeCategory === cat.id
                                            ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/30'
                                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    <cat.icon size={18} className={cat.color} />
                                    <span className="text-xs font-bold uppercase tracking-tight">{cat.title}</span>
                                </button>
                            ))}
                        </div>

                        {/* CATEGORY 1: SOLO FIRMA ELECTRÓNICA */}
                        {activeCategory === 'firma' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                                {/* Option A: 1 Año Firma + Soporte ($35) RECOMENDADO */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
                                        setPrice(35.00);
                                        setExpirationYears(1);
                                        setDocumentCount('');
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                                        price === 35 && expirationYears === 1 && programName.includes('Soporte')
                                            ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg'
                                            : 'bg-purple-500/5 border-purple-500/30 hover:border-purple-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-black text-white uppercase">1 Año + Soporte</span>
                                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[8px] font-black uppercase rounded">Recomendado</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2">Firma + Soporte + Anulación SRI + Configuración en portal SRI</p>
                                    <p className="text-xl font-black text-amber-400 font-mono">$35.00</p>
                                </button>

                                {/* Option B: 1 Año Solo Firma ($29) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año Solo Firma)');
                                        setPrice(29.00);
                                        setExpirationYears(1);
                                        setDocumentCount('');
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        price === 29 && expirationYears === 1
                                            ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg'
                                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-black text-white uppercase">1 Año Solo Firma</span>
                                        <span className="text-[9px] text-slate-400 font-bold">$29</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2">Archivo .p12 básico sin configuración de plataforma</p>
                                    <p className="text-xl font-black text-purple-400 font-mono">$29.00</p>
                                </button>

                                {/* Option C: Multiaños (2, 3, 4, 5 Años) */}
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                                    <span className="text-xs font-black text-white uppercase block">Multiaños (Solo Firma)</span>
                                    <select
                                        value={expirationYears > 1 ? expirationYears : 2}
                                        onChange={(e) => {
                                            const yrs = parseInt(e.target.value);
                                            setExpirationYears(yrs);
                                            const feeMap: Record<number, number> = { 2: 49, 3: 65, 4: 79, 5: 89 };
                                            setPrice(feeMap[yrs] || 49);
                                            setProgramName(`Firma Electrónica .p12 (${yrs} Años)`);
                                        }}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                                    >
                                        <option value={2}>2 Años — $49.00</option>
                                        <option value={3}>3 Años — $65.00</option>
                                        <option value={4}>4 Años — $79.00</option>
                                        <option value={5}>5 Años — $89.00</option>
                                    </select>
                                    <p className="text-[10px] text-amber-400 font-bold">Vigencia seleccionada: {expirationYears} Años</p>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 2: ZIFACT */}
                        {activeCategory === 'zifact' && (
                            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-4 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            Cantidad de Documentos (Comprobantes)
                                        </label>
                                        <select
                                            value={documentCount}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? '' : parseInt(e.target.value);
                                                setDocumentCount(val);
                                                if (val === 50 && includesSignature) setPrice(45);
                                                else if (val === 50 && !includesSignature) setPrice(25);
                                            }}
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                                        >
                                            <option value={50}>50 Documentos (Popular)</option>
                                            <option value={75}>75 Documentos</option>
                                            <option value={100}>100 Documentos</option>
                                            <option value={200}>200 Documentos</option>
                                            <option value={500}>500 Documentos</option>
                                            <option value={0}>Ilimitado (Full)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            ¿Incluye Firma Electrónica?
                                        </label>
                                        <select
                                            value={includesSignature ? 'yes' : 'no'}
                                            onChange={(e) => {
                                                const inc = e.target.value === 'yes';
                                                setIncludesSignature(inc);
                                                if (inc) {
                                                    setPrice(45.00);
                                                    setProgramName(`ZIFAC ${documentCount || 50} Docs + Firma Electrónica`);
                                                } else {
                                                    setPrice(25.00);
                                                    setProgramName(`ZIFAC ${documentCount || 50} Docs (Solo Software)`);
                                                }
                                            }}
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                                        >
                                            <option value="yes">Sí — Incluir Firma Electrónica (.p12)</option>
                                            <option value="no">No — Solo Software de Facturación ZiFact</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-300">Plan Seleccionado: ZiFact {documentCount || 50} Docs {includesSignature ? '+ Firma' : '(Solo Software)'}</span>
                                    <span className="text-lg font-black text-amber-400 font-mono">${price}.00</span>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 3: ECUAFACT */}
                        {activeCategory === 'ecuafact' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
                                {/* Option A: 60 Docs + Firma ($55) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT 60 Docs + Firma Electrónica');
                                        setDocumentCount(60);
                                        setPrice(55.00);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        documentCount === 60 && price === 55
                                            ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg'
                                            : 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-black text-white uppercase">EcuaFact 60 Docs + Firma</span>
                                        <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[8px] font-black uppercase rounded">Combo Popular</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2">60 Comprobantes anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-xl font-black text-emerald-400 font-mono">$55.00</p>
                                </button>

                                {/* Option B: Ilimitado + Firma ($90) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT Ilimitado + Firma Electrónica');
                                        setDocumentCount(0);
                                        setPrice(90.00);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        documentCount === 0 && price === 90
                                            ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10 shadow-lg'
                                            : 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-black text-white uppercase">EcuaFact Ilimitado + Firma</span>
                                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[8px] font-black uppercase rounded">Plan Empresa</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2">Comprobantes ilimitados anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-xl font-black text-amber-400 font-mono">$90.00</p>
                                </button>
                            </div>
                        )}

                        {/* CATEGORY 4: TALONARIO / OTROS */}
                        {activeCategory === 'talonario' && (
                            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={programName}
                                        onChange={(e) => setProgramName(e.target.value)}
                                        placeholder="Nombre del servicio (Ej: Talonario Físico Impreso)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white outline-none"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        placeholder="Precio Cobrado ($)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── PASO 3: GENERADOR DE AUTORIZACIÓN ESPECIAL ECUAFACT ── */}
                    {activeCategory === 'ecuafact' && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                    <FileCheck size={16} /> Documento de Autorización Especial EcuaFact
                                </h4>
                                <span className="text-[9px] font-bold text-emerald-300 uppercase px-2 py-0.5 bg-emerald-500/20 rounded">Requisito Obligatorio</span>
                            </div>

                            <p className="text-[11px] text-slate-300">
                                Genera la carta de autorización rellenada automáticamente con los datos de <strong>{targetClient?.name || 'Cliente'}</strong> para proceder con la emisión en Uanataca/EcuaFact.
                            </p>

                            {/* Datos auto-completados */}
                            <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                <div><span className="text-slate-500">Fecha:</span> <strong className="text-white block">{getFormattedCurrentDateSpanish()}</strong></div>
                                <div><span className="text-slate-500">Cliente:</span> <strong className="text-white block truncate">{targetClient?.name || 'N/A'}</strong></div>
                                <div><span className="text-slate-500">Cédula / RUC:</span> <strong className="text-amber-400 font-mono block">{targetClient?.ruc || 'N/A'}</strong></div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={isGeneratingDocx || !targetClient}
                                    onClick={handleDownloadEcuaFactDocx}
                                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Download size={15} />
                                    <span>{isGeneratingDocx ? 'Generando .DOCX...' : 'Descargar .DOCX Personalizado'}</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!targetClient}
                                    onClick={handlePrintEcuaFactAuth}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                                >
                                    <Printer size={15} className="text-emerald-400" />
                                    <span>Imprimir / Ver Carta</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── PASO 4: REQUISITOS OPCIONALES DE IDENTIDAD ── */}
                    <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                                <Camera size={14} className="text-indigo-400" />
                                Archivos de Identidad para Bóveda (Opcional)
                            </h4>
                            <span className="text-[9px] font-bold text-indigo-400 uppercase px-2 py-0.5 bg-indigo-500/20 rounded">Trámite Firma</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {([
                                { id: 'front', label: 'Cédula Anverso', icon: '🪪', state: idCardFront, setter: setIdCardFront, inputId: 'sales-id-front', formType: 'CEDULA_ANVERSO' },
                                { id: 'back',  label: 'Cédula Reverso', icon: '🔄', state: idCardBack,  setter: setIdCardBack,  inputId: 'sales-id-back',  formType: 'CEDULA_REVERSO'  },
                                { id: 'extra', label: 'Doc. Adicional',  icon: '📎', state: idCardSelfie, setter: setIdCardSelfie, inputId: 'sales-id-extra', formType: 'CEDULA_EXTRA'   },
                            ] as const).map(slot => (
                                <div key={slot.id} className="flex flex-col gap-1.5">
                                    <input
                                        type="file"
                                        id={slot.inputId}
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                const stored: StoredFile = {
                                                    name: file.name,
                                                    type: file.type.includes('pdf') ? 'pdf' : 'image',
                                                    size: file.size,
                                                    lastModified: file.lastModified,
                                                    content: reader.result as string,
                                                    metadata: { uploadedAt: new Date().toISOString(), formType: slot.formType }
                                                };
                                                slot.setter(stored);
                                                toast.success(`${slot.label} cargado`);
                                            };
                                            reader.readAsDataURL(file);
                                            e.target.value = '';
                                        }}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => document.getElementById(slot.inputId)?.click()}
                                        className={`relative w-full py-3 px-3 rounded-xl border border-dashed flex items-center justify-between transition-all ${
                                            slot.state
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                                : 'border-indigo-400/30 bg-indigo-500/5 hover:border-indigo-400 text-slate-400'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2">
                                            <span>{slot.icon}</span> {slot.label}
                                        </span>
                                        {slot.state ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Upload size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* MODAL FOOTER */}
                <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-3 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
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
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
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
