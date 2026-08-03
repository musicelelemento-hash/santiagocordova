import React, { useState, useMemo } from 'react';
import { 
    HeartHandshake, Plus, Search, DollarSign, Calculator, 
    CheckCircle2, FileText, Download, Printer, User, Calendar, X, Sparkles
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';

export interface SolicitudDevolucionIva {
    id: string;
    clienteId?: string;
    nombreBeneficiario: string;
    rucBeneficiario: string;
    tipoBeneficiario: 'Tercera Edad' | 'Discapacidad';
    porcentajeDiscapacidad?: number;
    periodoFiscal: string; // ej: "2026-01"
    montoIvaSolicitado: number;
    montoIvaDevueltoSRI?: number;
    estado: 'Borrador' | 'Ingresada SRI' | 'Aprobada' | 'Rechazada';
    fechaSolicitud: string;
}

interface DevolucionIvaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DevolucionIvaModal: React.FC<DevolucionIvaModalProps> = ({ isOpen, onClose }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [solicitudes, setSolicitudes] = useState<SolicitudDevolucionIva[]>([
        {
            id: 'DEV-001',
            nombreBeneficiario: 'SR. CARLOS ALBERTO MEDINA',
            rucBeneficiario: '0701234567001',
            tipoBeneficiario: 'Tercera Edad',
            periodoFiscal: '2026-01',
            montoIvaSolicitado: 108.00,
            montoIvaDevueltoSRI: 108.00,
            estado: 'Aprobada',
            fechaSolicitud: '2026-01-15'
        }
    ]);

    // Form
    const [selectedClientId, setSelectedClientId] = useState('');
    const [tipoBeneficiario, setTipoBeneficiario] = useState<'Tercera Edad' | 'Discapacidad'>('Tercera Edad');
    const [periodoFiscal, setPeriodoFiscal] = useState('2026-01');
    const [montoIva, setMontoIva] = useState<number>(108.00); // Tope legal SRI

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
    };

    const handleCreateSolicitud = () => {
        const clientObj = clients.find(c => c.id === selectedClientId);
        if (!clientObj) {
            toast.error("Selecciona un cliente beneficiario.");
            return;
        }

        const newSol: SolicitudDevolucionIva = {
            id: `DEV-${Date.now().toString().slice(-4)}`,
            clienteId: clientObj.id,
            nombreBeneficiario: clientObj.name,
            rucBeneficiario: clientObj.ruc,
            tipoBeneficiario,
            periodoFiscal,
            montoIvaSolicitado: montoIva,
            estado: 'Ingresada SRI',
            fechaSolicitud: new Date().toISOString().split('T')[0]
        };

        setSolicitudes([newSol, ...solicitudes]);
        toast.success(`🎉 Solicitud de Devolución IVA (${newSol.periodoFiscal}) registrada.`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-4xl h-[85vh] bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white">
                
                {/* Header */}
                <div className="p-6 bg-slate-900/80 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white font-bold shadow-lg shadow-rose-500/20">
                            <HeartHandshake size={22} />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-rose-400 tracking-[0.2em] block">
                                Trámites Especiales SRI
                            </span>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                Devolución de IVA — Tercera Edad & Discapacidad
                            </h2>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
                    
                    {/* Formulario */}
                    <div className="p-5 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
                        <h3 className="text-xs font-bold text-rose-300 uppercase">Nueva Solicitud de Devolución al SRI</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Beneficiario</label>
                                <select
                                    value={selectedClientId}
                                    onChange={(e) => handleSelectClient(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none"
                                >
                                    <option value="">-- Seleccionar cliente --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.ruc}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tipo de Ley</label>
                                <select
                                    value={tipoBeneficiario}
                                    onChange={(e) => setTipoBeneficiario(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none font-bold"
                                >
                                    <option value="Tercera Edad">👴 Tercera Edad</option>
                                    <option value="Discapacidad">♿ Personas con Discapacidad</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Monto IVA Solicitado ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={montoIva}
                                    onChange={(e) => setMontoIva(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono font-bold text-emerald-400 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleCreateSolicitud} className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">
                                Ingresar Solicitud
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Historial */}
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-4 px-5">Beneficiario</th>
                                    <th className="py-4 px-5">Ley Aplicada</th>
                                    <th className="py-4 px-5">Período</th>
                                    <th className="py-4 px-5 text-right">IVA Solicitado</th>
                                    <th className="py-4 px-5">Estado SRI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {solicitudes.map(s => (
                                    <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-5 font-bold text-white uppercase">{s.nombreBeneficiario}</td>
                                        <td className="py-4 px-5 text-rose-300 font-bold">{s.tipoBeneficiario}</td>
                                        <td className="py-4 px-5 font-mono text-slate-300">{s.periodoFiscal}</td>
                                        <td className="py-4 px-5 text-right font-mono font-bold text-emerald-400">${s.montoIvaSolicitado.toFixed(2)}</td>
                                        <td className="py-4 px-5">
                                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                {s.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
