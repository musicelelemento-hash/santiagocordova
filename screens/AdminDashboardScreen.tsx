
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
    const [filter, setFilter] = useState<'all' | 'mensual' | 'semestral' | 'vip' | 'urgent' | 'rimpe' | 'popular' | 'renta' | 'overdue' | 'prepaid' | 'no-iva' | 'no-renta' | 'boveda'>('mensual');
    const [inboxTab, setInboxTab] = useState<'pendientes' | 'completados'>('pendientes');
    const [searchTerm, setSearchTerm] = useState('');
    const [previewState, setPreviewState] = useState<{ isOpen: boolean, client: Client | null, declaration: any | null }>({
        isOpen: false,
        client: null,
        declaration: null
    });
    const [bulkResults, setBulkResults] = useState<BulkProcessResult[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const workspaceData = useMemo(() => {
        let list = clients.filter(c => !c.isDeleted && c.isActive);
        const today = new Date();

        // 1. Filtrado por Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(term) || c.ruc.includes(term));
        }

        // 2. Filtrado por Tabs de Obligación
        if (filter === 'mensual') {
            list = list.filter(c => {
                const freq = c.taxProfile?.ivaFrequency || 'Mensual';
                return freq === 'Mensual';
            });
        } else if (filter === 'semestral') {
            list = list.filter(c => {
                const freq = c.taxProfile?.ivaFrequency;
                const isSem = freq === 'Semestral' || c.regime === TaxRegime.RimpeEmprendedor;
                return isSem;
            });

        } else if (filter === 'urgent') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const d = getDueDateForPeriod(c, p);
                const isDeclared = (c.declarationHistory || []).some(dh => dh.period === p && (dh.status === DeclarationStatus.Enviada || dh.status === DeclarationStatus.Pagada || !!dh.proofFile));
                return !isDeclared && d && (isPast(d) || isToday(d) || isTomorrow(d) || d.getTime() - today.getTime() < 3 * 24 * 60 * 60 * 1000);
            });
        } else if (filter === 'rimpe') {
            list = list.filter(c => c.regime === TaxRegime.RimpeEmprendedor || c.regime === TaxRegime.RimpeNegocioPopular);
        } else if (filter === 'popular') {
            list = list.filter(c => c.regime === TaxRegime.RimpeNegocioPopular);
        } else if (filter === 'renta') {
            list = list.filter(c => c.taxProfile?.requiresAnnualRenta || c.regime === TaxRegime.RimpeNegocioPopular || c.regime === TaxRegime.RimpeEmprendedor);
        } else if (filter === 'overdue') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const d = getDueDateForPeriod(c, p);
                const isDone = (c.declarationHistory || []).some(dh => dh.period === p && (dh.status === DeclarationStatus.Enviada || dh.status === DeclarationStatus.Pagada));
                return d && isPast(d) && !isDone && c.isActive;
            });
        } else if (filter === 'prepaid') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const dec = (c.declarationHistory || []).find(dh => dh.period === p);
                return dec?.isPaid && dec?.status === DeclarationStatus.Pendiente && c.isActive;
            });
        } else if (filter === 'no-iva') {
            list = list.filter(c => c.taxProfile?.ivaFrequency === 'Ninguno');
        } else if (filter === 'no-renta') {
            list = list.filter(c => c.taxProfile?.requiresAnnualRenta === false);
        } else if (filter === 'boveda') {
            list = list.filter(c => {
                const p = getPeriod(c, today);
                const decl = (c.declarationHistory || []).find(dh => dh.period === p);
                return decl && !decl.proofFile && (decl.status === DeclarationStatus.Enviada || decl.status === DeclarationStatus.Pagada);
            });
        }

        // 3. Ordenamiento Elite: Estrictamente por Vencimiento SRI (1, 2, 3... 9, 0)
        return list.sort((a, b) => {
            const digitA = parseInt(a.ruc[8], 10);
            const digitB = parseInt(b.ruc[8], 10);
            
            // Map 0 to 10 for SRI order (1, 2, 3... 9, 0)
            const sortA = digitA === 0 ? 10 : digitA;
            const sortB = digitB === 0 ? 10 : digitB;

            if (sortA !== sortB) return sortA - sortB;
            
            // Por nombre si es el mismo dígito
            return a.name.localeCompare(b.name);
        });
    }, [clients, filter, searchTerm]);

    // INBOX ZERO & PRIORITY GROUPING
    const { urgentPriorities, pendientes, completados, allResults } = useMemo(() => {
        const today = new Date();
        const urgents: Client[] = [];
        const peds: Client[] = [];
        const comps: Client[] = [];
        
        for (const c of workspaceData) {
            const currentP = getPeriod(c, today);
            
            // Check IVA
            const ivaDecl = (c.declarationHistory || []).find(dh => dh.period === currentP);
            const isIvaDeclared = !!ivaDecl?.proofFile || ivaDecl?.status === DeclarationStatus.Enviada || ivaDecl?.status === DeclarationStatus.Pagada;
            
            // Check Renta
            const currentYear = today.getFullYear();
            const rentaPeriod = (currentYear - 1).toString();
            const needsRenta = c.taxProfile?.requiresAnnualRenta ?? (c.regime === TaxRegime.RimpeEmprendedor || c.regime === TaxRegime.RimpeNegocioPopular || c.regime === TaxRegime.General);
            const rentaDecl = (c.declarationHistory || []).find(dh => dh.period === rentaPeriod);
            const isRentaDeclared = !!rentaDecl?.proofFile || !!c.annualRentaProof || rentaDecl?.status === DeclarationStatus.Enviada || rentaDecl?.status === DeclarationStatus.Pagada;

            const needsIva = c.regime !== TaxRegime.RimpeNegocioPopular && c.taxProfile?.ivaFrequency !== 'Ninguno';

            // Only consider them "Done" (Completado) if all required *tax declarations* are made.
            const isDone = (!needsIva || isIvaDeclared) && (!needsRenta || isRentaDeclared);
            
            if (c.isDeleted || !c.isActive) continue;

            if (isDone) {
                comps.push(c);
            } else {
                // If not done, check if it's strictly urgent based on their *next* chronological due date
                let isUrgent = false;
                
                if (needsIva && !isIvaDeclared) {
                    const dueDate = getDueDateForPeriod(c, currentP);
                    if (dueDate && (isPast(dueDate) || isToday(dueDate))) isUrgent = true;
                }
                
                if (needsRenta && !isRentaDeclared) {
                    // Approximate renta due date for urgency (March/April). Assuming overdue if in June for instance.
                    // For now, if they need Renta and we are in March or later, and it's not declared, flag it.
                    // For now, if they need Renta and we are in March or later, and it's not declared, flag it.
                    if (today.getMonth() >= 2) isUrgent = true; 
                }

                // RED DOT: Declarado pero sin PDF
                if (ivaDecl && !ivaDecl.proofFile && ivaDecl.status === DeclarationStatus.Enviada) isUrgent = true;
                if (rentaDecl && !rentaDecl.proofFile && (rentaDecl.status === DeclarationStatus.Enviada || !!c.annualRentaProof)) {
                    // This logic depends on where the proof is stored. Ensuring it flags missing PDF.
                    if (!c.annualRentaProof) isUrgent = true;
                }

                if (isUrgent) {
                    urgents.push(c);
                } else {
                    peds.push(c);
                }
            }
        }
        return { urgentPriorities: urgents, pendientes: peds, completados: comps, allResults: workspaceData };
    }, [workspaceData]);

    const activeList = searchTerm ? allResults : (inboxTab === 'pendientes' ? (filter === 'all' || filter === 'mensual' ? [...urgentPriorities, ...pendientes] : allResults) : completados);

    const kpis = useMemo(() => {
        const today = new Date();
        const overdue = clients.filter(c => {
            const p = getPeriod(c, today);
            const d = getDueDateForPeriod(c, p);
            const isDone = (c.declarationHistory || []).some(dh => dh.period === p && (dh.status === DeclarationStatus.Pagada || dh.status === DeclarationStatus.Enviada));
            return d && isPast(d) && !isDone && c.isActive;
        }).length;

        // Updated income calculation using new fee structure if available
        const monthlyIncome = clients.filter(c => c.isActive).reduce((sum, c) => {
            const monthlyFee = c.feeStructure?.monthly ?? c.customServiceFee ?? 0;
            return sum + monthlyFee;
        }, 0);

        const prepaidCount = clients.filter(c => {
            const p = getPeriod(c, today);
            const dec = (c.declarationHistory || []).find(dh => dh.period === p);
            return dec?.isPaid && dec?.status === DeclarationStatus.Pendiente && c.isActive;
        }).length;

        return {
            total: clients.filter(c => c.isActive && !c.isDeleted).length,

            overdue,
            prepaid: prepaidCount,
            projectedIncome: monthlyIncome
        };
    }, [clients]);

    const expiringSignatures = useMemo(() => {
        const today = new Date();
        const nextMonth = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
        return clients.filter(c => {
            if (!c.isActive || !c.signatureExpirationDate) return false;
            const expDate = new Date(c.signatureExpirationDate);
            if (isNaN(expDate.getTime())) return false;
            return expDate <= nextMonth;
        });
    }, [clients]);

    const activeRentaRefunds = useMemo(() => {
        return clients.filter(c => c.isActive && c.hasRentaRefund && (c.rentaRefundStatus === 'Solicitado' || c.rentaRefundStatus === 'Pendiente'));
    }, [clients]);

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

            const history = [...c.declarationHistory];
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
            return { ...c, declarationHistory: history };
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
        <div className="space-y-8 animate-fade-in pb-20 relative aurora-premium min-h-screen">
            {/* Stitch Design Suggestion Hub - Elite Tactical Refinement */}
            {stitchSuggestions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in relative z-30">
                    {stitchSuggestions.map((s, idx) => (
                        <div key={idx} onClick={s.action} className="group relative overflow-hidden glass-tactical p-6 rounded-[2.5rem] border border-white/10 hover:neon-border-teal transition-all cursor-pointer hover:-translate-y-2 shadow-2xl">
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full -mr-16 -mt-16 transition-all duration-700 group-hover:scale-150 ${s.priority === 'high' ? 'bg-rose-500/10' : s.priority === 'medium' ? 'bg-amber-500/10' : 'bg-sky-500/10'}`}></div>
                            <div className="flex flex-col relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${s.priority === 'high' ? 'bg-rose-500' : s.priority === 'medium' ? 'bg-amber-500' : 'bg-sky-500'}`}></div>
                                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${s.priority === 'high' ? 'text-rose-500' : s.priority === 'medium' ? 'text-amber-500' : 'text-sky-500'}`}>
                                        {s.priority === 'high' ? 'CRITICAL ANALYTICS' : s.priority === 'medium' ? 'SYSTEM ADVISORY' : 'CORE OPTIMIZATION'}
                                    </span>
                                </div>
                                <h4 className="text-base font-black text-slate-900 dark:text-white mb-2 leading-tight tracking-tight">{s.title}</h4>
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed opacity-80">{s.desc}</p>
                            </div>
                            <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                <LucideIcons.ArrowRight size={18} className="text-emerald-500" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tactical Warning Banner: Compact for Mobile */}
            {tacticalInfo.todayDigit !== null && (
                <div className="relative z-30 sm:mb-8 mb-4 animate-fade-in-down">
                    <div className="glass-tactical rounded-3xl sm:rounded-[2rem] border border-rose-500/30 p-4 sm:p-6 shadow-2xl shadow-rose-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="relative">
                                <div className="bg-rose-600 p-3 sm:p-4 rounded-full text-white shadow-2xl shadow-rose-600/40 relative z-10">
                                    <LucideIcons.ShieldAlert size={20} className="sm:w-[26px] sm:h-[26px]" strokeWidth={2.5} />
                                </div>
                                <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-0.5 sm:mb-1">RADAR ALPHA-1</span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <p className="text-[10px] sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">DÍGITO CRÍTICO HOY:</p>
                                    <span className="text-2xl sm:text-4xl text-rose-500 font-display font-black tracking-tighter drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">{tacticalInfo.todayDigit}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex items-center gap-3 relative z-10">
                            <div className="px-3 sm:px-5 py-1.5 sm:py-2 bg-slate-900/50 dark:bg-black/40 rounded-xl sm:rounded-2xl border border-white/5 backdrop-blur-md">
                                <div className="flex items-center justify-end gap-2 sm:gap-3">
                                    <span className="text-[9px] sm:text-[12px] font-black tech-font text-rose-500">{urgentPriorities.length} PENDIENTES</span>
                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Background elements refined */}
            <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-sky-500/5 dark:bg-sky-400/5 blur-[160px] rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-0 w-[800px] h-[800px] bg-emerald-500/5 dark:bg-emerald-400/5 blur-[140px] rounded-full pointer-events-none"></div>

            {/* MANDO CENTRAL: Compact Mobile Hub */}
            <div className="relative z-20 sm:space-y-6 space-y-4">
                <div className="glass-tactical rounded-3xl sm:rounded-[3rem] border border-white/10 p-5 sm:p-8 shadow-2xl relative overflow-hidden group">
                    {/* Animated grid overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity"></div>
                    
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-5 sm:gap-8 relative z-10">
                        {/* Brand & Command Status */}
                        <div className="flex items-center gap-6 sm:gap-8 self-start lg:self-center w-full lg:w-auto overflow-hidden">
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                    <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
                                    <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">ALPHA CORE</span>
                                </div>
                                <h1 className="text-xl sm:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tighter leading-tight mb-1 truncate">
                                    Tablero <span className="neon-text-teal">Tributario</span>
                                </h1>
                                <p className="text-[8px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <LucideIcons.Shield size={10} /> HQ-V2.5
                                </p>
                            </div>
                            <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block shrink-0"></div>
                            <div className="flex-col hidden sm:flex shrink-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5 opacity-60">Status de Red</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 group-hover:scale-110 transition-transform">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"></div>
                                        <span className="text-[11px] font-black text-emerald-500 tech-font uppercase tracking-tighter">SYNC ACTIVE</span>
                                    </div>
                                    <div className="h-4 w-[1px] bg-white/10"></div>
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.Clock size={14} className="text-slate-500" />
                                        <span className="text-[10px] font-black text-slate-500 tech-font">14MS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Tech Search & Actions Bar: Optimized Mobile */}
                        <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
                            <div className="relative group w-full md:w-96">
                                <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
                                    <LucideIcons.Search className="text-slate-400 group-focus-within:text-emerald-500 group-focus-within:scale-110 transition-all duration-300" size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="FILTRAR LEGIÓN..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 dark:bg-black/40 border border-white/5 dark:border-white/10 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-12 sm:pl-14 pr-4 text-[11px] sm:text-sm font-black tech-font text-slate-900 dark:text-white placeholder-slate-500 focus:neon-border-teal focus:bg-black/30 transition-all outline-none"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 sm:group-focus-within:opacity-100 transition-opacity hidden sm:block">
                                    <span className="text-[9px] font-black text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/10 uppercase tracking-widest">Type to Search</span>
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
                                className="w-full md:w-auto flex items-center justify-center gap-3 sm:gap-4 bg-emerald-500 dark:bg-white text-white dark:text-slate-900 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] hover:scale-[1.03] active:scale-95 transition-all shadow-2xl shadow-emerald-500/20 dark:shadow-white/5 disabled:opacity-50 relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                                {isProcessing ? (
                                    <LucideIcons.Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <LucideIcons.Zap size={16} fill="currentColor" />
                                )}
                                ESCUADRÓN RÁPIDO
                            </button>
                        </div>
                    </div>

                    {/* METRICS DOCK: High-Density Swiper on Mobile */}
        <div className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-6 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-white/5 overflow-x-auto sm:overflow-x-visible no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory pb-4 sm:pb-0">
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 hover:bg-white/5 bg-white/10 dark:bg-white/5 sm:bg-transparent rounded-[2rem] transition-all cursor-pointer group" onClick={() => setFilter('all')}>
                            <div className="p-3 sm:p-4 bg-sky-500/10 text-sky-500 rounded-2xl group-hover:bg-sky-500 group-hover:text-white transition-all shadow-lg shadow-sky-500/10 border border-sky-500/20 shrink-0">
                                <LucideIcons.Users size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[7px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-0.5">TOTAL LEGIÓN</p>
                                <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tech-font tracking-tighter leading-none">{kpis.total}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[240px] sm:w-auto snap-center flex items-center gap-4 p-4 hover:bg-white/5 bg-white/10 dark:bg-white/5 sm:bg-transparent rounded-[2rem] transition-all cursor-pointer group" onClick={() => setFilter('overdue')}>
                            <div className={`p-3 sm:p-4 rounded-2xl transition-all shadow-lg border shrink-0 ${kpis.overdue > 0 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                <LucideIcons.ShieldAlert size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[7px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-0.5">FALLOS CRÍTICOS</p>
                                <p className={`text-xl sm:text-3xl font-black tech-font tracking-tighter leading-none ${kpis.overdue > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{kpis.overdue}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[85%] sm:w-auto snap-center flex items-center gap-5 p-4 hover:bg-white/5 bg-white/10 dark:bg-white/5 sm:bg-transparent rounded-[2rem] transition-all cursor-pointer group" onClick={() => navigate('clients', { initialFilter: { hasMissingPdf: true, title: 'Auditoría de Bóveda' } })}>
                            <div className={`p-3.5 sm:p-4 rounded-2xl transition-all shadow-lg border shrink-0 ${clients.filter(c => 
                                    c.declarationHistory?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proofFile
                                    )
                                ).length > 0 ? 'bg-amber-500 text-white border-amber-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white'}`}>
                                <LucideIcons.Vault size={22} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[8px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-1">BOVEDA PENDIENTE</p>
                                <p className={`text-2xl sm:text-3xl font-black tech-font tracking-tighter leading-none ${clients.filter(c => 
                                    c.declarationHistory?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proofFile
                                    )
                                ).length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{clients.filter(c => 
                                    c.declarationHistory?.some(d => 
                                        (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada) && !d.proofFile
                                    )
                                ).length}</p>
                            </div>
                        </div>
                        <div className="flex-none w-[90%] sm:w-auto sm:col-span-1 snap-center flex flex-col justify-center p-4 sm:p-5 bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden group/progress">
                             <div className="relative z-10 w-full">
                                <div className="flex justify-between items-end mb-2 sm:mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">INTEGRIDAD</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl sm:text-2xl font-black text-emerald-500 tech-font">{Math.round((completados.length / (allResults.length || 1)) * 100)}%</span>
                                            <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest hidden sm:inline">CONSOLIDADO</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase mb-0.5 sm:mb-1">{completados.length} / {allResults.length}</span>
                                        <LucideIcons.TrendingUp size={14} className="text-emerald-500" />
                                    </div>
                                </div>
                                <div className="w-full h-2 sm:h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-sky-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.4)] relative"
                                        style={{ width: `${(completados.length / (allResults.length || 1)) * 100}%` }}
                                    >
                                        <div className="absolute top-0 right-0 bottom-0 w-1 bg-white opacity-50 animate-pulse"></div>
                                    </div>
                                </div>
                             </div>
                             <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.05] group-hover/progress:scale-125 transition-transform">
                                <LucideIcons.Activity size={80} className="text-emerald-500 sm:w-[100px] sm:h-[100px]" />
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaign Progress Legend (Subtle) */}
            <div className="flex items-center gap-4 px-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{completados.length} Declarados</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{pendientes.length} Pendientes</span>
                </div>
            </div>



            {/* Critical Alerts Panel Refinado */}
            {(expiringSignatures.length > 0 || activeRentaRefunds.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Renta Refunds Panel - High Priority */}
                    {activeRentaRefunds.length > 0 && (
                        <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200/60 dark:border-amber-800/60 rounded-[2rem] p-6 shadow-xl shadow-amber-500/5 animate-fade-in-down lg:col-span-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
                                        <LucideIcons.HandCoins size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-amber-900 dark:text-amber-300 text-lg">Trámites Devolución Renta</h3>
                                        <p className="text-amber-600/70 dark:text-amber-400/60 text-[10px] font-black uppercase tracking-widest">{activeRentaRefunds.length} en seguimiento intensivo</p>
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
                                        <div key={c.id} className={`group/item flex justify-between items-center bg-white dark:bg-slate-800/50 p-3.5 rounded-2xl border transition-all ${isCritical ? 'border-red-300 dark:border-red-800/50 hover:border-red-500' : 'border-amber-100 dark:border-amber-900/30 hover:border-amber-400'}`}>
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{c.name}</span>
                                                <span className={`text-[10px] font-black uppercase tracking-wider mt-0.5 ${isCritical ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    Tiempo Transcurrido: {hoursPassed.toFixed(1)}h
                                                </span>
                                            </div>
                                            <button onClick={() => navigate('clients', { clientIdToView: c.id })} className={`shrink-0 px-4 py-1.5 text-[10px] font-black rounded-xl transition-all uppercase ${isCritical ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white dark:bg-amber-900/30 dark:text-amber-400'}`}>
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
                        <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-900 border border-red-200/60 dark:border-red-800/60 rounded-[2rem] p-6 shadow-xl shadow-red-500/5 animate-fade-in-down">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl">
                                        <LucideIcons.AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-red-900 dark:text-red-300 text-lg">Firmas por Caducar</h3>
                                        <p className="text-red-600/70 dark:text-red-400/60 text-[10px] font-black uppercase tracking-widest">{expiringSignatures.length} Clientes en riesgo</p>
                                    </div>
                                </div>
                                <LucideIcons.ChevronRight className="text-red-300" size={20} />
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {expiringSignatures.map(c => (
                                    <div key={c.id} className="group/item flex justify-between items-center bg-white dark:bg-slate-800/50 p-3.5 rounded-2xl border border-red-100 dark:border-red-900/30 hover:border-red-400 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{c.name}</span>
                                            <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5"><LucideIcons.Calendar size={12} /> Expira: {c.signatureExpirationDate}</span>
                                        </div>
                                        <button onClick={() => navigate('clients', { clientIdToView: c.id })} className="px-4 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black rounded-xl hover:bg-red-600 hover:text-white transition-all uppercase">Ver Detalle</button>
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
                        { id: 'all', label: 'Legión', icon: LucideIcons.Briefcase },
                        { id: 'mensual', label: 'IVA Mensual', icon: LucideIcons.Calendar },
                        { id: 'semestral', label: 'IVA Semestral', icon: LucideIcons.Clock },
                        { id: 'renta', label: 'Renta Anual', icon: LucideIcons.ShieldCheck },
                        { id: 'urgent', label: 'Crítico SRI', icon: LucideIcons.Zap, color: 'text-rose-500' },
                        { id: 'no-iva', label: 'Sin IVA', icon: LucideIcons.XCircle },
                        { id: 'no-renta', label: 'Sin Renta', icon: LucideIcons.XCircle },
                    ].map(tab => {
                        const isActive = filter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`
                                    relative flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-500 whitespace-nowrap group/tab
                                    ${isActive
                                        ? 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105 sm:scale-110 z-10'
                                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                                    }
                                `}
                            >
                                <tab.icon size={14} className={`${isActive ? 'text-white' : tab.color || 'text-slate-500 group-hover/tab:text-emerald-400'} transition-colors`} />
                                <span className="relative z-10">{tab.label}</span>
                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-full"></div>
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
                            className={`flex-1 sm:flex-none group relative flex items-center gap-3 sm:gap-5 p-1.5 sm:p-2 pr-4 sm:pr-8 rounded-full transition-all duration-500 border ${inboxTab === 'pendientes' ? 'glass-tactical border-emerald-500/30 shadow-lg' : 'border-transparent opacity-60'}`}
                        >
                            <div className={`p-3 sm:p-4 rounded-full transition-all duration-500 ${inboxTab === 'pendientes' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800'}`}>
                                <LucideIcons.Flashlight size={18} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col items-start translate-y-[1px]">
                                <span className="text-[7px] sm:text-[10px] font-black tech-font text-emerald-500 uppercase tracking-widest mb-0.5">PENDIENTES</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm sm:text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Deploy</span>
                                    <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] sm:text-[10px] font-black rounded tech-font">{pendientes.length}</span>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setInboxTab('completados')}
                            className={`flex-1 sm:flex-none group relative flex items-center gap-3 sm:gap-5 p-1.5 sm:p-2 pr-4 sm:pr-8 rounded-full transition-all duration-500 border ${inboxTab === 'completados' ? 'glass-tactical border-emerald-500/30 shadow-lg' : 'border-transparent opacity-60'}`}
                        >
                            <div className={`p-3 sm:p-4 rounded-full transition-all duration-500 ${inboxTab === 'completados' ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-800'}`}>
                                <LucideIcons.ShieldCheck size={18} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col items-start translate-y-[1px]">
                                <span className="text-[7px] sm:text-[10px] font-black tech-font text-sky-500 uppercase tracking-widest mb-0.5">COMPLETADOS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm sm:text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Docs</span>
                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] sm:text-[10px] font-black rounded tech-font">{completados.length}</span>
                                </div>
                            </div>
                        </button>
                    </div>
                    
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="h-4 w-[1px] bg-white/10 mx-4"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operación: {formatPeriodForDisplay(getPeriod({ ruc: '0000000000001' } as any, new Date())).split(' ')[0]}</span>
                    </div>
                </div>
            )}

            {searchTerm && (
                <div className="mb-8 flex items-center gap-4 text-slate-800 dark:text-white font-bold text-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200/50 dark:border-white/5 animate-fade-in-down shadow-2xl">
                    <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/20">
                        <LucideIcons.Search size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg tracking-tight">Mostrando resultados para <span className="text-emerald-500 font-black">"{searchTerm}"</span></span>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{activeList.length} clientes en el radar</span>
                    </div>
                    <button
                        onClick={() => setSearchTerm('')}
                        className="ml-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
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
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Búsqueda sin resultados</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm font-medium">
                            No encontramos clientes que coincidan con el filtro <span className="text-brand-teal font-bold">"{filter}"</span> o tu búsqueda actual.
                        </p>
                        <button
                            onClick={() => { setSearchTerm(''); setFilter('all'); }}
                            className="mt-8 px-6 py-2.5 bg-brand-navy text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
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
                        link.href = previewState.declaration.proofFile.url;
                        link.download = previewState.declaration.proofFile.name;
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
                        className="group relative flex items-center gap-3 p-4 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-[2rem] shadow-[0_20px_40px_rgba(245,158,11,0.4)] border border-amber-300/30 transition-all hover:scale-110 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <LucideIcons.HandCoins size={24} className="relative z-10" />
                        <span className="font-black text-[10px] tracking-widest uppercase relative z-10 pr-2">
                            {activeRentaRefunds.length} Refund{activeRentaRefunds.length > 1 ? 's' : ''}
                        </span>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
                            <LucideIcons.AlertCircle size={8} strokeWidth={4} />
                        </div>
                    </button>
                </div>
            )}

            <ChatBot />
        </div>
    );
};
