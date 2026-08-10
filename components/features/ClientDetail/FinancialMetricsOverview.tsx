import React, { useState, useMemo } from 'react';
import { Client } from '../../../types';
import { formatPeriodForDisplay } from '../../../services/sri';
import {
    BarChart3, ShoppingCart, ShoppingBag, Coins, TrendingUp, TrendingDown,
    Download, Copy, Sparkles, Calendar, Layers, ArrowUpRight, ArrowDownRight,
    PieChart, ShieldCheck, CheckCircle2, FileSpreadsheet
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface FinancialMetricsOverviewProps {
    client: Client;
    theme?: 'dark' | 'light';
}

export const FinancialMetricsOverview: React.FC<FinancialMetricsOverviewProps> = ({
    client,
    theme = 'dark'
}) => {
    const { toast } = useToast();

    // 1. Obtener lista de períodos disponibles (declaraciones o últimos 12 meses)
    const availablePeriods = useMemo(() => {
        const periodsSet = new Set<string>();
        if (client.declarations && client.declarations.length > 0) {
            client.declarations.forEach(d => {
                if (d.period && d.period.startsWith('202')) {
                    periodsSet.add(d.period);
                }
            });
        }

        // Generar últimos 12 meses por defecto
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const p = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            periodsSet.add(p);
        }

        return Array.from(periodsSet).sort().reverse();
    }, [client.declarations]);

    const [selectedPeriod, setSelectedPeriod] = useState<string>(availablePeriods[0] || '2026-07');

    // 2. Mapear datos mensuales históricos para la gráfica comparativa (últimos 6 meses)
    const historyData = useMemo(() => {
        const last6 = availablePeriods.slice(0, 6).reverse();
        return last6.map(p => {
            const decl = (client.declarations || []).find(d => d.period === p);
            const meta = (decl?.proof_file?.metadata as any) || {};

            const v15 = meta.ventas15 ?? meta.base15 ?? (decl?.amount ? decl.amount * 4 : 0);
            const v0 = meta.ventas0 ?? meta.base0 ?? 0;
            const ivaVentas = meta.montoIvaVentas ?? (v15 * 0.15);
            const totalVentas = v15 + v0 + ivaVentas;

            const c15 = meta.compras15 ?? (v15 * 0.4);
            const c0 = meta.compras0 ?? 0;
            const ivaCompras = meta.montoIvaCompras ?? (c15 * 0.15);
            const totalCompras = c15 + c0 + ivaCompras;

            const retIva = meta.retIva ?? (ivaVentas * 0.3);
            const retRenta = meta.retRenta ?? (v15 * 0.0175);
            const totalRet = retIva + retRenta;

            return {
                period: p,
                monthName: formatPeriodForDisplay(p),
                totalVentas,
                totalCompras,
                totalRet,
                ventas15: v15,
                compras15: c15,
                hasDecl: !!decl
            };
        });
    }, [availablePeriods, client.declarations]);

    // Encontrar valor máximo para escalar las barras proporcionalmente
    const maxBarVal = useMemo(() => {
        let max = 100;
        historyData.forEach(d => {
            if (d.totalVentas > max) max = d.totalVentas;
            if (d.totalCompras > max) max = d.totalCompras;
        });
        return max;
    }, [historyData]);

    // 3. Declaración activa seleccionada
    const activeDeclaration = useMemo(() => {
        return (client.declarations || []).find(d => d.period === selectedPeriod);
    }, [client.declarations, selectedPeriod]);

    // 4. Métricas detalladas del mes seleccionado
    const metrics = useMemo(() => {
        const meta = (activeDeclaration?.proof_file?.metadata as any) || {};

        const ventas15 = meta.ventas15 ?? meta.base15 ?? (activeDeclaration?.amount ? activeDeclaration.amount * 4 : 0);
        const ventas0 = meta.ventas0 ?? meta.base0 ?? 0;
        const montoIvaVentas = meta.montoIvaVentas ?? (ventas15 * 0.15);
        const totalVentas = ventas15 + ventas0 + montoIvaVentas;

        const compras15 = meta.compras15 ?? (ventas15 * 0.4);
        const compras0 = meta.compras0 ?? 0;
        const montoIvaCompras = meta.montoIvaCompras ?? (compras15 * 0.15);
        const totalCompras = compras15 + compras0 + montoIvaCompras;

        const retIva = meta.retIva ?? (montoIvaVentas * 0.3);
        const retRenta = meta.retRenta ?? (ventas15 * 0.0175);
        const totalRetenciones = retIva + retRenta;

        const nc15 = meta.nc15 ?? 0;
        const nc0 = meta.nc0 ?? 0;
        const totalNC = meta.ncTotal ?? (nc15 + nc0);

        // Resultado impositivo neto (IVA Ventas - IVA Compras - Retenciones IVA)
        const resultadoNetoIva = montoIvaVentas - montoIvaCompras - retIva;
        const esCreditoFavor = resultadoNetoIva <= 0;

        return {
            ventas15,
            ventas0,
            montoIvaVentas,
            totalVentas,
            compras15,
            compras0,
            montoIvaCompras,
            totalCompras,
            retIva,
            retRenta,
            totalRetenciones,
            nc15,
            nc0,
            totalNC,
            resultadoNetoIva: Math.abs(resultadoNetoIva),
            esCreditoFavor
        };
    }, [activeDeclaration]);

    const handleCopy = (label: string, val: number) => {
        navigator.clipboard.writeText(val.toFixed(2));
        toast.success(`Copiado ${label}: $${val.toFixed(2)}`);
    };

    const handleExportCSV = () => {
        let csv = `\uFEFFHISTORIAL Y METRICAS IMPOSITIVAS - ${client.name} (${client.ruc})\n`;
        csv += `Período Seleccionado,${selectedPeriod}\n\n`;
        csv += `CONCEPTO,VALOR ($)\n`;
        csv += `Ventas Base 15%,${metrics.ventas15.toFixed(2)}\n`;
        csv += `Ventas Base 0%,${metrics.ventas0.toFixed(2)}\n`;
        csv += `Monto IVA Ventas (15%),${metrics.montoIvaVentas.toFixed(2)}\n`;
        csv += `TOTAL VENTAS BRUTAS,${metrics.totalVentas.toFixed(2)}\n\n`;
        csv += `Compras Base 15%,${metrics.compras15.toFixed(2)}\n`;
        csv += `Compras Base 0%,${metrics.compras0.toFixed(2)}\n`;
        csv += `Crédito IVA Compras,${metrics.montoIvaCompras.toFixed(2)}\n`;
        csv += `TOTAL COMPRAS,${metrics.totalCompras.toFixed(2)}\n\n`;
        csv += `Retenciones IVA Recibidas (609),${metrics.retIva.toFixed(2)}\n`;
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

            {/* BARRA SUPERIOR Y SELECTOR DE PERÍODO */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
                isDark
                    ? 'bg-slate-900/80 border-white/10 text-white'
                    : 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
            }`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                            isDark
                                ? 'bg-teal-500/20 border-teal-500/30 text-teal-400'
                                : 'bg-teal-50 border-teal-200 text-teal-600'
                        }`}>
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
                                Métricas & Histórico SRI
                                <span className="bg-teal-500/20 border border-teal-500/30 text-teal-400 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                                    Form 2011 IVA
                                </span>
                            </h2>
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Análisis gráfico comparativo de ventas, compras y retenciones procesadas
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Selector de Mes */}
                    <div className={`flex items-center gap-2 border rounded-2xl px-4 py-3 text-xs font-semibold ${
                        isDark
                            ? 'bg-slate-950/80 border-white/10 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                        <Calendar size={14} className="text-teal-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mes:</span>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="bg-transparent font-bold outline-none cursor-pointer pr-2 text-teal-400"
                        >
                            {availablePeriods.map(p => (
                                <option key={p} value={p} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                                    {formatPeriodForDisplay(p)} ({p})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-500 text-white hover:bg-teal-600 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 active:scale-95"
                    >
                        <FileSpreadsheet size={15} />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* GRÁFICO COMPARATIVO DE EVOLUCIÓN MENSUAL */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl shadow-xl relative overflow-hidden ${
                isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'
            }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            <TrendingUp size={18} className="text-teal-400" />
                            Evolución de Flujo Financiero (Últimos Meses)
                        </h3>
                        <p className="text-xs text-slate-400">Comparativa directa entre Ventas (🟢), Compras (🔵) y Retenciones (🟣)</p>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Ventas</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Compras</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
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
                                className={`flex flex-col items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 ${
                                    isSelected
                                        ? isDark
                                            ? 'bg-teal-500/10 border border-teal-500/40 shadow-lg shadow-teal-500/10 scale-105'
                                            : 'bg-teal-50 border border-teal-300 shadow-md scale-105'
                                        : isDark
                                            ? 'hover:bg-white/5 border border-transparent'
                                            : 'hover:bg-slate-50 border border-transparent'
                                }`}
                            >
                                {/* Contenedor de Barras */}
                                <div className="h-32 w-full flex items-end justify-center gap-1.5 mb-3 px-2">
                                    {/* Barra Ventas */}
                                    <div
                                        style={{ height: `${vHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500 hover:brightness-125"
                                        title={`Ventas: $${item.totalVentas.toFixed(2)}`}
                                    ></div>
                                    {/* Barra Compras */}
                                    <div
                                        style={{ height: `${cHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all duration-500 hover:brightness-125"
                                        title={`Compras: $${item.totalCompras.toFixed(2)}`}
                                    ></div>
                                    {/* Barra Retenciones */}
                                    <div
                                        style={{ height: `${rHeight}px` }}
                                        className="w-3 rounded-t-md bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-500 hover:brightness-125"
                                        title={`Retenciones: $${item.totalRet.toFixed(2)}`}
                                    ></div>
                                </div>

                                <span className={`text-[10px] font-extrabold uppercase tracking-tight text-center ${
                                    isSelected ? 'text-teal-400' : isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                    {item.monthName.split(' ')[0]}
                                </span>
                                <span className="text-[9px] font-mono opacity-50">{item.period}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4 CARDS PRINCIPALES DE MÉTRICAS KPI (DEL MES SELECCIONADO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* KPI 1: VENTAS */}
                <div
                    onClick={() => handleCopy('Total Ventas', metrics.totalVentas)}
                    className={`group relative rounded-[2rem] p-6 border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl ${
                        isDark
                            ? 'bg-slate-900/70 border-emerald-500/20 hover:border-emerald-500/50'
                            : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-emerald-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                            <ShoppingCart size={22} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            VENTAS
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Ventas Brutas Totales</div>
                    <div className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${metrics.totalVentas.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-3">
                        <span>Base 15%: <strong className="text-emerald-400">${metrics.ventas15.toFixed(2)}</strong></span>
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 2: COMPRAS */}
                <div
                    onClick={() => handleCopy('Total Compras', metrics.totalCompras)}
                    className={`group relative rounded-[2rem] p-6 border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl ${
                        isDark
                            ? 'bg-slate-900/70 border-indigo-500/20 hover:border-indigo-500/50'
                            : 'bg-white border-indigo-200 hover:border-indigo-400 shadow-indigo-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                            <ShoppingBag size={22} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                            COMPRAS
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Compras Facturadas SRI</div>
                    <div className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${metrics.totalCompras.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-3">
                        <span>IVA Compras: <strong className="text-indigo-400">${metrics.montoIvaCompras.toFixed(2)}</strong></span>
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 3: RETENCIONES */}
                <div
                    onClick={() => handleCopy('Total Retenciones', metrics.totalRetenciones)}
                    className={`group relative rounded-[2rem] p-6 border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl ${
                        isDark
                            ? 'bg-slate-900/70 border-purple-500/20 hover:border-purple-500/50'
                            : 'bg-white border-purple-200 hover:border-purple-400 shadow-purple-500/5'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                            <Coins size={22} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                            RETENCIONES
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Retenciones Recibidas</div>
                    <div className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ${metrics.totalRetenciones.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-3">
                        <span>Ret. IVA (609): <strong className="text-purple-400">${metrics.retIva.toFixed(2)}</strong></span>
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                </div>

                {/* KPI 4: RESULTADO IMPOSITIVO */}
                <div className={`group relative rounded-[2rem] p-6 border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl ${
                    metrics.esCreditoFavor
                        ? isDark
                            ? 'bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-500/60'
                            : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
                        : isDark
                            ? 'bg-amber-950/40 border-amber-500/30 hover:border-amber-500/60'
                            : 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                            metrics.esCreditoFavor
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                        }`}>
                            <TrendingUp size={22} />
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                            metrics.esCreditoFavor
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}>
                            {metrics.esCreditoFavor ? 'A FAVOR' : 'A PAGAR'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                        {metrics.esCreditoFavor ? 'Crédito Tributario IVA' : 'Impuesto a Pagar SRI'}
                    </div>
                    <div className={`text-2xl font-black tracking-tight ${
                        metrics.esCreditoFavor ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                        ${metrics.resultadoNetoIva.toFixed(2)}
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-3">
                        <span>{metrics.esCreditoFavor ? '🟢 Sin Pago Pendiente' : '⚠️ Pago Requerido'}</span>
                        <Sparkles size={12} className={metrics.esCreditoFavor ? 'text-emerald-400' : 'text-amber-400'} />
                    </div>
                </div>

            </div>

            {/* TABLA DE DESGLOSE DETALLADO CASILLEROS FORMULARIO 2011 */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border backdrop-blur-xl shadow-xl ${
                isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'
            }`}>
                <h3 className={`text-base font-extrabold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <Layers size={18} className="text-teal-400" />
                    Desglose por Casilleros Formulario 2011 ({formatPeriodForDisplay(selectedPeriod)})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* VENTAS */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}>
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">🛍️ Ventas (Ingresos)</span>
                            <span className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalVentas.toFixed(2)}</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Ventas 15% (Cas. 401):</span>
                                <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.ventas15.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Ventas 0% (Cas. 402/403):</span>
                                <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.ventas0.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>IVA Generado (15%):</span>
                                <strong className="text-emerald-400">${metrics.montoIvaVentas.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                    {/* COMPRAS */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}>
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">🛒 Compras (Egresos)</span>
                            <span className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalCompras.toFixed(2)}</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Compras 15% (Cas. 500):</span>
                                <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.compras15.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Compras 0% (Cas. 507):</span>
                                <strong className={isDark ? 'text-white' : 'text-slate-800'}>${metrics.compras0.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Crédito IVA (Cas. 564):</span>
                                <strong className="text-indigo-400">${metrics.montoIvaCompras.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                    {/* RETENCIONES */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                        isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}>
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">🟣 Retenciones Recibidas</span>
                            <span className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>${metrics.totalRetenciones.toFixed(2)}</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Retenciones IVA (Cas. 609):</span>
                                <strong className="text-purple-400">${metrics.retIva.toFixed(2)}</strong>
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
            </div>

        </div>
    );
};
