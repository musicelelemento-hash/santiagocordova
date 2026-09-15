
import React, { useState } from 'react';
import { 
  History, Search, Filter, Trash2, 
  Download, Activity, AlertCircle, Info, 
  AlertTriangle, Shield, Terminal, Zap
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AuditLog } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AuditLogScreen: React.FC = () => {
    const { auditLogs, addAuditLog } = useAppStore();
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string | 'all'>('all');

    const filteredLogs = auditLogs.filter(log => {
        const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || 
                             log.details.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || log.type === filterType;
        return matchesSearch && matchesType;
    });

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'client': return History;
            case 'task': return Activity;
            case 'finance': return Shield;
            case 'ai': return Zap;
            default: return Terminal;
        }
    };

    const exportLogs = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `audit_log_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        addAuditLog({
            type: 'system',
            action: 'Exportación de Logs',
            details: 'Se exportó el historial de auditoría a JSON',
            severity: 'info'
        });
    };

    return (
        <div className="min-h-screen bg-surface text-on-surface p-6 lg:p-10 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-tertiary/10 rounded-lg border border-tertiary/20">
                                <History className="w-5 h-5 text-tertiary" />
                            </div>
                            <span className="text-xs font-semibold text-tertiary uppercase tracking-[0.3em]">System Monitoring</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight">TACTICAL AUDIT LOG</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={exportLogs}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition-all font-medium text-xs uppercase tracking-widest"
                        >
                            <Download className="w-4 h-4" />
                            Exportar JSON
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
                    <div className="md:col-span-8 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-tertiary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar en el historial táctico..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-tertiary/50 focus:bg-foreground/10 transition-all"
                        />
                    </div>
                    <div className="md:col-span-4 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-on-surface-variant" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full bg-foreground/5 border border-foreground/10 rounded-2xl py-4 px-4 text-xs font-medium uppercase tracking-widest focus:outline-none focus:border-tertiary/50"
                        >
                            <option value="all">TODOS LOS EVENTOS</option>
                            <option value="client">CLIENTES</option>
                            <option value="task">TAREAS</option>
                            <option value="finance">FINANZAS</option>
                            <option value="ai">INTELIGENCIA</option>
                            <option value="system">SISTEMA</option>
                        </select>
                    </div>
                </div>

                {/* Audit Table */}
                <div className="bg-foreground/[0.02] border border-foreground/5 rounded-[2rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-foreground/5 bg-foreground/[0.02]">
                                    <th className="p-6 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Timestamp</th>
                                    <th className="p-6 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Evento</th>
                                    <th className="p-6 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Detalles</th>
                                    <th className="p-6 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Severidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/5">
                                {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                    const Icon = getTypeIcon(log.type);
                                    return (
                                        <tr key={log.id} className="group hover:bg-foreground/[0.03] transition-colors">
                                            <td className="p-6">
                                                <span className="text-xs font-mono text-on-surface-variant">
                                                    {format(new Date(log.timestamp), 'dd MMM, HH:mm:ss', { locale: es })}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-foreground/5 rounded-lg border border-foreground/10 group-hover:border-foreground/20 transition-all">
                                                        <Icon className="w-4 h-4 text-tertiary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm tracking-tight">{log.action}</p>
                                                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">{log.type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-sm text-on-surface-variant leading-relaxed max-w-md">{log.details}</p>
                                            </td>
                                            <td className="p-6">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border ${getSeverityStyles(log.severity)}`}>
                                                    {log.severity}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <Terminal className="w-12 h-12" />
                                                <p className="text-xs font-semibold uppercase tracking-[0.3em]">Sin eventos registrados para esta búsqueda</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-8 flex items-center justify-between text-xs font-medium text-on-surface-variant uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Capa de Seguridad Estándar Stitch v3.0
                    </div>
                    <div>Historial limitado a los últimos 1000 registros tácticos</div>
                </div>
            </div>
        </div>
    );
};
