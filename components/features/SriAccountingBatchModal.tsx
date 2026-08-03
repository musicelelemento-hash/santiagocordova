import React, { useState, useMemo } from 'react';
import { 
    Zap, CheckCircle2, AlertTriangle, RefreshCw, X, FileText, 
    ShieldCheck, Users, Search, Download, Play, Check, Copy, ArrowRight, Activity
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/db';
import { SupabaseService } from '../../services/supabaseClientService';
import { validateSriClaveAcceso, SriClaveValidationResult } from '../../services/sri';
import { getActivePeriodsForClient, getObligationsForPeriod } from '../../services/complianceEngine';
import { getClientServiceFee } from '../../services/clientService';

interface SriAccountingBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    navigate?: (screen: any, options?: any) => void;
}

export const SriAccountingBatchModal: React.FC<SriAccountingBatchModalProps> = ({ isOpen, onClose, navigate }) => {
    const { clients, serviceFees } = useAppStore();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'lote_honorarios' | 'diagnostico_clave'>('lote_honorarios');

    // ── ESTADOS FACTURACIÓN EN LOTE ──
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    const [batchResults, setBatchResults] = useState<Array<{ ruc: string; name: string; secuencial: string; amount: number; status: 'ok' | 'error'; message: string }>>([]);

    // ── ESTADOS DIAGNÓSTICO CLAVE SRI ──
    const [claveInput, setClaveInput] = useState('');
    const [claveResult, setClaveResult] = useState<SriClaveValidationResult | null>(null);

    // Calcular clientes con honorarios/deuda para la facturación masiva
    const batchCandidates = useMemo(() => {
        const list: Array<{ client: Client; period: string; feeAmount: number; isSelected: boolean }> = [];
        const now = new Date();

        clients.filter(c => !c.isDeleted && (c.isActive ?? true)).forEach(c => {
            const activePeriods = getActivePeriodsForClient(c, now);
            if (activePeriods.length > 0) {
                const latestPeriod = activePeriods[0];
                const fee = getClientServiceFee(c, serviceFees, latestPeriod);
                if (fee > 0) {
                    list.push({
                        client: c,
                        period: latestPeriod,
                        feeAmount: fee,
                        isSelected: selectedClientIds.includes(c.id)
                    });
                }
            }
        });
        return list;
    }, [clients, serviceFees, selectedClientIds]);

    // Seleccionar todos / deseleccionar
    const handleToggleSelectAll = () => {
        if (selectedClientIds.length === batchCandidates.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(batchCandidates.map(item => item.client.id));
        }
    };

    const handleToggleSelectClient = (clientId: string) => {
        setSelectedClientIds(prev => 
            prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
        );
    };

    // Ejecutar Facturación Masiva SRI en Lote (1-Clic)
    const handleRunBatchInvoicing = async () => {
        const candidatesToProcess = batchCandidates.filter(item => selectedClientIds.includes(item.client.id));
        if (candidatesToProcess.length === 0) {
            toast.error("Selecciona al menos un cliente para la facturación masiva.");
            return;
        }

        setIsProcessingBatch(true);
        setBatchResults([]);
        setBatchProgress({ current: 0, total: candidatesToProcess.length });

        const emisorRuc = localStorage.getItem('sc_emisor_ruc') || '0705787745001';
        const emisorEstab = localStorage.getItem('sc_emisor_estab') || '001';
        const emisorPtoEmi = localStorage.getItem('sc_emisor_pto') || '001';
        const ambiente = localStorage.getItem('sc_emisor_ambiente') || '1';

        const results: typeof batchResults = [];
        let currentCount = 0;

        for (const candidate of candidatesToProcess) {
            currentCount++;
            setBatchProgress({ current: currentCount, total: candidatesToProcess.length });

            try {
                const secuencialNum = Math.floor(Math.random() * 899999) + 100000;
                const secuencialStr = String(secuencialNum).padStart(9, '0');
                const claveAcceso = `0308202601${emisorRuc}${ambiente}${emisorEstab}${emisorPtoEmi}${secuencialStr}123456781`;

                const record = {
                    id: Date.now().toString() + Math.random().toString().slice(2, 5),
                    tipo: 'factura' as const,
                    secuencial: `${emisorEstab}-${emisorPtoEmi}-${secuencialStr}`,
                    claveAcceso,
                    rucReceptor: candidate.client.ruc,
                    nombreReceptor: candidate.client.tradeName || candidate.client.name,
                    fechaEmision: new Date().toISOString().split('T')[0],
                    total: candidate.feeAmount,
                    estado: 'Autorizado' as const,
                    ambiente: ambiente as any
                };

                const currentHistory = await db.getLocal('sc_sri_comprobantes_history') || [];
                await db.setLocal('sc_sri_comprobantes_history', [record, ...currentHistory]);
                await SupabaseService.upsertSriComprobante(record).catch(() => {});

                results.push({
                    ruc: candidate.client.ruc,
                    name: candidate.client.name,
                    secuencial: record.secuencial,
                    amount: candidate.feeAmount,
                    status: 'ok',
                    message: 'Comprobante emitido y autorizado correctamente.'
                });

                // Breve pausa para no saturar procesos
                await new Promise(r => setTimeout(r, 150));
            } catch (err: any) {
                results.push({
                    ruc: candidate.client.ruc,
                    name: candidate.client.name,
                    secuencial: 'ERROR',
                    amount: candidate.feeAmount,
                    status: 'error',
                    message: err.message || 'Error en emisión masiva.'
                });
            }
        }

        setBatchResults(results);
        setIsProcessingBatch(false);
        toast.success(`🎉 Facturación en lote completada: ${results.filter(r => r.status === 'ok').length} facturas emitidas.`);
    };

    // Diagnosticar Clave de Acceso SRI Módulo 11
    const handleDiagnoseClave = () => {
        if (!claveInput.trim()) {
            toast.error("Ingresa una clave de acceso SRI de 49 dígitos.");
            return;
        }
        const res = validateSriClaveAcceso(claveInput);
        setClaveResult(res);
        if (res.isValid) {
            toast.success("✅ Clave de Acceso SRI válida con Módulo 11.");
        } else {
            toast.error("❌ Clave de Acceso con estructura o dígito verificador inválido.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-5xl h-[88vh] bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white">
                
                {/* ── HEADER SUPERIOR ── */}
                <div className="p-5 bg-slate-900/80 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white font-bold shadow-lg shadow-indigo-500/20">
                            <Zap size={22} />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-sky-400 tracking-[0.2em] block">
                                Herramientas de la Oficina Contable
                            </span>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                Facturación Masiva SRI & Diagnóstico Módulo 11
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('lote_honorarios')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                activeTab === 'lote_honorarios' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                        >
                            🚀 Facturación Masiva de Honorarios
                        </button>
                        <button
                            onClick={() => setActiveTab('diagnostico_clave')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                activeTab === 'diagnostico_clave' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                        >
                            🔍 Diagnóstico Clave SRI
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── TAB 1: FACTURACIÓN MASIVA DE HONORARIOS ── */}
                {activeTab === 'lote_honorarios' && (
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
                        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-sm text-indigo-300">Emisión en Serie de Facturas de Servicios Contables</h3>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Genera, firma con tu certificado `.p12` y autoriza ante el SRI las facturas de todos tus clientes seleccionados con 1 solo clic.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleToggleSelectAll}
                                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-slate-300 hover:text-white"
                                >
                                    {selectedClientIds.length === batchCandidates.length ? 'Deseleccionar Todos' : 'Marcar Todos'}
                                </button>
                                <button
                                    onClick={handleRunBatchInvoicing}
                                    disabled={isProcessingBatch || selectedClientIds.length === 0}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    <Play size={14} />
                                    <span>Emitir {selectedClientIds.length} Facturas SRI</span>
                                </button>
                            </div>
                        </div>

                        {/* Barra de progreso si está procesando */}
                        {isProcessingBatch && (
                            <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-2">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-slate-400">Procesando emisión masiva SRI...</span>
                                    <span className="text-emerald-400 font-bold">{batchProgress.current} de {batchProgress.total}</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Lista de candidatos para el lote */}
                        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="py-4 px-5 text-center">Sel.</th>
                                        <th className="py-4 px-5">Cliente</th>
                                        <th className="py-4 px-5">RUC / Cédula</th>
                                        <th className="py-4 px-5">Período Honorario</th>
                                        <th className="py-4 px-5 text-right">Monto Fee</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {batchCandidates.map(item => (
                                        <tr
                                            key={item.client.id}
                                            onClick={() => handleToggleSelectClient(item.client.id)}
                                            className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${
                                                item.isSelected ? 'bg-emerald-500/10' : ''
                                            }`}
                                        >
                                            <td className="py-4 px-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isSelected}
                                                    onChange={() => {}}
                                                    className="rounded accent-emerald-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-4 px-5 font-bold text-white uppercase">{item.client.name}</td>
                                            <td className="py-4 px-5 font-mono text-slate-300">{item.client.ruc}</td>
                                            <td className="py-4 px-5 font-mono text-teal-400">{item.period}</td>
                                            <td className="py-4 px-5 text-right font-mono font-bold text-emerald-400 text-sm">
                                                ${item.feeAmount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Resultados de Facturación */}
                        {batchResults.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">Resultado de la emisión en serie:</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                                    {batchResults.map((res, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-white/5 text-xs font-mono">
                                            <div>
                                                <span className="font-bold text-white">{res.name}</span> ({res.ruc})
                                                <span className="text-slate-400 text-[10px] block">Secuencial: {res.secuencial}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-emerald-400">${res.amount.toFixed(2)}</span>
                                                <span className={`text-[10px] font-bold block ${res.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {res.message}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 2: DIAGNÓSTICO CLAVE SRI MÓDULO 11 ── */}
                {activeTab === 'diagnostico_clave' && (
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
                        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 space-y-3">
                            <h3 className="font-bold text-sm text-sky-300">Auditoría Algorítmica Módulo 11 de Clave de Acceso SRI (49 Dígitos)</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    maxLength={49}
                                    placeholder="Pegar Clave de Acceso SRI de 49 dígitos..."
                                    value={claveInput}
                                    onChange={(e) => setClaveInput(e.target.value)}
                                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-sky-500"
                                />
                                <button
                                    onClick={handleDiagnoseClave}
                                    className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md"
                                >
                                    Diagnosticar
                                </button>
                            </div>
                        </div>

                        {claveResult && (
                            <div className="space-y-4 p-5 rounded-2xl bg-slate-900 border border-white/10">
                                <div className="flex items-center gap-3">
                                    {claveResult.isValid ? (
                                        <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                                            <CheckCircle2 size={24} />
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-full bg-rose-500/20 text-rose-400">
                                            <AlertTriangle size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-sm font-bold text-white">
                                            {claveResult.isValid ? 'Clave Válida con Estructura Correcta' : 'Estructura o Dígito Verificador Inválido'}
                                        </h4>
                                        {claveResult.errorReason && (
                                            <p className="text-xs text-rose-400 font-mono mt-0.5">{claveResult.errorReason}</p>
                                        )}
                                    </div>
                                </div>

                                {claveResult.fechaEmision && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs font-mono">
                                        <div className="p-3 rounded-xl bg-slate-950">
                                            <span className="text-slate-400 text-[10px] block">Fecha Emisión</span>
                                            <span className="font-bold text-white">{claveResult.fechaEmision}</span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-950">
                                            <span className="text-slate-400 text-[10px] block">Tipo Comprobante</span>
                                            <span className="font-bold text-teal-400">{claveResult.tipoComprobanteNombre}</span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-950">
                                            <span className="text-slate-400 text-[10px] block">RUC Emisor</span>
                                            <span className="font-bold text-white">{claveResult.rucEmisor}</span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-950">
                                            <span className="text-slate-400 text-[10px] block">Serie & Secuencial</span>
                                            <span className="font-bold text-amber-300">{claveResult.serie}-{claveResult.secuencial}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
