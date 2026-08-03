import React, { useState, useEffect, useMemo } from 'react';
import { 
    Coins, Plus, Search, Calendar, CheckCircle2, DollarSign, 
    Printer, ArrowRight, ShieldCheck, Clock, FileText, UserCheck, RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { db } from '../services/db';

export interface Cuota {
    numeroCuota: number;
    fechaVencimiento: string;
    montoCuota: number;
    pagado: boolean;
    fechaPago?: string;
    comprobantePago?: string;
}

export interface PlanRefinanciacion {
    id: string;
    codigoPlan: string;
    clienteId?: string;
    nombreCliente: string;
    rucCliente: string;
    montoTotalRefinanciado: number;
    montoAbonado: number;
    montoSaldoPendiente: number;
    numeroCuotas: number;
    fechaInicio: string;
    cuotas: Cuota[];
    estado: 'Vigente' | 'Cancelado' | 'En Mora';
    createdAt: string;
}

interface RefinanciacionScreenProps {
    navigate: (screen: any, options?: any) => void;
}

export const RefinanciacionScreen: React.FC<RefinanciacionScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [planes, setPlanes] = useState<PlanRefinanciacion[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedPlanDetail, setSelectedPlanDetail] = useState<PlanRefinanciacion | null>(null);

    // Form States
    const [selectedClientId, setSelectedClientId] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [rucCliente, setRucCliente] = useState('');
    const [montoTotal, setMontoTotal] = useState<number>(150.00);
    const [numeroCuotas, setNumeroCuotas] = useState<number>(3);
    const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const loadPlanes = async () => {
            try {
                const stored = await db.getLocal('sc_refinanciaciones_history');
                if (stored && Array.isArray(stored)) {
                    setPlanes(stored);
                } else {
                    const demoPlan: PlanRefinanciacion = {
                        id: 'REF-001',
                        codigoPlan: 'PLAN-REF-001',
                        nombreCliente: 'CORDOVA RAMIREZ ROBERTO SANTIAGO',
                        rucCliente: '0705787745001',
                        montoTotalRefinanciado: 150.00,
                        montoAbonado: 50.00,
                        montoSaldoPendiente: 100.00,
                        numeroCuotas: 3,
                        fechaInicio: '2026-01-01',
                        estado: 'Vigente',
                        createdAt: new Date().toISOString(),
                        cuotas: [
                            { numeroCuota: 1, fechaVencimiento: '2026-01-30', montoCuota: 50.00, pagado: true, fechaPago: '2026-01-25', comprobantePago: 'REC-001' },
                            { numeroCuota: 2, fechaVencimiento: '2026-02-28', montoCuota: 50.00, pagado: false },
                            { numeroCuota: 3, fechaVencimiento: '2026-03-30', montoCuota: 50.00, pagado: false }
                        ]
                    };
                    setPlanes([demoPlan]);
                    await db.setLocal('sc_refinanciaciones_history', [demoPlan]);
                }
            } catch (err) {
                console.error("Error al cargar refinanciaciones:", err);
            }
        };
        loadPlanes();
    }, []);

    const savePlanesToDb = async (newList: PlanRefinanciacion[]) => {
        setPlanes(newList);
        await db.setLocal('sc_refinanciaciones_history', newList);
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        const c = clients.find(item => item.id === clientId);
        if (c) {
            setNombreCliente(c.tradeName || c.name);
            setRucCliente(c.ruc);
        }
    };

    const handleCreatePlan = async () => {
        if (!nombreCliente || !rucCliente) {
            toast.error("Selecciona un cliente de la lista.");
            return;
        }
        if (montoTotal <= 0 || numeroCuotas <= 0) {
            toast.error("Ingresa un monto y número de cuotas válidos.");
            return;
        }

        const valorCuota = montoTotal / numeroCuotas;
        const cuotasGeneradas: Cuota[] = [];
        const baseDate = new Date(fechaInicio);

        for (let i = 1; i <= numeroCuotas; i++) {
            const nextDueDate = new Date(baseDate);
            nextDueDate.setMonth(baseDate.getMonth() + (i - 1));
            cuotasGeneradas.push({
                numeroCuota: i,
                fechaVencimiento: nextDueDate.toISOString().split('T')[0],
                montoCuota: Number(valorCuota.toFixed(2)),
                pagado: false
            });
        }

        const newPlan: PlanRefinanciacion = {
            id: `REF-${Date.now()}`,
            codigoPlan: `PLAN-REF-${String(planes.length + 1).padStart(3, '0')}`,
            clienteId: selectedClientId || undefined,
            nombreCliente,
            rucCliente,
            montoTotalRefinanciado: montoTotal,
            montoAbonado: 0,
            montoSaldoPendiente: montoTotal,
            numeroCuotas,
            fechaInicio,
            cuotas: cuotasGeneradas,
            estado: 'Vigente',
            createdAt: new Date().toISOString()
        };

        const updated = [newPlan, ...planes];
        await savePlanesToDb(updated);
        setIsCreateModalOpen(false);
        toast.success(`🎉 Plan de refinanciación ${newPlan.codigoPlan} creado exitosamente.`);
    };

    const handlePagarCuota = async (planId: string, numeroCuota: number) => {
        const updatedPlanes = planes.map(plan => {
            if (plan.id !== planId) return plan;
            const newCuotas = plan.cuotas.map(c => {
                if (c.numeroCuota === numeroCuota) {
                    return { ...c, pagado: true, fechaPago: new Date().toISOString().split('T')[0], comprobantePago: `ABO-${Date.now().toString().slice(-4)}` };
                }
                return c;
            });
            const nuevoAbonado = newCuotas.filter(c => c.pagado).reduce((s, c) => s + c.montoCuota, 0);
            const saldo = Math.max(0, plan.montoTotalRefinanciado - nuevoAbonado);
            const estado = saldo === 0 ? 'Cancelado' : plan.estado;

            const updatedPlan = { ...plan, cuotas: newCuotas, montoAbonado: nuevoAbonado, montoSaldoPendiente: saldo, estado };
            if (selectedPlanDetail?.id === planId) setSelectedPlanDetail(updatedPlan as any);
            return updatedPlan;
        });

        await savePlanesToDb(updatedPlanes as any);
        toast.success(`✅ Cuota #${numeroCuota} marcada como pagada.`);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER PRO DE REFINANCIACIÓN ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 text-white shrink-0">
                            <Coins size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Convenios y Acuerdos de Pago</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Refinanciación y Cuotas de Pago
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Consolida honorarios pendientes y facilita planes de pago en cuotas amortizadas con control de abonos.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95 shrink-0"
                    >
                        <Plus size={18} /> Nuevo Plan de Refinanciación
                    </button>
                </div>
            </div>

            {/* ── TABLA DE PLANES ── */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <th className="py-4 px-5">Código Plan</th>
                                <th className="py-4 px-5">Cliente</th>
                                <th className="py-4 px-5">Monto Refinanciado</th>
                                <th className="py-4 px-5">Abonado / Saldo</th>
                                <th className="py-4 px-5">Estado</th>
                                <th className="py-4 px-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {planes.map((p) => (
                                <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="py-4 px-5 font-mono font-bold text-teal-400">{p.codigoPlan}</td>
                                    <td className="py-4 px-5">
                                        <p className="font-bold text-white uppercase">{p.nombreCliente}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">RUC: {p.rucCliente}</p>
                                    </td>
                                    <td className="py-4 px-5 font-mono font-bold text-white text-base">
                                        ${p.montoTotalRefinanciado.toFixed(2)} ({p.numeroCuotas} cuotas)
                                    </td>
                                    <td className="py-4 px-5 font-mono">
                                        <p className="text-emerald-400 font-bold">Abonado: ${p.montoAbonado.toFixed(2)}</p>
                                        <p className="text-amber-300 font-bold">Saldo: ${p.montoSaldoPendiente.toFixed(2)}</p>
                                    </td>
                                    <td className="py-4 px-5">
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                            p.estado === 'Cancelado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        }`}>
                                            {p.estado}
                                        </span>
                                    </td>
                                    <td className="py-4 px-5 text-right whitespace-nowrap">
                                        <button
                                            onClick={() => setSelectedPlanDetail(p)}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold uppercase transition-all text-[10px] border border-indigo-500/30"
                                        >
                                            Ver Cuotas ({p.cuotas.filter(c => c.pagado).length}/{p.numeroCuotas})
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── MODAL DETALLE Y PAGOS DE CUOTAS ── */}
            {selectedPlanDetail && (
                <Modal isOpen={true} onClose={() => setSelectedPlanDetail(null)} title={`📊 Tabla de Amortización — ${selectedPlanDetail.codigoPlan}`} size="lg">
                    <div className="space-y-4 p-4 text-white">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center text-xs">
                            <div>
                                <h3 className="font-bold text-white uppercase">{selectedPlanDetail.nombreCliente}</h3>
                                <p className="text-slate-400 font-mono">RUC: {selectedPlanDetail.rucCliente}</p>
                            </div>
                            <div className="text-right font-mono">
                                <span className="text-slate-400 text-[10px] uppercase block">Saldo Pendiente</span>
                                <span className="text-xl font-black text-amber-300">${selectedPlanDetail.montoSaldoPendiente.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                            {selectedPlanDetail.cuotas.map((c) => (
                                <div key={c.numeroCuota} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-white/5 text-xs font-mono">
                                    <div>
                                        <span className="font-bold text-teal-400">Cuota #{c.numeroCuota}</span>
                                        <span className="text-slate-400 text-[10px] block">Vence: {c.fechaVencimiento}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-white text-sm">${c.montoCuota.toFixed(2)}</span>
                                        {c.pagado ? (
                                            <span className="text-emerald-400 text-[10px] font-bold block">✅ PAGADO ({c.fechaPago})</span>
                                        ) : (
                                            <button
                                                onClick={() => handlePagarCuota(selectedPlanDetail.id, c.numeroCuota)}
                                                className="px-2.5 py-1 mt-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/30"
                                            >
                                                Registrar Abono
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL NUEVO PLAN REFINANCIACIÓN ── */}
            {isCreateModalOpen && (
                <Modal isOpen={true} onClose={() => setIsCreateModalOpen(false)} title="➕ Crear Plan de Refinanciación" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-300 uppercase block">Cliente</label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => handleSelectClient(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                            >
                                <option value="">-- Seleccionar cliente --</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ruc}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Monto a Refinanciar ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={montoTotal}
                                    onChange={(e) => setMontoTotal(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Número de Cuotas</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={numeroCuotas}
                                    onChange={(e) => setNumeroCuotas(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleCreatePlan} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs">Crear Plan</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
