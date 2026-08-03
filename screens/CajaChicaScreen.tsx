import React, { useState, useEffect, useMemo } from 'react';
import { 
    Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, Lock, Unlock, 
    Plus, Search, Printer, CheckCircle, AlertTriangle, RefreshCw, 
    FileText, Calendar, Clock, CreditCard, Banknote, ShieldCheck, UserCheck, Trash2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Client } from '../types';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { db } from '../services/db';

export interface MovimientoCaja {
    id: string;
    tipo: 'ingreso' | 'egreso';
    concepto: string;
    monto: number;
    formaPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'deposito';
    clienteId?: string;
    nombreCliente?: string;
    comprobanteRef?: string;
    fechaHora: string;
    categoria: 'Honorarios' | 'Firmas' | 'Facturador' | 'Trámites SRI' | 'Suministros Oficina' | 'Otros';
}

export interface SesionCaja {
    id: string;
    fechaApertura: string;
    fechaCierre?: string;
    montoInicial: number;
    montoEfectivoCalculado: number;
    montoTransferenciasCalculado: number;
    montoTarjetasCalculado: number;
    montoEgresosCalculado: number;
    montoEfectivoReal?: number;
    diferenciaArqueo?: number;
    estado: 'abierta' | 'cerrada';
    movimientos: MovimientoCaja[];
    notasCierre?: string;
}

interface CajaChicaScreenProps {
    navigate: (screen: any, options?: any) => void;
}

export const CajaChicaScreen: React.FC<CajaChicaScreenProps> = ({ navigate }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [sesionesHistory, setSesionesHistory] = useState<SesionCaja[]>([]);
    const [currentSesion, setCurrentSesion] = useState<SesionCaja | null>(null);

    // Modales
    const [isAperturaModalOpen, setIsAperturaModalOpen] = useState(false);
    const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
    const [isArqueoModalOpen, setIsArqueoModalOpen] = useState(false);

    // Form Apertura
    const [montoInicialForm, setMontoInicialForm] = useState<number>(50.00);

    // Form Movimiento
    const [tipoMov, setTipoMov] = useState<'ingreso' | 'egreso'>('ingreso');
    const [conceptoMov, setConceptoMov] = useState('');
    const [montoMov, setMontoMov] = useState<number>(25.00);
    const [formaPagoMov, setFormaPagoMov] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'deposito'>('efectivo');
    const [categoriaMov, setCategoriaMov] = useState<MovimientoCaja['categoria']>('Honorarios');
    const [selectedClientId, setSelectedClientId] = useState('');

    // Form Arqueo / Cierre
    const [conteoEfectivoReal, setConteoEfectivoReal] = useState<number>(0);
    const [notasCierre, setNotasCierre] = useState('');

    // Cargar sesiones de caja chica desde IndexedDB
    useEffect(() => {
        const loadCaja = async () => {
            try {
                const stored = await db.getLocal('sc_caja_chica_history');
                if (stored && Array.isArray(stored)) {
                    setSesionesHistory(stored);
                    const abierta = stored.find(s => s.estado === 'abierta');
                    if (abierta) setCurrentSesion(abierta);
                } else {
                    // Datos iniciales de demostración
                    const todayStr = new Date().toISOString().split('T')[0];
                    const demoSesion: SesionCaja = {
                        id: `CAJA-${todayStr}`,
                        fechaApertura: `${todayStr} 08:30:00`,
                        montoInicial: 50.00,
                        montoEfectivoCalculado: 75.00,
                        montoTransferenciasCalculado: 50.00,
                        montoTarjetasCalculado: 0,
                        montoEgresosCalculado: 10.00,
                        estado: 'abierta',
                        movimientos: [
                            {
                                id: 'm1',
                                tipo: 'ingreso',
                                concepto: 'Cobro de Honorarios Contables - Enero 2026',
                                monto: 35.00,
                                formaPago: 'efectivo',
                                nombreCliente: 'CORDOVA RAMIREZ ROBERTO SANTIAGO',
                                fechaHora: `${todayStr} 09:15:00`,
                                categoria: 'Honorarios'
                            },
                            {
                                id: 'm2',
                                tipo: 'ingreso',
                                concepto: 'Emisión e Instalación Firma .p12',
                                monto: 25.00,
                                formaPago: 'transferencia',
                                nombreCliente: 'FARMACIA POPULAR EL ORO',
                                fechaHora: `${todayStr} 10:30:00`,
                                categoria: 'Firmas'
                            },
                            {
                                id: 'm3',
                                tipo: 'egreso',
                                concepto: 'Compra de Papel Bond y Toners de Imprenta',
                                monto: 10.00,
                                formaPago: 'efectivo',
                                fechaHora: `${todayStr} 11:00:00`,
                                categoria: 'Suministros Oficina'
                            }
                        ]
                    };
                    setSesionesHistory([demoSesion]);
                    setCurrentSesion(demoSesion);
                    await db.setLocal('sc_caja_chica_history', [demoSesion]);
                }
            } catch (err) {
                console.error("Error al cargar caja chica:", err);
            }
        };
        loadCaja();
    }, []);

    const saveCajaHistory = async (newList: SesionCaja[]) => {
        setSesionesHistory(newList);
        const abierta = newList.find(s => s.estado === 'abierta') || null;
        setCurrentSesion(abierta);
        await db.setLocal('sc_caja_chica_history', newList);
    };

    // Apertura de caja chica
    const handleAbrirCaja = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const newSesion: SesionCaja = {
            id: `CAJA-${Date.now()}`,
            fechaApertura: new Date().toLocaleString(),
            montoInicial: montoInicialForm,
            montoEfectivoCalculado: 0,
            montoTransferenciasCalculado: 0,
            montoTarjetasCalculado: 0,
            montoEgresosCalculado: 0,
            estado: 'abierta',
            movimientos: []
        };

        const updated = [newSesion, ...sesionesHistory];
        await saveCajaHistory(updated);
        setIsAperturaModalOpen(false);
        toast.success(`🟢 Caja Chica abierta con fondo inicial de $${montoInicialForm.toFixed(2)}.`);
    };

    // Registrar ingreso / egreso en la caja chica activa
    const handleAddMovimiento = async () => {
        if (!currentSesion) {
            toast.error("Abre la caja chica antes de registrar movimientos.");
            return;
        }
        if (!conceptoMov || montoMov <= 0) {
            toast.error("Ingresa un concepto y monto válidos.");
            return;
        }

        const clientObj = clients.find(c => c.id === selectedClientId);

        const newMov: MovimientoCaja = {
            id: `MOV-${Date.now()}`,
            tipo: tipoMov,
            concepto: conceptoMov,
            monto: montoMov,
            formaPago: formaPagoMov,
            clienteId: selectedClientId || undefined,
            nombreCliente: clientObj ? (clientObj.tradeName || clientObj.name) : undefined,
            fechaHora: new Date().toLocaleString(),
            categoria: categoriaMov
        };

        const updatedMovs = [newMov, ...currentSesion.movimientos];

        // Recalcular acumulados
        let efect = 0;
        let transf = 0;
        let tarj = 0;
        let egr = 0;

        updatedMovs.forEach(m => {
            if (m.tipo === 'ingreso') {
                if (m.formaPago === 'efectivo') efect += m.monto;
                else if (m.formaPago === 'transferencia' || m.formaPago === 'deposito') transf += m.monto;
                else if (m.formaPago === 'tarjeta') tarj += m.monto;
            } else {
                egr += m.monto;
            }
        });

        const updatedSesion: SesionCaja = {
            ...currentSesion,
            movimientos: updatedMovs,
            montoEfectivoCalculado: efect,
            montoTransferenciasCalculado: transf,
            montoTarjetasCalculado: tarj,
            montoEgresosCalculado: egr
        };

        const updatedList = sesionesHistory.map(s => s.id === currentSesion.id ? updatedSesion : s);
        await saveCajaHistory(updatedList);
        setIsMovimientoModalOpen(false);
        setConceptoMov('');
        toast.success(`✅ ${tipoMov === 'ingreso' ? 'Ingreso' : 'Egreso'} de $${montoMov.toFixed(2)} registrado.`);
    };

    // Arqueo y Cierre de Caja
    const handleCerrarCaja = async () => {
        if (!currentSesion) return;

        const totalEfectivoEsperado = currentSesion.montoInicial + currentSesion.montoEfectivoCalculado - currentSesion.montoEgresosCalculado;
        const diferencia = conteoEfectivoReal - totalEfectivoEsperado;

        const closedSesion: SesionCaja = {
            ...currentSesion,
            fechaCierre: new Date().toLocaleString(),
            montoEfectivoReal: conteoEfectivoReal,
            diferenciaArqueo: diferencia,
            estado: 'cerrada',
            notasCierre
        };

        const updatedList = sesionesHistory.map(s => s.id === currentSesion.id ? closedSesion : s);
        await saveCajaHistory(updatedList);
        setIsArqueoModalOpen(false);
        toast.success(`🔒 Caja Chica cerrada exitosamente. Diferencia: $${diferencia.toFixed(2)}`);
    };

    // Imprimir Reporte de Caja Chica / Arqueo
    const handlePrintCajaReport = (sesion: SesionCaja) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const totalEfectivoEsperado = sesion.montoInicial + sesion.montoEfectivoCalculado - sesion.montoEgresosCalculado;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte de Caja Chica - ${sesion.id}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #0f172a; max-width: 750px; margin: 0 auto; }
                    .header { text-align: center; border-b: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
                    .title { font-size: 20px; font-weight: 900; color: #4338ca; text-transform: uppercase; }
                    .subtitle { font-size: 11px; color: #64748b; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 20px; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                    .table th { background: #1e1b4b; color: white; text-transform: uppercase; padding: 8px; font-size: 10px; text-align: left; }
                    .table td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
                    .totals { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 12px; font-size: 12px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">SOLUCIONES CONTABLES — CAJA CHICA</div>
                    <div class="subtitle">Reporte Diario de Arqueo y Movimientos de Oficina</div>
                    <div class="subtitle">Apertura: ${sesion.fechaApertura} ${sesion.fechaCierre ? '| Cierre: ' + sesion.fechaCierre : ''}</div>
                </div>

                <div class="grid">
                    <div>
                        <strong>FONDO INICIAL:</strong> $${sesion.montoInicial.toFixed(2)}<br/>
                        <strong>INGRESOS EFECTIVO:</strong> $${sesion.montoEfectivoCalculado.toFixed(2)}<br/>
                        <strong>EGRESOS / GASTOS:</strong> $${sesion.montoEgresosCalculado.toFixed(2)}
                    </div>
                    <div>
                        <strong>TRANSFERENCIAS:</strong> $${sesion.montoTransferenciasCalculado.toFixed(2)}<br/>
                        <strong>EFECTIVO ESPERADO:</strong> $${totalEfectivoEsperado.toFixed(2)}<br/>
                        ${sesion.montoEfectivoReal !== undefined ? `<strong>EFECTIVO REAL:</strong> $${sesion.montoEfectivoReal.toFixed(2)} (Dif: $${(sesion.diferenciaArqueo || 0).toFixed(2)})` : ''}
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Tipo</th>
                            <th>Concepto</th>
                            <th>Forma Pago</th>
                            <th style="text-align: right;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sesion.movimientos.map(m => `
                            <tr>
                                <td>${m.fechaHora}</td>
                                <td><strong style="color: ${m.tipo === 'ingreso' ? '#059669' : '#dc2626'}">${m.tipo.toUpperCase()}</strong></td>
                                <td>${m.concepto} ${m.nombreCliente ? ' (' + m.nombreCliente + ')' : ''}</td>
                                <td style="text-transform: uppercase;">${m.formaPago}</td>
                                <td style="text-align: right; font-family: monospace; font-weight: bold;">$${m.monto.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-row bold" style="font-size: 14px; color: #4338ca;">
                        <span>SALDO NETO TOTAL:</span>
                        <span>$${(sesion.montoInicial + sesion.montoEfectivoCalculado + sesion.montoTransferenciasCalculado - sesion.montoEgresosCalculado).toFixed(2)}</span>
                    </div>
                </div>

                <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const totals = useMemo(() => {
        if (!currentSesion) return { fondoInicial: 0, ingresosEfectivo: 0, transferencias: 0, tarjetas: 0, egresos: 0, efectivoEsperado: 0, saldoTotal: 0 };

        const fondoInicial = currentSesion.montoInicial;
        const ingresosEfectivo = currentSesion.montoEfectivoCalculado;
        const transferencias = currentSesion.montoTransferenciasCalculado;
        const tarjetas = currentSesion.montoTarjetasCalculado;
        const egresos = currentSesion.montoEgresosCalculado;

        const efectivoEsperado = fondoInicial + ingresosEfectivo - egresos;
        const saldoTotal = fondoInicial + ingresosEfectivo + transferencias + tarjetas - egresos;

        return { fondoInicial, ingresosEfectivo, transferencias, tarjetas, egresos, efectivoEsperado, saldoTotal };
    }, [currentSesion]);

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* ── HEADER PRO DE CAJA CHICA ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[hsl(222,47%,4%)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-8 md:p-10">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-bl from-indigo-500/10 via-sky-500/5 to-transparent blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4.5 rounded-3xl bg-gradient-to-br from-indigo-500 to-sky-600 shadow-xl shadow-indigo-500/30 text-white shrink-0">
                            <Wallet size={32} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-2 h-2 rounded-full ${currentSesion ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">TPV Punto de Venta & Caja Chica</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                                Caja Chica de la Oficina Contable
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                                Control diario de cobros de honorarios en efectivo, transferencias, egresos de oficina y arqueo de turno.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {!currentSesion ? (
                            <button
                                onClick={() => setIsAperturaModalOpen(true)}
                                className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg active:scale-95"
                            >
                                <Unlock size={18} /> Abrir Caja Chica del Día
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsMovimientoModalOpen(true)}
                                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg active:scale-95"
                                >
                                    <Plus size={16} /> Registrar Ingreso / Egreso
                                </button>
                                <button
                                    onClick={() => setIsArqueoModalOpen(true)}
                                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-black text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-95"
                                >
                                    <Lock size={16} /> Arqueo y Cierre
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── TARJETAS RESUMEN DE CAJA EN TIEMPO REAL ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fondo Inicial</span>
                        <p className="text-2xl font-black font-mono text-white mt-0.5">${totals.fondoInicial.toFixed(2)}</p>
                    </div>
                    <Banknote size={24} className="text-indigo-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">Cobros Efectivo</span>
                        <p className="text-2xl font-black font-mono text-emerald-400 mt-0.5">${totals.ingresosEfectivo.toFixed(2)}</p>
                    </div>
                    <ArrowUpRight size={24} className="text-emerald-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-sky-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-sky-400 uppercase">Transferencias</span>
                        <p className="text-2xl font-black font-mono text-sky-400 mt-0.5">${totals.transferencias.toFixed(2)}</p>
                    </div>
                    <CreditCard size={24} className="text-sky-400" />
                </div>
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-rose-500/20 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-rose-400 uppercase">Egresos / Gastos</span>
                        <p className="text-2xl font-black font-mono text-rose-400 mt-0.5">${totals.egresos.toFixed(2)}</p>
                    </div>
                    <ArrowDownLeft size={24} className="text-rose-400" />
                </div>
            </div>

            {/* ── TABLA DE MOVIMIENTOS ── */}
            <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Movimientos de la Sesión Activa
                    </h3>
                    {currentSesion && (
                        <button
                            onClick={() => handlePrintCajaReport(currentSesion)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase transition-all flex items-center gap-1.5 text-xs"
                        >
                            <Printer size={13} /> Imprimir Arqueo
                        </button>
                    )}
                </div>

                {!currentSesion || currentSesion.movimientos.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl text-slate-400 text-xs">
                        Aún no hay movimientos registrados en la caja chica de hoy.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-4 px-5">Fecha / Hora</th>
                                    <th className="py-4 px-5">Tipo</th>
                                    <th className="py-4 px-5">Concepto / Cliente</th>
                                    <th className="py-4 px-5">Forma Pago</th>
                                    <th className="py-4 px-5 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {currentSesion.movimientos.map((m) => (
                                    <tr key={m.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-5 font-mono text-slate-400 text-[10px]">{m.fechaHora}</td>
                                        <td className="py-4 px-5">
                                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                                m.tipo === 'ingreso' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                            }`}>
                                                {m.tipo}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="font-bold text-white">{m.concepto}</p>
                                            {m.nombreCliente && (
                                                <p className="text-[10px] text-teal-400 font-mono">Cliente: {m.nombreCliente}</p>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 font-mono text-slate-300 uppercase text-[10px]">{m.formaPago}</td>
                                        <td className="py-4 px-5 text-right font-mono font-bold text-base text-white">
                                            ${m.monto.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── MODAL APERTURA CAJA ── */}
            {isAperturaModalOpen && (
                <Modal isOpen={true} onClose={() => setIsAperturaModalOpen(false)} title="🟢 Abrir Caja Chica del Día" size="sm">
                    <div className="space-y-4 p-4 text-white">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-300 uppercase block">Monto Inicial (Fondo de Caja Chica)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={montoInicialForm}
                                onChange={(e) => setMontoInicialForm(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono font-bold text-white outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsAperturaModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleAbrirCaja} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs">Abrir Caja</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL NUEVO MOVIMIENTO ── */}
            {isMovimientoModalOpen && (
                <Modal isOpen={true} onClose={() => setIsMovimientoModalOpen(false)} title="➕ Registrar Movimiento de Caja" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Tipo</label>
                                <select
                                    value={tipoMov}
                                    onChange={(e) => setTipoMov(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-bold outline-none"
                                >
                                    <option value="ingreso">🟢 Ingreso / Cobro</option>
                                    <option value="egreso">🔴 Egreso / Gasto Oficina</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Forma de Pago</label>
                                <select
                                    value={formaPagoMov}
                                    onChange={(e) => setFormaPagoMov(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-bold outline-none"
                                >
                                    <option value="efectivo">💵 Efectivo</option>
                                    <option value="transferencia">🏦 Transferencia Banco</option>
                                    <option value="deposito">🏛️ Depósito</option>
                                    <option value="tarjeta">💳 Tarjeta</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block">Cliente (Opcional)</label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                            >
                                <option value="">-- Cliente de mostrador --</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ruc}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Concepto *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Cobro honorario / Compra copias"
                                    value={conceptoMov}
                                    onChange={(e) => setConceptoMov(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block">Monto ($) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={montoMov}
                                    onChange={(e) => setMontoMov(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white font-mono outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsMovimientoModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleAddMovimiento} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs">Guardar Movimiento</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL ARQUEO DE CAJA ── */}
            {isArqueoModalOpen && (
                <Modal isOpen={true} onClose={() => setIsArqueoModalOpen(false)} title="🔒 Arqueo y Cierre de Caja Chica" size="md">
                    <div className="space-y-4 p-4 text-white">
                        <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 font-mono text-xs space-y-1">
                            <div className="flex justify-between text-slate-400"><span>Fondo Inicial:</span> <span>${totals.fondoInicial.toFixed(2)}</span></div>
                            <div className="flex justify-between text-emerald-400"><span>+ Ingresos Efectivo:</span> <span>${totals.ingresosEfectivo.toFixed(2)}</span></div>
                            <div className="flex justify-between text-rose-400"><span>- Egresos Oficina:</span> <span>${totals.egresos.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                                <span>EFECTIVO ESPERADO EN CAJA:</span>
                                <span>${totals.efectivoEsperado.toFixed(2)}</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                Conteo Físico Real de Efectivo ($) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={conteoEfectivoReal}
                                onChange={(e) => setConteoEfectivoReal(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono font-bold text-white outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setIsArqueoModalOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                            <button onClick={handleCerrarCaja} className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">Cerrar y Cuadrar Caja</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
