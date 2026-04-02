import React from 'react';
import { Client, DeclarationStatus, IvaFrequency, Declaration } from '../../types';
import { formatPeriodForDisplay } from '../../services/sri';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';

interface ComplianceReportExportProps {
    clients: Client[];
    periods: string[];
    frequency: IvaFrequency;
}

export const ComplianceReportExport: React.FC<ComplianceReportExportProps> = ({ 
    clients, 
    periods, 
    frequency 
}) => {
    const today = new Date();
    const emissionDate = format(today, "d 'de' MMMM 'de' yyyy", { locale: es });

    const lastPeriod = periods[0];
    
    const stats = {
        total: clients.length,
        declared: clients.filter(c => c.declarations?.some(d => d.period === lastPeriod && (d.status === DeclarationStatus.Enviada || d.status === DeclarationStatus.Pagada))).length,
        withPdf: clients.filter(c => c.declarations?.some(d => d.period === lastPeriod && d.proof_file)).length,
    };

    return (
        <div className="print-only p-12 bg-white text-slate-900 font-sans min-h-screen">
            {/* Header / Brand */}
            <div className="flex justify-between items-end border-b-4 border-slate-900 pb-10 mb-10">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xl italic">S</div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">SANTIAGO CORDOVA</h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Servicios de Inteligencia Tributaria • Pueblo Edition</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">RUC: 0105822994001 • info@santiagocordova.com</p>
                </div>
                <div className="text-right">
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block mb-2">
                        <h2 className="text-sm font-black uppercase tracking-widest">CONTROL DE CUMPLIMIENTO</h2>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">IVA {frequency} • CICLO {lastPeriod}</p>
                    <p className="text-[9px] font-medium text-slate-400 mt-1 italic">EMITIDO EL {emissionDate.toUpperCase()}</p>
                </div>
            </div>

            {/* Tactical Executive Summary */}
            <div className="grid grid-cols-4 gap-6 mb-12">
                <div className="bg-slate-50 border-r-2 border-slate-200 p-5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Unidades en Cartera</p>
                    <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-slate-50 border-r-2 border-slate-200 p-5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Declarados SRI</p>
                    <p className="text-3xl font-black text-slate-900">{stats.declared}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">{Math.round((stats.declared / stats.total) * 100)}% Cobertura</p>
                </div>
                <div className="bg-slate-50 border-r-2 border-slate-200 p-5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">PDFs en Bóveda</p>
                    <p className="text-3xl font-black text-slate-900">{stats.withPdf}</p>
                    <p className="text-[10px] font-bold text-sky-600 mt-1">{Math.round((stats.withPdf / stats.total) * 100)}% Eficiencia</p>
                </div>
                <div className="bg-slate-900 p-5 text-white">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Estatus Global</p>
                    <p className="text-2xl font-black text-white">{stats.declared === stats.total ? 'COMPLETE' : 'IN PROGRESS'}</p>
                    <div className="w-full h-1 bg-white/20 mt-3 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${(stats.withPdf / stats.total) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Obligations Matrix */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-y-2 border-slate-900 bg-slate-50">
                        <th className="py-5 px-6 text-left text-[10px] font-black uppercase tracking-[0.2em] w-80">RUC / CONTRIBUYENTE</th>
                        {periods.map(p => (
                            <th key={p} className="py-5 px-2 text-center text-[10px] font-black uppercase tracking-[0.2em] border-l border-slate-200">
                                {formatPeriodForDisplay(p).replace('IVA ', '')}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {clients.map((client, index) => {
                        const currentDigit = parseInt(client.ruc[8], 10);
                        const prevDigit = index > 0 ? parseInt(clients[index - 1].ruc[8], 10) : null;
                        const showGroupHeader = currentDigit !== prevDigit;

                        return (
                            <React.Fragment key={client.id}>
                                {showGroupHeader && (
                                    <tr className="bg-slate-50">
                                        <td colSpan={periods.length + 1} className="py-2 px-6 border-y border-slate-200">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">GRUPO VENCE DÍA: {currentDigit === 0 ? '28' : 10 + currentDigit * 2} (Dígito {currentDigit})</span>
                                        </td>
                                    </tr>
                                )}
                                <tr className="page-break-inside-avoid hover:bg-slate-50/50">
                                    <td className="py-4 px-6 border-r border-slate-100">
                                        <p className="text-[11px] font-black text-slate-900 uppercase truncate">{client.tradeName || client.name}</p>
                                        <p className="text-[9px] font-mono font-bold text-slate-400 mt-0.5 tracking-widest">{client.ruc}</p>
                                    </td>
                                    {periods.map(p => {
                                        const dec = client.declarations?.find(d => d.period === p);
                                        const hasPdf = !!dec?.proof_file;
                                        const isDone = (dec?.status === DeclarationStatus.Pagada || dec?.status === DeclarationStatus.Enviada);
                                        
                                        return (
                                            <td key={p} className={`py-4 px-2 text-center border-l border-slate-100 ${isDone && hasPdf ? 'bg-emerald-50/30' : ''}`}>
                                                <div className="flex flex-col items-center gap-1">
                                                    {isDone ? (
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                            <span className="text-[9px] font-black uppercase text-emerald-700 tracking-tighter">REPORTADO</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] font-bold uppercase text-slate-300">Pendiente</span>
                                                    )}
                                                    {hasPdf ? (
                                                        <span className="text-[8px] font-black text-sky-600 bg-sky-50 px-1 rounded tracking-tighter">
                                                            ✓ COMPROBANTE
                                                        </span>
                                                    ) : isDone ? (
                                                       <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter underline">
                                                            Falta PDF
                                                       </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {/* Footer / Validation Area */}
            <div className="mt-24 pt-16 border-t-2 border-slate-100 flex justify-between items-end">
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Certificación de Integridad</p>
                        <ul className="text-[8px] font-bold text-slate-500 flex flex-col gap-1 uppercase">
                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-900 rounded-full"></div> Documento generado bajo protocolos Pueblo Edition v3.1</li>
                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-900 rounded-full"></div> Validación de RUC y periodos procesada en tiempo real</li>
                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-900 rounded-full"></div> Encriptación de datos sensibles habilitada</li>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col items-center min-w-[250px]">
                    <div className="w-48 h-20 flex items-center justify-center border-b-2 border-slate-900 mb-4 italic font-premium text-slate-300 text-sm">
                         Sello Digital Pulse
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Santiago Cordova</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Contador General • Reg. 0105822994001</p>
                </div>
            </div>

            {/* Page info for multi-page print */}
            <div className="fixed bottom-8 left-12 text-[8px] font-bold text-slate-300 uppercase tracking-[0.5em] origin-left -rotate-90">
                PULSE REPORT • SECURE DATA • PAGE 01
            </div>
        </div>
    );
};
