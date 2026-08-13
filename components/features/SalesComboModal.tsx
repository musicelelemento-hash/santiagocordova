import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X, CheckCircle2, ShieldCheck, Zap, Key, FileText,
    ShoppingBag, Calendar, Lock, Camera, Upload, Search, UserPlus,
    Printer, Download, UserCheck, RefreshCw, Check, Info, ArrowRight, User, FileCheck, Loader, Sparkles
} from 'lucide-react';
import { extractDataFromSriPdf } from '../../services/pdfExtraction';
import { Client, FacturadorConfig, StoredFile, TaxRegime } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { downloadEcuafactDocx, printEcuafactAuthorization, getFormattedCurrentDateSpanish } from '../../services/ecuafactDocxService';
import { SupabaseService } from '../../services/supabaseClientService';
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

    // Quick Client Registration State (for Registered Accounting Clients)
    const [newClientName, setNewClientName] = useState('');
    const [newClientRuc, setNewClientRuc] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientRegime, setNewClientRegime] = useState<TaxRegime>(TaxRegime.General);

    // Buyer Type Selection: Cliente Contable vs Particular (Solo Plan)
    const [buyerType, setBuyerType] = useState<'cliente_registrado' | 'particular'>('cliente_registrado');

    // Particular / Walk-in Buyer Form State
    const [particularName, setParticularName] = useState('');
    const [particularRuc, setParticularRuc] = useState('');
    const [particularPhone, setParticularPhone] = useState('');
    const [particularEmail, setParticularEmail] = useState('');
    
    // Particular PDF Extraction
    const [isAnalyzingParticular, setIsAnalyzingParticular] = useState(false);
    const particularRucInputRef = useRef<HTMLInputElement>(null);

    // Category Tabs
    const [activeCategory, setActiveCategory] = useState<MainCategory>('ecuafact');

    // Selected Combo / Pricing State
    const [programName, setProgramName] = useState('ECUAFACT 60 Docs + Firma Electrónica');
    const [documentCount, setDocumentCount] = useState<number | ''>(60);
    const [price, setPrice] = useState<number | ''>(55.00);
    const [expirationYears, setExpirationYears] = useState<number>(1);
    const [includesSignature, setIncludesSignature] = useState<boolean>(true);
    const [shouldEmitSri, setShouldEmitSri] = useState<boolean>(true);
    const [webUrl, setWebUrl] = useState('https://app.ecuafact.com');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [providerName, setProviderName] = useState('Santiago Córdova');

    // Identity Documents
    const [idCardFront, setIdCardFront] = useState<StoredFile | null>(null);
    const [idCardBack, setIdCardBack] = useState<StoredFile | null>(null);
    const [idCardSelfie, setIdCardSelfie] = useState<StoredFile | null>(null);
    const [rucPdf, setRucPdf] = useState<StoredFile | null>(null);
    const [ecuafactSignedRequest, setEcuafactSignedRequest] = useState<StoredFile | null>(null);
    const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

    // Generating State
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    useEffect(() => {
        if (initialClient) {
            setSelectedClientId(initialClient.id);
            setUsername(initialClient.ruc || '');
            setIsChangingClient(false);
            if (initialClient.clientType === 'solo_plan' || initialClient.requiresDeclarations === false) {
                setBuyerType('particular');
            } else {
                setBuyerType('cliente_registrado');
            }
        } else {
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
            setIdCardFront(null);
            setIdCardBack(null);
            setIdCardSelfie(null);
            setRucPdf(null);
            setEcuafactSignedRequest(null);
        }
    }, [selectedClientId, targetClient]);

    // Filtered Client List for Search
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
            clientType: 'completo',
            requiresDeclarations: true,
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
        toast.success(`Cliente Contable ${created.name} creado y seleccionado.`);
    };

    const handleParticularRucUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error("Por favor suba un archivo PDF válido del RUC.");
            return;
        }
        setIsAnalyzingParticular(true);
        try {
            const extracted = await extractDataFromSriPdf(file);
            setParticularName(extracted.apellidos_nombres);
            setParticularRuc(extracted.ruc);
            if (!username) setUsername(extracted.ruc);
            toast.success("Datos extraídos del RUC correctamente.");
        } catch (error) {
            console.error(error);
            toast.error("Error al leer el PDF del RUC.");
        } finally {
            setIsAnalyzingParticular(false);
            if (particularRucInputRef.current) particularRucInputRef.current.value = '';
        }
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

    // Handle Upload for Identity Vault Slots with Supabase Cloud Storage
    const handleSlotFileUpload = async (file: File, slotId: string, setter: (f: StoredFile) => void) => {
        setUploadingSlot(slotId);
        toast.info(`Cargando ${file.name}...`);
        
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Content = reader.result as string;
                let storageUrl = '';
                let storagePath = '';

                const clientId = targetClient?.id || uuidv4();
                try {
                    const ext = file.name.split('.').pop() || 'jpg';
                    const uploadPath = `${clientId}/${slotId}_${Date.now()}.${ext}`;
                    const res = await SupabaseService.uploadFileToStorage('clients-vault', uploadPath, base64Content);
                    storageUrl = res.url;
                    storagePath = res.path;
                } catch (e) {
                    console.warn("Storage upload fallback to base64", e);
                }

                const stored: StoredFile = {
                    name: file.name,
                    type: file.name.endsWith('.p12') ? 'p12' : file.type.includes('pdf') ? 'pdf' : 'image',
                    size: file.size,
                    lastModified: file.lastModified,
                    content: base64Content,
                    url: storageUrl || undefined,
                    bucketPath: storagePath || undefined,
                    metadata: { uploadedAt: new Date().toISOString(), slot: slotId }
                };

                setter(stored);
                toast.success(`✅ ${file.name} guardado en el expediente.`);
                setUploadingSlot(null);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setUploadingSlot(null);
            toast.error("Error al procesar el archivo.");
        }
    };

    const handleSingleSaveAction = () => {
        let clientToProcess = targetClient;

        if (buyerType === 'particular') {
            if (!particularName.trim() || !particularRuc.trim()) {
                toast.error("Por favor ingrese el Nombre y RUC/Cédula del Comprador Particular.");
                return;
            }
            const cleanRuc = particularRuc.trim();
            const existing = clients.find(c => c.ruc === cleanRuc);
            if (existing) {
                clientToProcess = existing;
            } else {
                const createdParticular: Client = {
                    id: uuidv4(),
                    name: particularName.trim().toUpperCase(),
                    ruc: cleanRuc,
                    sriPassword: '12345678a',
                    phones: particularPhone.trim() ? [particularPhone.trim()] : [],
                    email: particularEmail.trim() || undefined,
                    regime: TaxRegime.General,
                    isActive: true,
                    declarations: [],
                    clientType: 'solo_plan',
                    requiresDeclarations: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                addClient(createdParticular);
                clientToProcess = createdParticular;
            }
        }

        if (!clientToProcess) {
            toast.error("Por favor seleccione un cliente o ingrese los datos del comprador particular.");
            return;
        }

        const expDate = calculateExpirationDate();

        const newFacturadorConfig: FacturadorConfig = {
            programName,
            url: webUrl,
            username: username || clientToProcess.ruc,
            password: password || clientToProcess.sriPassword,
            expirationDate: expDate,
            documentStatus: activeCategory === 'firma' ? `Firma ${expirationYears} Año(s)` : (documentCount ? `${documentCount} Docs / Anual` : 'Plan Ilimitado'),
            documentCount: typeof documentCount === 'number' ? documentCount : undefined,
            price: typeof price === 'number' ? price : undefined,
            soldByMe: true,
            providerName: providerName || 'Santiago Córdova',
            freeSupportAndCancellation: true
        };

        const isSoloPlan = buyerType === 'particular';

        const updatedClient: Client = {
            ...clientToProcess,
            facturadorConfig: newFacturadorConfig,
            billingPlan: newFacturadorConfig,
            clientType: isSoloPlan ? 'solo_plan' : 'completo',
            requiresDeclarations: !isSoloPlan,
            idCardFront: idCardFront || clientToProcess.idCardFront,
            idCardBack: idCardBack || clientToProcess.idCardBack,
            idCardSelfie: idCardSelfie || clientToProcess.idCardSelfie,
            rucPdf: rucPdf || clientToProcess.rucPdf,
            ecuafactSignedRequest: ecuafactSignedRequest || clientToProcess.ecuafactSignedRequest,
            facturadorActivationStatus: clientToProcess.facturadorActivationStatus || 'recursos_listos'
        };

        updateClient(clientToProcess.id, updatedClient);

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
            onEmitSriInvoice(updatedClient, description, finalPrice);
        } else {
            toast.success(`🎉 Plan y recursos guardados en la Bóveda de ${clientToProcess.name}`);
        }
    };

    const handleDownloadEcuaFactDocx = async () => {
        const clientName = targetClient?.name || particularName;
        const clientRuc = targetClient?.ruc || particularRuc;

        if (!clientName || !clientRuc) {
            toast.error("Seleccione o ingrese un cliente para generar la autorización.");
            return;
        }
        try {
            setIsGeneratingDocx(true);
            await downloadEcuafactDocx(clientName, clientRuc);
            toast.success("Documento .docx descargado correctamente.");
        } catch (err: any) {
            toast.error("Error generando archivo: " + err.message);
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    const handlePrintEcuaFactAuth = () => {
        const clientName = targetClient?.name || particularName;
        const clientRuc = targetClient?.ruc || particularRuc;

        if (!clientName || !clientRuc) {
            toast.error("Seleccione o ingrese un cliente para imprimir la autorización.");
            return;
        }
        printEcuafactAuthorization(clientName, clientRuc);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
            {/* Backdrop Click */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Centered Modal Container (Stitch Luxury #051424) */}
            <div className="relative z-10 w-full max-w-4xl my-auto bg-[#051424] max-h-[92vh] flex flex-col shadow-[0_30px_90px_-15px_rgba(0,0,0,0.9)] rounded-[2.5rem] border border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100 font-body">

                {/* ── HEADER LUXURY ── */}
                <div className="px-6 py-5 bg-[#051424]/90 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10b981] to-teal-700 text-white flex items-center justify-center font-bold shadow-lg shadow-[#10b981]/25">
                            <ShoppingBag size={22} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-[#10b981]">Nueva Luz 3.0 • Emisión SRI</span>
                            </div>
                            <h2 className="text-base sm:text-lg font-black text-white tracking-tight font-display">
                                Venta de Plan & Firma Electrónica
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ── MODAL BODY ── */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left custom-scrollbar">

                    {/* ── 1. SEGMENTED BUYER TYPE ── */}
                    <div className="p-4 bg-slate-900/60 rounded-3xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <User size={15} className="text-[#10b981]" />
                                Tipo de Comprador / Receptor
                            </label>

                            {buyerType === 'cliente_registrado' && (
                                <div className="flex items-center gap-2">
                                    {(targetClient && !isChangingClient) && (
                                        <button
                                            type="button"
                                            onClick={() => setIsChangingClient(true)}
                                            className="text-xs font-bold text-[#10b981] hover:underline flex items-center gap-1 cursor-pointer"
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
                                        className="text-xs font-bold text-[#10b981] hover:text-[#10b981]/80 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 transition-all cursor-pointer"
                                    >
                                        <UserPlus size={14} />
                                        {showQuickCreateClient ? 'Cancelar' : '+ Crear Cliente Contable'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Segmented Control */}
                        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-white/10 gap-1">
                            <button
                                type="button"
                                onClick={() => setBuyerType('cliente_registrado')}
                                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    buyerType === 'cliente_registrado'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <UserCheck size={15} /> Cliente Contable Registrado
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setBuyerType('particular');
                                    setSelectedClientId('');
                                }}
                                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    buyerType === 'particular'
                                        ? 'bg-gradient-to-r from-[#10b981] to-teal-600 text-white shadow-lg shadow-[#10b981]/30'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Zap size={15} /> Particular / Directo (Sin IVA Mensual)
                            </button>
                        </div>

                        {/* Particular / Walk-in Form */}
                        {buyerType === 'particular' ? (
                            <div className="p-4 bg-slate-950/70 border border-[#10b981]/30 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-[#10b981] uppercase tracking-wider flex items-center gap-2 font-mono">
                                        <User size={14} /> Comprador Particular (Solo Plan)
                                    </h4>
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                                        ⚡ Exento de Matriz de IVA
                                    </span>
                                </div>

                                {/* Extracción rápida por PDF */}
                                <div 
                                    onClick={() => !isAnalyzingParticular && particularRucInputRef.current?.click()}
                                    className={`
                                        p-3.5 rounded-2xl border border-dashed text-center cursor-pointer transition-all flex items-center justify-center gap-2.5
                                        ${isAnalyzingParticular ? 'border-[#10b981] bg-[#10b981]/10' : 'border-white/15 bg-slate-900/40 hover:border-[#10b981]/50'}
                                    `}
                                >
                                    <input type="file" ref={particularRucInputRef} onChange={handleParticularRucUpload} accept=".pdf" className="hidden" />
                                    {isAnalyzingParticular ? (
                                        <>
                                            <Loader className="w-4 h-4 text-[#10b981] animate-spin" />
                                            <span className="text-xs font-bold text-[#10b981]">Extrayendo datos de PDF SRI...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 text-[#10b981]" />
                                            <span className="text-xs font-bold text-slate-300">Subir Certificado RUC en PDF para auto-completar</span>
                                        </>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Nombre o Razón Social *"
                                        value={particularName}
                                        onChange={(e) => setParticularName(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#10b981]"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="RUC o Cédula *"
                                        value={particularRuc}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setParticularRuc(val);
                                            if (val.length >= 10 && !username) setUsername(val);
                                        }}
                                        className="px-3.5 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#10b981]"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="Teléfono / WhatsApp"
                                        value={particularPhone}
                                        onChange={(e) => setParticularPhone(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#10b981]"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Correo Electrónico (Opcional)"
                                        value={particularEmail}
                                        onChange={(e) => setParticularEmail(e.target.value)}
                                        className="px-3.5 py-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#10b981]"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Registered Client Search & Selector */
                            <>
                                {(targetClient && !isChangingClient && !showQuickCreateClient) ? (
                                    <div className="p-3.5 bg-[#10b981]/10 border border-[#10b981]/30 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-[#10b981]/20 text-[#10b981] flex items-center justify-center font-bold">
                                                <UserCheck size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-white uppercase">{targetClient.name}</h4>
                                                <p className="text-[11px] text-slate-400 font-mono">RUC: {targetClient.ruc} • {targetClient.regime}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-[#10b981] uppercase px-3 py-1 bg-[#10b981]/20 rounded-xl font-mono">
                                            Cliente Seleccionado
                                        </span>
                                    </div>
                                ) : showQuickCreateClient ? (
                                    /* Quick Client Form */
                                    <form onSubmit={handleQuickCreateClient} className="p-4 bg-slate-950/80 border border-indigo-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
                                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                                            <UserPlus size={14} /> Registrar Cliente Contable Rápido
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Nombre o Razón Social *"
                                                value={newClientName}
                                                onChange={(e) => setNewClientName(e.target.value)}
                                                className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                required
                                            />
                                            <input
                                                type="text"
                                                placeholder="RUC o Cédula *"
                                                value={newClientRuc}
                                                onChange={(e) => setNewClientRuc(e.target.value)}
                                                className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-indigo-500"
                                                required
                                            />
                                            <input
                                                type="text"
                                                placeholder="Teléfono"
                                                value={newClientPhone}
                                                onChange={(e) => setNewClientPhone(e.target.value)}
                                                className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                                            />
                                            <select
                                                value={newClientRegime}
                                                onChange={(e) => setNewClientRegime(e.target.value as TaxRegime)}
                                                className="px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                                            >
                                                <option value={TaxRegime.General}>Régimen General</option>
                                                <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                                <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
                                            >
                                                Guardar Cliente
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
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs font-medium outline-none focus:border-[#10b981]"
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
                                            className="w-full px-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs font-bold text-white focus:border-[#10b981] outline-none cursor-pointer"
                                        >
                                            <option value="">-- Seleccione un cliente registrado --</option>
                                            {filteredClients.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} — RUC: {c.ruc} ({c.regime})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── 2. CATEGORÍAS DE PLANES & PRICING (STITCH GRID) ── */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-300 uppercase tracking-wider block font-mono">
                            Seleccionar Categoría del Plan
                        </label>

                        {/* Category Tabs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                                    className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                                        activeCategory === cat.id
                                            ? 'bg-[#10b981]/15 border-[#10b981] text-white shadow-lg shadow-[#10b981]/10 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    <cat.icon size={18} className={activeCategory === cat.id ? 'text-[#10b981]' : 'text-slate-400'} />
                                    <span className="text-xs font-bold uppercase tracking-tight">{cat.title}</span>
                                </button>
                            ))}
                        </div>

                        {/* CATEGORY 1: SOLO FIRMA ELECTRÓNICA */}
                        {activeCategory === 'firma' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 animate-in fade-in duration-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
                                        setPrice(35.00);
                                        setExpirationYears(1);
                                        setDocumentCount('');
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        price === 35 && expirationYears === 1 && programName.includes('Soporte')
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">1 Año + Soporte</span>
                                        <span className="px-2 py-0.5 bg-[#10b981] text-slate-950 text-[8px] font-black uppercase rounded font-mono">Recomendado</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Firma .p12 + Anulación SRI + Configuración en portal</p>
                                    <p className="text-2xl font-black text-[#10b981] font-mono">$35.00</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año Solo Firma)');
                                        setPrice(29.00);
                                        setExpirationYears(1);
                                        setDocumentCount('');
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        price === 29 && expirationYears === 1
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">1 Año Solo Firma</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Archivo .p12 básico para emitir comprobantes</p>
                                    <p className="text-2xl font-black text-white font-mono">$29.00</p>
                                </button>

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
                                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                                    >
                                        <option value={2}>2 Años — $49.00</option>
                                        <option value={3}>3 Años — $65.00</option>
                                        <option value={4}>4 Años — $79.00</option>
                                        <option value={5}>5 Años — $89.00</option>
                                    </select>
                                    <p className="text-[10px] text-[#10b981] font-mono font-bold">Vigencia: {expirationYears} Años</p>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 2: ZIFACT */}
                        {activeCategory === 'zifact' && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4 pt-1 animate-in fade-in duration-200">
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
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
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
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                                        >
                                            <option value="yes">Sí — Incluir Firma Electrónica (.p12)</option>
                                            <option value="no">No — Solo Software de Facturación ZiFact</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl flex items-center justify-between">
                                    <span className="text-xs font-bold text-[#10b981]">Plan: ZiFact {documentCount || 50} Docs {includesSignature ? '+ Firma' : '(Solo Software)'}</span>
                                    <span className="text-xl font-black text-white font-mono">${price}.00</span>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 3: ECUAFACT */}
                        {activeCategory === 'ecuafact' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT 60 Docs + Firma Electrónica');
                                        setDocumentCount(60);
                                        setPrice(55.00);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        documentCount === 60 && price === 55
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">EcuaFact 60 Docs + Firma</span>
                                        <span className="px-2 py-0.5 bg-[#10b981] text-slate-950 text-[8px] font-black uppercase rounded font-mono">Popular</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">60 Comprobantes anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-2xl font-black text-[#10b981] font-mono">$55.00</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT Ilimitado + Firma Electrónica');
                                        setDocumentCount(0);
                                        setPrice(90.00);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        documentCount === 0 && price === 90
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">EcuaFact Ilimitado + Firma</span>
                                        <span className="px-2 py-0.5 bg-[#10b981] text-slate-950 text-[8px] font-black uppercase rounded font-mono">Empresa</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Comprobantes ilimitados anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-2xl font-black text-[#10b981] font-mono">$90.00</p>
                                </button>
                            </div>
                        )}

                        {/* CATEGORY 4: TALONARIO / OTROS */}
                        {activeCategory === 'talonario' && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3 pt-1 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={programName}
                                        onChange={(e) => setProgramName(e.target.value)}
                                        placeholder="Nombre del servicio (Ej: Talonario Físico Impreso)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#10b981]"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        placeholder="Precio Cobrado ($)"
                                        className="px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#10b981]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 3. AUTORIZACIÓN ESPECIAL ECUAFACT (DOCX/PRINT) ── */}
                    {activeCategory === 'ecuafact' && (
                        <div className="p-4 bg-slate-900/80 border border-[#10b981]/30 rounded-3xl space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[#10b981] flex items-center gap-2 font-mono">
                                    <FileCheck size={16} /> Documento de Autorización Especial EcuaFact
                                </h4>
                                {(targetClient || particularName) && (
                                    <span className="text-[9px] font-black text-[#10b981] uppercase px-2.5 py-0.5 bg-[#10b981]/20 rounded-full font-mono">
                                        Personalizado en vivo
                                    </span>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-300">
                                Descarga o imprime la carta de autorización rellenada automáticamente con los datos de <strong>{targetClient?.name || particularName || 'el cliente'}</strong>.
                            </p>

                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={isGeneratingDocx || (!targetClient && !particularName)}
                                    onClick={handleDownloadEcuaFactDocx}
                                    className="px-4 py-2.5 bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Download size={14} />
                                    <span>{isGeneratingDocx ? 'Generando .DOCX...' : 'Descargar .DOCX Personalizado'}</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!targetClient && !particularName}
                                    onClick={handlePrintEcuaFactAuth}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>Imprimir Carta</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── 4. EXPEDIENTE & BÓVEDA DE IDENTIDAD (STITCH TACTICAL DROPZONE) ── */}
                    <div className="p-4 bg-slate-900/40 rounded-3xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 font-mono">
                                <Camera size={14} className="text-[#10b981]" />
                                Expediente & Recursos en Nube
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                                Respaldado automáticamente
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {([
                                { id: 'idCardFront',  label: 'Cédula Anverso', icon: '🪪', state: idCardFront,  setter: setIdCardFront,  inputId: 'sales-id-front' },
                                { id: 'idCardBack',   label: 'Cédula Reverso', icon: '🪪', state: idCardBack,   setter: setIdCardBack,   inputId: 'sales-id-back' },
                                { id: 'idCardSelfie', label: 'Foto Selfie',     icon: '📸', state: idCardSelfie, setter: setIdCardSelfie, inputId: 'sales-id-selfie' },
                                { id: 'rucPdf',       label: 'RUC Actual (PDF)', icon: '📄', state: rucPdf,      setter: setRucPdf,      inputId: 'sales-ruc-pdf' },
                                ...(activeCategory === 'ecuafact' ? [
                                    { id: 'ecuafactSignedRequest', label: 'Solicitud Firmada', icon: '✍️', state: ecuafactSignedRequest, setter: setEcuafactSignedRequest, inputId: 'sales-signed-req' }
                                ] : [])
                            ] as const).map(slot => (
                                <div key={slot.id} className="flex flex-col gap-1">
                                    <input
                                        type="file"
                                        id={slot.inputId}
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleSlotFileUpload(file, slot.id, slot.setter);
                                            e.target.value = '';
                                        }}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => document.getElementById(slot.inputId)?.click()}
                                        className={`relative w-full py-2.5 px-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                                            slot.state
                                                ? 'border-[#10b981] bg-[#10b981]/15 text-white'
                                                : 'border-white/10 bg-slate-950/80 hover:border-white/20 text-slate-400'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2">
                                            <span>{slot.icon}</span> {slot.label}
                                        </span>
                                        {uploadingSlot === slot.id ? (
                                            <Loader size={14} className="animate-spin text-[#10b981]" />
                                        ) : slot.state ? (
                                            <CheckCircle2 size={15} className="text-[#10b981]" />
                                        ) : (
                                            <Upload size={14} className="text-slate-500" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* ── FOOTER CON ACCIÓN SRI DIRECTA ── */}
                <div className="p-5 bg-[#051424]/95 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input
                            type="checkbox"
                            checked={shouldEmitSri}
                            onChange={(e) => setShouldEmitSri(e.target.checked)}
                            className="w-4 h-4 rounded-md bg-slate-950 border-white/20 text-[#10b981] focus:ring-[#10b981] cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 group-hover:text-white transition-colors font-bold font-mono flex items-center gap-1.5">
                            <Sparkles size={14} className="text-[#10b981]" />
                            Emitir Factura SRI automáticamente al guardar (${price || 0})
                        </span>
                    </label>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSingleSaveAction}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 bg-gradient-to-r from-[#10b981] via-teal-500 to-emerald-600 hover:from-[#10b981]/90 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-[#10b981]/25 active:scale-95 transition-all cursor-pointer"
                        >
                            <FileText size={16} />
                            <span>Guardar Plan y Emitir Factura SRI</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
