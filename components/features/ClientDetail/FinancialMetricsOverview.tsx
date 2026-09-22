import React, { useState, useMemo, useEffect } from 'react';
import { Client, TaxRegime } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';
import {
    BarChart3, ShoppingCart, ShoppingBag, Coins, TrendingUp, TrendingDown,
    Download, Copy, Sparkles, Calendar, Layers, ArrowUpRight, ArrowDownRight,
    PieChart, ShieldCheck, CheckCircle2, FileSpreadsheet, Award, AlertCircle
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

/**
 * De donde salio una cifra.
 *
 *  'sri'       la mando la extension, leida del portal.
 *  'estimado'  no vino y se calculo con una regla de proporcion.
 *
 * La distincion importa. Sin ella la ficha mostraba el honorario del cliente
 * multiplicado por cuatro como "ventas del periodo", con la misma tipografia
 * y el mismo color que un dato real del SRI. Los respaldos siguen: sirven
 * para que la ficha no quede vacia. Lo que cambia es que ahora se ven.
 */
type OrigenCifra = 'sri' | 'estimado';

/** Toma el primer candidato que sea un numero de verdad; si no hay, estima. */
const leerCifra = (
    candidatos: unknown[],
    estimar: () => number
): { valor: number; origen: OrigenCifra } => {
    for (const c of candidatos) {
        if (typeof c === 'number' && Number.isFinite(c)) {
            return { valor: c, origen: 'sri' };
        }
    }
    return { valor: estimar(), origen: 'estimado' };
};

/** Marca discreta para una cifra que no vino del SRI. */
const SelloEstimado: React.FC<{ origen: OrigenCifra; que: string }> = ({ origen, que }) => {
    if (origen === 'sri') return null;
    return (
        <span
            title={`No hay dato del SRI para ${que} en este periodo. Este numero es una estimacion, no una lectura del portal.`}
            className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                       bg-amber-500/15 text-amber-500 border border-amber-500/40 whitespace-nowrap"
        >
            estimado
        </span>
    );
};

interface FinancialMetricsOverviewProps {
    client: Client;
    theme?: 'dark' | 'light';
}

export const FinancialMetricsOverview: React.FC<FinancialMetricsOverviewProps> = ({
    client,
    theme = 'dark'
}) => {
    const { toast } = useToast();

    // Detección precisa de régimen y cadencia
    const isPopular = client.regime === TaxRegime.RimpeNegocioPopular ||
                      client.taxProfile?.ivaFrequency === 'Ninguno' ||
                      !!client.regime?.toLowerCase().includes('popular');
    const isSemestral = !isPopular && (client.taxProfile?.ivaFrequency === 'Semestral' || client.regime === TaxRegime.RimpeEmprendedor);
    const isMensual = !isPopular && !isSemestral;
    const isGeneralRegime = !isPopular && (client.regime === TaxRegime.General || !client.regime?.toLowerCase().includes('rimpe'));

    // 1. Obtener lista de períodos disponibles según el régimen del cliente
    const availablePeriods = useMemo(() => {
        const periodsSet = new Set<string>();
        if (client.declarations && client.declarations.length > 0) {
            client.declarations.forEach(d => {
                if (d.period && d.period.startsWith('202')) {
                    if (isPopular) {
                        // Para Negocio Popular, aceptar períodos anuales (4 dígitos) o derivar el año
                        if (d.period.length === 4) {
                            periodsSet.add(d.period);
                        } else if (d.period.includes('-')) {
                            periodsSet.add(d.period.split('-')[0]);
                        }
                    } else if (isSemestral) {
                        if (d.period.includes('S')) {
                            periodsSet.add(d.period);
                        }
                    } else {
                        periodsSet.add(d.period);
                    }
                }
            });
        }

        const now = new Date();
        const currentYearNum = now.getFullYear();

        if (isPopular) {
            // Generar últimos 5 años fiscales para RIMPE Negocio Popular
            for (let i = 0; i < 5; i++) {
                periodsSet.add((currentYearNum - i).toString());
            }
        } else if (isSemestral) {
            // Generar últimos semestres
            for (let i = 0; i < 3; i++) {
                const y = currentYearNum - i;
                periodsSet.add(`${y}-S2`);
                periodsSet.add(`${y}-S1`);
            }
        } else {
            // Generar últimos 12 meses por defecto para Régimen General / Mensual
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const p = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                periodsSet.add(p);
            }
        }

        return Array.from(periodsSet).sort().reverse();
    }, [client.declarations, isPopular, isSemestral]);

    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        if (availablePeriods.length > 0) return availablePeriods[0];
        return isPopular ? (new Date().getFullYear() - 1).toString() : '2026-07';
    });

    // Sincronizar selección si cambia la cartera de períodos disponibles
    useEffect(() => {
        if (availablePeriods.length > 0 && !availablePeriods.includes(selectedPeriod)) {
            setSelectedPeriod(availablePeriods[0]);
        }
    }, [availablePeriods, selectedPeriod]);

    // Ventas YTD / Anuales del cliente
    const currentYear = new Date().getFullYear().toString();
    const ytdSales = useMemo(() => {
        let total = 0;
        if (client.declarations) {
            client.declarations.forEach(d => {
                if (d.period && d.period.startsWith(currentYear)) {
                    const meta = (d.proof_file?.metadata as any) || {};
                    const v15 = meta.ventas15 ?? meta.base15 ?? (d.amount ? d.amount * 4 : 0);
                    const v0 = meta.ventas0 ?? meta.base0 ?? 0;
                    const v5 = meta.ventas5 ?? 0;
                    total += v15 + v0 + v5;
                }
            });
        }
        return total;
    }, [client.declarations, currentYear]);

    // 3. Declaración activa seleccionada
    const activeDeclaration = useMemo(() => {
        return (client.declarations || []).find(d => d.period === selectedPeriod);
    }, [client.declarations, selectedPeriod]);

    // Ingresos anuales para Negocio Popular (Año seleccionado o en curso)
    const annualRevenueNp = useMemo(() => {
        if (!isPopular) return ytdSales;
        const targetYear = selectedPeriod.length === 4 ? selectedPeriod : currentYear;
        let total = 0;
        let count = 0;
        if (client.declarations) {
            client.declarations.forEach(d => {
                if (d.period && d.period.startsWith(targetYear)) {
                    const meta = (d.proof_file?.metadata as any) || {};
                    const v15 = meta.ventas15 ?? meta.base15 ?? 0;
                    const v0 = meta.ventas0 ?? meta.base0 ?? (d.amount ? d.amount * 4 : 0);
                    const v5 = meta.ventas5 ?? 0;
                    total += v15 + v0 + v5;
                    count++;
                }
            });
        }
        if (total === 0 && activeDeclaration) {
            const meta = (activeDeclaration.proof_file?.metadata as any) || {};
            const v15 = meta.ventas15 ?? meta.base15 ?? 0;
            const v0 = meta.ventas0 ?? meta.base0 ?? (activeDeclaration.amount ? activeDeclaration.amount * 4 : 0);
            total = v15 + v0;
        }
        return total;
    }, [isPopular, selectedPeriod, currentYear, client.declarations, activeDeclaration, ytdSales]);

    // Tabla SRI RIMPE Negocio Popular (Decreto Ley Orgánica de Economía Familiar)
    // Ingresos brutos hasta $20,000 anuales. Cuotas fijas anuales:
    const npTaxBrackets = [
        { limit: 2500, tax: 0, msg: "Cuota Fija $0.00 (Exento)" },
        { limit: 5000, tax: 5, msg: "Cuota Fija $5.00" },
        { limit: 10000, tax: 15, msg: "Cuota Fija $15.00" },
        { limit: 15000, tax: 35, msg: "Cuota Fija $35.00" },
        { limit: 20000, tax: 60, msg: "Cuota Fija Máxima $60.00" },
        { limit: Infinity, tax: 60, msg: "Excluido de Negocio Popular (Supera $20,000)" }
    ];

    const currentNpBracket = useMemo(() => {
        return npTaxBrackets.find(b => annualRevenueNp <= b.limit) || npTaxBrackets[npTaxBrackets.length - 1];
    }, [annualRevenueNp]);

    // Tabla SRI Régimen General 2024
    const taxBrackets = [
        { limit: 11902, tax: 0, msg: "Fracción Básica Desgravada" },
        { limit: 15159, tax: 5, msg: "Tramo 5%" },
        { limit: 19682, tax: 10, msg: "Tramo 10%" },
        { limit: 25215, tax: 12, msg: "Tramo 12%" },
        { limit: 33738, tax: 15, msg: "Tramo 15%" },
        { limit: 44721, tax: 20, msg: "Tramo 20%" },
        { limit: 59537, tax: 25, msg: "Tramo 25%" },
        { limit: 79388, tax: 30, msg: "Tramo 30%" },
        { limit: 105580, tax: 35, msg: "Tramo 35%" },
        { limit: Infinity, tax: 37, msg: "Tramo Máximo 37%" }
    ];

    const currentBracket = useMemo(() => {
        return taxBrackets.find(b => ytdSales <= b.limit) || taxBrackets[taxBrackets.length - 1];
    }, [ytdSales]);

    // 2. Mapear datos históricos para la gráfica comparativa (últimos períodos)
    const historyData = useMemo(() => {
        const lastSlice = availablePeriods.slice(0, 6).reverse();
        return lastSlice.map(p => {
            const decl = (client.declarations || []).find(d => d.period === p);
            const meta = (decl?.proof_file?.metadata as any) || {};

            const v15 = meta.ventas15 ?? meta.base15 ?? 0;
            const v0 = meta.ventas0 ?? meta.base0 ?? (decl?.amount && isPopular ? decl.amount * 4 : 0);
            const v5 = meta.ventas5 ?? 0;
            const ivaVentas = isPopular ? 0 : (meta.montoIvaVentas ?? (v15 * 0.15));
            const totalVentas = v15 + v0 + v5 + ivaVentas;

            const c15 = meta.compras15 ?? (isPopular ? 0 : v15 * 0.4);
            const c0 = meta.compras0 ?? 0;
            const c5 = meta.compras5 ?? 0;
            const ivaCompras = isPopular ? 0 : (meta.montoIvaCompras ?? (c15 * 0.15));
            const totalCompras = c15 + c0 + c5 + ivaCompras;

            const retIva = isPopular ? 0 : (meta.retIva ?? (ivaVentas * 0.3));
            const retRenta = meta.retRenta ?? (totalVentas * 0.0175);
            const totalRet = retIva + retRenta;

            let displayName = formatPeriodForDisplay(p);
            if (isPopular && p.length === 4) {
                displayName = `Año ${p}`;
            }

            return {
                period: p,
                displayName,
                monthName: displayName,
                totalVentas,
                totalCompras,
                totalRet,
                ventas15: v15,
                ventas0: v0,
                ventas5: v5,
                compras15: c15,
                compras0: c0,
                compras5: c5,
                hasDecl: !!decl
            };
        });
    }, [availablePeriods, client.declarations, isPopular]);

    // Encontrar valor máximo para escalar las barras proporcionalmente
    const maxBarVal = useMemo(() => {
        let max = 100;
        historyData.forEach(d => {
            if (d.totalVentas > max) max = d.totalVentas;
            if (d.totalCompras > max) max = d.totalCompras;
        });
        return max;
    }, [historyData]);

    // 4. Métricas detalladas del período seleccionado (con soporte multi-tarifa 0%, 5%, 8%, 15% y retenciones)
    const metrics = useMemo(() => {
        const meta = (activeDeclaration?.proof_file?.metadata as any) || {};

        // Base 15%
        const rVentas15 = leerCifra(
            [meta.ventas15, meta.base15],
            () => (isPopular ? 0 : (activeDeclaration?.amount ? activeDeclaration.amount * 4 : 0))
        );
        const ventas15 = rVentas15.valor;

        // Base 0% (Para Negocio Popular sus ventas son Notas de Venta con tarifa 0%)
        const rVentas0 = leerCifra(
            [meta.ventas0, meta.base0],
            () => (isPopular ? (activeDeclaration?.amount ? activeDeclaration.amount * 4 : 0) : 0)
        );
        const ventas0 = rVentas0.valor;

        // Base 5% y 8%
        const ventas5 = leerCifra([meta.ventas5], () => 0).valor;
        const ventas8 = leerCifra([meta.ventas8], () => 0).valor;

        const montoIvaVentas = isPopular
            ? 0
            : leerCifra([meta.montoIvaVentas], () => (ventas15 * 0.15) + (ventas5 * 0.05) + (ventas8 * 0.08)).valor;
        const totalVentas = ventas15 + ventas0 + ventas5 + ventas8 + montoIvaVentas;

        // Compras multi-tarifa
        const rCompras15 = leerCifra([meta.compras15], () => (isPopular ? 0 : ventas15 * 0.4));
        const compras15 = rCompras15.valor;
        const compras0 = leerCifra([meta.compras0], () => 0).valor;
        const compras5 = leerCifra([meta.compras5], () => 0).valor;
        const compras8 = leerCifra([meta.compras8], () => 0).valor;
        const montoIvaCompras = isPopular
            ? 0
            : leerCifra([meta.montoIvaCompras], () => (compras15 * 0.15) + (compras5 * 0.05)).valor;
        const totalCompras = compras15 + compras0 + compras5 + compras8 + montoIvaCompras;

        // Retenciones
        const rRetIva = leerCifra([meta.retIva], () => (isPopular ? 0 : montoIvaVentas * 0.3));
        const retIva = rRetIva.valor;
        const rRetRenta = leerCifra([meta.retRenta], () => (totalVentas * 0.0175));
        const retRenta = rRetRenta.valor;
        const totalRetenciones = retIva + retRenta;

        const origenVentas: OrigenCifra = isPopular ? rVentas0.origen : rVentas15.origen;
        const origenCompras: OrigenCifra = rCompras15.origen;
        const origenRetenciones: OrigenCifra =
            (rRetIva.origen === 'sri' && rRetRenta.origen === 'sri') ? 'sri' : 'estimado';

        const nc15 = meta.nc15 ?? 0;
        const nc0 = meta.nc0 ?? 0;
        const totalNC = meta.ncTotal ?? (nc15 + nc0);

        // Resultado impositivo:
        // Negocio Popular -> Cuota fija anual según tramo ($0, $5, $15, $35 o $60)
        // General / Emprendedor -> Saldo IVA Ventas - Compras - Retenciones
        const cuotaFijaNp = currentNpBracket.tax;
        const resultadoNetoIva = montoIvaVentas - montoIvaCompras - retIva;
        const esCreditoFavor = isPopular ? false : resultadoNetoIva <= 0;

        return {
            ventas15,
            ventas0,
            ventas5,
            ventas8,
            montoIvaVentas,
            totalVentas,
            compras15,
            compras0,
            compras5,
            compras8,
            montoIvaCompras,
            totalCompras,
            retIva,
            retRenta,
            totalRetenciones,
            nc15,
            nc0,
            totalNC,
            cuotaFijaNp,
            resultadoNetoIva: isPopular ? cuotaFijaNp : Math.abs(resultadoNetoIva),
            esCreditoFavor,
            origenVentas,
            origenCompras,
            origenRetenciones,
            hayEstimados: origenVentas === 'estimado'
                       || origenCompras === 'estimado'
                       || origenRetenciones === 'estimado'
        };
    }, [activeDeclaration, isPopular, currentNpBracket.tax]);

    const handleCopy = (label: string, val: number) => {
        navigator.clipboard.writeText(val.toFixed(2));
        toast.success(`Copiado ${label}: $${val.toFixed(2)}`);
    };

    const handleExportCSV = () => {
        let csv = `\uFEFFHISTORIAL Y METRICAS IMPOSITIVAS - ${client.name} (${client.ruc})\n`;
        csv += `Período Seleccionado,${selectedPeriod}\n`;
        // Una estimación no puede viajar en una hoja como si fuera un dato
        // del portal: quien la reciba no tiene forma de saberlo.
        if (metrics.hayEstimados) {
            csv += `ATENCION,"Este período no tiene todos los datos del SRI. Las filas marcadas (estimado) son cálculos aproximados, no lecturas del portal."\n`;
        }
        csv += `\n`;
        csv += `CONCEPTO,VALOR ($)\n`;
        csv += `Ventas Base 15%${metrics.origenVentas === 'estimado' ? ' (estimado)' : ''},${metrics.ventas15.toFixed(2)}\n`;
        csv += `Ventas Base 0%,${metrics.ventas0.toFixed(2)}\n`;
        csv += `Monto IVA Ventas (15%),${metrics.montoIvaVentas.toFixed(2)}\n`;
        csv += `TOTAL VENTAS BRUTAS,${metrics.totalVentas.toFixed(2)}\n\n`;
        csv += `Compras Base 15%${metrics.origenCompras === 'estimado' ? ' (estimado)' : ''},${metrics.compras15.toFixed(2)}\n`;
        csv += `Compras Base 0%,${metrics.compras0.toFixed(2)}\n`;
        csv += `Crédito IVA Compras,${metrics.montoIvaCompras.toFixed(2)}\n`;
        csv += `TOTAL COMPRAS,${metrics.totalCompras.toFixed(2)}\n\n`;
        csv += `Retenciones IVA Recibidas (609)${metrics.origenRetenciones === 'estimado' ? ' (estimado)' : ''},${metrics.retIva.toFixed(2)}\n`;
        csv += `Retenciones Renta Recibidas (610),${metrics.retRenta.toFixed(2)}\n`;
        csv += `TOTAL RETENCIONES,${metrics.totalRetenciones.toFixed(2)}\n\n`;
        csv += `RESULTADO IMPOSITIVO,${metrics.esCreditoFavor ? 'Crédito a Favor: $' : 'Saldo a Pagar: $'}${metrics.resultadoNetoIva.toFixed(2)}\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Metricas_Financieras_${client.ruc}_${selectedPeriod}.csv`;
        link.click();
        toast.success("Métricas exportadas a CSV con éxito.");
    };

    const isDark = theme === 'dark';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* BARRA SUPERIOR Y SELECTOR DE PERÍODO (STITCH LUXURY HEADER) */}
            <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
                isDark
                    ? 'bg-[#051424]/90 border-white/10 border-t-white/20 text-white shadow-2xl shadow-black/40'
                    : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
            }`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                            isDark
                                ? 'bg-[#00A896]/15 border-[#00A896]/30 text-[#00A896] shadow-[#00A896]/20'
                                : 'bg-teal-50 border-teal-200 text-teal-600'
                        }`}>
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight flex items-center gap-2">
                                Métricas & Histórico SRI
                                <span className="bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] text-[10px] font-mono font-bold uppercase px-3 py-1 rounded-full tracking-wider shadow-[0_0_8px_rgba(0,168,150,0.2)]">
                                    {isPopular ? 'Form. Renta RIMPE' : isSemestral ? 'Form. 2011 IVA Semestral' : 'Form. 2011 IVA Mensual'}
                                </span>
                            </h2>
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {isPopular
                                    ? 'Control anual de ingresos brutos, gastos y cuota fija anual RIMPE Negocio Popular'
                                    : 'Análisis gráfico comparativo de ventas, compras y retenciones procesadas'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Selector de Período Dinámico */}
                    <div className={`flex items-center gap-2 border rounded-2xl px-4 py-2.5 text-xs font-mono font-bold ${
                        isDark
                            ? 'bg-[#0b1326]/80 border-white/10 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                        <Calendar size={14} className="text-[#00A896]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {isPopular ? 'Año Fiscal:' : isSemestral ? 'Semestre:' : 'Mes:'}
                        </span>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="bg-transparent font-bold outline-none cursor-pointer pr-2 text-[#00A896]"
                        >
                            {availablePeriods.map(p => (
                                <option key={p} value={p} className={isDark ? 'bg-[#051424] text-white' : 'bg-white text-slate-900'}>
                                    {isPopular && p.length === 4 ? `Año Fiscal ${p}` : `${formatPeriodForDisplay(p)} (${p})`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-[#00A896]/20 active:scale-95 border border-white/10"
                    >
                        <FileSpreadsheet size={15} />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* TERMÓMETRO INTELIGENTE (RIMPE NEGOCIO POPULAR O RÉGIMEN GENERAL) */}
            {isPopular ? (
                <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-xl relative overflow-hidden ${
                    isDark ? 'bg-[#051424]/90 border-white/10 border-t-white/20' : 'bg-white border-slate-200'
                }`}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                        <div>
                            <h3 className={`text-base font-black font-display flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                <Sparkles size={18} className="text-[#C9A96E]" />
                                Termómetro RIMPE Negocio Popular ({selectedPeriod.length === 4 ? `Año Fiscal ${selectedPeriod}` : `Año ${currentYear}`})
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-md">
                                Monitoreo del límite anual de $20,000.00 para mantenerse en Negocio Popular y cálculo de cuota fija SRI.
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Ingresos Brutos Anuales</p>
                            <p className={`text-3xl font-black font-mono tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                ${(annualRevenueNp || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono font-bold">
                            <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Tramo Oficial: <strong className="text-[#00A896]">{currentNpBracket.msg}</strong>
                            </span>
                            <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Tope Categoría: $20,000.00
                            </span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    annualRevenueNp > 20000 
                                        ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' 
                                        : annualRevenueNp > 15000 
                                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' 
                                            : 'bg-[#00A896] shadow-[0_0_8px_#00A896]'
                                }`}
                                style={{ width: `${Math.min(100, ((annualRevenueNp || 0) / 20000) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            {annualRevenueNp > 20000 
                                ? "⚠️ Ha superado el límite de $20,000.00 de Negocio Popular. El SRI requerirá pasar a RIMPE Emprendedor o Régimen General."
                                : `Dispone de $${Math.max(0, 20000 - annualRevenueNp).toLocaleString('en-US', { minimumFractionDigits: 2 })} de margen antes de superar la categoría de Negocio Popular.`
                            }
                        </p>
                    </div>
                </div>
            ) : isGeneralRegime ? (
                <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-xl relative overflow-hidden ${
                    isDark ? 'bg-[#051424]/90 border-white/10 border-t-white/20' : 'bg-white border-slate-200'
                }`}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                        <div>
                            <h3 className={`text-base font-black font-display flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                <Sparkles size={18} className="text-amber-400" />
                                Termómetro de Renta (YTD {currentYear})
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-md">
                                Monitoreo inteligente de sus ventas acumuladas frente a la tabla del Impuesto a la Renta.
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Total Facturado</p>
                            <p className={`text-3xl font-black font-mono tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                ${(ytdSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono font-bold">
                            <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Progreso hacia: {currentBracket.msg}</span>
                            <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {currentBracket.limit === Infinity ? 'Tope Máximo' : `Tope: ${currentBracket.limit.toLocaleString()}`}
                            </span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    currentBracket.tax === 0 ? 'bg-[#00A896] shadow-[0_0_8px_#00A896]' : 
                                    currentBracket.tax <= 12 ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                                }`}
                                style={{ width: `${currentBracket.limit === Infinity ? 100 : Math.min(100, (ytdSales / currentBracket.limit) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                            {currentBracket.limit === Infinity 
                                ? "Has superado el último tramo de la tabla de impuestos."
                                : `Te faltan ${(currentBracket.limit - ytdSales).toLocaleString('en-US', { minimumFractionDigits: 2 })} para pasar a la siguiente categoría de impuestos (${taxBrackets[taxBrackets.indexOf(currentBracket) + 1]?.msg || 'N/A'}).`
                            }
                        </p>
                    </div>
                </div>
            ) : null}

            {/* GRÁFICO COMPARATIVO DE EVOLUCIÓN */}
            <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-xl relative overflow-hidden ${
                isDark ? 'bg-[#051424]/90 border-white/10 border-t-white/20' : 'bg-white border-slate-200'
            }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className={`text-base font-black font-display flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            <TrendingUp size={18} className="text-[#00A896]" />
                            {isPopular
                                ? 'Evolución de Ingresos y Gastos (Histórico Anual)'
                                : isSemestral
                                    ? 'Evolución de Flujo Financiero (Últimos Semestres)'
                                    : 'Evolución de Flujo Financiero (Últimos Meses)'}
                        </h3>
                        <p className="text-xs text-slate-400">
                            {isPopular
                                ? 'Comparativa anual entre Ingresos Brutos (🟢), Gastos (🔵) y Retenciones Renta (🟣)'
                                : 'Comparativa directa entre Ventas (🟢), Compras (🔵) y Retenciones (🟣)'}
                        </p>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 text-xs font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#00A896] shadow-[0_0_6px_#00A896]"></span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                                {isPopular ? 'Ingresos' : 'Ventas'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2B6AFF] shadow-[0_0_6px_#2B6AFF]"></span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                                {isPopular ? 'Gastos' : 'Compras'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#C9A96E] shadow-[0_0_6px_#C9A96E]"></span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Retenciones</span>
                        </div>
                    </div>
                </div>

                {/* BARRAS DE GRÁFICO VISUAL */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-6 pb-2">
                    {historyData.map((item) => {
                        const isSelected = item.period === selectedPeriod;
                        const vHeight = Math.max(10, Math.round((item.totalVentas / maxBarVal) * 120));
                        const cHeight = Math.max(10, Math.round((item.totalCompras / maxBarVal) * 120));
                        const rHeight = Math.max(8, Math.round((item.totalRet / maxBarVal) * 120));

                        return (
                            <div
                                key={item.period}
                                onClick={() => setSelectedPeriod(item.period)}
                                className={`flex flex-col items-center p-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${
                                    isSelected
                                        ? isDark
                                            ? 'bg-[#00A896]/15 border border-[#00A896]/50 shadow-lg shadow-[#00A896]/20 scale-105'
                                            : 'bg-teal-50 border border-teal-300 shadow-md scale-105'
                                        : isDark
                                            ? 'hover:bg-white/5 border border-transparent'
                                            : 'hover:bg-slate-50 border border-transparent'
                                }`}
                            >
                                {/* Contenedor de Barras */}
                                <div className="h-32 w-full flex items-end justify-center gap-1.5 mb-3 px-2">
                                    {/* Barra Ventas / Ingresos */}
                                    <div
                                        style={{ height: `${vHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-teal-700 to-[#00A896] transition-all duration-500 hover:brightness-125"
                                        title={`${isPopular ? 'Ingresos' : 'Ventas'}: $${item.totalVentas.toFixed(2)}`}
                                    ></div>
                                    {/* Barra Compras / Gastos */}
                                    <div
                                        style={{ height: `${cHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-indigo-700 to-[#2B6AFF] transition-all duration-500 hover:brightness-125"
                                        title={`${isPopular ? 'Gastos' : 'Compras'}: $${item.totalCompras.toFixed(2)}`}
                                    ></div>
                                    {/* Barra Retenciones */}
                                    <div
                                        style={{ height: `${rHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-amber-700 to-[#C9A96E] transition-all duration-500 hover:brightness-125"
                                        title={`Retenciones: $${item.totalRet.toFixed(2)}`}
                                    ></div>
                                </div>

                                <span className={`text-[10px] font-mono font-bold uppercase tracking-tight text-center ${
                                    isSelected ? 'text-[#00A896]' : isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                    {item.displayName || item.monthName.split(' ')[0]}
                                </span>
                                <span className="text-[9px] font-mono opacity-50">{item.period}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4 CARDS PRINCIPALES DE MÉTRICAS KPI (DEL PERÍODO SELECCIONADO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* KPI 1: VENTAS / INGRESOS */}
                <div
                    onClick={() => handleCopy('Total Ventas/Ingresos', metrics.totalVentas)}
                    className={`group relative rounded-3xl p-6 border backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl overflow-hidden ${
                        isDark
                            ? 'bg-[#051424]/90 border-[#00A896]/30 border-t-white/20 hover:border-[#00A896]/60 shadow-black/40'
                            : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-emerald-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#00A896]/10 border border-[#00A896]/20 flex items-center justify-center text-[#00A896] group-hover:scale-110 transition-transform shadow-md shadow-[#00A896]/10">
                            <ShoppingCart size={22} />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase text-[#00A896] bg-[#00A896]/15 px-2.5 py-1 rounded-lg border border-[#00A896]/30">
                            {isPopular ? 'INGRESOS' : 'VENTAS'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>{isPopular ? 'Ingresos Brutos Ejercicio' : 'Ventas Brutas Totales'}</span>
                        <SelloEstimado origen={metrics.origenVentas} que="las ventas" />
                    </div>
                    <div className={`text-2xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${metrics.totalVentas.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-white/5 pt-3">
                        {isPopular ? (
                            <span>Tarifa 0%: <strong className="text-[#00A896]">Notas de Venta</strong></span>
                        ) : (
                            <span>Base 15%: <strong className="text-[#00A896]">${metrics.ventas15.toFixed(2)}</strong></span>
                        )}
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 2: COMPRAS / GASTOS */}
                <div
                    onClick={() => handleCopy('Total Compras/Gastos', metrics.totalCompras)}
                    className={`group relative rounded-3xl p-6 border backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl overflow-hidden ${
                        isDark
                            ? 'bg-[#051424]/90 border-[#2B6AFF]/30 border-t-white/20 hover:border-[#2B6AFF]/60 shadow-black/40'
                            : 'bg-white border-indigo-200 hover:border-indigo-400 shadow-indigo-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#2B6AFF]/10 border border-[#2B6AFF]/20 flex items-center justify-center text-[#2B6AFF] group-hover:scale-110 transition-transform shadow-md shadow-[#2B6AFF]/10">
                            <ShoppingBag size={22} />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase text-[#2B6AFF] bg-[#2B6AFF]/15 px-2.5 py-1 rounded-lg border border-[#2B6AFF]/30">
                            {isPopular ? 'GASTOS' : 'COMPRAS'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>{isPopular ? 'Gastos del Ejercicio' : 'Compras Facturadas SRI'}</span>
                        <SelloEstimado origen={metrics.origenCompras} que="las compras" />
                    </div>
                    <div className={`text-2xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${metrics.totalCompras.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-white/5 pt-3">
                        {isPopular ? (
                            <span>Compras justificadas: <strong className="text-[#2B6AFF]">${metrics.totalCompras.toFixed(2)}</strong></span>
                        ) : (
                            <span>IVA Compras: <strong className="text-[#2B6AFF]">${metrics.montoIvaCompras.toFixed(2)}</strong></span>
                        )}
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 3: RETENCIONES */}
                <div
                    onClick={() => handleCopy('Total Retenciones', isPopular ? metrics.retRenta : metrics.totalRetenciones)}
                    className={`group relative rounded-3xl p-6 border backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl overflow-hidden ${
                        isDark
                            ? 'bg-[#051424]/90 border-[#C9A96E]/30 border-t-white/20 hover:border-[#C9A96E]/60 shadow-black/40'
                            : 'bg-white border-purple-200 hover:border-purple-400 shadow-purple-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#C9A96E]/10 border border-[#C9A96E]/20 flex items-center justify-center text-[#C9A96E] group-hover:scale-110 transition-transform shadow-md shadow-[#C9A96E]/10">
                            <Coins size={22} />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase text-[#C9A96E] bg-[#C9A96E]/15 px-2.5 py-1 rounded-lg border border-[#C9A96E]/30">
                            RETENCIONES
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>{isPopular ? 'Retenciones Renta Recibidas' : 'Retenciones Recibidas'}</span>
                        <SelloEstimado origen={metrics.origenRetenciones} que="las retenciones" />
                    </div>
                    <div className={`text-2xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${(isPopular ? metrics.retRenta : metrics.totalRetenciones).toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-white/5 pt-3">
                        {isPopular ? (
                            <span>Ret. Fuente Renta: <strong className="text-[#C9A96E]">${metrics.retRenta.toFixed(2)}</strong></span>
                        ) : (
                            <span>Ret. IVA (609): <strong className="text-[#C9A96E]">${metrics.retIva.toFixed(2)}</strong></span>
                        )}
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 4: RESULTADO IMPOSITIVO */}
                <div className={`group relative rounded-3xl p-6 border backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl overflow-hidden ${
                    isPopular
                        ? isDark
                            ? 'bg-[#051424]/90 border-[#C9A96E]/40 border-t-white/20 hover:border-[#C9A96E]/70 shadow-black/40'
                            : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
                        : metrics.esCreditoFavor
                            ? isDark
                                ? 'bg-[#051424]/90 border-[#00A896]/40 border-t-white/20 hover:border-[#00A896]/70 shadow-black/40'
                                : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
                            : isDark
                                ? 'bg-[#051424]/90 border-amber-500/40 border-t-white/20 hover:border-amber-500/70 shadow-black/40'
                                : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                            isPopular
                                ? 'bg-[#C9A96E]/20 border border-[#C9A96E]/30 text-[#C9A96E]'
                                : metrics.esCreditoFavor
                                    ? 'bg-[#00A896]/20 border border-[#00A896]/30 text-[#00A896]'
                                    : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                        }`}>
                            {isPopular ? <Award size={22} /> : <TrendingUp size={22} />}
                        </div>
                        <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border ${
                            isPopular
                                ? 'text-[#C9A96E] bg-[#C9A96E]/15 border-[#C9A96E]/30 shadow-[0_0_8px_rgba(201,169,110,0.2)]'
                                : metrics.esCreditoFavor
                                    ? 'text-[#00A896] bg-[#00A896]/15 border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]'
                                    : 'text-amber-400 bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        }`}>
                            {isPopular ? 'CUOTA FIJA' : metrics.esCreditoFavor ? 'A FAVOR' : 'A PAGAR'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider mb-1">
                        {isPopular ? 'Impuesto Anual RIMPE' : metrics.esCreditoFavor ? 'Crédito Tributario IVA' : 'Impuesto a Pagar SRI'}
                    </div>
                    <div className={`text-2xl font-black font-mono tracking-tight ${
                        isPopular ? 'text-[#C9A96E]' : metrics.esCreditoFavor ? 'text-[#00A896]' : 'text-amber-400'
                    }`}>
                        ${metrics.resultadoNetoIva.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-white/5 pt-3">
                        {isPopular ? (
                            <span>{currentNpBracket.msg.split('(')[0]}</span>
                        ) : (
                            <span>{metrics.esCreditoFavor ? '🟢 Sin Pago Pendiente' : '⚠️ Pago Requerido'}</span>
                        )}
                        <Sparkles size={12} className={isPopular ? 'text-[#C9A96E]' : metrics.esCreditoFavor ? 'text-[#00A896]' : 'text-amber-400'} />
                    </div>
                </div>

            </div>

            {/* TABLA DE DESGLOSE DETALLADO CASILLEROS (ADAPTADA AL RÉGIMEN) */}
            <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-xl ${
                isDark ? 'bg-[#051424]/90 border-white/10 border-t-white/20' : 'bg-white border-slate-200'
            }`}>
                <h3 className={`text-base font-black font-display mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <Layers size={18} className="text-[#00A896]" />
                    {isPopular
                        ? `Desglose Formulario Renta RIMPE Popular (${isPopular && selectedPeriod.length === 4 ? `Año Fiscal ${selectedPeriod}` : formatPeriodForDisplay(selectedPeriod)})`
                        : `Desglose por Casilleros Formulario 2011 (${formatPeriodForDisplay(selectedPeriod)})`}
                </h3>

                {isPopular ? (
                    /* DESGLOSE ESPECÍFICO RIMPE NEGOCIO POPULAR */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                        {/* COL 1: INGRESOS BRUTOS */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#00A896] uppercase tracking-wider">🛍️ Actividad RIMPE</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalVentas.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Notas de Venta (Tarifa 0%):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.totalVentas.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Obligación IVA:</span>
                                    <strong className="text-emerald-400">Exento de Form. 104</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Comprobante Emitido:</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>Nota de Venta</strong>
                                </div>
                            </div>
                        </div>

                        {/* COL 2: COMPRAS Y GASTOS */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#2B6AFF] uppercase tracking-wider">🛒 Gastos Deducibles</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalCompras.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Gastos Registrados SRI:</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.totalCompras.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Crédito Tributario IVA:</span>
                                    <strong className="text-slate-400">No aplica (Costo/Gasto)</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Sustento Tributario:</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>Facturas Proveedor</strong>
                                </div>
                            </div>
                        </div>

                        {/* COL 3: LIQUIDACIÓN DE CUOTA RIMPE */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#C9A96E] uppercase tracking-wider">📜 Cuota Fija Anual</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.cuotaFijaNp.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Cuota RIMPE Anual:</span>
                                    <strong className="text-[#C9A96E]">${metrics.cuotaFijaNp.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Retenciones Renta que le hicieron:</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.retRenta.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Impuesto Neto Estimado:</span>
                                    <strong className={metrics.cuotaFijaNp > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                        ${Math.max(0, metrics.cuotaFijaNp - metrics.retRenta).toFixed(2)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* DESGLOSE RÉGIMEN GENERAL / EMPRENDEDOR FORM 2011 (CON MULTI-TARIFA) */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                        {/* VENTAS */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#00A896] uppercase tracking-wider">🛍️ Ventas (Ingresos)</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalVentas.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Ventas 15% (Cas. 401):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.ventas15.toFixed(2)}</strong>
                                </div>
                                {metrics.ventas5 > 0 && (
                                    <div className="flex justify-between text-slate-400">
                                        <span>Ventas 5% (Cas. 404):</span>
                                        <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.ventas5.toFixed(2)}</strong>
                                    </div>
                                )}
                                <div className="flex justify-between text-slate-400">
                                    <span>Ventas 0% (Cas. 402/403):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.ventas0.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>IVA Generado:</span>
                                    <strong className="text-[#00A896]">${metrics.montoIvaVentas.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>

                        {/* COMPRAS */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#2B6AFF] uppercase tracking-wider">🛒 Compras (Egresos)</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalCompras.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Compras 15% (Cas. 500):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.compras15.toFixed(2)}</strong>
                                </div>
                                {metrics.compras5 > 0 && (
                                    <div className="flex justify-between text-slate-400">
                                        <span>Compras 5% (Cas. 501):</span>
                                        <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.compras5.toFixed(2)}</strong>
                                    </div>
                                )}
                                <div className="flex justify-between text-slate-400">
                                    <span>Compras 0% (Cas. 507):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.compras0.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Crédito IVA (Cas. 564):</span>
                                    <strong className="text-[#2B6AFF]">${metrics.montoIvaCompras.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>

                        {/* RETENCIONES */}
                        <div className={`p-5 rounded-2xl border space-y-3 ${
                            isDark ? 'bg-[#0b1326]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <span className="text-xs font-bold text-[#C9A96E] uppercase tracking-wider">🟣 Retenciones Recibidas</span>
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalRetenciones.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Retenciones IVA (Cas. 609):</span>
                                    <strong className="text-[#C9A96E]">${metrics.retIva.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Retenciones Renta (Cas. 610):</span>
                                    <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.retRenta.toFixed(2)}</strong>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Notas de Crédito Total:</span>
                                    <strong className="text-amber-400">${metrics.totalNC.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
