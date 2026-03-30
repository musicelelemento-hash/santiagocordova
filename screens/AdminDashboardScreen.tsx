
import React, { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Screen, Client, DeclarationStatus, TaxRegime } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getPeriod, getDueDateForPeriod, formatPeriodForDisplay } from '../services/sri';
import { isPast, isToday, isTomorrow } from 'date-fns';
import { ClientCard } from '../components/features/ClientCard';
import { useToast } from '../context/ToastContext';
import { PdfPreviewModal } from '../components/features/ClientDetail/PdfPreviewModal';
import { processBulkPdfs, BulkProcessResult } from '../services/bulkOperations';
import { BulkUploadReportModal } from '../components/features/BulkUploadReportModal';
import { ChatBot } from '../components/features/ChatBot';
import { VirtualClientList } from '../components/features/VirtualClientList';

interface AdminDashboardScreenProps {
    navigate: (screen: Screen, options?: any) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigate }) => {
    const { clients, setClients, serviceFees, updateClient } = useAppStore();
    const { toast } = useToast();

    // Auto-detección de Campaña Mensual
    const [filter, setFilter] = useState<'all' | 'mensual' | 'semestral' | 'vip' | 'urgent' | 'rimpe' | 'popular' | 'renta' | 'overdue' | 'prepaid' | 'no-iva' | 'no-renta' | 'boveda'>(() => {
        return (sessionStorage.getItem('dashboard_filter') as any) || 'mensual';
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
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    // --- SINGLE PASS PERFORMANCE ENGINE ---
    const { 
        urgentPriorities, pendientes, completados, allResults, 
        kpis, expiringSignatures, activeRentaRefunds 
    } = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const rentaPeriod = (currentYear - 1).toString();
        const next15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
        
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
            const currentP = getPeriod(c, today);
            const dueDate = getDueDateForPeriod(c, currentP);
            const declarations = c.declarations || [];
            
            const ivaDecl = declarations.find(dh => dh.period === currentP);
            const isIvaDeclared = !!ivaDecl?.proof_file || ivaDecl?.status === DeclarationStatus.Enviada || ivaDecl?.status === DeclarationStatus.Pagada;
            
            const rentaDecl = declarations.find(dh => dh.period === rentaPeriod);
            const needsRenta = c.taxProfile?.requiresAnnualRenta ?? (c.regime === TaxRegime.RimpeEmprendedor || c.regime === TaxRegime.RimpeNegocioPopular || c.regime === TaxRegime.General);
            const isRentaDeclared = !!rentaDecl?.proof_file || rentaDecl?.status === DeclarationStatus.Enviada || rentaDecl?.status === DeclarationStatus.Pagada;

            // Stats
            if (dueDate && isPast(dueDate) && !isIvaDeclared) overdueCount++;
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
                const isUrgent = (dueDate && (isPast(dueDate) || isToday(dueDate))) && !isIvaDeclared;
                filterMatch = !!isUrgent;
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
            }

            if (filterMatch) {
                filtered.push(c);
                
                // 3. Categorization (Inbox)
                const needsIva = c.regime !== TaxRegime.RimpeNegocioPopular && c.taxProfile?.ivaFrequency !== 'Ninguno';
                const isDone = (!needsIva || isIvaDeclared) && (!needsRenta || isRentaDeclared);

                if (isDone) {
                    comps.push(c);
                } else {
                    let isUrgent = false;
                    if (needsIva && !isIvaDeclared && dueDate && (isPast(dueDate) || isToday(dueDate))) isUrgent = true;
                    if (needsRenta && !isRentaDeclared && today.getMonth() >= 2) isUrgent = true;
                    if (ivaDecl && !ivaDecl.proof_file && ivaDecl.status === DeclarationStatus.Enviada) isUrgent = true;
                    if (rentaDecl && !rentaDecl.proof_file && rentaDecl.status === DeclarationStatus.Enviada) isUrgent = true;

                    if (isUrgent) urgents.push(c);
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
            activeRentaRefunds: refunds
        };
    }, [clients, filter, searchTerm]);


    const activeList = searchTerm ? allResults : (inboxTab === 'pendientes' ? (filter === 'all' || filter === 'mensual' ? [...urgentPriorities, ...pendientes] : allResults) : completados);


    // ... (handleAction remains same) ...
    const handleAction = (client: Client, action: 'declare' | 'pay' | 'deactivate', customPeriod?: string) => {
        const today = new Date();
        const period = customPeriod || getPeriod(client, today);
        const nowIso = today.toISOString();

        if (action === 'deactivate') {
            updateClient(client.id, { isActive: false });
            toast.success(`${client.name} desactivado`);
            return;
        }

        setClients(prev => prev.map(c => {
            if (c.id !== client.id) return c;

            const history = [...c.declarations];
            const idx = history.findIndex(d => d.period === period);
            const newStatus = action === 'declare' ? DeclarationStatus.Enviada : DeclarationStatus.Pagada;

            const newEntry = {
                period,
                status: newStatus,
                updatedAt: nowIso,
                ...(action === 'declare' ? { declaredAt: nowIso } : {}),
                ...(action === 'pay' ? { paidAt: nowIso, transactionId: `Q-${Date.now().toString().slice(-4)}` } : {})
            };

            if (idx > -1) {
                history[idx] = { ...history[idx], ...newEntry };
            } else {
                history.push(newEntry);
            }
            return { ...c, declarations: history };
        }));

        toast.success(action === 'declare' ? 'Declaración registrada' : 'Pago registrado');
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
                                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-tighter">DÍGITO CRÍTICO HOY:</p>
                                    <span className="text-2xl sm:text-4xl text-rose-400 font-display font-semibold tracking-tighter drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">{tacticalInfo.todayDigit}</span>
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
            <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-sky-400/5 dark:bg-sky-400/5 blur-[160px] rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-0 w-[800px] h-[800px] bg-emerald-400/5 dark:bg-emerald-400/5 blur-[140px] rounded-full pointer-events-none"></div>

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
                                    <div className="w-3 h-1 bg-emerald-400 rounded-full"></div>
                                    <span className="text-xs sm:text-xs font-medium text-emerald-400 uppercase tracking-[0.4em]">ADMINISTRACIÓN CENTRAL</span>
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
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"></div>
                                        <span className="text-[11px] font-semibold text-emerald-400 tech-font uppercase tracking-tighter">SYNC ACTIVE</span>
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
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-12 sm:pl-14 pr-4 text-[11px] sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-400 focus:bg-white dark:focus:bg-black/30 transition-all outline-none"
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
                                className="w-full md:w-auto flex items-center justify-center gap-3 sm:gap-4 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-400 dark:hover:bg-emerald-500 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-xs sm:text-[11px] font-medium uppercase tracking-[0.2em] hover:scale-[1.03] active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                                {isProcessing ? (
                                    <LucideIcons.Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <LucideIcons.Upload size={16} fill="currentColor" />
                                )}
                                CARGA RÁPIDA
                            </button>
                        </div>
                    </div>

                    {/* METRICS DOCK: High-Density Swiper on Mobile */}
                    <div className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-6 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-100 dark:border-white/5 overflow-x-auto sm:overflow-x-visible no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory pb-4 sm:pb-0">
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 glass-zen group cursor-pointer" onClick={() => setFilter('all')}>
                            <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm border border-slate-200 dark:border-white/5 shrink-0">
                                <LucideIcons.Users size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">Cartera Total</p>
                                <p className="text-xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tighter leading-none">{kpis.total}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 glass-zen group cursor-pointer" onClick={() => setFilter('overdue')}>
                            <div className={`p-3 sm:p-4 rounded-2xl transition-all shadow-sm border shrink-0 ${kpis.overdue > 0 ? 'bg-rose-50 text-rose-400 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                <LucideIcons.ShieldAlert size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-0.5">Pendientes Críticos</p>
                                <p className={`text-xl sm:text-3xl font-semibold tracking-tighter leading-none ${kpis.overdue > 0 ? 'text-rose-400' : 'text-primary'}`}>{kpis.overdue}</p>
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
                                        <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">CONSOLIDADO</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl sm:text-2xl font-semibold text-primary">{Math.round((completados.length / (allResults.length || 1)) * 100)}%</span>
                                            <span className="text-xs sm:text-xs font-medium text-slate-400 uppercase tracking-widest hidden sm:inline">Eficiencia</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase mb-0.5 sm:mb-1">{completados.length} / {allResults.length}</span>
                                        <LucideIcons.CheckCircle2 size={14} className="text-primary" />
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-black/20 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(134,167,137,0.3)]"
                                        style={{ width: `${(completados.length / (allResults.length || 1)) * 100}%` }}
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
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{completados.length} Declarados</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{pendientes.length} Pendientes</span>
                </div>
            </div>



            {/* Critical Alerts Panel Refinado */}
            {(expiringSignatures.length > 0 || activeRentaRefunds.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Renta Refunds Panel - High Priority */}
                    {activeRentaRefunds.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200/60 dark:border-amber-800/60 rounded-[2rem] p-6 shadow-xl shadow-amber-400/5 animate-fade-in-down lg:col-span-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-500 dark:text-amber-400 rounded-xl">
                                        <LucideIcons.HandCoins size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-lg">Trámites Devolución Renta</h3>
                                        <p className="text-amber-500/70 dark:text-amber-400/60 text-xs font-semibold uppercase tracking-widest">{activeRentaRefunds.length} en seguimiento intensivo</p>
                                    </div>
                                </div>
                                <LucideIcons.Clock className="text-amber-400 animate-spin-slow" size={20} />
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeRentaRefunds.map(c => {
                                    const requestedAt = c.rentaRefundRequestedAt ? new Date(c.rentaRefundRequestedAt) : new Date();
                                    const hoursPassed = Math.abs(new Date().getTime() - requestedAt.getTime()) / 36e5;
                                    const isCritical = hoursPassed > 24;
                                    return (
                                        <div key={c.id} className={`group/item flex justify-between items-center bg-white dark:bg-slate-800/50 p-3.5 rounded-2xl border transition-all ${isCritical ? 'border-red-300 dark:border-red-800/50 hover:border-rose-400' : 'border-amber-100 dark:border-amber-900/30 hover:border-amber-400'}`}>
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{c.name}</span>
                                                <span className={`text-xs font-semibold uppercase tracking-wider mt-0.5 ${isCritical ? 'text-rose-400' : 'text-amber-500 dark:text-amber-400'}`}>
                                                    Tiempo Transcurrido: {hoursPassed.toFixed(1)}h
                                                </span>
                                            </div>
                                            <button onClick={() => navigate('clients', { clientIdToView: c.id })} className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-xl transition-all uppercase ${isCritical ? 'bg-red-50 text-rose-400 hover:bg-rose-400 hover:text-white dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                Revisar
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {/* Expiring Signatures Alert */}
                    {expiringSignatures.length > 0 && (
                        <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-900 border border-red-200/60 dark:border-red-800/60 rounded-[2rem] p-6 shadow-xl shadow-rose-400/5 animate-fade-in-down">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-red-100 dark:bg-red-900/40 text-rose-400 dark:text-red-400 rounded-xl">
                                        <LucideIcons.AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-red-900 dark:text-red-300 text-lg">Firmas por Caducar</h3>
                                        <p className="text-rose-400/70 dark:text-red-400/60 text-xs font-semibold uppercase tracking-widest">{expiringSignatures.length} Clientes en riesgo</p>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight className="text-red-300" size={20} />
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {expiringSignatures.map(c => (
                                    <div key={c.id} className="group/item flex justify-between items-center bg-white dark:bg-slate-800/50 p-3.5 rounded-2xl border border-red-100 dark:border-red-900/30 hover:border-red-400 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{c.name}</span>
                                            <span className="text-xs text-rose-400 font-medium flex items-center gap-1 mt-0.5"><LucideIcons.Calendar size={12} /> Expira: {c.signatureExpirationDate}</span>
                                        </div>
                                        <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-4 py-1.5 bg-red-50 dark:bg-red-900/30 text-rose-400 dark:text-red-400 text-xs font-semibold rounded-xl hover:bg-rose-400 hover:text-white transition-all uppercase">Ver Detalle</button>
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
                        { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Calendar },
                        { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Clock },
                        { id: 'renta', label: 'Renta Anual', icon: LucideIcons.ShieldCheck },
                        { id: 'urgent', label: 'Crítico SRI', icon: LucideIcons.Zap, color: 'text-rose-400' },
                        { id: 'no-iva', label: 'Sin IVA', icon: LucideIcons.XCircle },
                        { id: 'no-renta', label: 'Sin Renta', icon: LucideIcons.XCircle },
                    ].map(tab => {
                        const isActive = filter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`
                                    relative flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-500 whitespace-nowrap group/tab
                                    ${isActive
                                        ? 'bg-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105 sm:scale-110 z-10'
                                        : 'text-slate-400 hover:text-white hover:bg-white/10'
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

            {/* Client Grid (Virtualized) */}
            <div className="animate-fade-in">
                {activeList.length > 0 ? (
                    <VirtualClientList
                        clients={activeList}
                        serviceFees={serviceFees}
                        onQuickAction={handleAction}
                        onView={(c) => navigate('clients', { clientIdToView: c.id })}
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

            <ChatBot />
        </div>
    );
};
