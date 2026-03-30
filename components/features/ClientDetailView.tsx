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
    Sparkles, AlertTriangle, Info, Clock, Briefcase, Key, MapPin, CreditCard, LayoutDashboard, User, History as HistoryIcon, Crown, Save, Activity, MessageCircle, Plus, Store, FileClock, Trash2, ToggleLeft, ToggleRight, Hammer, Building, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Lock, Share2, UploadCloud, FileKey, ExternalLink, Globe, ArrowRight, Download, ScanLine, FilePlus, Power, FileCheck, Coins, BadgePercent, Play, Settings, FileDown,
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
                        lastModified: file.lastModified
                    } as any;
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
        <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                <div className={`p-8 rounded-[2.5rem] ${isWorkOrder ? 'bg-amber-400/10 border-amber-400/20 shadow-primary' : (isFullyAlDia ? 'bg-emerald-400/10 border-emerald-400/20 shadow-primary' : 'glass-elite')} relative overflow-hidden group transition-all duration-700`}>
                    <div className="relative z-10">
                        <p className={`text-xs font-medium uppercase tracking-widest mb-3 ${isWorkOrder ? 'text-amber-400' : (isFullyAlDia ? 'text-emerald-400' : 'text-slate-500')}`}>DIRECTIVA OPERATIVA</p>
                        <h4 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight uppercase text-white">
                            {isFullyAlDia ? 'ÓPTIMA' : 'INTERVENCIÓN REQUERIDA'}
                        </h4>
                        <div className="mt-6 flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full animate-ping ${isFullyAlDia ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Sincronización Activa</span>
                        </div>
                    </div>
                </div>

                {!isFullyDeclared && (
                    <div className="p-8 rounded-[2.5rem] glass-card flex items-center gap-6 group transition-all hover:bg-white/5 border border-white/5">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-primary group-hover:scale-110 transition-transform duration-500">
                            <Zap size={28} className="animate-pulse" />
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-primary mb-1">VECTOR DE ATAQUE</p>
                            <p className="text-sm font-medium text-white uppercase tracking-tight">DECLARAR OBLIGACIÓN</p>
                        </div>
                    </div>
                )}

                {isFullyDeclared && !isFullyPaid && (
                    <div className="p-8 rounded-[2.5rem] glass-card flex items-center gap-6 group transition-all hover:bg-white/5 border border-white/5">
                        <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shadow-primary group-hover:scale-110 transition-transform duration-500">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase text-amber-400 tracking-[0.2em] mb-1">FASE: LIQUIDACIÓN</p>
                            <p className="text-sm font-black text-white uppercase tracking-tight">RECURSOS COMPROMETIDOS</p>
                        </div>
                    </div>
                )}
                
                {cloudStatus === 'saving' && (
                    <div className="p-8 rounded-[2.5rem] glass-card flex items-center gap-6 animate-pulse border border-white/5">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <RefreshCcw size={28} className="animate-spin" />
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-indigo-400 mb-1">Sincronización</p>
                            <p className="text-sm font-medium text-white uppercase tracking-tight">Actualizando Nube</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                    <div className="glass-card rounded-[3rem] p-10 relative overflow-hidden group border border-white/5">
                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h3 className="text-xl font-medium text-white tracking-tight uppercase flex items-center gap-4">
                                    <Activity className="text-primary" size={24} />
                                    PANEL DE INTELIGENCIA FISCAL
                                </h3>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-3">MÉTRICAS DE CUMPLIMIENTO Y OBLIGACIONES CRÍTICAS</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                            <TaxObligationCard
                                title="IVA Mensual"
                                period={complianceStats?.iva.period || ''}
                                status={complianceStats?.iva.isDeclared ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente}
                                isPaid={complianceStats?.iva.is_paid}
                                amount={client.fee_structure?.monthly || 5}
                                dueDate={getDueDateForPeriod(editedClient, complianceStats?.iva.period || '') || undefined}
                                onDeclare={() => setConfirmation({ action: 'declare', period: complianceStats?.iva.period || '' })}
                                onPay={() => handleQuickPay(complianceStats?.iva.period || '')}
                                onUpload={() => { setUploadingTarget({ type: 'iva', period: complianceStats?.iva.period }); proofInputRef.current?.click(); }}
                                onWhatsApp={() => handleWhatsAppPaymentRequest(complianceStats?.iva.period || '', 'IVA')}
                                onRevertPayment={() => handleRevertPayment(complianceStats?.iva.period || '')}
                                declarationDate={editedClient.declarations.find(d => d.period === complianceStats?.iva.period)?.declaredAt}
                            />

                            <div className="space-y-8">
                                <div className="p-8 glass-card rounded-[2.5rem] relative overflow-hidden group/card shadow-2xl border border-white/5">
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Arquitectura Tributaria</p>
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-primary shadow-inner group-hover/card:scale-110 transition-transform">
                                            <ShieldCheck size={28} />
                                        </div>
                                        <div>
                                            <p className="text-base font-medium text-white leading-tight uppercase tracking-tight">{client.regime}</p>
                                            <p className="text-[11px] font-black text-emerald-400 mt-1 uppercase tracking-[0.2em]">VALIDADO & ACTIVO</p>
                                        </div>
                                    </div>
                                </div>

                                {client.taxProfile?.requiresAnnualRenta && editedClient.rentaRefundStatus !== 'Completado' && (
                                    <div className="p-8 glass-card rounded-[2.5rem] space-y-8 relative overflow-hidden group/renta shadow-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Protocolo Renta</p>
                                            <div className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-black rounded-lg uppercase tracking-[0.2em]">MISIÓN CRÍTICA</div>
                                        </div>
                                        <div className="flex gap-3 flex-wrap pb-6">
                                            {[
                                                { id: 'Solicitado', label: 'Inicio', icon: Send },
                                                { id: 'Esperando Confirmación', label: 'SRI Web', icon: Clock },
                                                { id: 'Confirmado', label: 'Validado', icon: FileCheck },
                                                { id: 'Completado', label: 'Dossier', icon: ShieldCheck }
                                            ].map((step) => {
                                                const statusOrder = ['Pendiente', 'Solicitado', 'Esperando Confirmación', 'Confirmado', 'Completado'];
                                                const currentIdx = statusOrder.indexOf(editedClient.rentaRefundStatus || 'Pendiente');
                                                const stepIdx = statusOrder.indexOf(step.id);
                                                const isActive = editedClient.rentaRefundStatus === step.id;
                                                const isDone = stepIdx < currentIdx;

                                                return (
                                                    <button
                                                        key={step.id}
                                                        onClick={() => {
                                                            if (step.id === 'Solicitado') handleRentaRefundAction('start');
                                                            if (step.id === 'Esperando Confirmación') handleRentaRefundAction('message_received');
                                                            if (step.id === 'Confirmado') handleRentaRefundAction('confirm');
                                                            if (step.id === 'Completado') handleRentaRefundAction('complete');
                                                        }}
                                                        className={`flex-1 min-w-[110px] flex justify-center items-center gap-2 px-4 py-3 rounded-2xl border transition-all whitespace-nowrap ${isActive ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]' : (isDone ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-slate-950 text-slate-600 border-white/5 hover:border-white/10')}`}
                                                    >
                                                        <step.icon size={14} className="flex-shrink-0" />
                                                        <span className="text-[11px] font-black uppercase tracking-[0.1em]">{step.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <TaxObligationCard
                                            title={`Renta (${editedClient.rentaRefundStatus || 'Inactivo'})`}
                                            period={complianceStats?.renta.period || ''}
                                            status={
                                                (editedClient.rentaRefundStatus && editedClient.rentaRefundStatus !== 'Pendiente' ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente)
                                            }
                                            isPaid={!!editedClient.rentaRefundPaid}
                                            amount={10.00}
                                            dueDate={getDueDateForPeriod(editedClient, complianceStats?.renta.period || '') || undefined}
                                            onDeclare={() => handleRentaRefundAction('start')}
                                            onPay={() => handleRentaRefundAction('pay')}
                                            onUpload={() => { setUploadingTarget({ type: 'devolucionRenta', period: complianceStats?.renta.period }); proofInputRef.current?.click(); }}
                                            onWhatsApp={() => handleWhatsAppPaymentRequest(complianceStats?.renta.period || '', 'Devolución de Renta')}
                                            onRevertPayment={() => handleRentaRefundAction('revert_pay')}
                                            declarationDate={editedClient.rentaRefundRequestedAt ? safeFormat(editedClient.rentaRefundRequestedAt, 'dd/MM/yyyy HH:mm') : undefined}
                                        />
                                    </div>
                                )}

                                {client.hasElderlyDevolucionIva && editedClient.elderlyDevolucionIvaStatus !== 'Completado' && (
                                    <div className="p-8 glass-card rounded-[2.5rem] space-y-8 relative overflow-hidden group/elderly shadow-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Protocolo Devolución (T. Edad)</p>
                                        </div>

                                        <div className="flex gap-3 flex-wrap pb-6">
                                            {[
                                                { id: 'Pendiente', label: 'Inicio', icon: Send, action: 'start' },
                                                { id: 'En Proceso', label: 'En Proceso', icon: Clock, action: 'process' },
                                                { id: 'Completado', label: 'Completado', icon: ShieldCheck, action: 'complete' }
                                            ].map((step) => {
                                                const statusOrder = ['Pendiente', 'En Proceso', 'Completado'];
                                                const currentIdx = statusOrder.indexOf(editedClient.elderlyDevolucionIvaStatus || 'Pendiente');
                                                const stepIdx = statusOrder.indexOf(step.id);
                                                const isActive = editedClient.elderlyDevolucionIvaStatus === step.id;
                                                const isDone = stepIdx < currentIdx;

                                                return (
                                                    <button
                                                        key={step.id}
                                                        onClick={() => handleElderlyRefundAction(step.action as any)}
                                                        className={`flex-1 min-w-[110px] flex justify-center items-center gap-2 px-4 py-3 rounded-2xl border transition-all whitespace-nowrap ${isActive ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]' : (isDone ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-slate-950 text-slate-600 border-white/5 hover:border-white/10')}`}
                                                    >
                                                        <step.icon size={14} className="flex-shrink-0" />
                                                        <span className="text-[11px] font-black uppercase tracking-[0.1em]">{step.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <TaxObligationCard
                                            title={`Devolución IVA (${editedClient.elderlyDevolucionIvaStatus || 'Pendiente'})`}
                                            period={complianceStats?.iva.period || ''}
                                            status={
                                                (editedClient.elderlyDevolucionIvaStatus && editedClient.elderlyDevolucionIvaStatus !== 'Pendiente' ? DeclarationStatus.Enviada : DeclarationStatus.Pendiente)
                                            }
                                            isPaid={!!editedClient.elderlyDevolucionIvaPaid}
                                            amount={15.00}
                                            onDeclare={() => handleElderlyRefundAction('start')}
                                            onPay={() => {
                                                const updated = { ...editedClient, elderlyDevolucionIvaPaid: true };
                                                setEditedClient(updated);
                                                onSave(updated);
                                                toast.success("Pago registrado");
                                            }}
                                            onUpload={() => { setUploadingTarget({ type: 'devolucionIvaTerceraEdad', period: complianceStats?.iva.period }); proofInputRef.current?.click(); }}
                                            onWhatsApp={() => handleWhatsAppPaymentRequest(complianceStats?.iva.period || '', 'Devolución IVA Tercera Edad')}
                                            onRevertPayment={() => {
                                                const updated = { ...editedClient, elderlyDevolucionIvaPaid: false };
                                                setEditedClient(updated);
                                                onSave(updated);
                                                toast.success("Pago revertido");
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                        <div className="space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-primary shadow-inner">
                                    <Mail size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Enlace Email</p>
                                    <p className="text-sm font-medium text-white truncate pr-4">{client.email || 'SIN ASIGNAR'}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-amber-400 shadow-inner">
                                    <Phone size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Enlace Móvil</p>
                                    <p className="text-sm font-medium text-white truncate pr-4">{(client.phones && client.phones.length > 0) ? client.phones[0] : 'SIN ASIGNAR'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-12 pt-10 border-t border-white/5">
                            <button onClick={handleOpenSRI} className="flex flex-col items-center gap-3 p-5 bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 rounded-[2rem] transition-all group/btn">
                                <Globe size={20} className="text-primary group-hover/btn:scale-110 transition-all duration-500" />
                                <span className="text-[11px] font-black text-slate-500 group-hover/btn:text-primary uppercase tracking-[0.2em]">PORTAL SRI</span>
                            </button>
                            <button onClick={handleWhatsApp} className="flex flex-col items-center gap-3 p-5 bg-white/5 hover:bg-emerald-400/10 border border-white/5 hover:border-emerald-400/20 rounded-[2rem] transition-all group/btn">
                                <MessageCircle size={20} className="text-emerald-400 group-hover/btn:scale-110 transition-all duration-500" />
                                <span className="text-[11px] font-black text-slate-500 group-hover/btn:text-emerald-400 uppercase tracking-[0.2em]">WHATSAPP</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md rounded-[3rem] p-10 border border-white/5 shadow-2xl">
                        <PaymentHistoryChart client={client} />
                    </div>

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
            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h3 className="text-xl font-medium text-white tracking-tight uppercase flex items-center gap-4">
                            <Activity className="text-primary" size={24} />
                            REGISTRO OPERATIVO
                        </h3>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mt-3">TRAZABILIDAD DE ACCIONES Y VALIDACIONES</p>
                    </div>
                </div>

                <DocumentTimeline
                    client={client}
                    onViewPreview={(decl) => setPreviewItem(decl)}
                    onDownload={handleDownload}
                    onWhatsApp={(period) => handleWhatsAppPaymentRequest(period, 'IVA')}
                />
            </div>
            
            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-base font-medium text-white tracking-tight uppercase flex items-center gap-3">
                        <FileClock className="text-emerald-400" size={20} />
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

            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h3 className="text-xl font-medium text-white tracking-tight uppercase flex items-center gap-4">
                            <Store className="text-primary" size={24} />
                            Repositorio de Documentos
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-3">Gestión centralizada de archivos y comprobantes</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 text-xs font-medium text-emerald-400 flex items-center gap-3 shadow-inner uppercase tracking-widest">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            {(client.declarations || []).filter(d => d.proof_file).length} Archivos Protegidos
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    <button
                        onClick={() => { setUploadingTarget({ type: 'iva', period: getPeriod(client, new Date()) }); proofInputRef.current?.click(); }}
                        className="aspect-square rounded-[2.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl relative z-10">
                            <Plus className="text-slate-500 group-hover:text-primary" size={32} />
                        </div>
                        <span className="text-xs font-medium uppercase text-slate-500 group-hover:text-primary tracking-widest relative z-10">Subir Documento</span>
                    </button>

                    {[...(client.declarations || [])]
                        .filter(d => d.proof_file)
                        .sort((a, b) => b.period.localeCompare(a.period))
                        .map((decl, idx) => (
                            <div key={idx} className="glass-card rounded-[2.5rem] p-5 border border-white/5 shadow-2xl hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setPreviewItem(decl)}>
                                <div className="aspect-[4/3] rounded-2xl bg-white/5 mb-5 flex items-center justify-center relative overflow-hidden group-hover:bg-white/10 transition-colors">
                                    <FileText className="text-slate-700 group-hover:text-primary group-hover:scale-110 transition-all duration-500" size={48} />
                                    {decl.proof_file?.metadata?.formType && (
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-primary text-slate-950 text-xs font-medium rounded-lg uppercase tracking-widest shadow-lg">
                                            {decl.proof_file.metadata.formType}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Eye className="text-white" size={28} />
                                    </div>
                                </div>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-medium text-emerald-400 tracking-tighter">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            <span className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">{formatPeriodForDisplay(decl.period)}</span>
                                        </div>
                                        <button className="p-2.5 hover:bg-white/10 rounded-xl text-slate-600 hover:text-primary transition-colors">
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
        <div className="space-y-10 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-4">
                        <Coins size={20} className="text-primary" />
                        Configuración de Honorarios
                    </h3>
                    
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">
                                Honorario {editedClient.taxProfile?.ivaFrequency === 'Semestral' ? 'Semestral' : 'Mensual'}
                            </label>
                            <div className="relative group/input">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-medium">$</div>
                                <input
                                    type="number"
                                    value={monthlyFee}
                                    onChange={(e) => setMonthlyFee(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-base font-medium text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Asesoría Anual (Renta)</label>
                            <div className="relative group/input">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-400 font-medium">$</div>
                                <input
                                    type="number"
                                    value={annualFee}
                                    onChange={(e) => setAnnualFee(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full pl-12 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-base font-medium text-white focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-10 flex items-center gap-4">
                        <MapPin size={20} className="text-emerald-400" />
                        PERFIL DEL CONTRIBUYENTE
                    </h3>

                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Régimen Tributario</label>
                            <select
                                value={editedClient.regime}
                                onChange={(e) => setEditedClient({ ...editedClient, regime: e.target.value as TaxRegime })}
                                disabled={!isEditing}
                                className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none appearance-none shadow-inner"
                            >
                                <option value={TaxRegime.General}>Régimen General</option>
                                <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-10 flex items-center gap-4">
                    <Building size={20} className="text-indigo-400" />
                    INFORMACIÓN DE CONTACTO
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            value={editedClient.email || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                            placeholder="contacto@ejemplo.com"
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Teléfono de Contacto</label>
                        <input
                            type="text"
                            value={editedClient.phones && editedClient.phones.length > 0 ? editedClient.phones[0] : ''}
                            onChange={(e) => setEditedClient({ ...editedClient, phones: [e.target.value] })}
                            disabled={!isEditing}
                            className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                            placeholder="+593 000 000 000"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Frecuencia IVA</label>
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
                            className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none appearance-none shadow-inner"
                        >
                            <option value="Mensual">Ciclo Mensual</option>
                            <option value="Semestral">Ciclo Semestral</option>
                            <option value="Ninguno">Inactivo</option>
                        </select>
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Clave SRI</label>
                        <div className="relative">
                            <input
                                type={passwordVisible ? "text" : "password"}
                                value={editedClient.sriPassword || ''}
                                onChange={(e) => setEditedClient({ ...editedClient, sriPassword: e.target.value })}
                                disabled={!isEditing}
                                autoComplete="new-password"
                                className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                                placeholder="********"
                            />
                            <button onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-primary">
                                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Dirección Principal</label>
                    <input
                        type="text"
                        value={editedClient.address || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, address: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner"
                        placeholder="Dirección del domicilio o negocio"
                    />
                </div>

                <div className="mt-8 space-y-4">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-widest ml-1">Detalle de Actividad</label>
                    <textarea
                        value={editedClient.economicActivity || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, economicActivity: e.target.value })}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full px-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-sm font-medium text-white focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-40 outline-none shadow-inner resize-none"
                        placeholder="Descripción de la actividad económica"
                    />
                </div>
            </div>

            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-10 flex items-center gap-4">
                    <ShieldCheck size={20} className="text-emerald-400" />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-700">
            <div className="bg-secondary/40 backdrop-blur-3xl w-full h-full md:max-h-[92vh] md:max-w-6xl md:rounded-[2.5rem] shadow-2xl flex flex-col relative overflow-hidden border border-white/5 aurora-premium">
                
                <button onClick={onBack} className="absolute top-8 right-8 z-50 p-3 bg-white/5 border border-white/5 text-slate-500 hover:text-primary rounded-2xl transition-all md:flex hidden hover:scale-110 active:scale-90 group/close shadow-2xl">
                    <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <div className="p-8 md:p-14 pb-20 relative z-10">
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

                        {/* Minimalist Navigation */}
                        <div className="flex gap-2 p-2 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/5 mb-12 overflow-x-auto no-scrollbar max-w-full sm:max-w-fit mx-auto md:mx-0">
                            {(['profile', 'history', 'vault', 'settings'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 sm:px-10 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all relative rounded-[1.5rem] whitespace-nowrap ${activeTab === tab ? 'text-slate-950 bg-primary shadow-primary' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
                                >
                                    <span className="relative z-10 flex items-center gap-3">
                                        {tab === 'profile' && <LayoutDashboard size={16} />}
                                        {tab === 'history' && <Activity size={16} />}
                                        {tab === 'vault' && <Lock size={16} />}
                                        {tab === 'settings' && <Settings size={16} />}
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

                <div className="flex-none p-6 md:px-14 bg-white/5 backdrop-blur-2xl border-t border-white/5 flex justify-between items-center relative z-20">
                    <div className="flex items-center gap-6">
                        <SidebarAction icon={Download} label="Exportar Dossier" onClick={() => toast.info('Generando Reporte Elite...')} />
                    </div>
                    <div className="flex gap-4">
                        {isEditing ? (
                            <>
                                <button onClick={() => !isAnalyzingPdf && fileInputRef.current?.click()} className="px-5 py-3.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all">
                                    {isAnalyzingPdf ? <Loader size={12} className="animate-spin" /> : <ScanLine size={14} />}
                                    <span>MÓDULO SCANNER</span>
                                </button>
                                <button onClick={() => setIsEditing(false)} className="px-6 py-3.5 bg-white/5 border border-white/5 text-slate-500 rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:text-slate-300 transition-all">CANCELAR</button>
                                <button onClick={handleSave} className="px-8 py-3.5 bg-primary text-slate-950 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-primary transition-all active:scale-95">GUARDAR CAMBIOS</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center justify-center w-full sm:w-auto px-10 py-3.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:bg-cyan-500/20 hover:border-cyan-500/60 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all backdrop-blur-md transform hover:-translate-y-1 active:scale-95">
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