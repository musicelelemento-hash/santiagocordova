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
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History as HistoryIcon, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download, ScanLine, FilePlus, Power, FileCheck, Coins, BadgePercent, Play, Settings, FileDown, TrendingUp,
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
import { FacturadorCard } from './ClientDetail/FacturadorCard';
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
    while (periods.length < count && client.regime === TaxRegime.RimpeNegocioPopular) {
        const period = getPeriod(client, currentDate);
        if (!periods.includes(period)) { periods.push(period); }
        currentDate = subYears(currentDate, 1);
    }
    return periods.slice(0, count).reverse();
};

const getStatusIndicator = (client: Pick<Client, 'taxProfile' | 'regime'>): string => {
    if (client.regime === TaxRegime.RimpeEmprendedor) return 'Semestral';
    const profile = client.taxProfile;
    if (!profile) return 'Mensual';
    if (profile.ivaFrequency === 'Mensual' && !profile.hasActiveDevolucionIva) return 'Mensual';
    if (profile.ivaFrequency === 'Semestral') return 'Semestral';
    if (profile.ivaFrequency === 'Ninguno' && profile.requiresAnnualRenta) return 'Renta';
    if (profile.hasActiveDevolucionIva) return 'Devolucion';
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

    const { whatsappTemplates, setTasks, clients, cloudStatus, setCloudStatus } = useAppStore();
    const [editedClient, setEditedClient] = useState(client);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'vault' | 'settings'>('profile');

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
                return { ...prev, ...updatedData };
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
        <div className="space-y-6 sm:space-y-16 animate-in fade-in slide-in-from-bottom-10 h-full duration-1000">
            {/* The Tactical Main View: Grid Architecture (Alpha + Beta) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-16">
                
                {/* Sector Alfa: Compliance Intelligence (8/12) */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-16">
                    
                    {/* High-Impact Compliance Score - THE KPI HERO */}
                    <div className="bg-surface-lowest rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-16 relative overflow-hidden shadow-architect border border-surface-low group">
                        {/* Dynamic Background Mesh */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary-rgb),0.03),transparent_70%)]"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8 sm:gap-12">
                            <div className="space-y-8 sm:space-y-10 group-hover:translate-x-3 transition-transform duration-1000">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                        <h2 className="text-sm font-black text-on-surface uppercase tracking-[0.5em] font-premium">DIRECTIVA DE CUMPLIMIENTO</h2>
                                    </div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium opacity-40">FISCAL SCORE & RISK CONTROL v2.1</p>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-baseline gap-4">
                                        <span className="text-4xl sm:text-6xl font-black text-primary tracking-tighter transition-all duration-700 font-premium group-hover:scale-105 active:opacity-40 select-none">
                                            {isFullyAlDia ? 100 : 88}<span className="text-2xl sm:text-4xl ml-1 sm:ml-2">%</span>
                                        </span>
                                        <div className="h-0.5 flex-grow max-w-[60px] sm:max-w-[80px] bg-primary/20 rounded-full mb-3 sm:mb-8"></div>
                                    </div>
                                    <p className="text-[9px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-[0.3em] sm:tracking-[0.4em] font-premium">REPUTACIÓN FISCAL ÓPTIMA</p>
                                </div>
                            </div>

                            <div className="relative flex justify-center text-center">
                                <span className={`absolute -top-10 sm:-top-20 left-1/2 -translate-x-1/2 text-[80px] sm:text-[150px] lg:text-[200px] font-black leading-none tracking-tighter opacity-5 transition-all duration-1000 group-hover:scale-125 select-none font-premium ${isFullyAlDia ? 'text-tertiary' : 'text-primary'}`}>
                                    {isFullyAlDia ? 'A+' : 'A'}
                                </span>
                                <div className="relative z-10 space-y-4">
                                    <div className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-0 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl font-premium backdrop-blur-xl ${isFullyAlDia ? 'bg-tertiary/10 text-tertiary shadow-tertiary/10 border border-tertiary/20' : 'bg-primary text-on-primary shadow-primary/20'}`}>
                                        {isFullyAlDia ? 'COMPLIANCE VERIFIED' : 'ACTION REQUIRED'}
                                    </div>
                                    <div className="flex items-center justify-center gap-3 text-on-surface-variant/40">
                                        <TrendingUp size={16} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest font-premium">PROYECCIÓN POSITIVA</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tactical Executive Dashboard */}
                    <div className="space-y-6 sm:space-y-10 group/executive">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] sm:text-[11px] font-black text-on-surface-variant uppercase tracking-[0.25em] sm:tracking-[0.3em] font-premium relative flex items-center gap-3 sm:gap-4">
                                OBLIGACIONES EJECUTIVAS
                                <div className="h-[1px] w-8 sm:w-12 bg-on-surface-variant/10"></div>
                            </h3>
                            <button onClick={() => setActiveTab('history')} className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-[0.15em] hover:tracking-[0.25em] transition-all font-premium">HISTORIAL</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                            {/* IVA Obligation Vector */}
                            {complianceStats?.iva.needed && (
                                <TaxObligationCard
                                    type="iva"
                                    title="IMPUESTO AL VALOR AGREGADO (IVA)"
                                    period={complianceStats.iva.period}
                                    isDeclared={complianceStats.iva.isDeclared}
                                    isPaid={complianceStats.iva.is_paid}
                                    amount={getClientServiceFee(client, serviceFees, complianceStats.iva.period)}
                                    dueDate={getDueDateForPeriod(client, complianceStats.iva.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.iva.period })}
                                    onPay={() => handleQuickPay(complianceStats.iva.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'iva', period: complianceStats.iva.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* RENTA Obligation Vector */}
                            {complianceStats?.renta.needed && (
                                <TaxObligationCard
                                    type="renta"
                                    title="IMPUESTO A LA RENTA (ANUAL)"
                                    period={complianceStats.renta.period}
                                    isDeclared={complianceStats.renta.isDeclared}
                                    isPaid={complianceStats.renta.is_paid}
                                    amount={editedClient.fee_structure?.annual ?? 10}
                                    dueDate={getDueDateForPeriod(client, complianceStats.renta.period) || undefined}
                                    onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats.renta.period })}
                                    onPay={() => handleQuickPay(complianceStats.renta.period)}
                                    onUpload={() => { setUploadingTarget({ type: 'renta', period: complianceStats.renta.period }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {/* Special Vectors: Refunds */}
                            {editedClient.taxProfile?.hasActiveDevolucionIva && (
                                <TaxObligationCard
                                    type="refund"
                                    title="DEVOLUCIÓN IVA (TERCERA EDAD)"
                                    status={editedClient.elderlyDevolucionIvaStatus as any}
                                    resolutionFile={editedClient.elderlyDevolucionIvaResolutionFile}
                                    onAction={handleElderlyRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionIvaTerceraEdad' }); proofInputRef.current?.click(); }}
                                />
                            )}

                            {editedClient.taxProfile?.requiresAnnualRenta && editedClient.rentaRefundStatus && (
                                <TaxObligationCard
                                    type="renta_refund"
                                    title="DEVOLUCIÓN IMPUESTO RENTA"
                                    status={editedClient.rentaRefundStatus as any}
                                    isPaid={editedClient.rentaRefundPaid}
                                    onAction={handleRentaRefundAction}
                                    onUpload={() => { setUploadingTarget({ type: 'devolucionRenta' }); proofInputRef.current?.click(); }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Analytics Integration */}
                    <div className="bg-surface-lowest rounded-[3rem] sm:rounded-[3.5rem] p-6 sm:p-10 border border-surface-low shadow-architect overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 sm:p-8">
                            <Activity size={24} className="text-primary/20" />
                        </div>
                        <div className="flex items-center gap-4 mb-6 sm:mb-10">
                            <h3 className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium">ANALÍTICA DE HONORARIOS</h3>
                        </div>
                        <PaymentHistoryChart client={client} />
                    </div>
                </div>

                {/* Sector Beta: Tactical Vault & Data (4/12) */}
                <div className="lg:col-span-4 space-y-6 sm:space-y-12">
                    
                    {/* Tactical Access Card */}
                    <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low shadow-architect relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:opacity-40 transition-all duration-1000 group-hover:scale-110 group-hover:-rotate-12">
                            <Key size={48} className="text-secondary" />
                        </div>
                        
                        <div className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-12 relative z-10">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[1.2rem] sm:rounded-[1.5rem] bg-secondary-fixed/10 flex items-center justify-center text-secondary shadow-inner">
                                <Lock size={20} className="sm:w-[24px] sm:h-[24px]" />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black text-on-surface uppercase tracking-[0.2em] font-premium">BÓVEDA TÁCTICA</h3>
                                <p className="text-[8px] sm:text-[9px] font-black text-on-surface-variant/60 uppercase tracking-[0.3em] mt-1 font-premium">CREDENTIAL SECURITY MGR</p>
                            </div>
                        </div>

                        <div className="space-y-5 sm:space-y-6 relative z-10">
                            <div className="p-6 sm:p-8 bg-surface rounded-[1.5rem] sm:rounded-[2rem] border border-surface-low group/pass shadow-sm hover:border-primary/30 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-[8px] sm:text-[9px] font-black text-on-surface-variant uppercase tracking-[0.3em] font-premium">CLAVE PORTAL SRI</div>
                                    <div className="p-1 px-2.5 bg-primary/10 rounded-full text-[8px] font-black text-primary uppercase tracking-widest font-premium animate-pulse">ENCRIPTADO</div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <code className="text-base sm:text-lg font-black tracking-[0.2em] sm:tracking-[0.3em] text-primary font-premium selection:bg-primary selection:text-white truncate pr-4">
                                        {passwordVisible ? client.sriPassword : '••••••••••••'}
                                    </code>
                                    <button 
                                        onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="p-2 sm:p-3 hover:bg-primary/10 rounded-xl text-on-surface-variant hover:text-primary transition-all active:scale-90"
                                        title={passwordVisible ? "Ocultar" : "Mostrar"}
                                    >
                                        {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:gap-5">
                                <button 
                                    onClick={handleOpenSRI}
                                    className="flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 bg-surface hover:bg-primary/5 border border-surface-low hover:border-primary/20 rounded-[2rem] sm:rounded-[2.5rem] transition-all group/btn shadow-sm active:scale-95"
                                >
                                    <Globe size={20} className="sm:w-[24px] sm:h-[24px] text-primary group-hover/btn:scale-125 transition-all duration-700" />
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-variant group-hover/btn:text-primary uppercase tracking-[0.2em] font-premium">LOG-IN SRI</span>
                                </button>
                                <button 
                                    onClick={handleShareViaWhatsApp}
                                    className="flex flex-col items-center gap-3 sm:gap-4 p-6 sm:p-8 bg-surface hover:bg-tertiary-fixed/10 border border-surface-low hover:border-tertiary/20 rounded-[2rem] sm:rounded-[2.5rem] transition-all group/btn shadow-sm active:scale-95"
                                >
                                    <Share2 size={20} className="sm:w-[24px] sm:h-[24px] text-tertiary group-hover/btn:scale-125 transition-all duration-700" />
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-variant group-hover/btn:text-tertiary uppercase tracking-[0.2em] font-premium">DIFUNDIR</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Facturador Intelligence */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                        <FacturadorCard 
                            config={editedClient.facturadorConfig || {}} 
                            isEditing={isEditing}
                            onChange={(config) => setEditedClient({ ...editedClient, facturadorConfig: config })}
                        />
                    </div>

                    {/* Operational Commands */}
                    <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low shadow-architect space-y-6 sm:space-y-10 group overflow-hidden relative">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                        <h3 className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-[0.4em] font-premium relative z-10">COMANDOS OPERACIONALES</h3>
                        
                        <div className="space-y-3 sm:space-y-5 relative z-10">
                            <button onClick={handleWhatsApp} className="w-full flex items-center justify-between p-4 sm:p-7 bg-surface hover:bg-primary/5 border border-surface-low hover:border-primary/10 rounded-2xl sm:rounded-[2rem] transition-all group/opt shadow-sm active:scale-[0.98]">
                                <div className="flex items-center gap-3 sm:gap-5">
                                    <div className="p-2 sm:p-4 bg-primary/10 rounded-xl sm:rounded-2xl text-primary group-hover/opt:rotate-12 transition-transform">
                                        <MessageCircle size={18} className="sm:w-[20px] sm:h-[20px]" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] sm:text-xs font-black text-on-surface uppercase tracking-widest font-premium">ENLACE WHATSAPP</div>
                                        <div className="text-[7px] sm:text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 sm:mt-1.5 font-premium opacity-60">COMUNICACIÓN DIRECTA</div>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] text-on-surface-variant/40 group-hover/opt:translate-x-3 group-hover/opt:text-primary transition-all duration-500" />
                            </button>

                            <button onClick={() => setActiveTab('settings')} className="w-full flex items-center justify-between p-4 sm:p-7 bg-surface hover:bg-secondary/5 border border-surface-low hover:border-secondary/10 rounded-2xl sm:rounded-[2rem] transition-all group/opt shadow-sm active:scale-[0.98]">
                                <div className="flex items-center gap-3 sm:gap-5">
                                    <div className="p-2 sm:p-4 bg-secondary/10 rounded-xl sm:rounded-2xl text-secondary group-hover/opt:rotate-[30deg] transition-transform">
                                        <Settings size={18} className="sm:w-[20px] sm:h-[20px]" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] sm:text-xs font-black text-on-surface uppercase tracking-widest font-premium">PARAMETRÍA TÉCNICA</div>
                                        <div className="text-[7px] sm:text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 sm:mt-1.5 font-premium opacity-60">ESTRUCTURACIÓN FISCAL</div>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] text-on-surface-variant/40 group-hover/opt:translate-x-3 group-hover/opt:text-secondary transition-all duration-500" />
                            </button>
                        </div>
                    </div>

                    {/* Executive Notes */}
                    <ClientNotes 
                        clientId={client.id} 
                        notes={client.structuredNotes || []} 
                    />
                </div>
            </div>
        </div>
    );

    const handleDownload = (decl: Declaration) => {
        if (!decl.proof_file?.content) return;
        const link = document.createElement('a');
        link.href = decl.proof_file.content;
        link.download = decl.proof_file.name;
        link.click();
    };

    const renderHistoryTab = () => (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="bg-surface-lowest rounded-[3rem] p-10 shadow-architect relative overflow-hidden group border border-surface-low">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h3 className="text-xl font-extrabold text-on-surface tracking-tight uppercase flex items-center gap-4 font-premium">
                            <Activity className="text-primary" size={24} />
                            REGISTRO OPERATIVO
                        </h3>
                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mt-3 font-premium">TRAZABILIDAD DE ACCIONES Y VALIDACIONES</p>
                    </div>
                </div>

                <DocumentTimeline
                    client={client}
                    onViewPreview={(decl) => setPreviewItem(decl)}
                    onDownload={handleDownload}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>
            
            <div className="bg-surface-lowest rounded-[3rem] p-10 shadow-architect relative overflow-hidden group border border-surface-low">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-base font-extrabold text-on-surface tracking-tight uppercase flex items-center gap-3 font-premium">
                        <FileClock className="text-tertiary" size={20} />
                        Resumen de Declaraciones
                    </h3>
                </div>

                <DeclarationHistoryTable
                    client={client}
                    history={editedClient.declarations || []}
                    onShowReceipt={handleShowReceipt}
                    onRevertPayment={handleRevertPayment}
                    onDeclare={(period) => setConfirmation({ action: 'declare', period })}
                    onPay={handleQuickPay}
                    onUpload={(p) => { setUploadingTarget({ type: 'iva', period: p }); proofInputRef.current?.click(); }}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>
        </div>
    );

    const renderVaultTab = () => (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <VaultCard icon={ScanLine} label="Certificado RUC" file={editedClient.rucCertificate} onUpload={(f) => setEditedClient({ ...editedClient, rucCertificate: f })} />
                <VaultCard icon={FileText} label="Otros RUC PDF" file={editedClient.rucPdf} onUpload={(f) => setEditedClient({ ...editedClient, rucPdf: f })} />
                <VaultCard icon={FileKey} label="Firma Electrónica" file={editedClient.signatureFile} onUpload={(f) => setEditedClient({ ...editedClient, signatureFile: f })} />
                {editedClient.rentaRefundResolutionFile && (
                    <VaultCard icon={ShieldCheck} label="Resolución Renta" file={editedClient.rentaRefundResolutionFile} onUpload={(f) => setEditedClient({ ...editedClient, rentaRefundResolutionFile: f })} />
                )}
                {editedClient.elderlyDevolucionIvaResolutionFile && (
                    <VaultCard icon={ShieldCheck} label="Resolución T.EDAD" file={editedClient.elderlyDevolucionIvaResolutionFile} onUpload={(f) => setEditedClient({ ...editedClient, elderlyDevolucionIvaResolutionFile: f })} />
                )}
                <VaultCard icon={Smartphone} label="Clave SRI" file={undefined} isPassword value={client.sriPassword} />
            </div>

            <FacturadorCard 
                config={editedClient.facturadorConfig} 
                isEditing={isEditing} 
                onChange={(config) => setEditedClient({ ...editedClient, facturadorConfig: config })} 
            />

            <div className="bg-surface-lowest rounded-[3rem] p-10 border border-surface-low relative overflow-hidden group shadow-architect">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h3 className="text-xl font-extrabold text-on-surface tracking-tight uppercase flex items-center gap-4 font-premium">
                            <Store className="text-primary" size={24} />
                            Repositorio de Documentos
                        </h3>
                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mt-3 font-premium">Gestión centralizada de archivos y comprobantes</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-6 py-3 bg-surface rounded-2xl text-[9px] font-black text-tertiary flex items-center gap-3 shadow-architect-low uppercase tracking-[0.2em] font-premium">
                            <div className="w-2 h-2 bg-tertiary rounded-full animate-pulse"></div>
                            {(client.declarations || []).filter(d => d.proof_file).length} Archivos Protegidos
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    <button
                        onClick={() => { setUploadingTarget({ type: 'iva', period: getPeriod(client, new Date()) }); proofInputRef.current?.click(); }}
                        className="aspect-square rounded-[2.5rem] border-2 border-dashed border-surface-low flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden architect-layer-2 shadow-sm"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center group-hover:scale-110 transition-transform shadow-architect relative z-10">
                            <Plus className="text-on-surface-variant group-hover:text-primary" size={32} />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase text-on-surface-variant group-hover:text-primary tracking-widest relative z-10 font-premium">Subir Documento</span>
                    </button>

                    {[...(client.declarations || [])]
                        .filter(d => d.proof_file)
                        .sort((a, b) => b.period.localeCompare(a.period))
                        .map((decl, idx) => (
                            <div key={idx} className="bg-surface rounded-[2.5rem] p-5 shadow-architect-low hover:scale-[1.02] hover:shadow-architect transition-all cursor-pointer group relative overflow-hidden" onClick={() => setPreviewItem(decl)}>
                                <div className="aspect-[4/3] rounded-2xl bg-surface-lowest mb-5 flex items-center justify-center relative overflow-hidden group-hover:bg-primary/5 transition-colors">
                                    <FileText className="text-on-surface-variant/40 group-hover:text-primary group-hover:scale-110 transition-all duration-500" size={48} />
                                    {decl.proof_file?.metadata?.formType && (
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-primary text-primary-foreground text-[9px] font-black rounded-lg uppercase tracking-widest shadow-md font-premium">
                                            {decl.proof_file.metadata.formType}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Eye className="text-primary" size={28} />
                                    </div>
                                </div>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-extrabold text-tertiary tracking-tighter font-premium">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-1 font-premium">{formatPeriodForDisplay(decl.period)}</span>
                                        </div>
                                        <button className="p-2.5 hover:bg-surface-lowest rounded-xl text-on-surface-variant hover:text-primary transition-colors">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                </div>
            </div>
        </div>
    );

    const renderSettingsTab = () => (
        <div className="space-y-10 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-1000 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low relative overflow-hidden group shadow-architect">
                    <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mb-10 sm:mb-12 flex items-center gap-4 font-premium">
                        <Coins size={18} className="sm:w-[20px] sm:h-[20px] text-primary" />
                        Configuración de Honorarios
                    </h3>
                    
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">
                                Honorario {editedClient.taxProfile?.ivaFrequency === 'Semestral' ? 'Semestral' : 'Mensual'}
                            </label>
                            <div className="relative group/input">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-extrabold">$</div>
                                <input
                                    type="number"
                                    value={monthlyFee}
                                    onChange={(e) => setMonthlyFee(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full pl-12 pr-6 py-5 bg-surface border border-surface-low rounded-2xl text-base font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Asesoría Anual (Renta)</label>
                            <div className="relative group/input">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-600 font-extrabold font-premium">$</div>
                                <input
                                    type="number"
                                    value={annualFee}
                                    onChange={(e) => setAnnualFee(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full pl-12 pr-6 py-5 bg-surface border border-surface-low rounded-2xl text-base font-extrabold text-on-surface focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low relative overflow-hidden group shadow-architect">
                    <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mb-10 sm:mb-12 flex items-center gap-4 font-premium">
                        <MapPin size={18} className="sm:w-[20px] sm:h-[20px] text-tertiary" />
                        PERFIL DEL CONTRIBUYENTE
                    </h3>

                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Régimen Tributario</label>
                            <select
                                value={editedClient.regime}
                                onChange={(e) => setEditedClient({ ...editedClient, regime: e.target.value as TaxRegime })}
                                disabled={!isEditing}
                                className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                            >
                                <option value={TaxRegime.General}>Régimen General</option>
                                <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface-lowest rounded-[3rem] p-10 border border-surface-low relative overflow-hidden group shadow-architect">
                <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mb-12 flex items-center gap-4 font-premium">
                    <Building size={20} className="text-primary" />
                    INFORMACIÓN DE CONTACTO
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Correo Electrónico</label>
                        <input
                            type="email"
                            value={editedClient.email || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                            placeholder="contacto@ejemplo.com"
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Teléfono de Contacto</label>
                        <input
                            type="text"
                            value={editedClient.phones && editedClient.phones.length > 0 ? editedClient.phones[0] : ''}
                            onChange={(e) => setEditedClient({ ...editedClient, phones: [e.target.value] })}
                            disabled={!isEditing}
                            className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                            placeholder="+593 000 000 000"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Frecuencia IVA</label>
                        <select
                            value={editedClient.taxProfile?.ivaFrequency || 'Mensual'}
                            onChange={(e) => setEditedClient({
                                ...editedClient,
                                taxProfile: { 
                                    ...(editedClient.taxProfile || { requiresAnnualRenta: true, requiresAnexosGastos: false, hasActiveDevolucionIva: false, hasActiveElderlyDevolucionIva: false, requiresIce: false, requiresAnexoPvp: false }), 
                                    ivaFrequency: e.target.value as any 
                                }
                            })}
                            disabled={!isEditing}
                            className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none appearance-none shadow-sm font-premium"
                        >
                            <option value="Mensual">Ciclo Mensual</option>
                            <option value="Semestral">Ciclo Semestral</option>
                            <option value="Ninguno">Inactivo</option>
                        </select>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Clave SRI</label>
                        <div className="relative">
                            <input
                                type={passwordVisible ? "text" : "password"}
                                value={editedClient.sriPassword || ''}
                                onChange={(e) => setEditedClient({ ...editedClient, sriPassword: e.target.value })}
                                disabled={!isEditing}
                                autoComplete="new-password"
                                className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                                placeholder="********"
                            />
                            <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Dirección Principal</label>
                    <input
                        type="text"
                        value={editedClient.address || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, address: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-6 py-5 bg-surface border border-surface-low rounded-2xl text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm font-premium"
                        placeholder="Dirección del domicilio o negocio"
                    />
                </div>

                <div className="mt-8 space-y-4">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1 font-premium">Detalle de Actividad</label>
                    <textarea
                        value={editedClient.economicActivity || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, economicActivity: e.target.value })}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full px-6 py-5 bg-surface border border-surface-low rounded-[2rem] text-sm font-extrabold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 outline-none shadow-sm resize-none font-premium"
                        placeholder="Descripción de la actividad económica"
                    />
                </div>
            </div>

            <div className="bg-surface-lowest rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-surface-low relative overflow-hidden group shadow-architect">
                <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em] mb-10 sm:mb-12 flex items-center gap-4 font-premium">
                    <ShieldCheck size={18} className="sm:w-[20px] sm:h-[20px] text-tertiary" />
                    PROTOCOLOS FISCALES AVANZADOS
                </h3>
                <ExtraObligationsCheckboxes
                    editedClient={editedClient}
                    setEditedClient={setEditedClient}
                    disabled={!isEditing}
                />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-700">
            <div className="bg-surface w-full h-full md:max-h-[92vh] md:max-w-6xl md:rounded-[2.5rem] shadow-architect flex flex-col relative overflow-hidden architect-layer-1">
                
                <button onClick={onBack} className="absolute top-8 right-8 z-50 p-3 bg-surface-low border border-surface-lowest text-on-surface-variant hover:text-primary rounded-2xl transition-all md:flex hidden hover:scale-110 active:scale-90 group/close shadow-sm">
                    <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <div className="p-5 sm:p-14 pb-20 relative z-10">
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
                            nextDeadline={nextDeadline}
                        />

                        <div className="flex gap-1 p-1 sm:p-1.5 bg-surface-low rounded-[2rem] mb-10 sm:mb-12 overflow-x-auto no-scrollbar max-w-full sm:max-w-fit mx-auto md:mx-0 shadow-sm relative z-20">
                            {(['profile', 'history', 'vault', 'settings'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 sm:px-10 py-3 sm:py-3.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all relative rounded-[1.5rem] whitespace-nowrap flex-shrink-0 ${activeTab === tab ? 'text-on-surface bg-surface shadow-architect scale-[1.02]' : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-lowest'}`}
                                >
                                    <span className="relative z-10 flex items-center gap-2 sm:gap-3">
                                        {tab === 'profile' && <LayoutDashboard size={13} className={`sm:w-[14px] sm:h-[14px] ${activeTab === tab ? 'text-primary' : ''}`} />}
                                        {tab === 'history' && <Activity size={13} className={`sm:w-[14px] sm:h-[14px] ${activeTab === tab ? 'text-primary' : ''}`} />}
                                        {tab === 'vault' && <Lock size={13} className={`sm:w-[14px] sm:h-[14px] ${activeTab === tab ? 'text-primary' : ''}`} />}
                                        {tab === 'settings' && <Settings size={13} className={`sm:w-[14px] sm:h-[14px] ${activeTab === tab ? 'text-primary' : ''}`} />}
                                        {tab === 'profile' ? 'ESTRATEGIA' : tab === 'history' ? 'OPERATIVAS' : tab === 'vault' ? 'DATA BÓVEDA' : 'SISTEMAS'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 min-h-[500px]">
                            {activeTab === 'profile' && renderProfileTab()}
                            {activeTab === 'history' && renderHistoryTab()}
                            {activeTab === 'vault' && renderVaultTab()}
                            {activeTab === 'settings' && renderSettingsTab()}
                        </div>
                    </div>
                </div>

                <div className="flex-none p-5 sm:p-6 md:px-14 bg-surface-low border-t border-surface-lowest flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-0 relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-6">
                        <SidebarAction icon={Download} label="Exportar Dossier" onClick={() => toast.info('Generando Reporte Elite...')} />
                    </div>
                    <div className="flex gap-4">
                        {isEditing ? (
                            <>
                                <button onClick={() => !isAnalyzingPdf && fileInputRef.current?.click()} className="px-5 py-3.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl border border-primary/20 text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 transition-all">
                                    {isAnalyzingPdf ? <Loader size={12} className="animate-spin" /> : <ScanLine size={14} />}
                                    <span>MÓDULO SCANNER</span>
                                </button>
                                <button onClick={() => setIsEditing(false)} className="px-6 py-3.5 text-on-surface-variant font-black text-[10px] uppercase tracking-[0.25em] hover:bg-surface-lowest transition-all rounded-xl">CANCELAR</button>
                                <button onClick={handleSave} className="px-8 py-3.5 bg-primary text-on-primary-fixed rounded-xl text-[10px] font-black uppercase tracking-[0.25em] shadow-architect transition-all active:scale-95">GUARDAR CAMBIOS</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center justify-center w-full sm:w-auto px-10 py-3.5 bg-surface text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] shadow-architect hover:bg-primary/5 hover:border-primary/40 transition-all transform hover:-translate-y-0.5 active:scale-95">
                                MÓDULO DE EDICIÓN
                            </button>
                        )}
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
            </div>
        </div>
    );
});