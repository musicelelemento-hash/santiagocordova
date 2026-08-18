import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X, CheckCircle2, ShieldCheck, Zap, Key, FileText,
    ShoppingBag, Calendar, Lock, Camera, Upload, Search, UserPlus,
    Printer, Download, UserCheck, RefreshCw, Check, Info, ArrowRight, User, 
    FileCheck, Loader, Sparkles, DollarSign, Wallet, Send, Share2, Copy,
    TrendingUp, ExternalLink, HelpCircle, CheckSquare, Layers, Award
} from 'lucide-react';
import { extractDataFromSriPdf } from '../../services/pdfExtraction';
import { Client, FacturadorConfig, StoredFile, TaxRegime, BillingPlan } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { downloadEcuafactDocx, printEcuafactAuthorization, getFormattedCurrentDateSpanish } from '../../services/ecuafactDocxService';
import { SupabaseService } from '../../services/supabaseClientService';
import { db } from '../../services/db';
import { v4 as uuidv4 } from 'uuid';

interface SalesComboModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialClient?: Client | null;
    onEmitSriInvoice?: (client: Client, description: string, amount: number) => void;
}

type MainCategory = 'ecuafact' | 'zifact' | 'firma' | 'sri_gratuito' | 'talonario';
type PaymentMethod = 'transferencia_pichincha' | 'transferencia_guayaquil' | 'transferencia_bolivariano' | 'efectivo' | 'deuna_tarjeta';

export const SalesComboModal: React.FC<SalesComboModalProps> = ({
    isOpen,
    onClose,
    initialClient,
    onEmitSriInvoice
}) => {
    const { clients, updateClient, addClient, systemSettings } = useAppStore();
    const { toast } = useToast();

    // ── 1. Client Selection State ──
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isChangingClient, setIsChangingClient] = useState(false);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [showQuickCreateClient, setShowQuickCreateClient] = useState(false);

    // Quick Client Registration State
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

    // ── 2. Category Tabs & Presets ──
    const [activeCategory, setActiveCategory] = useState<MainCategory>('ecuafact');

    const getTodayIso = () => new Date().toISOString().split('T')[0];
    const getYesterdayIso = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    };

    // ── 3. Selected Combo / Pricing / Profit State ──
    const [programName, setProgramName] = useState('ECUAFACT 60 Docs + Firma Electrónica');
    const [documentCount, setDocumentCount] = useState<number | ''>(60);
    const [price, setPrice] = useState<number | ''>(55.00);
    const [estimatedCost, setEstimatedCost] = useState<number>(20.00);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia_pichincha');
    const [expirationYears, setExpirationYears] = useState<number>(1);
    const [saleDate, setSaleDate] = useState<string>(getTodayIso());
    const [customExpirationDate, setCustomExpirationDate] = useState<string>(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    });
    const [includesSignature, setIncludesSignature] = useState<boolean>(true);
    const [shouldEmitSri, setShouldEmitSri] = useState<boolean>(true);
    const [webUrl, setWebUrl] = useState('https://app.ecuafact.com');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [providerName, setProviderName] = useState('Santiago Córdova');
    const [isExpressDelivery, setIsExpressDelivery] = useState<boolean>(false);

    // Auto-recalculate expiration date when saleDate or expirationYears changes
    useEffect(() => {
        if (saleDate) {
            const parts = saleDate.split('-').map(Number);
            if (parts.length === 3) {
                const [y, m, day] = parts;
                const d = new Date(y, m - 1, day);
                d.setFullYear(d.getFullYear() + (expirationYears || 1));
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                setCustomExpirationDate(`${yyyy}-${mm}-${dd}`);
            }
        }
    }, [saleDate, expirationYears]);

    // ── 4. Identity Documents & Cloud Vault ──
    const [idCardFront, setIdCardFront] = useState<StoredFile | null>(null);
    const [idCardBack, setIdCardBack] = useState<StoredFile | null>(null);
    const [idCardSelfie, setIdCardSelfie] = useState<StoredFile | null>(null);
    const [rucPdf, setRucPdf] = useState<StoredFile | null>(null);
    const [ecuafactSignedRequest, setEcuafactSignedRequest] = useState<StoredFile | null>(null);
    const [signatureFile, setSignatureFile] = useState<StoredFile | null>(null);
    const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

    // Generating State
    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    // Initialize with target client
    useEffect(() => {
        if (initialClient) {
            setSelectedClientId(initialClient.id);
            setUsername(initialClient.ruc || '');
            setIsChangingClient(false);
            if (initialClient.clientType === 'solo_plan' || initialClient.requiresDeclarations === false) {
                setBuyerType('particular');
                setParticularName(initialClient.name);
                setParticularRuc(initialClient.ruc);
                setParticularPhone(initialClient.phones?.[0] || '');
                setParticularEmail(initialClient.email || '');
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
            setSignatureFile(targetClient.signatureFile || null);
            
            const conf = targetClient.billingPlan || targetClient.facturadorConfig;
            if (conf) {
                setUsername(conf.username || targetClient.ruc);
                setPassword(conf.password || targetClient.sriPassword);
                setProgramName(conf.programName || programName);
                if (conf.documentCount !== undefined) {
                    setDocumentCount(conf.documentCount);
                }
                if (conf.price !== undefined) {
                    setPrice(conf.price);
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
            setSignatureFile(null);
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

    // Live OCR PDF RUC extraction
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
            if (extracted.contacto?.celular && !particularPhone) {
                setParticularPhone(extracted.contacto.celular);
            }
            if (extracted.contacto?.email && !particularEmail) {
                setParticularEmail(extracted.contacto.email);
            }
            if (!username) setUsername(extracted.ruc);
            toast.success("✅ Datos del RUC extraídos y auto-rellenados con éxito.");
        } catch (error) {
            console.error(error);
            toast.error("Error al leer el PDF del RUC.");
        } finally {
            setIsAnalyzingParticular(false);
            if (particularRucInputRef.current) particularRucInputRef.current.value = '';
        }
    };

    // Category Change Handler with Dynamic Profit Margin Calculation
    const handleCategoryChange = (cat: MainCategory) => {
        setActiveCategory(cat);
        if (cat === 'ecuafact') {
            setProgramName('ECUAFACT 60 Docs + Firma Electrónica');
            setDocumentCount(60);
            setPrice(55.00);
            setEstimatedCost(22.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl(systemSettings?.ecuafactUrl || 'https://app.ecuafact.com');
        } else if (cat === 'zifact') {
            setProgramName('ZIFAC 50 Docs + Firma Electrónica');
            setDocumentCount(50);
            setPrice(45.00);
            setEstimatedCost(18.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl(systemSettings?.zifactUrl || 'https://sistema.zifac.com');
        } else if (cat === 'firma') {
            setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
            setDocumentCount('');
            setPrice(35.00);
            setEstimatedCost(14.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl('');
        } else if (cat === 'sri_gratuito') {
            setProgramName('Asistencia Facturador SRI Gratuito + Firma .p12');
            setDocumentCount(0); // Ilimitado en el SRI
            setPrice(35.00);
            setEstimatedCost(14.00);
            setExpirationYears(1);
            setIncludesSignature(true);
            setWebUrl('https://srienlinea.sri.gob.ec');
        } else {
            setProgramName('Talonario Físico / Servicio Personalizado');
            setDocumentCount('');
            setPrice(25.00);
            setEstimatedCost(10.00);
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

    // Calculate Profit & Net Margin
    const numericPrice = typeof price === 'number' ? price : 0;
    const finalPriceWithExpress = numericPrice + (isExpressDelivery ? 5 : 0);
    const netProfit = Math.max(0, finalPriceWithExpress - estimatedCost);
    const profitMarginPercent = finalPriceWithExpress > 0 ? Math.round((netProfit / finalPriceWithExpress) * 100) : 0;

    // Handle Upload for Identity Vault Slots with Supabase Cloud Storage
    const handleSlotFileUpload = async (file: File, slotId: string, setter: (f: StoredFile) => void) => {
        setUploadingSlot(slotId);
        toast.info(`Cargando ${file.name} a la Bóveda Segura...`);
        
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
                    console.warn("Storage upload fallback to local base64", e);
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

    // Copy formatted credentials for WhatsApp
    const handleCopyWhatsAppWelcome = () => {
        const clientName = targetClient?.name || particularName || 'Estimado(a) Cliente';
        const clientRuc = targetClient?.ruc || particularRuc || 'RUC';
        const expDate = customExpirationDate || calculateExpirationDate();

        const message = `✨ *¡BIENVENIDO A SU FACTURACIÓN ELECTRÓNICA & FIRMA DIGITAL!* ✨
Hola *${clientName}*, le saludamos de *Santiago Córdova - Asesoría Tributaria*.

Su plan ha sido activado con éxito:
━━━━━━━━━━━━━━━━━━━━
📌 *PLAN:* ${programName}
🏢 *RUC / CÉDULA:* ${clientRuc}
🔑 *USUARIO:* ${username || clientRuc}
🔒 *CLAVE INICIAL:* ${password || '12345678a'}
📅 *VIGENCIA HASTA:* ${expDate}
🌐 *ACCESO AL SISTEMA:* ${webUrl || 'https://srienlinea.sri.gob.ec'}
━━━━━━━━━━━━━━━━━━━━
💡 *BENEFICIOS INCLUIDOS:*
✓ Emisión electrónica autorizada por el SRI.
✓ Respaldo de firma .p12 en Bóveda Digital.
✓ Soporte técnico directo y anulación de comprobantes.

Cualquier duda o configuración adicional, estamos a su total disposición. ¡Muchas gracias por su confianza! 🚀`;

        navigator.clipboard.writeText(message);
        toast.success("📋 Mensaje de bienvenida y credenciales copiado para WhatsApp.");
    };

    // Single Save Action (Syncs Client, Cloud Vault, SaaS License, and SRI Invoice)
    const handleSingleSaveAction = async () => {
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
                    sriPassword: password || '12345678a',
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

        const expDate = customExpirationDate || calculateExpirationDate();

        const newFacturadorConfig: FacturadorConfig = {
            programName,
            url: webUrl,
            username: username || clientToProcess.ruc,
            password: password || clientToProcess.sriPassword,
            expirationDate: expDate,
            startDate: saleDate,
            documentStatus: activeCategory === 'firma' ? `Firma ${expirationYears} Año(s)` : (documentCount ? `${documentCount} Docs / Anual` : 'Plan Ilimitado'),
            documentCount: typeof documentCount === 'number' ? documentCount : undefined,
            price: finalPriceWithExpress,
            soldByMe: true,
            providerName: providerName || 'Santiago Córdova',
            freeSupportAndCancellation: true
        };

        const isSoloPlan = buyerType === 'particular';

        const updatedClient: Client = {
            ...clientToProcess,
            facturadorConfig: newFacturadorConfig,
            billingPlan: newFacturadorConfig,
            signatureExpirationDate: includesSignature ? expDate : clientToProcess.signatureExpirationDate,
            signatureIssueDate: includesSignature ? saleDate : clientToProcess.signatureIssueDate,
            signatureProvider: includesSignature ? (activeCategory === 'ecuafact' ? 'Uanataca / Ecuanexus' : 'Security Data') : clientToProcess.signatureProvider,
            clientType: isSoloPlan ? 'solo_plan' : 'completo',
            requiresDeclarations: !isSoloPlan,
            idCardFront: idCardFront || clientToProcess.idCardFront,
            idCardBack: idCardBack || clientToProcess.idCardBack,
            idCardSelfie: idCardSelfie || clientToProcess.idCardSelfie,
            rucPdf: rucPdf || clientToProcess.rucPdf,
            ecuafactSignedRequest: ecuafactSignedRequest || clientToProcess.ecuafactSignedRequest,
            signatureFile: signatureFile || clientToProcess.signatureFile,
            facturadorActivationStatus: 'activado'
        };

        updateClient(clientToProcess.id, updatedClient);

        // Auto-register SaaS License in persistent memory
        try {
            const existingLicenses = (await db.getLocal('sc_licencias_history')) || [];
            const serviceLabel = activeCategory === 'ecuafact' ? 'Facturador Ecuafact' :
                                 activeCategory === 'zifact' ? 'Facturador Zifac' :
                                 activeCategory === 'firma' ? 'Firma Electrónica .p12' : 'Software Personalizado';

            const newLic = {
                id: `LIC-${Date.now()}`,
                licenseKey: `SC-LIC-2026-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                clienteId: clientToProcess.id,
                nombreCliente: clientToProcess.name,
                rucCliente: clientToProcess.ruc,
                tipoServicio: serviceLabel,
                fechaActivacion: saleDate,
                fechaExpiracion: expDate,
                estado: 'Activa',
                observaciones: `Venta registrada vía Menú Interno (${programName}) - Precio: $${finalPriceWithExpress}`
            };

            const updatedLicList = [newLic, ...existingLicenses.filter((l: any) => l.rucCliente !== clientToProcess?.ruc || l.tipoServicio !== serviceLabel)];
            await db.setLocal('sc_licencias_history', updatedLicList);
        } catch (e) {
            console.warn("Licencias auto-sync error:", e);
        }

        let description = `Venta de Plan ${programName}`;
        if (activeCategory === 'ecuafact') {
            description = `Combo ECUAFACT (${documentCount || 60} Comprobantes + Firma Electrónica)`;
        } else if (activeCategory === 'zifact') {
            description = `Combo ZIFAC (${documentCount || 50} Comprobantes ${includesSignature ? '+ Firma Electrónica' : ''})`;
        } else if (activeCategory === 'firma') {
            description = `Firma Electrónica .p12 — ${expirationYears} Año(s)`;
        } else if (activeCategory === 'sri_gratuito') {
            description = `Asistencia Configuración Facturador SRI Gratuito + Firma .p12`;
        }

        onClose();

        if (shouldEmitSri && onEmitSriInvoice) {
            onEmitSriInvoice(updatedClient, description, finalPriceWithExpress);
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
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto font-sans">
            {/* Backdrop Click */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Centered Modal Container (Obsidian & Emerald Luxury) */}
            <div className="relative z-10 w-full max-w-5xl my-auto bg-[#051424] max-h-[94vh] flex flex-col shadow-[0_30px_90px_-15px_rgba(0,0,0,0.95)] rounded-[2.5rem] border border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100 font-body">

                {/* ── 1. HEADER LUXURY ── */}
                <div className="px-6 py-5 bg-[#051424]/95 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#10b981] via-teal-600 to-emerald-800 text-white flex items-center justify-center font-bold shadow-lg shadow-[#10b981]/25 border border-white/10">
                            <ShoppingBag size={24} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_10px_#10b981]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] font-mono text-[#10b981]">Terminal de Venta Directa • Nueva Luz 3.0</span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-display">
                                Venta de Planes de Facturación & Firmas .p12
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyWhatsAppWelcome}
                            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Copiar mensaje de bienvenida para WhatsApp"
                        >
                            <Share2 size={14} />
                            <span>Copiar WhatsApp</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── 2. MODAL BODY ── */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left custom-scrollbar">

                    {/* ── SECCIÓN 1: SELECTOR TRI-MODAL DE COMPRADOR ── */}
                    <div className="p-5 bg-slate-900/60 rounded-3xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <User size={15} className="text-[#10b981]" />
                                1. Identificación del Comprador / Receptor
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
                                        {showQuickCreateClient ? 'Cancelar' : '+ Registrar Rápido'}
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

                        {/* Particular / Walk-in Form with OCR RUC parser */}
                        {buyerType === 'particular' ? (
                            <div className="p-4 bg-slate-950/70 border border-[#10b981]/30 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-[#10b981] uppercase tracking-wider flex items-center gap-2 font-mono">
                                        <User size={14} /> Comprador Particular (Solo Facturación / Firma)
                                    </h4>
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                                        ⚡ Aislado de Obligaciones Tributarias
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
                                            <span className="text-xs font-bold text-[#10b981]">Extrayendo automáticamente datos desde el PDF del RUC...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 text-[#10b981]" />
                                            <span className="text-xs font-bold text-slate-300">Subir Certificado RUC en PDF para auto-completar datos al instante</span>
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
                                                placeholder="Buscar cliente por Nombre, RUC o Nombre Comercial..."
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

                    {/* ── SECCIÓN 2: CATÁLOGO DE 5 CATEGORÍAS & PRESETS ── */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-300 uppercase tracking-wider block font-mono">
                            2. Seleccionar Plataforma & Paquete Comercial
                        </label>

                        {/* Category Tabs */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {[
                                { id: 'ecuafact', title: 'EcuaFact (Combo)', icon: ShieldCheck, badge: 'Popular' },
                                { id: 'zifact', title: 'ZiFact (Software)', icon: Zap, badge: 'POS' },
                                { id: 'firma', title: 'Solo Firma (.p12)', icon: Key, badge: 'Multi-Año' },
                                { id: 'sri_gratuito', title: 'SRI Asistido', icon: Layers, badge: 'Gratuito' },
                                { id: 'talonario', title: 'Talonario / Otros', icon: FileText, badge: 'Custom' },
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategoryChange(cat.id as MainCategory)}
                                    className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer relative overflow-hidden ${
                                        activeCategory === cat.id
                                            ? 'bg-[#10b981]/15 border-[#10b981] text-white shadow-lg shadow-[#10b981]/10 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    <cat.icon size={18} className={activeCategory === cat.id ? 'text-[#10b981]' : 'text-slate-400'} />
                                    <span className="text-[11px] font-bold uppercase tracking-tight">{cat.title}</span>
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded font-mono ${
                                        activeCategory === cat.id ? 'bg-[#10b981] text-slate-950' : 'bg-white/10 text-slate-400'
                                    }`}>
                                        {cat.badge}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* CATEGORY 1: ECUAFACT */}
                        {activeCategory === 'ecuafact' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 animate-in fade-in duration-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT 60 Docs + Firma Electrónica');
                                        setDocumentCount(60);
                                        setPrice(55.00);
                                        setEstimatedCost(22.00);
                                        setExpirationYears(1);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        documentCount === 60 && price === 55
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">60 Docs + Firma</span>
                                        <span className="px-2 py-0.5 bg-[#10b981] text-slate-950 text-[8px] font-black uppercase rounded font-mono">Popular</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">60 Comprobantes anuales + Firma Electrónica .p12 Uanataca</p>
                                    <p className="text-2xl font-black text-[#10b981] font-mono">$55.00</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT 200 Docs + Firma Electrónica');
                                        setDocumentCount(200);
                                        setPrice(75.00);
                                        setEstimatedCost(30.00);
                                        setExpirationYears(1);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        documentCount === 200 && price === 75
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">200 Docs + Firma</span>
                                        <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 text-[8px] font-black uppercase rounded font-mono">Negocio</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">200 Comprobantes anuales + Firma Electrónica .p12 incluida</p>
                                    <p className="text-2xl font-black text-white font-mono">$75.00</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('ECUAFACT Ilimitado + Firma Electrónica');
                                        setDocumentCount(0);
                                        setPrice(90.00);
                                        setEstimatedCost(35.00);
                                        setExpirationYears(1);
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                        documentCount === 0 && price === 90
                                            ? 'border-[#10b981] bg-[#10b981]/15 ring-1 ring-[#10b981]/30'
                                            : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white uppercase">Ilimitado + Firma</span>
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase rounded font-mono">Empresas</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-2">Comprobantes ilimitados anuales + Firma Electrónica .p12</p>
                                    <p className="text-2xl font-black text-white font-mono">$90.00</p>
                                </button>
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
                                                if (val === 50) { setPrice(includesSignature ? 45 : 25); setEstimatedCost(includesSignature ? 18 : 10); }
                                                else if (val === 100) { setPrice(includesSignature ? 55 : 35); setEstimatedCost(includesSignature ? 22 : 14); }
                                                else if (val === 200) { setPrice(includesSignature ? 65 : 45); setEstimatedCost(includesSignature ? 26 : 18); }
                                                else if (val === 500) { setPrice(includesSignature ? 85 : 65); setEstimatedCost(includesSignature ? 32 : 24); }
                                                else if (val === 0) { setPrice(includesSignature ? 110 : 80); setEstimatedCost(includesSignature ? 40 : 30); }
                                            }}
                                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                                        >
                                            <option value={50}>50 Documentos (Popular)</option>
                                            <option value={100}>100 Documentos</option>
                                            <option value={200}>200 Documentos</option>
                                            <option value={500}>500 Documentos</option>
                                            <option value={0}>Ilimitado (Full)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                            ¿Incluye Firma Electrónica .p12?
                                        </label>
                                        <select
                                            value={includesSignature ? 'yes' : 'no'}
                                            onChange={(e) => {
                                                const inc = e.target.value === 'yes';
                                                setIncludesSignature(inc);
                                                if (inc) {
                                                    setPrice(45.00);
                                                    setEstimatedCost(18.00);
                                                    setProgramName(`ZIFAC ${documentCount || 50} Docs + Firma Electrónica`);
                                                } else {
                                                    setPrice(25.00);
                                                    setEstimatedCost(10.00);
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
                                    <span className="text-xs font-bold text-[#10b981]">Plan Seleccionado: ZiFact {documentCount || 50} Docs {includesSignature ? '+ Firma' : '(Solo Software)'}</span>
                                    <span className="text-xl font-black text-white font-mono">${price}.00</span>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 3: SOLO FIRMA ELECTRÓNICA */}
                        {activeCategory === 'firma' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 animate-in fade-in duration-200">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProgramName('Firma Electrónica .p12 (1 Año + Soporte SRI)');
                                        setPrice(35.00);
                                        setEstimatedCost(14.00);
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
                                        <span className="text-xs font-bold text-white uppercase">1 Año + Soporte SRI</span>
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
                                        setEstimatedCost(14.00);
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
                                    <p className="text-[11px] text-slate-400 mb-2">Archivo .p12 estándar para emitir comprobantes</p>
                                    <p className="text-2xl font-black text-white font-mono">$29.00</p>
                                </button>

                                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                                    <span className="text-xs font-bold text-white uppercase block">Multiaños (Solo Firma)</span>
                                    <select
                                        value={expirationYears > 1 ? expirationYears : 2}
                                        onChange={(e) => {
                                            const yrs = parseInt(e.target.value);
                                            setExpirationYears(yrs);
                                            const feeMap: Record<number, { price: number; cost: number }> = {
                                                2: { price: 49, cost: 22 },
                                                3: { price: 65, cost: 30 },
                                                4: { price: 79, cost: 38 },
                                                5: { price: 89, cost: 45 }
                                            };
                                            const mapped = feeMap[yrs] || { price: 49, cost: 22 };
                                            setPrice(mapped.price);
                                            setEstimatedCost(mapped.cost);
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

                        {/* CATEGORY 4: SRI GRATUITO ASISTIDO */}
                        {activeCategory === 'sri_gratuito' && (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3 pt-1 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-950 rounded-xl border border-white/10 space-y-1">
                                        <span className="text-xs font-bold text-white uppercase">Servicio de Asistencia SRI</span>
                                        <p className="text-[11px] text-slate-400">Configuración del portal SRI en Línea, subida de la firma electrónica .p12 y creación de catálogo de productos/servicios.</p>
                                    </div>
                                    <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tarifa Integral</span>
                                        <span className="text-2xl font-black text-[#10b981] font-mono">$35.00</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CATEGORY 5: TALONARIO / OTROS */}
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

                    {/* ── SECCIÓN 3: CALCULADORA DE RENTABILIDAD & FORMA DE PAGO ── */}
                    <div className="p-5 bg-slate-900/80 rounded-3xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <TrendingUp size={15} className="text-[#10b981]" />
                                3. Desglose Financiero, Rentabilidad & Método de Pago
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isExpressDelivery}
                                    onChange={(e) => setIsExpressDelivery(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded bg-slate-950 border-white/20 text-[#10b981] focus:ring-[#10b981]"
                                />
                                <span className="text-[11px] font-bold text-amber-400 font-mono">⚡ Trámite Express (+ $5.00)</span>
                            </label>
                        </div>

                        {/* Financial Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Precio al Cliente</span>
                                <p className="text-2xl font-black text-white mt-1">${finalPriceWithExpress.toFixed(2)}</p>
                                <span className="text-[9px] text-slate-500">Monto total facturado</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Costo Proveedor Base</span>
                                <p className="text-2xl font-black text-slate-400 mt-1">${estimatedCost.toFixed(2)}</p>
                                <span className="text-[9px] text-slate-500">Costo de emisión / software</span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/40">
                                <span className="text-[10px] font-bold text-[#10b981] uppercase">Ganancia Neta Despacho</span>
                                <p className="text-2xl font-black text-[#10b981] mt-1">${netProfit.toFixed(2)}</p>
                                <span className="text-[9px] text-emerald-400 font-bold font-sans">Margen: {profitMarginPercent}% de rentabilidad</span>
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                                    Método de Cobro Recibido
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                                >
                                    <option value="transferencia_pichincha">🏦 Transferencia Banco Pichincha</option>
                                    <option value="transferencia_guayaquil">🏦 Transferencia Banco Guayaquil</option>
                                    <option value="transferencia_bolivariano">🏦 Transferencia Banco Bolivariano</option>
                                    <option value="efectivo">💵 Efectivo Directo en Oficina</option>
                                    <option value="deuna_tarjeta">💳 DeUna / Tarjeta Débito / Crédito</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                                    Canal & Responsable de Venta
                                </label>
                                <input
                                    type="text"
                                    value={providerName}
                                    onChange={(e) => setProviderName(e.target.value)}
                                    placeholder="Santiago Córdova"
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#10b981]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── SECCIÓN 4: CONTROL DE FECHAS DE EMISIÓN & VENCIMIENTO ── */}
                    <div className="p-5 bg-slate-900/60 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                                <Calendar size={15} className="text-[#10b981]" />
                                4. Fechas de Emisión & Caducidad de Software / Firma
                            </label>
                            <span className="text-[10px] text-slate-400 font-mono">
                                Control de Vigencia Exacta
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Fecha de Venta / Emisión */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de Venta / Emisión</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setSaleDate(getTodayIso())}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                                saleDate === getTodayIso() ? 'bg-[#10b981] text-slate-950 font-black' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Hoy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSaleDate(getYesterdayIso())}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                                saleDate === getYesterdayIso() ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Ayer
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#10b981]"
                                />
                            </div>

                            {/* Fecha de Caducidad Exacta */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de Caducidad / Vencimiento</span>
                                    <span className="text-[9px] font-mono text-[#10b981] font-bold">{expirationYears} Año(s) de Vigencia</span>
                                </div>
                                <input
                                    type="date"
                                    value={customExpirationDate}
                                    onChange={(e) => setCustomExpirationDate(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-[#10b981]/30 rounded-xl text-xs font-mono font-bold text-emerald-400 outline-none focus:border-[#10b981]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── SECCIÓN 5: PODER / AUTORIZACIÓN ESPECIAL ECUAFACT (DOCX/PRINT) ── */}
                    {activeCategory === 'ecuafact' && (
                        <div className="p-5 bg-slate-900/80 border border-[#10b981]/30 rounded-3xl space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-[#10b981] flex items-center gap-2 font-mono">
                                    <FileCheck size={16} /> 5. Documento de Autorización Especial EcuaFact (Uanataca)
                                </h4>
                                {(targetClient || particularName) && (
                                    <span className="text-[9px] font-black text-[#10b981] uppercase px-2.5 py-0.5 bg-[#10b981]/20 rounded-full font-mono">
                                        Personalizado en vivo
                                    </span>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-300">
                                Descarga o imprime la carta de poder especial rellenada con los datos de <strong>{targetClient?.name || particularName || 'el cliente'}</strong> para el trámite de firma electrónica.
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
                                    <span>Imprimir Carta Directa</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── SECCIÓN 6: EXPEDIENTE DIGITAL & BÓVEDA DE IDENTIDAD (CLOUD STORAGE) ── */}
                    <div className="p-5 bg-slate-900/60 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 font-mono">
                                <Camera size={14} className="text-[#10b981]" />
                                6. Expediente Digital & Bóveda de Identidad en la Nube
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                                Respaldado en Supabase Storage
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {([
                                { id: 'idCardFront',  label: 'Cédula Anverso', icon: '🪪', state: idCardFront,  setter: setIdCardFront,  inputId: 'sales-id-front' },
                                { id: 'idCardBack',   label: 'Cédula Reverso', icon: '🪪', state: idCardBack,   setter: setIdCardBack,   inputId: 'sales-id-back' },
                                { id: 'idCardSelfie', label: 'Foto Selfie con Cédula', icon: '📸', state: idCardSelfie, setter: setIdCardSelfie, inputId: 'sales-id-selfie' },
                                { id: 'rucPdf',       label: 'RUC Actual (PDF)', icon: '📄', state: rucPdf,      setter: setRucPdf,      inputId: 'sales-ruc-pdf' },
                                { id: 'signatureFile', label: 'Firma .p12 (Opcional)', icon: '🔐', state: signatureFile, setter: setSignatureFile, inputId: 'sales-signature-file' },
                                ...(activeCategory === 'ecuafact' ? [
                                    { id: 'ecuafactSignedRequest', label: 'Solicitud Firmada', icon: '✍️', state: ecuafactSignedRequest, setter: setEcuafactSignedRequest, inputId: 'sales-signed-req' }
                                ] : [])
                            ] as const).map(slot => (
                                <div key={slot.id} className="flex flex-col gap-1">
                                    <input
                                        type="file"
                                        id={slot.inputId}
                                        accept="image/*,application/pdf,.p12"
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
                                        className={`relative w-full py-3 px-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                                            slot.state
                                                ? 'border-[#10b981] bg-[#10b981]/15 text-white shadow-sm'
                                                : 'border-white/10 bg-slate-950/80 hover:border-white/20 text-slate-400'
                                        }`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2 truncate">
                                            <span>{slot.icon}</span> {slot.label}
                                        </span>
                                        {uploadingSlot === slot.id ? (
                                            <Loader size={14} className="animate-spin text-[#10b981]" />
                                        ) : slot.state ? (
                                            <CheckCircle2 size={16} className="text-[#10b981] shrink-0" />
                                        ) : (
                                            <Upload size={14} className="text-slate-500 shrink-0" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* ── 3. FOOTER CON ACCIÓN SRI DIRECTA & CIERRE MÁGICO ── */}
                <div className="p-5 bg-[#051424]/95 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input
                            type="checkbox"
                            checked={shouldEmitSri}
                            onChange={(e) => setShouldEmitSri(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-950 border-white/20 text-[#10b981] focus:ring-[#10b981] cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 group-hover:text-white transition-colors font-bold font-mono flex items-center gap-1.5">
                            <Sparkles size={14} className="text-[#10b981]" />
                            Emitir Factura Electrónica SRI al guardar (${finalPriceWithExpress.toFixed(2)})
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
                            <span>Guardar Plan & Emitir Factura SRI</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
