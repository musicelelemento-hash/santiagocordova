
import React, { useState, useMemo } from 'react';
import { Client, IvaFrequency } from '../../../types';
import { format, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import { NoteCategory, ClientNote } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

interface IvaFrequencyChangeModalProps {
    client: Client;
    onConfirm: (updatedClient: Client) => void;
    onCancel: () => void;
}

/**
 * Calcula el periodo de inicio correcto según la nueva frecuencia y la fecha actual.
 * - Mensual → El periodo actual (mes anterior si es entre día 10-28, si no el mes de preparación)
 * - Semestral → El semestre vigente (S1 o S2 según el mes)
 */
function computeNewStartPeriod(newFreq: IvaFrequency): string {
    const today = new Date();
    const month = getMonth(today) + 1; // 1-12
    const year = getYear(today);

    if (newFreq === 'Mensual') {
        // El primer periodo obligatorio es el mes anterior al actual
        const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return format(prev, 'yyyy-MM');
    }

    if (newFreq === 'Semestral') {
        // Si estamos Ene-Jun → el primer semestre a declarar es S2 del año anterior
        // Si estamos Jul-Dic → el primer semestre a declarar es S1 del año actual
        if (month <= 6) {
            return `${year - 1}-S2`;
        } else {
            return `${year}-S1`;
        }
    }

    return format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM');
}

/**
 * Etiqueta legible del semestre activo
 */
function getSemesterLabel(period: string): string {
    if (period.includes('S1')) return `Semestral S1 (Enero–Junio ${period.substring(0, 4)})`;
    if (period.includes('S2')) return `Semestral S2 (Julio–Diciembre ${period.substring(0, 4)})`;
    return period;
}

export const IvaFrequencyChangeModal: React.FC<IvaFrequencyChangeModalProps> = ({
    client,
    onConfirm,
    onCancel,
}) => {
    const currentFreq = client.taxProfile?.ivaFrequency || 'Mensual';
    const today = new Date();

    // La nueva frecuencia por defecto es el opuesto al actual
    const [newFreq, setNewFreq] = useState<IvaFrequency>(
        currentFreq === 'Mensual' ? 'Semestral' : 'Mensual'
    );
    const [reason, setReason] = useState('');
    const [effectiveDate, setEffectiveDate] = useState<string>(format(today, 'yyyy-MM-dd'));
    const [newFee, setNewFee] = useState<string>(
        newFreq === 'Semestral'
            ? (client.fee_structure?.semestral ?? 10).toString()
            : (client.fee_structure?.monthly ?? 5).toString()
    );

    const suggestedStartPeriod = useMemo(() => computeNewStartPeriod(newFreq), [newFreq]);

    // Alerta de declaraciones pendientes en la frecuencia actual
    const hasPendingDeclarations = useMemo(() => {
        const currentPeriod = client.taxProfile?.ivaFrequency === 'Semestral'
            ? (getMonth(today) + 1 <= 6 ? `${getYear(today) - 1}-S2` : `${getYear(today)}-S1`)
            : format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM');
        const decl = (client.declarations || []).find(d => d.period === currentPeriod);
        return !decl || (decl.status === 'Pendiente' && !decl.proof_file);
    }, [client, today]);

    const handleConfirm = () => {
        // 1. Actualizar el taxProfile con la nueva frecuencia
        const updatedTaxProfile = {
            ...(client.taxProfile || {
                ivaFrequency: 'Mensual' as IvaFrequency,
                requiresAnnualRenta: true,
                requiresAnexosGastos: false,
                hasActiveDevolucionIva: false,
                hasActiveElderlyDevolucionIva: false,
                requiresIce: false,
                requiresAnexoPvp: false,
            }),
            ivaFrequency: newFreq,
        };

        // 2. Actualizar fee_structure
        const feeValue = parseFloat(newFee) || (newFreq === 'Semestral' ? 10 : 5);
        const updatedFeeStructure = {
            ...(client.fee_structure || {}),
            monthly: newFreq === 'Mensual' ? feeValue : (client.fee_structure?.monthly ?? 5),
            semestral: newFreq === 'Semestral' ? feeValue : (client.fee_structure?.semestral ?? 10),
            annual: client.fee_structure?.annual ?? 10,
        };

        // 3. Registrar el cambio en notas estructuradas
        const changeNote: ClientNote = {
            id: uuidv4(),
            content: `🔄 CAMBIO DE RÉGIMEN IVA: ${currentFreq.toUpperCase()} → ${newFreq.toUpperCase()}. Vigente desde: ${effectiveDate}. Nuevo período de inicio: ${suggestedStartPeriod}. Motivo: ${reason || 'Cambio de condición tributaria (artesano/régimen)'}`,
            category: NoteCategory.Important,
            createdAt: new Date().toISOString(),
            createdBy: 'Sistema',
        };

        // 4. Construir el cliente actualizado
        const updatedClient: Client = {
            ...client,
            taxProfile: updatedTaxProfile,
            fee_structure: updatedFeeStructure,
            // El nuevo clientStartPeriod refleja desde cuándo aplica la nueva frecuencia
            clientStartPeriod: suggestedStartPeriod,
            structuredNotes: [...(client.structuredNotes || []), changeNote],
            updatedAt: new Date().toISOString(),
        };

        onConfirm(updatedClient);
    };

    const freqOptions: { id: IvaFrequency; label: string; desc: string; icon: any; color: string }[] = [
        {
            id: 'Mensual',
            label: 'Mensual',
            desc: 'Declara IVA cada mes (días 10–28). Régimen General, artesanos activos.',
            icon: LucideIcons.CalendarDays,
            color: 'blue',
        },
        {
            id: 'Semestral',
            label: 'Semestral',
            desc: 'Declara IVA 2 veces al año. Artesanos calificados, RIMPE Emprendedor.',
            icon: LucideIcons.Calendar,
            color: 'indigo',
        },
        {
            id: 'Ninguno',
            label: 'Exento / Sin IVA',
            desc: 'RIMPE Negocio Popular. Sin obligación de IVA. Solo Renta anual.',
            icon: LucideIcons.ShieldOff,
            color: 'slate',
        },
    ];

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
                
                {/* Glow decorativo */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/8 rounded-full blur-[80px] -mr-24 -mt-24 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-500/8 rounded-full blur-[60px] -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                            <LucideIcons.RefreshCcw size={24} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                Cambio de Frecuencia IVA
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                {client.tradeName || client.name}
                            </p>
                        </div>
                        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all">
                            <LucideIcons.X size={20} />
                        </button>
                    </div>

                    {/* Alerta de pendientes */}
                    {hasPendingDeclarations && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
                            <LucideIcons.AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                                    Declaración pendiente
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                                    El cliente tiene la declaración del período actual ({currentFreq}) sin procesar. Se recomienda completarla antes de cambiar la frecuencia para no perder el historial.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Frecuencia actual → nueva */}
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                            Régimen Actual: <span className="text-blue-500">{currentFreq}</span>
                        </label>
                        <div className="grid gap-2">
                            {freqOptions.map(opt => {
                                const Icon = opt.icon;
                                const isSelected = newFreq === opt.id;
                                const isCurrent = currentFreq === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            if (!isCurrent) {
                                                setNewFreq(opt.id);
                                                setNewFee(opt.id === 'Semestral'
                                                    ? (client.fee_structure?.semestral ?? 10).toString()
                                                    : (client.fee_structure?.monthly ?? 5).toString()
                                                );
                                            }
                                        }}
                                        disabled={isCurrent}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 ${
                                            isCurrent
                                                ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 opacity-50 cursor-not-allowed'
                                                : isSelected
                                                    ? `border-${opt.color}-400 bg-${opt.color}-50 dark:bg-${opt.color}-500/10 shadow-sm scale-[1.01]`
                                                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                            isSelected && !isCurrent
                                                ? `bg-${opt.color}-100 dark:bg-${opt.color}-500/20 text-${opt.color}-600 dark:text-${opt.color}-400`
                                                : 'bg-slate-100 dark:bg-white/10 text-slate-400'
                                        }`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${isSelected && !isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {opt.label}
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-[9px] px-2 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-500 rounded-md font-black uppercase tracking-wider">
                                                        Actual
                                                    </span>
                                                )}
                                                {isSelected && !isCurrent && (
                                                    <span className="text-[9px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-md font-black uppercase tracking-wider">
                                                        Nuevo
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                                        </div>
                                        {isSelected && !isCurrent && (
                                            <LucideIcons.CheckCircle size={18} className="text-indigo-500 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Periodo de inicio */}
                    {newFreq !== 'Ninguno' && (
                        <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
                            <LucideIcons.CalendarCheck size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1">
                                    Primer período con la nueva frecuencia
                                </p>
                                <p className="text-base font-black text-emerald-800 dark:text-emerald-300">
                                    {newFreq === 'Semestral'
                                        ? getSemesterLabel(suggestedStartPeriod)
                                        : format(new Date(suggestedStartPeriod + '-01'), 'MMMM yyyy', { locale: es }).toUpperCase()
                                    }
                                </p>
                                <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500/70 mt-1">
                                    Los períodos anteriores con frecuencia {currentFreq} quedan preservados en el historial.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Nueva cuota */}
                    {newFreq !== 'Ninguno' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                                    Nueva Cuota ({newFreq === 'Semestral' ? 'Por semestre' : 'Por mes'})
                                </label>
                                <div className="relative">
                                    <LucideIcons.DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="number"
                                        value={newFee}
                                        onChange={e => setNewFee(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2.5 glass-card-premium rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                                    Fecha efectiva del cambio
                                </label>
                                <input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={e => setEffectiveDate(e.target.value)}
                                    className="w-full px-3 py-2.5 glass-card-premium rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Motivo */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                            Motivo del cambio <span className="text-slate-300">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Ej: Calificación como artesano, cambio de actividad..."
                            className="w-full px-4 py-2.5 glass-card-premium rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-all placeholder:text-slate-300"
                        />
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold rounded-2xl border border-slate-200 dark:border-white/10 text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={newFreq === currentFreq}
                            className="flex-[2] flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            <LucideIcons.RefreshCcw size={15} />
                            Confirmar Cambio {newFreq !== currentFreq ? `→ ${newFreq}` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
