import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Client, DeclarationStatus, Declaration, TaxRegime, ServiceFeesConfig, StoredFile, Task, TaskStatus } from '../../types';
import { validateIdentifier, getDaysUntilDue, getPeriod, validateSriPassword, formatPeriodForDisplay, getDueDateForPeriod, getNextPeriod, safeFormat, getWhatsAppUrl, requiresIva } from '../../services/sri';
import { summarizeTextWithGemini, analyzeClientPhoto } from '../../services/geminiService';
import { extractDataFromSriPdf, extractDataFromDeclarationPdf, fileToBase64 } from '../../services/pdfExtraction';
import { getClientServiceFee } from '../../services/clientService';
import { isPast, subMonths, subYears, addDays, getYear } from 'date-fns';
import {
    X, Edit, BrainCircuit, Check, DollarSign, RotateCcw, Eye, EyeOff, Copy,
    ShieldCheck, FileText, Zap, UserCheck, UserX, UserCheck2, HandCoins,
    MoreHorizontal, Printer, Clipboard, CheckCircle, CheckCircle2, Send, Loader, ArrowDownToLine,
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History as HistoryIcon, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, ChevronDown, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download, ScanLine, FilePlus, Power, FileCheck, Coins, BadgePercent, Play, Settings, FileDown, TrendingUp,
    Search, Filter, Trash, LogOut, Menu, ArrowLeft, RefreshCcw, Smartphone, Hash, Landmark, AlertCircle
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { v4 as uuidv4 } from 'uuid';

// Modular Sub-components
import { ClientHeader } from './ClientDetail/ClientHeader';
import { CopyButton } from './ClientDetail/CopyButton';
import { VaultCard } from './ClientDetail/VaultCard';

import { DocumentTimeline } from './ClientDetail/DocumentTimeline';
import { PdfPreviewModal } from './ClientDetail/PdfPreviewModal';
import { ProfileDataItem } from './ClientDetail/ProfileDataItem';
import { SidebarAction } from './ClientDetail/SidebarAction';
import { QuickActionBtn } from './ClientDetail/QuickActionBtn';
import { PaymentHistoryChart } from './ClientDetail/PaymentHistoryChart';
import { TaxObligationCard } from './ClientDetail/TaxObligationCard';
import { DeclarationHistoryTable } from './ClientDetail/DeclarationHistoryTable';
import { ExtraObligationsCheckboxes } from './ClientDetail/ExtraObligationsCheckboxes';
import { ClientNotes } from './ClientDetail/ClientNotes';
import { DeclarationProgressBar } from './ClientDetail/DeclarationProgressBar';
import { DynamicStatusIndicator } from './ClientDetail/DynamicStatusIndicator';

// Tab Components
import { ProfileTab } from './ClientDetail/tabs/ProfileTab';
import { HistoryTab } from './ClientDetail/tabs/HistoryTab';
import { VaultTab } from './ClientDetail/tabs/VaultTab';
import { SettingsTab } from './ClientDetail/tabs/SettingsTab';

const getRecentPeriods = (client: Client, count: number): string[] => {
    if (!client) return [];
    const periods: string[] = [];
    let currentDate = new Date();
    const ivaFreq = client.taxProfile?.ivaFrequency || 'Mensual';

    for (let i = 0; i < count; i++) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) periods.push(period);

        if (ivaFreq === 'Mensual') { currentDate = subMonths(currentDate, 1); }
        else if (ivaFreq === 'Semestral') { currentDate = subMonths(currentDate, 6); }
        else { currentDate = subYears(currentDate, 1); }
    }
    return periods.slice(0, count).reverse();
};

const getStatusIndicator = (client: Pick<Client, 'taxProfile' | 'regime'>): string => {
    const profile = client.taxProfile;
    const frequency = profile?.ivaFrequency || (client.regime === TaxRegime.RimpeEmprendedor ? 'Semestral' : 'Mensual');
    
    if (frequency === 'Semestral') return 'Semestral';
    if (frequency === 'Ninguno' && profile?.requiresAnnualRenta) return 'Renta';
    if (profile?.hasActiveDevolucionIva) return 'Devolucion';
    return 'Mensual';
};

// buildCategory and isVipCategory helpers removed as logic is now direct

const TimelineActionButton = ({ icon: Icon, color, onClick, title }: { icon: any, color: string, onClick: () => void, title: string }) => (
    <button
        onClick={onClick}
        title={title}
        className={`p-2.5 rounded-xl ${color} hover:scale-110 active:scale-95 transition-all shadow-sm`}
    >
        <Icon size={16} />
    </button>
);

interface ClientDetailViewProps {
    client: Client;
    onSave: (updatedClient: Client) => void;
    onBack: () => void;
    serviceFees: ServiceFeesConfig;
    sriCredentials?: Record<string, string>;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = memo(({ client, onSave, onBack, serviceFees, sriCredentials }) => {
    if (!client) return <div className="p-10 text-center">No se ha seleccionado un cliente válido.</div>;

    const { toast } = useToast();
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    const { whatsappTemplates, setTasks, clients, cloudStatus, setCloudStatus, removeClient, updateClient } = useAppStore();
    const [editedClient, setEditedClient] = useState(client);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'vault' | 'settings'>('profile');
    const [vaultViewMode, setVaultViewMode] = useState<'gallery' | 'list' | 'table'>('gallery');

    const [obligation, setObligation] = useState(getStatusIndicator(client));

    const [monthlyFee, setMonthlyFee] = useState<string>(
        (client.taxProfile?.ivaFrequency === 'Semestral' 
            ? (client.fee_structure?.semestral ?? 10) 
            : (client.fee_structure?.monthly ?? 5)
        ).toString()
    );
    const [annualFee, setAnnualFee] = useState<string>((client.fee_structure?.annual ?? 10).toString());

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [signaturePasswordVisible, setSignaturePasswordVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
    const proofInputRef = useRef<HTMLInputElement>(null);
    const [uploadingTarget, setUploadingTarget] = useState<{ type: string; period?: string } | null>(null);
    const [activeSection, setActiveSection] = useState<'overview' | 'actions' | 'notes'>('overview');

    const [mismatchData, setMismatchData] = useState<{ ruc: string, name: string } | null>(null);

    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState('');
    const [confirmation, setConfirmation] = useState<{ action: 'declare' | 'pay'; period: string } | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<Declaration | null>(null);
    const [receiptData, setReceiptData] = useState<any | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isEditing && client) {
            setEditedClient(client);
            setObligation(getStatusIndicator(client));
            setMonthlyFee((client.taxProfile?.ivaFrequency === 'Semestral' 
                ? (client.fee_structure?.semestral ?? 10) 
                : (client.fee_structure?.monthly ?? 5)
            ).toString());
            setAnnualFee((client.fee_structure?.annual ?? 10).toString());
        }
    }, [client, isEditing]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { totalDebt, nextDeadline, lastActivityDate, primaryCommand, isFullyPaid, isFullyDeclared, complianceStats, isWorkOrder, isFullyAlDia } = useMemo(() => {
        if (!editedClient) return { totalDebt: 0, nextDeadline: null, lastActivityDate: null, primaryCommand: null, isFullyPaid: false, isFullyDeclared: false, complianceStats: null };

        const currentPeriod = getPeriod(editedClient, new Date());
        const decl = (editedClient.declarations || []).find(d => d.period === currentPeriod);

        const isIvaPaid = !!decl?.is_paid;
        const isIvaDeclared = !!decl?.proof_file || decl?.status === DeclarationStatus.Enviada || decl?.status === DeclarationStatus.Pagada;

        const currentYear = getYear(new Date());
        const needsRenta = editedClient.taxProfile?.requiresAnnualRenta ?? (editedClient.regime === TaxRegime.RimpeEmprendedor || editedClient.regime === TaxRegime.RimpeNegocioPopular);
        const rentaPeriod = (currentYear - 1).toString();
        const rentaDecl = (editedClient.declarations || []).find(d => d.period === rentaPeriod);

        const isRentaPaid = !!rentaDecl?.is_paid;
        const isRentaDeclared = (
            rentaDecl?.proof_file ||
            rentaDecl?.status === DeclarationStatus.Enviada ||
            rentaDecl?.status === DeclarationStatus.Pagada
        );

        const isIceOk = !editedClient.taxProfile?.requiresIce || (
            true // Enforced by general array going forward
        );
        const isPvpOk = !editedClient.taxProfile?.requiresAnexoPvp || (
            true // Handled generally
        );

        const fullyPaid = isIvaPaid && isRentaPaid && (!editedClient.taxProfile?.requiresIce || true) && (!editedClient.taxProfile?.requiresAnexoPvp || true);
        const fullyDeclared = isIvaDeclared && isRentaDeclared && isIceOk && isPvpOk;

        const pending = (editedClient.declarations || []).filter(d => !d.is_paid);
        let debt = pending.reduce((sum, d) => sum + (d.amount ?? getClientServiceFee(editedClient, serviceFees, d.period)), 0);

        // Add Renta debt if not paid and required
        const rentaFee = editedClient.fee_structure?.annual ?? 10;
        if (needsRenta && !isRentaPaid) {
            debt += rentaFee;
        }

        const sortedByPeriod = [...(editedClient.declarations || [])].sort((a, b) => a.period.localeCompare(b.period));
        const activeWorkflowDeclaration = sortedByPeriod.find(d => d.status === DeclarationStatus.Pendiente) ||
            sortedByPeriod.find(d => d.status === DeclarationStatus.Enviada && !d.is_paid) || null;

        let cmd = null;
        if (activeWorkflowDeclaration) {
            cmd = {
                type: 'iva',
                period: activeWorkflowDeclaration.period,
                title: `IVA ${formatPeriodForDisplay(activeWorkflowDeclaration.period)}`,
                isDeclared: activeWorkflowDeclaration.status === DeclarationStatus.Enviada || activeWorkflowDeclaration.status === DeclarationStatus.Pagada,
                is_paid: !!activeWorkflowDeclaration.is_paid,
                amount: activeWorkflowDeclaration.amount ?? getClientServiceFee(editedClient, serviceFees, activeWorkflowDeclaration.period)
            };
        }

        let nextIvaPeriod = getPeriod(editedClient, new Date());
        if (decl && decl.status === DeclarationStatus.Pagada) {
            nextIvaPeriod = getNextPeriod(nextIvaPeriod);
        }
        const ivaDeadline = getDueDateForPeriod(editedClient, nextIvaPeriod);

        let rentaTargetPeriod = rentaPeriod;
        const isCurrentRentaDone = isRentaPaid && (isRentaDeclared || (rentaDecl && rentaDecl.status === DeclarationStatus.Pagada));
        if (isCurrentRentaDone) {
            rentaTargetPeriod = currentYear.toString();
        }
        let rentaDeadline = getDueDateForPeriod(editedClient, rentaTargetPeriod);

        let nObligation = null;
        if (needsRenta && rentaDeadline && (!ivaDeadline || rentaDeadline.getTime() < ivaDeadline.getTime())) {
            nObligation = { dueDate: rentaDeadline, period: rentaTargetPeriod, type: 'renta' };
        } else if (ivaDeadline) {
            nObligation = { dueDate: ivaDeadline, period: nextIvaPeriod, type: 'iva' };
        }

        return {
            totalDebt: debt,
            nextDeadline: nObligation ? nObligation.dueDate : null,
            lastActivityDate: (editedClient.declarations && editedClient.declarations.length > 0) ? new Date(Math.max(...editedClient.declarations.map(d => new Date(d.updatedAt).getTime()))) : null,
            primaryCommand: cmd,
            isFullyPaid: fullyPaid,
            isFullyDeclared: fullyDeclared,
            complianceStats: {
                iva: { period: currentPeriod, isDeclared: isIvaDeclared, is_paid: isIvaPaid, needed: requiresIva(editedClient) },
                renta: { period: rentaPeriod, isDeclared: isRentaDeclared, is_paid: isRentaPaid, needed: needsRenta }
            },
            isWorkOrder: (!fullyDeclared && fullyPaid),
            isFullyAlDia: (fullyDeclared && fullyPaid)
        };
    }, [editedClient, serviceFees]);

    const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !uploadingTarget) return;

        setIsAnalyzingPdf(true);
        try {
            let extractedData: any = null;

            if (file.type === 'application/pdf') {
                try {
                    // Primero intentamos extraer datos de declaración (Form 104/102)
                    extractedData = await extractDataFromDeclarationPdf(file);

                    // Validación de RUC
                    if (extractedData.ruc && client.ruc && extractedData.ruc.trim() !== client.ruc.trim()) {
                        setMismatchData({ ruc: extractedData.ruc, name: "CONTRIBUYENTE EXTERNO" });
                        return;
                    }

                    // Validación de Periodo (si aplica)
                    if (uploadingTarget.period && extractedData.period && !extractedData.period.includes(uploadingTarget.period.substring(0, 4))) {
                        toast.warning(`El PDF parece ser del periodo ${extractedData.period}, pero intentas subirlo a ${uploadingTarget.period}`);
                    }
                } catch (e) {
                    // Si falla, intentamos la extracción general
                    const general = await extractDataFromSriPdf(file);
                    if (general.ruc && client.ruc && general.ruc.trim() !== client.ruc.trim()) {
                        setMismatchData({ ruc: general.ruc, name: general.apellidos_nombres });
                        return;
                    }
                }
            }

            const base64 = await fileToBase64(file);
            const storedFile: StoredFile = {
                name: file.name,
                type: file.type.includes('pdf') ? 'pdf' : 'other',
                size: file.size,
                lastModified: Date.now(),
                content: base64,
                metadata: extractedData ? {
                    amount: extractedData.amount,
                    period: extractedData.period,
                    formType: extractedData.formType,
                    sriId: extractedData.id
                } : undefined
            };

            let updatedClient = { ...editedClient };

            if (uploadingTarget.type === 'iva' && uploadingTarget.period) {
                const updatedHistory = [...(editedClient.declarations || [])];
                const idx = updatedHistory.findIndex(d => d.period === uploadingTarget.period);
                if (idx !== -1) {
                    updatedHistory[idx] = {
                        ...updatedHistory[idx],
                        proof_file: storedFile,
                        amount: extractedData?.amount || updatedHistory[idx].amount,
                        status: DeclarationStatus.Enviada,
                        updatedAt: new Date().toISOString(),
                        declaredAt: extractedData?.declarationDate // Guardamos la fecha del SRI
                    };
                } else {
                    updatedHistory.push({
                        period: uploadingTarget.period,
                        status: DeclarationStatus.Enviada,
                        is_paid: false,
                        updatedAt: new Date().toISOString(),
                        declaredAt: extractedData?.declarationDate,
                        proof_file: storedFile,
                        amount: extractedData?.amount
                    });
                }
                updatedClient.declarations = updatedHistory;
            } else if (uploadingTarget.type === 'renta') {
                const currentYear = getYear(new Date());
                const period = (currentYear - 1).toString();
                const updatedHistory = [...(editedClient.declarations || [])];
                const idx = updatedHistory.findIndex(d => d.period === period);
                if (idx !== -1) {
                    updatedHistory[idx] = { ...updatedHistory[idx], proof_file: storedFile, status: DeclarationStatus.Enviada, updatedAt: new Date().toISOString() };
                } else {
                    updatedHistory.push({ period, status: DeclarationStatus.Enviada, is_paid: false, proof_file: storedFile, updatedAt: new Date().toISOString() });
                }
                updatedClient.declarations = updatedHistory;
            } else if (uploadingTarget.type === 'devolucionRenta') {
                updatedClient.rentaRefundResolutionFile = storedFile;
                updatedClient.rentaRefundStatus = 'Completado';
                updatedClient.updatedAt = new Date().toISOString();
            } else if (uploadingTarget.type === 'devolucionIvaTerceraEdad') {
                updatedClient.elderlyDevolucionIvaResolutionFile = storedFile;
                updatedClient.elderlyDevolucionIvaStatus = 'Completado';
                updatedClient.updatedAt = new Date().toISOString();
            }

            setEditedClient(updatedClient);
            
            // CRITICAL: Explicitly set cloud status to saving before calling onSave
            // onSave (which calls updateClient) will handle the rest
            onSave(updatedClient);
            
            toast.success(extractedData ? `✅ Formulario ${extractedData.formType} validado y guardado.` : "Comprobante guardado.");
        } catch (error) {
            toast.error("Error al procesar el documento.");
            setCloudStatus('error');
        } finally {
            setIsAnalyzingPdf(false);
            setUploadingTarget(null);
            if (proofInputRef.current) proofInputRef.current.value = '';
        }
    };

    const handlePdfUpdate = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsAnalyzingPdf(true);
        try {
            const extracted = await extractDataFromSriPdf(file);
            if (extracted.ruc && client.ruc && extracted.ruc.trim() !== client.ruc.trim()) {
                setMismatchData({ ruc: extracted.ruc, name: extracted.apellidos_nombres });
                return;
            }
            const b64 = await fileToBase64(file);
            setEditedClient(prev => {
                const updatedData: Partial<Client> = {
                    name: extracted.apellidos_nombres || prev.name,
                    address: extracted.direccion || prev.address,
                    regime: extracted.regimen || prev.regime
                };
                if (extracted.isCertificate) {
                    updatedData.rucCertificate = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        lastModified: file.lastModified,
                        content: b64
                    };
                }
            const updatedClientFull = { ...prev, ...updatedData };
            onSave(updatedClientFull);
            return updatedClientFull;
        });
        toast.success(extracted.isCertificate ? "Certificado RUC validado y guardado." : "Información SRI validada.");
    } catch (error) { toast.error("Error al validar PDF."); }
    finally { setIsAnalyzingPdf(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
};

    const handleJumpToOwner = () => {
        if (!mismatchData) return;
        const owner = clients.find(c => c.ruc === mismatchData.ruc);
        if (owner) { onBack(); setTimeout(() => setMismatchData(null), 100); }
        else { toast.info("Cliente no existe."); setMismatchData(null); }
    };

    const handleSoftDelete = () => {
        updateClient(client.id, { isDeleted: true });
        toast.success(`${client.name} enviado a la papelera`);
        onBack();
    };

    const handleSave = () => {
        const recurringFee = parseFloat(monthlyFee) || (editedClient.taxProfile?.ivaFrequency === 'Semestral' ? 10 : 5);
        const aFeeValue = parseFloat(annualFee) || 10;
        
        const toSave = { 
            ...editedClient, 
            fee_structure: { 
                monthly: editedClient.taxProfile?.ivaFrequency === 'Semestral' ? (client.fee_structure?.monthly ?? 5) : recurringFee,
                semestral: editedClient.taxProfile?.ivaFrequency === 'Semestral' ? recurringFee : (client.fee_structure?.semestral ?? 10),
                annual: aFeeValue 
            } 
        };
        onSave(toSave);
        setIsEditing(false);
    };

    const handleConfirmAction = (sendWhatsApp: boolean = false) => {
        if (!confirmation) return;
        setIsProcessingAction(true);
        const { action, period } = confirmation;
        const now = new Date().toISOString();
        const updatedHistory = [...(editedClient.declarations || [])];
        const idx = updatedHistory.findIndex(d => d.period === period);
        if (idx === -1) {
            updatedHistory.push({ period, status: action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente, is_paid: action === 'pay', declaredAt: action === 'declare' ? now : undefined, paidAt: action === 'pay' ? now : undefined, updatedAt: now });
        } else {
            updatedHistory[idx] = { ...updatedHistory[idx], ...(action === 'declare' ? { status: DeclarationStatus.Enviada, declaredAt: now } : {}), ...(action === 'pay' ? { is_paid: true, paidAt: now } : {}), updatedAt: now };
        }
        const updatedClient = { ...editedClient, declarations: updatedHistory };
        setEditedClient(updatedClient);
        onSave(updatedClient);
        setTimeout(() => {
            if (action === 'pay') {
                const updatedDeclaration = updatedHistory.find(d => d.period === period);
                if (updatedDeclaration) handleShowReceipt(updatedDeclaration);
            }
            setIsProcessingAction(false);
            setConfirmation(null);
            toast.success(action === 'declare' ? 'Declaración registrada' : 'Pago registrado');
        }, 500);
    };

    const handleExtraAction = (type: 'renta' | 'anexo' | 'devolucion', action: 'declare' | 'pay') => {
        let updated = { ...editedClient };
        if (type === 'renta') {
            const currentYear = getYear(new Date());
            const period = (currentYear - 1).toString();
            const updatedHistory = [...(updated.declarations || [])];
            const idx = updatedHistory.findIndex(d => d.period === period);
            if (idx === -1) {
                updatedHistory.push({
                    period,
                    status: action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente,
                    is_paid: action === 'pay',
                    updatedAt: new Date().toISOString()
                });
            } else {
                if (action === 'declare') updatedHistory[idx].status = DeclarationStatus.Enviada;
                if (action === 'pay') updatedHistory[idx].is_paid = true;
                updatedHistory[idx].updatedAt = new Date().toISOString();
            }
            updated.declarations = updatedHistory;
        }
        setEditedClient(updated);
        onSave(updated);
        toast.success("Estado actualizado.");
    };

    const handleRentaRefundAction = (action: 'start' | 'message_received' | 'confirm' | 'pay' | 'revert_pay' | 'complete' | 'cancel') => {
        let updated = { ...editedClient };
        const now = new Date().toISOString();
        
        if (action === 'start') {
            updated.rentaRefundStatus = 'Solicitado';
            updated.rentaRefundRequestedAt = now;
        } else if (action === 'message_received') {
            updated.rentaRefundStatus = 'Esperando Confirmación';
            updated.rentaRefundConfirmationStartedAt = now;
            updated.rentaRefundConfirmationDeadline = addDays(new Date(), 2).toISOString();
        } else if (action === 'confirm') {
            updated.rentaRefundStatus = 'Confirmado';
        } else if (action === 'pay') {
            updated.rentaRefundPaid = true;
        } else if (action === 'revert_pay') {
            updated.rentaRefundPaid = false;
        } else if (action === 'complete') {
            updated.rentaRefundStatus = 'Completado';
        } else if (action === 'cancel') {
            updated.rentaRefundStatus = 'Cancelado';
        }
        
        setEditedClient(updated);
        onSave(updated);
        toast.success(`Trámite de devolución Renta: ${action === 'confirm' ? 'Confirmado' : action.replace('_', ' ')}`);
    };

    const handleElderlyRefundAction = (action: 'start' | 'process' | 'complete' | 'cancel') => {
        let updated = { ...editedClient };
        
        if (action === 'start') {
            updated.elderlyDevolucionIvaStatus = 'Pendiente';
        } else if (action === 'process') {
            updated.elderlyDevolucionIvaStatus = 'En Proceso';
        } else if (action === 'complete') {
            updated.elderlyDevolucionIvaStatus = 'Completado';
        } else if (action === 'cancel') {
            updated.elderlyDevolucionIvaStatus = 'Pendiente';
        }
        
        setEditedClient(updated);
        onSave(updated);
        toast.success(`Trámite T.EDAD: ${updated.elderlyDevolucionIvaStatus}`);
    };

    const handleQuickPay = (period: string) => setConfirmation({ action: 'pay', period });

    const handleShowReceipt = (declaration: Declaration) => {
        const fee = declaration.amount ?? getClientServiceFee(client, serviceFees, declaration.period);
        setReceiptData({ transactionId: declaration.transactionId || `MAN-${declaration.period.replace('-', '')}`, clientName: client.name, clientRuc: client.ruc, client: client, paymentDate: safeFormat(declaration.paidAt || declaration.updatedAt, 'dd MMMM yyyy, HH:mm'), paidPeriods: [{ period: declaration.period, amount: fee }], totalAmount: fee });
        setIsReceiptModalOpen(true);
    };

    const handleRevertPayment = (period: string) => {
        const updatedHistory = (editedClient.declarations || []).map(dec => dec.period === period ? { ...dec, status: DeclarationStatus.Enviada, paidAt: undefined, is_paid: false, updatedAt: new Date().toISOString() } : dec);
        onSave({ ...editedClient, declarations: updatedHistory });
    };

    const handlePrintReceipt = () => {
        const content = receiptRef.current?.innerHTML;
        if (content) {
            const win = window.open('', '_blank');
            win?.document.write(`<html><body onload="window.print()">${content}</body></html>`);
            win?.document.close();
        }
    };

    const copyReceiptToClipboard = () => {
        if (receiptData) {
            const text = `RECIBO: ${receiptData.transactionId}\nCliente: ${receiptData.clientName}\nTotal: $${receiptData.totalAmount.toFixed(2)}`;
            navigator.clipboard.writeText(text);
            toast.success("Copiado.");
        }
    };

    const handleWhatsApp = () => {
        if (client.phones?.length) {
            window.open(getWhatsAppUrl(client.phones[0]), '_blank');
        }
    };

    const handleOpenSRI = () => window.open("https://srienlinea.sri.gob.ec/", "_blank");

    const handleShareViaWhatsApp = () => {
        if (!client.phones?.length || !client.sharedAccessKey) return;
        const msg = `Acceso a Bóveda: https://portal.santiagocordova.com/client/${client.id}?token=${client.sharedAccessKey}`;
        window.open(getWhatsAppUrl(client.phones[0], msg), "_blank");
    };


    const handleWhatsAppPaymentRequest = (period: string, type: string) => {
        const fee = getClientServiceFee(client, serviceFees, period);
        const greeting = new Date().getHours() < 12 ? 'Buenos días' : 'Buenas tardes';
        const name = client.name.split(' ')[0];
        const formattedPeriod = formatPeriodForDisplay(period);
        const message = `${greeting} ${name} 👋. Le saludo de SantiagoCordova.com. Le informo que su obligación de ${type} correspondiente a ${formattedPeriod} ya ha sido procesada con éxito en el SRI.\n\nEl valor total de honorarios es de $${fee.toFixed(2)}. Puede realizar el pago por transferencia o depósito.\n\n¡Muchas gracias!`;
        window.open(getWhatsAppUrl(client.phones[0], message), "_blank");
    };

    const renderProfileTab = () => (
        <ProfileTab
            client={client}
            editedClient={editedClient}
            setEditedClient={setEditedClient}
            isEditing={isEditing}
            isFullyAlDia={isFullyAlDia}
            complianceStats={complianceStats}
            serviceFees={serviceFees}
            setConfirmation={setConfirmation}
            handleQuickPay={handleQuickPay}
            setUploadingTarget={setUploadingTarget}
            proofInputRef={proofInputRef}
            setActiveTab={setActiveTab}
            handleWhatsApp={handleWhatsApp}
            handleOpenSRI={handleOpenSRI}
            handleShareViaWhatsApp={handleShareViaWhatsApp}
            passwordVisible={passwordVisible}
            setPasswordVisible={setPasswordVisible}
            handleExtraAction={handleExtraAction}
            handleRentaRefundAction={handleRentaRefundAction}
            handleElderlyRefundAction={handleElderlyRefundAction}
        />
    );

    const handleDownload = (decl: Declaration) => {
        if (!decl.proof_file?.content) return;
        const link = document.createElement('a');
        link.href = decl.proof_file.content;
        link.download = decl.proof_file.name;
        link.click();
    };

    const renderHistoryTab = () => (
        <HistoryTab
            client={client}
            editedClient={editedClient}
            setPreviewItem={setPreviewItem}
            handleDownload={handleDownload}
            handleWhatsAppPaymentRequest={handleWhatsAppPaymentRequest}
            handleShowReceipt={handleShowReceipt}
            handleRevertPayment={handleRevertPayment}
            setConfirmation={setConfirmation}
            handleQuickPay={handleQuickPay}
            setUploadingTarget={setUploadingTarget}
            proofInputRef={proofInputRef}
        />
    );

    const renderVaultTab = () => (
        <VaultTab
            client={client}
            editedClient={editedClient}
            setEditedClient={setEditedClient}
            isEditing={isEditing}
            vaultViewMode={vaultViewMode}
            setVaultViewMode={setVaultViewMode}
            setUploadingTarget={setUploadingTarget}
            proofInputRef={proofInputRef}
            setPreviewItem={setPreviewItem}
            notes={client.structuredNotes || []}
        />
    );

    const renderSettingsTab = () => (
        <SettingsTab
            client={client}
            editedClient={editedClient}
            setEditedClient={setEditedClient}
            isEditing={isEditing}
        />
    );

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-8 bg-slate-100/40 backdrop-blur-3xl overflow-hidden animate-in fade-in duration-700">
            <div className="bg-slate-50 w-full h-full md:max-h-[92vh] md:max-w-7xl md:rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] flex flex-col relative overflow-hidden group/modal">
                
                {/* DYNAMIC ISLAND - The Central Command Dock (Viewport Fixed) */}
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-20 duration-1000 pointer-events-none w-full max-w-fit px-4">
                    <div className="flex items-center gap-1 p-1 bg-white/90 backdrop-blur-[40px] border border-slate-200 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] pointer-events-auto ring-1 ring-black/[0.05]">
                        {(['profile', 'history', 'vault', 'settings'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`group relative flex items-center gap-3 px-6 py-4 rounded-[2rem] transition-all duration-700 overflow-hidden ${
                                    activeTab === tab 
                                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 scale-[1.08] -translate-y-1' 
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                <div className="relative z-10 flex items-center gap-3">
                                    {tab === 'profile' && <LayoutDashboard size={16} className={`transition-all duration-700 ${activeTab === tab ? 'rotate-0' : 'group-hover:rotate-12 group-hover:scale-110'}`} />}
                                    {tab === 'history' && <Activity size={16} className={`transition-all duration-700 ${activeTab === tab ? 'scale-110' : 'group-hover:scale-125'}`} />}
                                    {tab === 'vault' && <Lock size={16} className={`transition-all duration-700 ${activeTab === tab ? 'scale-110' : 'group-hover:-translate-y-0.5'}`} />}
                                    {tab === 'settings' && <Settings size={16} className={`transition-all duration-700 ${activeTab === tab ? 'rotate-0' : 'group-hover:rotate-90 group-hover:scale-110'}`} />}
                                    
                                    <span className={`text-[11px] font-black uppercase tracking-[0.25em] font-premium transition-all duration-700 ${
                                        activeTab === tab ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0 md:opacity-100 md:max-w-[150px] overflow-hidden'
                                    }`}>
                                        {tab === 'profile' ? 'Táctico' : tab === 'history' ? 'Operativas' : tab === 'vault' ? 'Bóveda' : 'Sistemas'}
                                    </span>
                                </div>
                                {activeTab === tab && (
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent,rgba(255,255,255,0.1),transparent)] animate-shine"></div>
                                )}
                            </button>
                        ))}
                        
                        <div className="w-[1px] h-8 bg-slate-200 mx-3 hidden md:block"></div>
                        
                        <button 
                            onClick={onBack}
                            className="hidden md:flex items-center gap-3 px-6 py-4 text-slate-400 hover:text-rose-500 transition-all duration-500 group rounded-[2rem] hover:bg-rose-50"
                            title="Regresar al Directorio"
                        >
                            <X size={16} className="group-hover:rotate-90 transition-transform duration-700" />
                            <span className="text-[11px] font-black uppercase tracking-[0.25em] font-premium">Salir</span>
                        </button>
                    </div>
                </div>

                <button onClick={onBack} className="absolute top-8 right-8 z-50 p-4 bg-white/80 backdrop-blur-xl border border-slate-100 text-slate-400 hover:text-blue-600 rounded-2xl transition-all md:flex hidden hover:scale-110 active:scale-90 group/close shadow-xl hover:border-blue-500/30">
                    <X size={24} className="group-hover:rotate-90 transition-transform duration-700" />
                </button>

                <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative">
                    <div className="p-5 sm:p-14 pb-40 relative z-10">
                        <ClientHeader
                            client={client}
                            onBack={onBack}
                            totalDebt={totalDebt}
                            isFullyPaid={isFullyPaid}
                            isFullyDeclared={isFullyDeclared}
                            complianceStats={complianceStats}
                            isEditing={isEditing}
                            onToggleEdit={() => isEditing ? handleSave() : setIsEditing(true)}
                            editedClient={editedClient}
                            setEditedClient={setEditedClient}
                            onCopy={handleCopy}
                            onWhatsApp={handleWhatsApp}
                            onOpenSRI={handleOpenSRI}
                            onShare={handleShareViaWhatsApp}
                            onDelete={() => setIsDeleteConfirmOpen(true)}
                            nextDeadline={nextDeadline}
                        />

                        {/* Main Tactical Viewport */}
                        <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 min-h-[700px] relative z-10">
                            {activeTab === 'profile' && renderProfileTab()}
                            {activeTab === 'history' && renderHistoryTab()}
                            {activeTab === 'vault' && renderVaultTab()}
                            {activeTab === 'settings' && renderSettingsTab()}
                        </div>
                    </div>
                </div>

                {/* Tactical Footer Action Bar - Integrated into context */}
                <div className={`flex-none p-8 md:px-14 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center transition-all duration-700 ${isEditing ? 'opacity-100 translate-y-0 h-auto visible' : 'opacity-0 translate-y-full h-0 invisible'}`}>
                    <div className="flex items-center gap-6">
                        <SidebarAction icon={Download} label="Exportar Dossier" onClick={() => toast.info('Generando Reporte Elite...')} />
                        <div className="hidden lg:flex items-center gap-3 border-l border-slate-100 pl-8 opacity-40 select-none">
                            <span className="text-[10px] font-black tracking-[0.5em] text-slate-400 font-premium uppercase">CONTROL DE MISIÓN v4.0</span>
                        </div>
                    </div>
                    <div className="flex gap-5">
                        <button onClick={() => !isAnalyzingPdf && fileInputRef.current?.click()} className="px-6 py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl border border-blue-100 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-all shadow-sm">
                            {isAnalyzingPdf ? <Loader size={14} className="animate-spin" /> : <ScanLine size={16} />}
                            <span>MÓDULO SCANNER</span>
                        </button>
                        <button onClick={() => setIsEditing(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 hover:text-slate-900 transition-all rounded-2xl">ABORTAR</button>
                        <button onClick={handleSave} className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95">GUARDAR DATOS</button>
                    </div>
                </div>
                <input type="file" ref={proofInputRef} className="hidden" onChange={handleProofUpload} accept=".pdf,image/*" />
                <input type="file" ref={fileInputRef} className="hidden" onChange={handlePdfUpdate} accept=".pdf" />

                <PdfPreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    declaration={previewItem}
                    client={client}
                    onDownload={() => previewItem && handleDownload(previewItem)}
                />

                <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} title="Confirmar Acción">
                    <div className="p-6 text-center">
                        <p className="mb-6">¿Proceder con {confirmation?.action === 'declare' ? 'declaración' : 'pago'} de {confirmation ? formatPeriodForDisplay(confirmation.period) : ''}?</p>
                        <button onClick={() => handleConfirmAction(false)} className="w-full py-4 bg-brand-navy text-white font-semibold rounded-2xl text-xs uppercase tracking-widest">Confirmar</button>
                    </div>
                </Modal>
                <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Recibo">
                    {receiptData && (
                        <div className="p-4 bg-white rounded-xl">
                            <div ref={receiptRef} className="text-center font-mono text-sm space-y-3 mb-6">
                                <h3 className="font-medium">RECIBO</h3>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p>{receiptData.clientName}</p>
                                    <p className="font-medium text-lg">${receiptData.totalAmount.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handlePrintReceipt} className="flex-1 bg-brand-navy text-white py-3 rounded-xl font-medium">Imprimir</button>
                                <button onClick={copyReceiptToClipboard} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium">Copiar</button>
                            </div>
                        </div>
                    )}
                </Modal>
                <Modal isOpen={!!mismatchData} onClose={() => setMismatchData(null)} title="RUC Erróneo">
                    <div className="text-center p-4">
                        <p>El RUC no coincide con {client.name}.</p>
                        <button onClick={handleJumpToOwner} className="w-full py-4 bg-brand-navy text-white font-semibold rounded-2xl mt-4">Ver Ficha Correcta</button>
                    </div>
                </Modal>

                {/* Modal confirmación de papelera */}
                <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Enviar a Papelera">
                    <div className="p-6 text-center space-y-6">
                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-500/20">
                            <Trash2 size={28} className="text-rose-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">{client.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                Este cliente se moverá a la papelera. Podrás restaurarlo desde la pestaña <strong>Papelera</strong> en el directorio de clientes.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-surface-low/50 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-surface-low transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSoftDelete}
                                className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} strokeWidth={2.5} />
                                Enviar a Papelera
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
});