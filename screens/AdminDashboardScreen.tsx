
import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Screen, Client, DeclarationStatus, TaxRegime, Declaration } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { isPast, isToday, isTomorrow, format, subMonths } from 'date-fns';
import { ClientCard } from '../components/features/ClientCard';
import { useToast } from '../context/ToastContext';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { processBulkPdfs, BulkProcessResult } from '../services/bulkOperations';
import { BulkUploadReportModal } from '../components/features/BulkUploadReportModal';
import { ChatBot } from '../components/features/ChatBot';
import { VirtualClientList } from '../components/features/VirtualClientList';
import { TaxComplianceMatrix } from '../components/features/TaxComplianceMatrix';
import { ComplianceReportExport } from '../components/features/ComplianceReportExport';
import { IvaFrequency } from '../types';
import { getComplianceSummary, getClientCompliance, ComplianceColor } from '../services/complianceEngine';
import { PortfolioSemaphore } from '../components/ui/PortfolioSemaphore';

interface AdminDashboardScreenProps {
    navigate: (screen: Screen, options?: any) => void;
    theme?: 'light' | 'dark';
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate, theme = 'dark' }) => {
    const { clients, setClients, serviceFees, updateClient } = useAppStore();
    const { toast } = useToast();

    // Auto-detección de Campaña Mensual
    const [filter, setFilter] = useState<'all' | 'mensual' | 'semestral' | 'vip' | 'urgent' | 'rimpe' | 'popular' | 'renta' | 'overdue' | 'prepaid' | 'no-iva' | 'no-renta' | 'boveda' | 'digital-mando' | ComplianceColor>(() => {
        return (sessionStorage.getItem('dashboard_filter') as any) || 'digital-mando';
    });
    const [inboxTab, setInboxTab] = useState<'pendientes' | 'completados'>('pendientes');
    const [searchTerm, setSearchTerm] = useState(() => {
        return sessionStorage.getItem('dashboard_search') || '';
    });
    const [previewState, setPreviewState] = useState<{ isOpen: boolean, client: Client | null, declaration: any | null }>({
        isOpen: false,
        client: null,
        declaration: null
    });
    const [bulkResults, setBulkResults] = useState<BulkProcessResult[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isTacticalVisible, setIsTacticalVisible] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [matrixUploadSelection, setMatrixUploadSelection] = useState<{ client: Client, period: string } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const matrixFileInputRef = React.useRef<HTMLInputElement>(null);

    // Persistence Effect
    React.useEffect(() => {
        sessionStorage.setItem('dashboard_filter', filter);
    }, [filter]);

    React.useEffect(() => {
        sessionStorage.setItem('dashboard_search', searchTerm);
    }, [searchTerm]);

    // Scroll Persistence
    React.useEffect(() => {
        const savedScroll = sessionStorage.getItem('dashboard_scroll');
        if (savedScroll) {
            // Give a small timeout for the list to render
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }, 100);
        }

        const handleScroll = () => {
            sessionStorage.setItem('dashboard_scroll', window.scrollY.toString());
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- SINGLE PASS PERFORMANCE ENGINE (Upgraded to Zen v3.1) ---
    const { 
        urgentPriorities, pendientes, completados, allResults, 
        kpis, expiringSignatures, activeRentaRefunds, complianceSummary
    } = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const rentaPeriod = (currentYear - 1).toString();
        const next15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);

        const currentFreq: 'Mensual' | 'Semestral' | 'Anual' | 'all' = 
            filter === 'mensual' ? 'Mensual' :
            filter === 'semestral' ? 'Semestral' :
            filter === 'renta' ? 'Anual' : 
            filter === 'digital-mando' ? 'Mensual' : 'all';

        const summary = getComplianceSummary(clients, today, currentFreq);


        const urgents: Client[] = [];
        const peds: Client[] = [];
        const comps: Client[] = [];
        const filtered: Client[] = [];
        const signExp: Client[] = [];
        const refunds: Client[] = [];
        
        let overdueCount = 0;
        let prepaidCount = 0;
        let totalIncome = 0;
        let activeCount = 0;

        for (const c of clients) {
            if (c.isDeleted || !c.isActive) continue;
            activeCount++;

            // 1. KPI & Special Lists Calculations
            const compliance = getClientCompliance(c, today, currentFreq);
            const currentP = getPeriod(c, today);

            const dueDate = getDueDateForPeriod(c, currentP);
            const declarations = c.declarations || [];
            
            const ivaDecl = declarations.find(dh => dh.period === currentP);
            
            // Stats
            if (compliance.overdueCount > 0) overdueCount++;
            if (ivaDecl?.is_paid && ivaDecl?.status === DeclarationStatus.Pendiente) prepaidCount++;
            totalIncome += (c.fee_structure?.monthly ?? c.customServiceFee ?? 0);

            // Special Lists
            if (c.signatureExpirationDate) {
                const expDate = new Date(c.signatureExpirationDate);
                if (!isNaN(expDate.getTime()) && expDate <= next15Days) signExp.push(c);
            }
            if (c.hasRentaRefund && (c.rentaRefundStatus === 'Solicitado' || c.rentaRefundStatus === 'Pendiente')) {
                refunds.push(c);
            }

            // 2. Filter logic for "allResults" (workspaceData)
            const searchMatch = !searchTerm || 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.ruc.includes(searchTerm) || 
                (c.tradeName?.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!searchMatch) continue;

            let filterMatch = true;
            if (filter === 'urgent') {
                filterMatch = compliance.urgentCount > 0;
            } else if (filter === 'overdue') {
                filterMatch = compliance.overdueCount > 0;
            } else if (filter === 'red' || filter === 'orange' || filter === 'yellow' || filter === 'green' || filter === 'gray') {
                filterMatch = compliance.overallColor === filter;
            } else if (filter === 'prepaid') {
                filterMatch = !!(ivaDecl?.is_paid && ivaDecl?.status === DeclarationStatus.Pendiente);
            } else if (filter === 'no-iva') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Ninguno';
            } else if (filter === 'mensual') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Mensual';
            } else if (filter === 'semestral') {
                filterMatch = c.taxProfile?.ivaFrequency === 'Semestral';
            } else if (filter === 'popular') {
                filterMatch = c.regime === TaxRegime.RimpeNegocioPopular;
            } else if (filter === 'no-renta') {
                filterMatch = c.taxProfile?.requiresAnnualRenta === false;
            } else if (filter === 'boveda') {
                filterMatch = !!(ivaDecl && !ivaDecl.proof_file && (ivaDecl.status === DeclarationStatus.Enviada || ivaDecl.status === DeclarationStatus.Pagada));
            } else if (filter === 'digital-mando') {
                filterMatch = c.taxProfile?.ivaFrequency !== 'Ninguno';
            }

            if (filterMatch) {
                filtered.push(c);
                
                // 3. Categorization (Inbox)
                const isDone = compliance.score === 100 && compliance.overdueCount === 0;

                if (isDone) {
                    comps.push(c);
                } else {
                    if (compliance.urgentCount > 0 || compliance.overdueCount > 0) urgents.push(c);
                    else peds.push(c);
                }
            }
        }

        // Final Sort for filtered results
        filtered.sort((a, b) => {
            const digitA = parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10);
            const sortA = digitA === 0 ? 10 : digitA;
            const sortB = digitB === 0 ? 10 : digitB;
            if (sortA !== sortB) return sortA - sortB;
            return a.name.localeCompare(b.name);
        });

        return { 
            urgentPriorities: urgents, 
            pendientes: peds, 
            completados: comps, 
            allResults: filtered,
            kpis: { 
                total: activeCount, 
                overdue: overdueCount, 
                prepaid: prepaidCount, 
                projectedIncome: totalIncome 
            },
            expiringSignatures: signExp,
            activeRentaRefunds: refunds,
            complianceSummary: summary
        };
    }, [clients, searchTerm, filter]);

    // Data for Matrix Mode
    const matrixPeriods = useMemo(() => {
        const today = new Date();
        const result = [];
        const isSemestral = filter === 'semestral';
        
        if (!isSemestral) { // Monthly (Default or Mensual filter)
            for (let i = 0; i < 6; i++) {
                const date = subMonths(today, i + 1);
                const p = format(date, 'yyyy-MM');
                if (p >= '2026-01') result.push(p);
            }
        } else { // Semestral
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            if (currentMonth >= 6) {
                const p1 = `${currentYear}-S1`;
                const p2 = `${currentYear - 1}-S2`;
                if (p1 >= '2026-S1') result.push(p1);
                if (p2 >= '2026-S1') result.push(p2);
            } else {
                const p1 = `${currentYear - 1}-S2`;
                const p2 = `${currentYear - 1}-S1`;
                if (p1 >= '2026-S1') result.push(p1);
                if (p2 >= '2026-S1') result.push(p2);
            }
        }
        return result;
    }, [filter]);

    const matrixClients = useMemo(() => {
        const freq = filter === 'semestral' ? 'Semestral' : 'Mensual';
        const filtered = clients.filter(c => !c.isDeleted && c.isActive && c.taxProfile?.ivaFrequency === freq);
        
        return filtered.sort((a, b) => {
            const digitA = parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10);
            const sortA = digitA === 0 ? 10 : digitA;
            const sortB = digitB === 0 ? 10 : digitB;
            if (sortA !== sortB) return sortA - sortB;
            return a.name.localeCompare(b.name);
        });
    }, [clients, filter]);


    const activeList = searchTerm ? allResults : (inboxTab === 'pendientes' ? (filter === 'all' || filter === 'mensual' ? [...urgentPriorities, ...pendientes] : allResults) : completados);


    // ... (handleAction remains same) ...
    const handleAction = (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge', customPeriod?: string) => {
        const today = new Date();
        const period = customPeriod || getPeriod(client, today);
        const nowIso = today.toISOString();

        if (action === 'deactivate') {
            updateClient(client.id, { isActive: false });
            toast.success(`${client.name} desactivado`);
            return;
        }
        if (action === 'restore') {
            updateClient(client.id, { isDeleted: false, isActive: true });
            toast.success(`${client.name} restaurado`);
            return;
        }
        if (action === 'purge') {
            return;
        }

        const updatedHistory = [...client.declarations];
        const idx = updatedHistory.findIndex(d => d.period === period);
        
        let newStatus: DeclarationStatus;
        let updates: Partial<Declaration> = { updatedAt: nowIso };

        switch (action) {
            case 'declare':
                newStatus = DeclarationStatus.Enviada;
                updates.declaredAt = nowIso;
                break;
            case 'pay':
                newStatus = DeclarationStatus.Pagada;
                updates.paidAt = nowIso;
                updates.is_paid = true;
                updates.transactionId = `Q-${Date.now().toString().slice(-4)}`;
                break;
            case 'cancel':
                newStatus = DeclarationStatus.Cancelada;
                break;
            case 'revert':
                newStatus = DeclarationStatus.Pendiente;
                updates.is_paid = false;
                updates.paidAt = undefined;
                updates.declaredAt = undefined;
                updates.transactionId = undefined;
                break;
            default:
                newStatus = DeclarationStatus.Pendiente;
        }

        const newEntry = {
            period,
            status: newStatus,
            ...updates
        };

        if (idx > -1) {
            updatedHistory[idx] = { ...updatedHistory[idx], ...newEntry };
        } else {
            updatedHistory.push(newEntry as Declaration);
        }

        updateClient(client.id, { declarations: updatedHistory });

        const actionLabels: Record<string, string> = {
            declare: 'Declaración registrada',
            pay: 'Pago registrado',
            cancel: 'Declaración cancelada',
            revert: 'Acción revertida'
        };
        
        if (actionLabels[action]) {
            toast.success(actionLabels[action]);
        }
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsProcessing(true);
        toast.info(`Iniciando procesamiento de ${files.length} archivos...`);

        try {
            const results = await processBulkPdfs(files, (curr, total) => {
                // Progress tracking
            });
            setBulkResults(results as any);
            setIsBulkModalOpen(true);
            toast.success("Procesamiento masivo completado");
        } catch (error) {
            toast.error("Error en el procesamiento masivo");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const openPreview = (client: Client, declaration: any) => {
        setPreviewState({
            isOpen: true,
            client,
            declaration
        });
    };

    const handleUploadFromMatrix = (client: Client, period: string) => {
        setMatrixUploadSelection({ client, period });
        matrixFileInputRef.current?.click();
    };

    const onMatrixFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !matrixUploadSelection) return;

        setIsProcessing(true);
        try {
            const results = await processBulkPdfs([file], () => {});
            setBulkResults(results as any);
            setIsBulkModalOpen(true);
            toast.success("Documento procesado");
        } catch (error) {
            toast.error("Error al procesar el documento");
        } finally {
            setIsProcessing(false);
            setMatrixUploadSelection(null);
            if (matrixFileInputRef.current) matrixFileInputRef.current.value = '';
        }
    };
    const tacticalInfo = useMemo(() => {
        const day = new Date().getDate();
        const schedule: Record<number, number> = { 10: 1, 12: 2, 14: 3, 16: 4, 18: 5, 20: 6, 22: 7, 24: 8, 26: 9, 28: 0 };
        const todayDigit = schedule[day] ?? null;
        const tomorrowDigit = schedule[day + 1] ?? schedule[day + 2] ?? null;

        return { todayDigit, tomorrowDigit };
    }, []);

    const stitchSuggestions = useMemo(() => {
        const suggestions: { title: string, desc: string, priority: 'high' | 'medium' | 'low', action: () => void }[] = [];

        if (tacticalInfo.todayDigit !== null && urgentPriorities.length > 0) {
            suggestions.push({
                title: `Vencimiento Crítico: Dígito ${tacticalInfo.todayDigit}`,
                desc: `Hay ${urgentPriorities.length} clientes que vencen hoy según el SRI. Prioridad inmediata.`,
                priority: 'high',
                action: () => setFilter('urgent')
            });
        }

        if (expiringSignatures.length > 0) {
            suggestions.push({
                title: 'Renovación de Firmas',
                desc: `${expiringSignatures.length} firmas están por caducar. Gestionar renovaciones para evitar bloqueos.`,
                priority: 'medium',
                action: () => setFilter('all')
            });
        }

        if (activeRentaRefunds.length > 0) {
            suggestions.push({
                title: 'Seguimiento de Devoluciones',
                desc: `Tienes ${activeRentaRefunds.length} trámites de renta en curso. Revisa el estatus para asegurar el depósito.`,
                priority: 'low',
                action: () => setFilter('renta')
            });
        }

        return suggestions.slice(0, 3);
    }, [tacticalInfo, urgentPriorities, expiringSignatures, activeRentaRefunds]);

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative aurora-zen min-h-screen">
            {/* Stitch Design Suggestion Hub - Elite Tactical Refinement */}
            {stitchSuggestions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in relative z-30 px-4 sm:px-0">
                    {stitchSuggestions.map((s, idx) => (
                        <div key={idx} onClick={s.action} className="group relative overflow-hidden glass-zen p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full -mr-16 -mt-16 transition-all duration-700 group-hover:scale-150 ${s.priority === 'high' ? 'bg-rose-400/5' : s.priority === 'medium' ? 'bg-amber-400/5' : 'bg-primary/5'}`}></div>
                            <div className="flex flex-col relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${s.priority === 'high' ? 'bg-rose-400' : s.priority === 'medium' ? 'bg-amber-400' : 'bg-primary'}`}></div>
                                    <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${s.priority === 'high' ? 'text-rose-400' : s.priority === 'medium' ? 'text-amber-400' : 'text-primary'}`}>
                                        {s.priority === 'high' ? 'Atención Crítica' : s.priority === 'medium' ? 'Aviso del Sistema' : 'Optimización'}
                                    </span>
                                </div>
                                <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-2 leading-tight tracking-tight">{s.title}</h4>
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed opacity-80">{s.desc}</p>
                            </div>
                            <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                <LucideIcons.ArrowRight size={18} className="text-emerald-400" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tactical Warning Banner: Zen Mode */}
            {isTacticalVisible && tacticalInfo.todayDigit !== null && (
                <div className="relative z-30 sm:mb-8 mb-4 animate-fade-in-down px-4 sm:px-0 group/tactical">
                    <div className="glass-zen rounded-[2rem] p-4 sm:p-6 flex items-center justify-between border-rose-200/50 dark:border-rose-400/20">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="relative">
                                <div className="bg-rose-500 p-3 sm:p-4 rounded-full text-white shadow-2xl shadow-rose-500/40 relative z-10">
                                    <LucideIcons.ShieldAlert size={20} className="sm:w-[26px] sm:h-[26px]" strokeWidth={2.5} />
                                </div>
                                <div className="absolute inset-0 bg-rose-400 rounded-full animate-ping opacity-25"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs sm:text-xs font-semibold text-emerald-400 uppercase tracking-[0.4em] mb-0.5 sm:mb-1">ALERTA DEL SISTEMA</span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <p className="text-xs sm:text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-premium">DÍGITO CRÍTICO HOY:</p>
                                    <span className="text-2xl sm:text-4xl text-slate-900 dark:text-white font-display font-semibold tracking-tighter">{tacticalInfo.todayDigit}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right flex items-center gap-3 relative z-10 hidden sm:flex">
                                <div className="px-3 sm:px-5 py-1.5 sm:py-2 bg-slate-900/50 dark:bg-black/40 rounded-xl sm:rounded-2xl border border-white/5 backdrop-blur-md">
                                    <div className="flex items-center justify-end gap-2 sm:gap-3">
                                        <span className="text-[11px] sm:text-[12px] font-semibold tech-font text-rose-400">{urgentPriorities.length} PENDIENTES</span>
                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-400 animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsTacticalVisible(false)}
                                className="p-2 sm:p-3 hover:bg-rose-400/10 rounded-full transition-colors text-slate-400 hover:text-rose-400 group-hover/tactical:opacity-100 sm:opacity-0"
                            >
                                <LucideIcons.X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Background elements refined */}
            <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-slate-400/5 dark:bg-white/5 blur-[160px] rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-0 w-[800px] h-[800px] bg-slate-400/5 dark:bg-white/5 blur-[140px] rounded-full pointer-events-none"></div>

            {/* MANDO CENTRAL: Zen Hub */}
            <div className="relative z-20 sm:space-y-6 space-y-4 px-4 sm:px-0">
                <div className="glass-zen rounded-[2.5rem] p-5 sm:p-8 relative overflow-hidden group">
                    {/* Animated grid overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity"></div>
                    
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-5 sm:gap-8 relative z-10">
                        {/* Brand & Command Status */}
                        <div className="flex items-center gap-6 sm:gap-8 self-start lg:self-center w-full lg:w-auto overflow-hidden">
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                    <div className="w-3 h-1 bg-slate-900 dark:bg-white rounded-full"></div>
                                    <span className="text-xs sm:text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] font-premium">ADMINISTRACIÓN CENTRAL</span>
                                </div>
                                <h1 className="text-xl sm:text-5xl font-sans font-semibold text-slate-900 dark:text-white tracking-tighter leading-tight mb-1 truncate">
                                    Gestión <span className="text-primary italic font-light">Tributaria</span>
                                </h1>
                                <p className="text-xs sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <LucideIcons.Shield size={10} /> SISTEMA v2.5
                                </p>
                            </div>
                            <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block shrink-0"></div>
                            <div className="flex-col hidden sm:flex shrink-0">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.15em] mb-1.5 opacity-60">Status de Red</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 group-hover:scale-110 transition-transform">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white animate-pulse"></div>
                                        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter font-premium">SYNC ACTIVE</span>
                                    </div>
                                    <div className="h-4 w-[1px] bg-white/10"></div>
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.Clock size={14} className="text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-500 tech-font">14MS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Tech Search & Actions Bar: Optimized Mobile */}
                        <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
                            <div className="relative group w-full md:w-96">
                                <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
                                    <LucideIcons.Search className="text-slate-400 group-focus-within:text-emerald-400 group-focus-within:scale-110 transition-all duration-300" size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="BUSCAR CLIENTE..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-12 sm:pl-14 pr-4 text-[11px] sm:text-sm font-black text-slate-900 dark:text-white placeholder-slate-400 focus:border-slate-900 dark:focus:border-white focus:bg-white dark:focus:bg-black/30 transition-all outline-none font-premium"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 sm:group-focus-within:opacity-100 transition-opacity hidden sm:block">
                                    <span className="text-[11px] font-semibold text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/10 uppercase tracking-widest">Type to Search</span>
                                </div>
                            </div>
                            <input
                                type="file"
                                multiple
                                accept=".pdf"
                                ref={fileInputRef}
                                onChange={handleBulkUpload}
                                className="hidden"
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className="w-full md:w-auto flex items-center justify-center gap-3 sm:gap-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-xs sm:text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-slate-900/10 dark:shadow-none disabled:opacity-50 relative overflow-hidden group/btn font-premium"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                                {isProcessing ? (
                                    <LucideIcons.Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <LucideIcons.Upload size={16} fill="currentColor" />
                                )}
                                CARGA RÁPIDA
                            </button>
                            <div className="flex items-center bg-slate-100 dark:bg-black/20 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 opacity-50'}`}
                                    title="Vista de Lista"
                                >
                                    <LucideIcons.List size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('matrix')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 opacity-50'}`}
                                    title="Vista de Matriz"
                                >
                                    <LucideIcons.LayoutGrid size={18} />
                                </button>
                            </div>
                            {viewMode === 'matrix' && (
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 font-premium shrink-0"
                                >
                                    <LucideIcons.Printer size={16} />
                                    EXPORTAR PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {/* COMPLIANCE SEMAPHORE: Proactive Health Indicator */}
                    <PortfolioSemaphore 
                        summary={complianceSummary} 
                        onFilterChange={(newFilter) => setFilter(newFilter as any)}
                        activeFilter={filter as any}
                    />

                    {/* METRICS DOCK: High-Density Swiper on Mobile */}
                    <div className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-6 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-100 dark:border-white/5 overflow-x-auto sm:overflow-x-visible no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory pb-4 sm:pb-0">
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 glass-zen group cursor-pointer" onClick={() => setFilter('all')}>
                            <div className="p-3 sm:p-4 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-2xl group-hover:bg-slate-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-slate-900 transition-all shadow-sm border border-slate-200 dark:border-white/5 shrink-0">
                                <LucideIcons.Users size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">Total Clientes</p>
                                <p className="text-xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tighter leading-none">{kpis.total}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 glass-zen group cursor-pointer" onClick={() => setFilter('all')}>
                            <div className={`p-3 sm:p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 transition-all shadow-sm shrink-0`}>
                                <LucideIcons.TrendingUp size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5 font-premium">Facturación Est.</p>
                                <p className={`text-xl sm:text-3xl font-black tracking-tighter leading-none font-premium text-emerald-600 dark:text-emerald-400`}>${Math.round(kpis.projectedIncome)}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[85%] sm:w-auto snap-center flex items-center gap-5 p-4 glass-zen group cursor-pointer" onClick={() => navigate('clients', { initialFilter: { hasMissingPdf: true, title: 'Auditoría de Bóveda' } })}>
                            <div className={`p-3.5 sm:p-4 rounded-2xl transition-all shadow-sm border shrink-0 ${clients.filter(c => 
                                    c.declarations?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
                                    )
                                ).length > 0 ? 'bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/20' : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800 dark:border-white/5'}`}>
                                <LucideIcons.Vault size={22} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-1">Archivo Digital</p>
                                <p className={`text-2xl sm:text-3xl font-semibold tracking-tighter leading-none ${clients.filter(c => 
                                    c.declarations?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
                                    )
                                ).length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{clients.filter(c => 
                                    c.declarations?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proof_file
                                    )
                                ).length}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[90%] sm:w-auto sm:col-span-1 snap-center flex flex-col justify-center p-4 sm:p-5 glass-zen relative overflow-hidden group/progress">
                             <div className="relative z-10 w-full">
                                <div className="flex justify-between items-end mb-2 sm:mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1 font-premium">LOGRO FISCAL</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-premium">{complianceSummary.averageScore}%</span>
                                            <span className="text-xs sm:text-xs font-black text-slate-400 uppercase tracking-widest hidden sm:inline font-premium">Eficiencia</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase mb-0.5 sm:mb-1 font-premium">{completados.length} / {allResults.length}</span>
                                        <LucideIcons.CheckCircle2 size={14} className="text-slate-900 dark:text-white" />
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-black/20 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-slate-900 dark:bg-white transition-all duration-1000 ease-out"
                                        style={{ width: `${complianceSummary.averageScore}%` }}
                                    ></div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaign Progress Legend (Subtle) */}
            <div className="flex items-center gap-4 px-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white"></div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">{completados.length} Declarados</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/10"></div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-premium">{pendientes.length} Pendientes</span>
                </div>
            </div>



            {/* Critical Alerts Panel Refinado */}
            {(expiringSignatures.length > 0 || activeRentaRefunds.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Renta Refunds Panel - High Priority */}
                    {activeRentaRefunds.length > 0 && (
                        <div className="bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none animate-fade-in-down lg:col-span-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-2xl">
                                        <LucideIcons.HandCoins size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] font-premium">Devoluciones de Renta</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{activeRentaRefunds.length} expedientes en monitoreo</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white animate-pulse"></div>
                                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest font-premium">ACTIVO</span>
                                </div>
                            </div>
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeRentaRefunds.map(c => {
                                    const requestedAt = c.rentaRefundRequestedAt ? new Date(c.rentaRefundRequestedAt) : new Date();
                                    const hoursPassed = Math.abs(new Date().getTime() - requestedAt.getTime()) / 36e5;
                                    const isCritical = hoursPassed > 24;
                                    return (
                                        <div key={c.id} className={`group/item flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-5 rounded-[2rem] border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all`}>
                                            <div className="flex flex-col min-w-0 pr-4">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-50 uppercase tracking-tight font-premium truncate">{c.name}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest mt-2 ${isCritical ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    Tiempo: {hoursPassed.toFixed(1)}H {isCritical && '• PRIORIDAD'}
                                                </span>
                                            </div>
                                            <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="shrink-0 px-6 py-2.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all font-premium">
                                                DETALLE
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {/* Expiring Signatures Alert */}
                    {expiringSignatures.length > 0 && (
                        <div className="bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-none animate-fade-in-down lg:col-span-full mt-4">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl">
                                        <LucideIcons.AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] font-premium">Firmas por Caducar</h3>
                                        <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest mt-2">{expiringSignatures.length} perfiles requieren renovación</p>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight className="text-slate-300" size={20} />
                            </div>
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                                {expiringSignatures.map(c => (
                                    <div key={c.id} className="group/item flex justify-between items-center bg-slate-50/50 dark:bg-white/5 p-5 rounded-[2rem] border border-transparent hover:border-rose-200 dark:hover:border-rose-900/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-50 uppercase tracking-tight font-premium">{c.name}</span>
                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-2">VENCE: {c.signatureExpirationDate}</span>
                                        </div>
                                        <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-6 py-2.5 bg-rose-500 text-white hover:bg-rose-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all font-premium shadow-lg shadow-rose-200/50 dark:shadow-none">
                                            RENOVAR
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* Workflow Tabs (Smart Floating Orbital Dock) */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] sm:relative sm:bottom-0 sm:left-0 sm:translate-x-0 w-[95%] sm:w-auto max-w-4xl">
                <div className="glass-tactical-dock rounded-full p-2 flex items-center gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 dark:bg-black/60 backdrop-blur-3xl no-scrollbar overflow-x-auto">
                    {[
                        { id: 'all', label: 'Directorio', icon: LucideIcons.Users },
                        { id: 'digital-mando', label: 'Mando Digital', icon: LucideIcons.Activity, color: 'text-sky-400' },
                        { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Calendar },
                        { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Clock },
                        { id: 'renta', label: 'Renta Anual', icon: LucideIcons.ShieldCheck },
                        { id: 'urgent', label: 'Crítico SRI', icon: LucideIcons.Zap, color: 'text-rose-400' },
                    ].map(tab => {
                        const isActive = filter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`
                                    relative flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap group/tab font-premium
                                    ${isActive
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl scale-105 sm:scale-105 z-10'
                                        : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                                    }
                                `}
                            >
                                <tab.icon size={14} className={`${isActive ? 'text-white' : tab.color || 'text-slate-500 group-hover/tab:text-emerald-400'} transition-colors`} />
                                <span className="relative z-10">{tab.label}</span>
                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-full"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>


            {/* INBOX ZERO TABS: Tactical Multi-Stage Switch (Optimized for Mobile) */}
            {!searchTerm && (
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-10 z-10 relative">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setInboxTab('pendientes')}
                            className={`flex-1 sm:flex-none group relative flex items-center gap-3 sm:gap-5 p-1.5 sm:p-2 pr-4 sm:pr-8 rounded-full transition-all duration-500 border ${inboxTab === 'pendientes' ? 'glass-elite border-emerald-400/30' : 'border-transparent opacity-60'}`}
                        >
                            <div className={`p-3 sm:p-4 rounded-full transition-all duration-500 ${inboxTab === 'pendientes' ? 'bg-primary text-white shadow-lg' : 'bg-slate-800'}`}>
                                <LucideIcons.Flashlight size={18} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col items-start translate-y-[1px]">
                                <span className="text-[11px] sm:text-xs font-semibold tech-font text-emerald-400 uppercase tracking-widest mb-0.5">PENDIENTES</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm sm:text-xl font-premium font-semibold text-slate-900 dark:text-white uppercase tracking-tight">Deploy</span>
                                    <span className="px-1.5 py-0.5 bg-rose-400/20 text-rose-400 text-xs sm:text-xs font-semibold rounded tech-font">{pendientes.length}</span>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setInboxTab('completados')}
                            className={`flex-1 sm:flex-none group relative flex items-center gap-3 sm:gap-5 p-1.5 sm:p-2 pr-4 sm:pr-8 rounded-full transition-all duration-500 border ${inboxTab === 'completados' ? 'glass-elite border-sky-400/30' : 'border-transparent opacity-60'}`}
                        >
                            <div className={`p-3 sm:p-4 rounded-full transition-all duration-500 ${inboxTab === 'completados' ? 'bg-accent text-white shadow-lg' : 'bg-slate-800'}`}>
                                <LucideIcons.ShieldCheck size={18} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col items-start translate-y-[1px]">
                                <span className="text-[11px] sm:text-xs font-semibold tech-font text-sky-400 uppercase tracking-widest mb-0.5">COMPLETADOS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm sm:text-xl font-premium font-semibold text-slate-900 dark:text-white uppercase tracking-tight">Docs</span>
                                    <span className="px-1.5 py-0.5 bg-emerald-400/20 text-emerald-400 text-xs sm:text-xs font-semibold rounded tech-font">{completados.length}</span>
                                </div>
                            </div>
                        </button>
                    </div>
                    
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="h-4 w-[1px] bg-white/10 mx-4"></div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Operación: {formatPeriodForDisplay(getPeriod({ ruc: '0000000000001' } as any, new Date())).split(' ')[0]}</span>
                    </div>
                </div>
            )}

            {searchTerm && (
                <div className="mb-8 flex items-center gap-4 text-slate-800 dark:text-white font-medium text-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 animate-fade-in-down shadow-2xl">
                    <div className="p-4 bg-emerald-400 text-white rounded-2xl shadow-xl shadow-emerald-400/20">
                        <LucideIcons.Search size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg tracking-tight">Mostrando resultados para <span className="text-emerald-400 font-semibold">"{searchTerm}"</span></span>
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-[0.2em] mt-1">{activeList.length} clientes en el radar</span>
                    </div>
                    <button
                        onClick={() => setSearchTerm('')}
                        className="ml-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-semibold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        Resetear Búsqueda
                    </button>
                </div>
            )}

            {/* Client Grid (Virtualized) or Matrix View */}
            <div className="animate-fade-in no-print">
                {viewMode === 'matrix' ? (
                    <TaxComplianceMatrix 
                        clients={matrixClients}
                        onViewClient={(c) => navigate('clients', { clientIdToView: c.id })}
                        onUploadReceipt={handleUploadFromMatrix}
                        onPreviewReceipt={(c, d) => setPreviewState({ isOpen: true, client: c, declaration: d })}
                        theme={theme}
                    />
                ) : activeList.length > 0 ? (
                    <VirtualClientList
                        clients={activeList}
                        serviceFees={serviceFees}
                        onQuickAction={handleAction}
                        onView={(c) => navigate('clients', { clientIdToView: c.id })}
                        frequency={filter === 'semestral' ? 'Semestral' : (filter === 'mensual' ? 'Mensual' : 'all')}
                    />
                ) : (
                    <div className="py-32 text-center">
                        <div className="relative inline-flex mb-6">
                            <div className="absolute inset-0 bg-brand-teal/20 blur-3xl rounded-full"></div>
                            <div className="relative p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl">
                                <LucideIcons.Inbox size={48} className="text-slate-300 dark:text-slate-700" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">Búsqueda sin resultados</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm font-medium">
                            No encontramos clientes que coincidan con el filtro <span className="text-brand-teal font-medium">"{filter}"</span> o tu búsqueda actual.
                        </p>
                        <button
                            onClick={() => { setSearchTerm(''); setFilter('all'); }}
                            className="mt-8 px-6 py-2.5 bg-brand-navy text-white rounded-xl font-semibold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Restablecer Flujo
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden component for Print Export */}
            <ComplianceReportExport 
                clients={matrixClients}
                periods={matrixPeriods}
                frequency={filter === 'semestral' ? 'Semestral' : 'Mensual'}
            />

            {previewState.client && previewState.declaration && (
                <PdfPreviewModal
                    isOpen={previewState.isOpen}
                    onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
                    client={previewState.client}
                    declaration={previewState.declaration}
                    onDownload={() => {
                        const link = document.createElement('a');
                        link.href = previewState.declaration.proof_file.url;
                        link.download = previewState.declaration.proof_file.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                />
            )}
            <BulkUploadReportModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                results={bulkResults as any}
            />
            {/* Renta Refund Floating Orb */}
            {activeRentaRefunds.length > 0 && (
                <div className="fixed bottom-24 right-6 z-50 animate-bounce-slow">
                    <button
                        onClick={() => setFilter('renta')}
                        className="group relative flex items-center gap-3 p-4 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-[2rem] shadow-[0_20px_40px_rgba(245,158,11,0.4)] border border-amber-300/30 transition-all hover:scale-110 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <LucideIcons.HandCoins size={24} className="relative z-10" />
                        <span className="font-semibold text-xs tracking-widest uppercase relative z-10 pr-2">
                            {activeRentaRefunds.length} Refund{activeRentaRefunds.length > 1 ? 's' : ''}
                        </span>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center">
                            <LucideIcons.AlertCircle size={8} strokeWidth={4} />
                        </div>
                    </button>
                </div>
            )}

            <input
                type="file"
                accept=".pdf"
                ref={matrixFileInputRef}
                onChange={onMatrixFileChange}
                className="hidden"
            />
            <ChatBot />
        </div>
    );
};
