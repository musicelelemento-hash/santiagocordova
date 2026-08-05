import React, { useState, useEffect, useMemo } from 'react';
import {
    X, CheckCircle2, ShieldCheck, Zap, Key, FileText,
    ShoppingBag, Calendar, Lock, Camera, Upload, Search, UserPlus,
    Printer, Download, UserCheck, RefreshCw, Check, Info, ArrowRight, User, FileCheck
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

    // Client Selection State
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isChangingClient, setIsChangingClient] = useState(false);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [showQuickCreateClient, setShowQuickCreateClient] = useState(false);

    // Quick Client Registration State
    const [newClientName, setNewClientName] = useState('');
    const [newClientRuc, setNewClientRuc] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientRegime, setNewClientRegime] = useState<TaxRegime>(TaxRegime.General);

    // Category Tabs
    const [activeCategory, setActiveCategory] = useState<MainCategory>('ecuafact');

    // Selected Combo / Pricing State
    const [programName, setProgramName] = useState('ECUAFACT 60 Docs + Firma');
    const [documentCount, setDocumentCount] = useState<number | ''>(60);
    const [price, setPrice] = useState<number | ''>(55.00);
    const [expirationYears, setExpirationYears] = useState<number>(1);
    const [includesSignature, setIncludesSignature] = useState<boolean>(true);
    const [shouldEmitSri, setShouldEmitSri] = useState<boolean>(true);
    const [webUrl, setWebUrl] = useState('https://app.ecuafact.com');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [providerName, setProviderName] = useState('Santiago Córdova');

    // Registration Mode State (Pro Elite: Solo Plan vs Completo)
    const [isOnlyPlanRegistration, setIsOnlyPlanRegistration] = useState<boolean>(true);

    // Identity Documents
    const [idCardFront, setIdCardFront] = useState<StoredFile | null>(null);
    const [idCardBack, setIdCardBack] = useState<StoredFile | null>(null);
    const [idCardSelfie, setIdCardSelfie] = useState<StoredFile | null>(null);
    const [rucPdf, setRucPdf] = useState<StoredFile | null>(null);
    const [ecuafactSignedRequest, setEcuafactSignedRequest] = useState<StoredFile | null>(null);

    // Generating State
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    useEffect(() => {
        if (initialClient) {
            setSelectedClientId(initialClient.id);
            setUsername(initialClient.ruc || '');
            setIsChangingClient(false);
        } else {
            // Do not force clients[0] (Perez). Let user select or search a client explicitly.
            setSelectedClientId('');
            setUsername('');
            setIsChangingClient(true);
        }
    }, [initialClient, isOpen]);

    // Active Target Client
    const targetClient = useMemo(() => {
        if (selectedClientId) {
            return clients.find(c => c.id === selectedClientId) || null;
        }
        return initialClient || null;
    }, [selectedClientId, clients, initialClient]);

    // Populate state from targetClient when selected
    useEffect(() => {
        if (targetClient) {
            setIsOnlyPlanRegistration(targetClient.requiresDeclarations === false || targetClient.clientType === 'solo_plan');
            setIdCardFront(targetClient.idCardFront || null);
            setIdCardBack(targetClient.idCardBack || null);
            setIdCardSelfie(targetClient.idCardSelfie || null);
            setRucPdf(targetClient.rucPdf || null);
            setEcuafactSignedRequest(targetClient.ecuafactSignedRequest || null);
            
            if (targetClient.facturadorConfig) {
                setUsername(targetClient.facturadorConfig.username || targetClient.ruc);
                setPassword(targetClient.facturadorConfig.password || targetClient.sriPassword);
                setProgramName(targetClient.facturadorConfig.programName || programName);
                if (targetClient.facturadorConfig.documentCount !== undefined) {
                    setDocumentCount(targetClient.facturadorConfig.documentCount);
                }
                if (targetClient.facturadorConfig.price !== undefined) {
                    setPrice(targetClient.facturadorConfig.price);
                }
            } else {
                setUsername(targetClient.ruc || '');
                setPassword(targetClient.sriPassword || '');
            }
        } else {
            setIsOnlyPlanRegistration(true);
            setIdCardFront(null);
            setIdCardBack(null);
            setIdCardSelfie(null);
            setRucPdf(null);
            setEcuafactSignedRequest(null);
        }
    }, [selectedClientId, targetClient]);

    // Filtered Client List
    const filteredClients = useMemo(() => {
        if (!clientSearchQuery.trim()) return clients.filter(c => !c.isDeleted && c.isActive !== false).slice(0, 8);
        const q = clientSearchQuery.toLowerCase().trim();
        return clients.filter(c =>
            !c.isDeleted && c.isActive !== false &&
            (c.name.toLowerCase().includes(q) || c.ruc.includes(q) || (c.tradeName && c.tradeName.toLowerCase().includes(q)))
        ).slice(0, 10);
    }, [clients, clientSearchQuery]);

    // Fast inline client creation
    const handleQuickCreateClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim() || !newClientRuc.trim()) {
            toast.error("Por favor ingrese el Nombre y RUC del cliente.");
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
            clientType: isOnlyPlanRegistration ? 'solo_plan' : 'completo',
            requiresDeclarations: !isOnlyPlanRegistration,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        addClient(created);
        setSelectedClientId(created.id);
        setUsername(created.ruc);
        setShowQuickCreateClient(false);
        setIsChangingClient(false);
        setNewClientName('');
        setNewClientRuc('');
        setNewClientPhone('');
        toast.success(`Cliente ${created.name} creado y seleccionado.`);
    };

    // Category Change Handler
    const handleCategoryChange = (cat: MainCategory) => {
        setActiveCategory(cat);
        if (cat === 'firma') {
            setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
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

    const handleSingleSaveAction = () => {
        if (!targetClient) {
            toast.error("Por favor seleccione un cliente.");
            return;
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

        const updatedClient: Client = {
            ...targetClient,
            facturadorConfig: newFacturadorConfig,
            clientType: isOnlyPlanRegistration ? 'solo_plan' : 'completo',
            requiresDeclarations: !isOnlyPlanRegistration,
            idCardFront: idCardFront || undefined,
            idCardBack: idCardBack || undefined,
            idCardSelfie: idCardSelfie || undefined,
            rucPdf: rucPdf || undefined,
            ecuafactSignedRequest: ecuafactSignedRequest || undefined,
            facturadorActivationStatus: targetClient.facturadorActivationStatus || 'recursos_listos'
        };

        updateClient(targetClient.id, updatedClient);

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

        if (shouldEmitSri && onEmitSriInvoice) {
            onEmitSriInvoice(targetClient, description, finalPrice);
        } else {
            toast.success(`Plan guardado en la Bóveda de ${targetClient.name}`);
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
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
            {/* Backdrop Click */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Centered Modal Container */}
            <div className="relative z-10 w-full max-w-4xl my-auto bg-slate-950 max-h-[92vh] flex flex-col shadow-2xl rounded-3xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100 font-body">

                {/* HEADER (Colores coincidentes con el menú de la página) */}
                <div className="px-6 py-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#00A896]/20 border border-[#00A896]/30 text-[#00A896] flex items-center justify-center font-bold shadow-md">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                Venta de Plan & Firma Electrónica
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Asigna el plan al cliente y emite su comprobante SRI
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 text-left">

                    {/* ── CLIENT SELECTOR / INFO BADGE ── */}
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <User size={15} className="text-[#00A896]" />
                                Cliente Receptor
                            </label>

                            <div className="flex items-center gap-2">
                                {(targetClient && !isChangingClient) && (
                                    <button
                                        type="button"
                                        onClick={() => setIsChangingClient(true)}
                                        className="text-xs font-semibold text-[#00A896] hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} /> Cambiar Cliente
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowQuickCreateClient(!showQuickCreateClient);
                                        setIsChangingClient(true);
                                    }}
                                    className="text-xs font-semibold text-[#00A896] hover:text-[#00A896]/80 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00A896]/10 border border-[#00A896]/20 transition-all"
                                >
                                    <UserPlus size={14} />
                                    {showQuickCreateClient ? 'Cancelar Registro' : '+ Crear Nuevo Cliente'}
                                </button>
                            </div>
                        </div>

                        {/* Registered Client Badge if pre-selected */}
                        {(targetClient && !isChangingClient && !showQuickCreateClient) ? (
                            <div className="p-3 bg-[#00A896]/10 border border-[#00A896]/30 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#00A896]/20 text-[#00A896] flex items-center justify-center font-bold">
                                        <UserCheck size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-white">{targetClient.name}</h4>
                                        <p className="text-[11px] text-slate-400 font-mono">RUC: {targetClient.ruc} • {targetClient.regime}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-[#00A896] uppercase px-2.5 py-1 bg-[#00A896]/20 rounded-lg">
                                    Perfil Seleccionado
                                </span>
                            </div>
                        ) : showQuickCreateClient ? (
                            /* Quick Client Form */
                            <form onSubmit={handleQuickCreateClient} className="p-4 bg-slate-950 border border-[#00A896]/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
                                <h4 className="text-xs font-bold text-[#00A896] uppercase tracking-wider flex items-center gap-2">
                                    <UserPlus size={14} /> Registrar Cliente al Vuelo
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Nombre o Razón Social *"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#00A896]"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="RUC o Cédula *"
                                        value={newClientRuc}
                                        onChange={(e) => setNewClientRuc(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#00A896]"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="Teléfono (Opcional)"
                                        value={newClientPhone}
                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#00A896]"
                                    />
                                    <select
                                        value={newClientRegime}
                                        onChange={(e) => setNewClientRegime(e.target.value as TaxRegime)}
                                        className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#00A896]"
                                    >
                                        <option value={TaxRegime.General}>Régimen General</option>
                                        <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                        <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-[#00A896] hover:bg-[#009282] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                                    >
                                        Guardar y Seleccionar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Live Search Bar + Selector */
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente por Nombre o RUC..."
                                        value={clientSearchQuery}
                                        onChange={(e) => setClientSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-medium outline-none focus:border-[#00A896]"
                                    />
                                </div>

                                <select
                                    value={selectedClientId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedClientId(val);
                                        const found = clients.find(c => c.id === val);
                                        if (found) {
                                            setUsername(found.ruc || '');
                                            setIsChangingClient(false);
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white focus:border-[#00A896] outline-none cursor-pointer"
                                >
                                    <option value="">-- Seleccione un cliente para la venta --</option>
                                    {filteredClients.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} — RUC: {c.ruc} ({c.regime})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* ── MODALIDAD DE REGISTRO EN GESTIÓN INTERNA (PRO ELITE) ── */}
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/10 space-y-3">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <FileCheck size={15} className="text-[#00A896]" />
                                Modalidad de Registro en Gestión Interna
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-white/10">
                                Opción Pro Elite
                            </span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsOnlyPlanRegistration(true)}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                    isOnlyPlanRegistration
                                        ? 'bg-[#00A896]/15 border-[#00A896] text-white shadow-lg shadow-[#00A896]/10 ring-1 ring-[#00A896]/40'
                                        : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                                            <Zap size={14} /> Solo Registro de Plan & Firma
                                        </span>
                                        {isOnlyPlanRegistration ? (
                                            <CheckCircle2 size={16} className="text-[#00A896]" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full border border-slate-600" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Guarda la firma .p12, datos del plan, credenciales y cobro. <strong>NO aparecerá en la Matriz SRI</strong> ni pedirá declaraciones mensuales/semestrales.
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsOnlyPlanRegistration(false)}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                    !isOnlyPlanRegistration
                                        ? 'bg-blue-500/15 border-blue-500 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                                        : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                                            <ShieldCheck size={14} /> Cliente Contable Completo
                                        </span>
                                        {!isOnlyPlanRegistration ? (
                                            <CheckCircle2 size={16} className="text-blue-400" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full border border-slate-600" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Matricula al cliente en la <strong>Matriz de Cumplimiento SRI</strong> para seguimiento tributario continuo y alertas de vencimientos.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ── CATEGORÍAS DE PLANES (Diseño Coherente con el Menú) ── */}
                    <div>
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3">
                            Seleccionar Categoría del Plan
                        </label>

                        {/* Category Tabs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            {[
                                { id: 'firma', title: 'Solo Firma (.p12)', icon: Key },
                                { id: 'zifact', title: 'ZiFact (Software)', icon: Zap },
                                { id: 'ecuafact', title: 'EcuaFact (Combo)', icon: ShieldCheck },
                                { id: 'talonario', title: 'Talonario / Otros', icon: FileText },
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategoryChange(cat.id as MainCategory)}
                                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                        activeCategory === cat.id
                                            ? 'bg-[#00A896]/15 border-[#00A896] text-white ring-1 ring-[#00A896]/30'
                                            : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    <cat.icon size={18} className={activeCategory === cat.id ? 'text-[#00A896]' : 'text-slate-400'} />
                                    <span className="text-xs font-bold uppercase tracking-tight">{cat.title}</span>
                                </button>
                            ))}
                        </div>

                        {/* CATEGORY 1: SOLO FIRMA ELECTRÓNICA */}
                        {activeCategory === 'firma' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                                {/* Option A: 1 Año + Soporte ($35) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
                                        setPrice(35.00);
                                        setExpirationYears(1);
                                        setDocumentCount('');
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        price === 35 && expirationYears === 1 && programName.includes('Soporte')
                                            ? 'border-[#00A896] bg-[#00A896]/15 ring-1 ring-[#00A896]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">1 Año + Soporte</span>
                                        <span className="px-2 py-0.5 bg-[#00A896] text-slate-950 text-[8px] font-black uppercase rounded">Recomendado</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Firma + Soporte + Anulación SRI + Configuración en portal SRI</p>
                                    <p className="text-xl font-bold text-[#00A896] font-mono">$35.00</p>
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
                                            ? 'border-[#00A896] bg-[#00A896]/15 ring-1 ring-[#00A896]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">1 Año Solo Firma</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Archivo .p12 básico sin configuración de plataforma</p>
                                    <p className="text-xl font-bold text-white font-mono">$29.00</p>
                                </button>

                                {/* Option C: Multiaños */}
                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                                    <span className="text-xs font-bold text-white uppercase block">Multiaños (Solo Firma)</span>
                                    <select
                                        value={expirationYears > 1 ? expirationYears : 2}
                                        onChange={(e) => {
                                            const yrs = parseInt(e.target.value);
                                            setExpirationYears(yrs);
                                            const feeMap: Record<number, number> = { 2: 49, 3: 65, 4: 79, 5: 89 };
                                            setPrice(feeMap[yrs] || 49);
                                            setProgramName(`Firma Electrónica .p12 (${yrs} Años)`);
                                        }}
                                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"
                                    >
                                        <option value={2}>2 Años — $49.00</option>
                                        <option value={3}>3 Años — $65.00</option>
                                        <option value={4}>4 Años — $79.00</option>
                                        <option value={5}>5 Años — $89.00</option>
                                    </select>
                                    <p className="text-[10px] text-[#00A896] font-bold">Vigencia: {expirationYears} Años</p>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 2: ZIFACT */}
                        {activeCategory === 'zifact' && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4 animate-in fade-in duration-200">
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
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"
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
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"
                                        >
                                            <option value="yes">Sí — Incluir Firma Electrónica (.p12)</option>
                                            <option value="no">No — Solo Software de Facturación ZiFact</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-3 bg-[#00A896]/10 border border-[#00A896]/30 rounded-xl flex items-center justify-between">
                                    <span className="text-xs font-bold text-[#00A896]">Plan: ZiFact {documentCount || 50} Docs {includesSignature ? '+ Firma' : '(Solo Software)'}</span>
                                    <span className="text-lg font-bold text-white font-mono">${price}.00</span>
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
                                            ? 'border-[#00A896] bg-[#00A896]/15 ring-1 ring-[#00A896]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">EcuaFact 60 Docs + Firma</span>
                                        <span className="px-2 py-0.5 bg-[#00A896] text-slate-950 text-[8px] font-black uppercase rounded">Popular</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">60 Comprobantes anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-xl font-bold text-[#00A896] font-mono">$55.00</p>
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
                                            ? 'border-[#00A896] bg-[#00A896]/15 ring-1 ring-[#00A896]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">EcuaFact Ilimitado + Firma</span>
                                        <span className="px-2 py-0.5 bg-[#00A896] text-slate-950 text-[8px] font-black uppercase rounded">Empresa</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Comprobantes ilimitados anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-xl font-bold text-[#00A896] font-mono">$90.00</p>
                                </button>
                            </div>
                        )}

                        {/* CATEGORY 4: TALONARIO / OTROS */}
                        {activeCategory === 'talonario' && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={programName}
                                        onChange={(e) => setProgramName(e.target.value)}
                                        placeholder="Nombre del servicio (Ej: Talonario Físico Impreso)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#00A896]"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        placeholder="Precio Cobrado ($)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#00A896]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── AUTORIZACIÓN ESPECIAL ECUAFACT ── */}
                    {activeCategory === 'ecuafact' && (
                        <div className="p-4 bg-slate-900/80 border border-[#00A896]/30 rounded-2xl space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00A896] flex items-center gap-2">
                                    <FileCheck size={16} /> Documento de Autorización Especial EcuaFact
                                </h4>
                                {targetClient && (
                                    <span className="text-[9px] font-bold text-[#00A896] uppercase px-2 py-0.5 bg-[#00A896]/20 rounded">
                                        Personalizado en tiempo real
                                    </span>
                                )}
                            </div>

                            {targetClient ? (
                                <>
                                    <p className="text-[11px] text-slate-300">
                                        Genera la carta de autorización rellenada automáticamente con los datos de <strong>{targetClient.name}</strong>.
                                    </p>

                                    <div className="p-3 bg-slate-950 rounded-xl border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                        <div><span className="text-slate-500">Fecha:</span> <strong className="text-white block">{getFormattedCurrentDateSpanish()}</strong></div>
                                        <div><span className="text-slate-500">Cliente:</span> <strong className="text-white block truncate">{targetClient.name}</strong></div>
                                        <div><span className="text-slate-500">Cédula / RUC:</span> <strong className="text-[#00A896] font-mono block">{targetClient.ruc}</strong></div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-medium flex items-center gap-2">
                                    <Info size={16} className="flex-shrink-0 text-amber-400" />
                                    <span>Por favor seleccione o cree un cliente arriba para personalizar y descargar su documento de autorización EcuaFact.</span>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={isGeneratingDocx || !targetClient}
                                    onClick={handleDownloadEcuaFactDocx}
                                    className="px-4 py-2 bg-[#00A896] hover:bg-[#009282] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={14} />
                                    <span>{isGeneratingDocx ? 'Generando .DOCX...' : 'Descargar .DOCX Personalizado'}</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!targetClient}
                                    onClick={handlePrintEcuaFactAuth}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Printer size={14} />
                                    <span>Imprimir / Ver Carta</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── REQUISITOS OPCIONALES DE IDENTIDAD Y TRAMITACIÓN ── */}
                    <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                            <Camera size={14} className="text-[#00A896]" />
                            Requisitos y Recursos para el Trámite
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {([
                                { id: 'front',  label: 'Cédula Anverso', icon: '🪪', state: idCardFront,  setter: setIdCardFront,  inputId: 'sales-id-front',  formType: 'CEDULA_ANVERSO' },
                                { id: 'back',   label: 'Cédula Reverso', icon: '🪪', state: idCardBack,   setter: setIdCardBack,   inputId: 'sales-id-back',   formType: 'CEDULA_REVERSO' },
                                { id: 'selfie', label: 'Foto Selfie',     icon: '📸', state: idCardSelfie, setter: setIdCardSelfie, inputId: 'sales-id-selfie', formType: 'CEDULA_SELFIE'  },
                                { id: 'ruc',    label: 'RUC Actual (PDF)', icon: '📄', state: rucPdf,      setter: setRucPdf,      inputId: 'sales-ruc-pdf',    formType: 'RUC_PDF' },
                                ...(activeCategory === 'ecuafact' ? [
                                    { id: 'signed', label: 'Solicitud Firmada', icon: '✍️', state: ecuafactSignedRequest, setter: setEcuafactSignedRequest, inputId: 'sales-signed-req', formType: 'ECUAFACT_SIGNED_REQUEST' }
                                ] : [])
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
                                        className={`relative w-full py-2.5 px-3 rounded-xl border flex items-center justify-between transition-all ${
                                            slot.state
                                                ? 'border-[#00A896] bg-[#00A896]/10 text-white'
                                                : 'border-white/10 bg-slate-950 hover:border-white/20 text-slate-400'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2">
                                            <span>{slot.icon}</span> {slot.label}
                                        </span>
                                        {slot.state ? <CheckCircle2 size={15} className="text-[#00A896]" /> : <Upload size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* MODAL FOOTER UNIFICADO (1 solo botón principal con color del tema) */}
                <div className="p-5 bg-slate-900/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={shouldEmitSri}
                            onChange={(e) => setShouldEmitSri(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-950 border-white/20 text-[#00A896] focus:ring-[#00A896] cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 group-hover:text-white transition-colors font-medium">
                            Emitir Factura SRI automáticamente al guardar (${price || 0})
                        </span>
                    </label>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSingleSaveAction}
                            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3 bg-[#00A896] hover:bg-[#009282] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00A896]/20 active:scale-95 transition-all cursor-pointer"
                        >
                            <FileText size={16} />
                            <span>Guardar Plan y Procesar</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
