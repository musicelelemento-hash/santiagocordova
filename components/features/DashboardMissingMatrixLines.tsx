import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, Screen, ClientFilter, Task } from '../../types';
import { getNinthDigit } from '../../services/sri';
import { SriCampaignWidget } from './SriCampaignWidget';

interface DashboardMissingMatrixLinesProps {
    clients: Client[];
    navigate: (screen: Screen, options?: { clientFilter?: ClientFilter, initialTaskData?: Partial<Task>, initialClientData?: Partial<Client> }) => void;
    onUploadReceipt?: (client: Client, period: string, type: any) => void;
    theme?: 'light' | 'dark';
}

export const DashboardMissingMatrixLines: React.FC<DashboardMissingMatrixLinesProps> = ({
    clients,
    navigate,
    onUploadReceipt,
    theme = 'dark'
}) => {
    // Current date logic
    const today = new Date();
    const currentDay = today.getDate();

    const getDigitForDay = (day: number): number => {
        if (day <= 10) return 1;
        if (day <= 12) return 2;
        if (day <= 14) return 3;
        if (day <= 16) return 4;
        if (day <= 18) return 5;
        if (day <= 20) return 6;
        if (day <= 22) return 7;
        if (day <= 24) return 8;
        if (day <= 26) return 9;
        return 0;
    };

    const activeTodayDigit = getDigitForDay(currentDay);
    const [selectedDigitFilter, setSelectedDigitFilter] = useState<number | null>(activeTodayDigit);
    const [activeTab, setActiveTab] = useState<'today_digit' | 'all_missing'>('today_digit');
    const [copiedRuc, setCopiedRuc] = useState<string | null>(null);

    // Filter missing clients for Semestral S1 and Mensual
    const missingClientsData = useMemo(() => {
        const result: Array<{
            client: Client;
            digit: number;
            period: string;
            type: 'Semestral' | 'Mensual';
            missingLabel: string;
            isOverdue: boolean;
        }> = [];

        clients.forEach(c => {
            if (c.isDeleted || !c.isActive) return;
            const digit = getNinthDigit(c.ruc);
            const decls = c.declarations || [];

            // 1. Check Semestral S1 2026 missing
            const isRimpeEmp = c.regime === 'RimpeEmprendedor' || c.taxProfile?.ivaFrequency === 'Semestral';
            if (isRimpeEmp) {
                const s1Decl = decls.find(d => d.period.includes('2026-S1') || d.period.includes('2026:S1'));
                const isS1Done = s1Decl && (s1Decl.status === DeclarationStatus.Enviada || s1Decl.status === DeclarationStatus.Pagada || !!s1Decl.proof_file);
                if (!isS1Done) {
                    result.push({
                        client: c,
                        digit,
                        period: '2026-S1',
                        type: 'Semestral',
                        missingLabel: 'Semestral S1 (Ene - Jun 2026)',
                        isOverdue: digit < activeTodayDigit
                    });
                }
            }

            // 2. Check Mensual Junio 2026 missing
            const isMensual = c.taxProfile?.ivaFrequency === 'Mensual' || (c.regime === 'General' && c.taxProfile?.ivaFrequency !== 'Semestral');
            if (isMensual) {
                const junDecl = decls.find(d => d.period.endsWith('2026-06') || d.period.endsWith('2026-05'));
                const isJunDone = junDecl && (junDecl.status === DeclarationStatus.Enviada || junDecl.status === DeclarationStatus.Pagada || !!junDecl.proof_file);
                if (!isJunDone) {
                    result.push({
                        client: c,
                        digit,
                        period: '2026-06',
                        type: 'Mensual',
                        missingLabel: 'Mensual Junio 2026',
                        isOverdue: digit < activeTodayDigit
                    });
                }
            }
        });

        return result;
    }, [clients, activeTodayDigit]);

    // Filter by selected digit if tab or filter is active
    const filteredMissingLines = useMemo(() => {
        if (activeTab === 'today_digit' && selectedDigitFilter === null) {
            return missingClientsData.filter(item => item.digit === activeTodayDigit);
        }
        if (selectedDigitFilter !== null) {
            return missingClientsData.filter(item => item.digit === selectedDigitFilter);
        }
        return missingClientsData;
    }, [missingClientsData, selectedDigitFilter, activeTab, activeTodayDigit]);

    const handleCopyRuc = (ruc: string) => {
        navigator.clipboard.writeText(ruc);
        setCopiedRuc(ruc);
        setTimeout(() => setCopiedRuc(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Widget Banner Campaña Activa */}
            <SriCampaignWidget
                clients={clients}
                selectedDigitFilter={selectedDigitFilter}
                onSelectDigitFilter={(d) => {
                    setSelectedDigitFilter(d);
                    if (d === null) setActiveTab('all_missing');
                    else setActiveTab('today_digit');
                }}
                theme={theme}
            />

            {/* Dashboard Lineas de Matriz de Clientes Faltantes */}
            <div className="bg-slate-900/90 border border-white/10 rounded-[2.2rem] p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                {/* Header Control de Líneas Faltantes */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
                            <LucideIcons.AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white tracking-tight uppercase font-premium flex items-center gap-2">
                                Líneas de Matriz · Clientes Faltantes
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono">
                                    {filteredMissingLines.length} Faltantes
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Clientes sin comprobante PDF registrado en la campaña actual.
                            </p>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5">
                        <button
                            onClick={() => {
                                setActiveTab('today_digit');
                                setSelectedDigitFilter(activeTodayDigit);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'today_digit' && selectedDigitFilter === activeTodayDigit
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideIcons.Clock size={14} />
                            Vencen Hoy (Dígito {activeTodayDigit})
                        </button>

                        <button
                            onClick={() => {
                                setActiveTab('all_missing');
                                setSelectedDigitFilter(null);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                activeTab === 'all_missing' && selectedDigitFilter === null
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideIcons.ListFilter size={14} />
                            Todos los Faltantes ({missingClientsData.length})
                        </button>
                    </div>
                </div>

                {/* Table of Missing Matrix Lines */}
                <div className="mt-4 overflow-x-auto no-scrollbar">
                    {filteredMissingLines.length > 0 ? (
                        <div className="space-y-2.5 min-w-[700px]">
                            {filteredMissingLines.map(({ client, digit, period, type, missingLabel, isOverdue }) => {
                                const phoneStr = client.phones && client.phones.length > 0 ? client.phones[0].replace(/\D/g, '') : '';
                                const whatsappPhone = phoneStr.startsWith('0') ? '593' + phoneStr.substring(1) : (phoneStr.startsWith('593') ? phoneStr : '593' + phoneStr);

                                return (
                                    <div
                                        key={`${client.id}-${period}`}
                                        className="group/line flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-primary/40 transition-all duration-300 shadow-sm"
                                    >
                                        {/* Dígito RUC Badge & Client Info */}
                                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-mono font-black text-xs shadow-md ${
                                                digit === activeTodayDigit
                                                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 animate-pulse'
                                                    : isOverdue
                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                                    : 'bg-slate-800 text-slate-300 border border-white/10'
                                            }`}>
                                                <span className="text-[7px] uppercase tracking-wider opacity-80">DÍGITO</span>
                                                <span className="leading-none text-sm">{digit}</span>
                                            </div>

                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-white truncate font-premium group-hover/line:text-primary transition-colors">
                                                        {client.tradeName || client.name}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider ${
                                                        type === 'Semestral'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                                    }`}>
                                                        {type}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">
                                                        {client.ruc}
                                                    </span>
                                                    <button
                                                        onClick={() => handleCopyRuc(client.ruc)}
                                                        className="text-slate-500 hover:text-primary transition-colors p-0.5"
                                                        title="Copiar RUC"
                                                    >
                                                        {copiedRuc === client.ruc ? <LucideIcons.Check size={10} className="text-emerald-400" /> : <LucideIcons.Copy size={10} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Línea de Celda Faltante Matriz */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-400">
                                                    {period} · FALTANTE
                                                </span>
                                                <span className="font-bold text-[10px]">
                                                    {missingLabel}
                                                </span>
                                            </div>

                                            {/* Acciones Rápidas */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (onUploadReceipt) onUploadReceipt(client, period, type === 'Semestral' ? 'IVA' : 'IVA');
                                                        else navigate('clients');
                                                    }}
                                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                                                    title="Subir Comprobante PDF"
                                                >
                                                    <LucideIcons.Upload size={14} />
                                                    <span className="hidden sm:inline">Subir PDF</span>
                                                </button>

                                                <button
                                                    onClick={() => navigate('sri_facturacion')}
                                                    className="p-2.5 bg-primary hover:bg-gradient-azure text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
                                                    title="Emitir Factura Electrónica SRI"
                                                >
                                                    <LucideIcons.Zap size={14} />
                                                    <span className="hidden sm:inline">Facturar SRI</span>
                                                </button>

                                                {phoneStr && (
                                                    <a
                                                        href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Buen día ${client.name}, le recordamos que su declaración de ${missingLabel} se encuentra pendiente.`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all"
                                                        title="Enviar WhatsApp"
                                                    >
                                                        <LucideIcons.MessageCircle size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center flex flex-col items-center justify-center gap-3 bg-white/[0.01] rounded-2xl border border-white/5">
                            <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                                <LucideIcons.CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider font-premium">
                                    ¡Todos los Clientes al Día!
                                </h4>
                                <p className="text-xs text-slate-400 mt-1">
                                    No hay declaraciones ni comprobantes faltantes para el filtro seleccionado.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
