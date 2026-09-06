import React, { useState, useMemo } from 'react';
import { 
    Key, Copy, Check, ExternalLink, RefreshCw, Zap, Search, 
    ShieldCheck, Lock, ArrowRight, UserCheck, AlertTriangle, X, Sparkles, Upload
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { transformPasswordForSri, sendSRIPasswordChangeToExtension, openSRIPortal } from '../../services/extensionBridge';
import { parseCredentialsCSV } from '../../services/csv';

interface SriPasswordChangerModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientToFocus?: Client;
}

export const SriPasswordChangerModal: React.FC<SriPasswordChangerModalProps> = ({ isOpen, onClose, clientToFocus }) => {
    const { clients, updateClient } = useAppStore();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [copiedRuc, setCopiedRuc] = useState<string | null>(null);
    const [copiedPass, setCopiedPass] = useState<string | null>(null);
    const [processedMap, setProcessedMap] = useState<Record<string, boolean>>({});

    const csvInputRef = React.useRef<HTMLInputElement>(null);

    /**
     * Lo que el CSV cambiaria, antes de tocar nada.
     *
     * Antes el import aplicaba los cambios de una y solo avisaba despues. Si
     * el archivo traia una clave vieja, pisaba una buena sin que nadie
     * pudiera verlo venir.
     *
     * `cambian` no guarda la clave, solo a quien le cambiaria: el archivo de
     * Chrome ya es texto plano, no hace falta volver a pintarlo en pantalla.
     */
    /** Las claves leídas del archivo, fuera del estado de React. */
    const claves = React.useRef<Record<string, string>>({});

    const [propuesta, setPropuesta] = useState<{
        leidas: number;
        cambian: { id: string; ruc: string; name: string; teniaClave: boolean }[];
        sinCambio: number;
        noEstan: string[];
    } | null>(null);

    const activeClients = useMemo(() => {
        return clients.filter(c => !c.isDeleted && (c.isActive ?? true));
    }, [clients]);

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            if (!content) return;
            const creds = parseCredentialsCSV(content);
            claves.current = creds;   // en una ref, no en el estado de React
            const credKeys = Object.keys(creds);
            if (credKeys.length === 0) {
                toast.error("No se encontraron claves de usuario/RUC válidas en el archivo CSV.");
                return;
            }

            // Se arma la propuesta y se muestra. Nada se toca hasta que el
            // usuario lo confirme.
            const cambian: { id: string; ruc: string; name: string; teniaClave: boolean }[] = [];
            let sinCambio = 0;
            const rucsUsados = new Set<string>();

            clients.forEach(c => {
                const clave = creds[c.ruc] || creds[c.ruc.slice(0, 10)];
                if (!clave) return;
                rucsUsados.add(c.ruc);
                rucsUsados.add(c.ruc.slice(0, 10));
                if (c.sriPassword === clave) { sinCambio++; return; }
                cambian.push({ id: c.id, ruc: c.ruc, name: c.name, teniaClave: !!c.sriPassword });
            });

            const noEstan = credKeys.filter(k => !rucsUsados.has(k));
            setPropuesta({ leidas: credKeys.length, cambian, sinCambio, noEstan });
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    /** Aplica lo que el usuario acaba de aprobar. */
    const aplicarPropuesta = () => {
        if (!propuesta) return;
        const cuando = new Date().toISOString();
        propuesta.cambian.forEach(c => {
            const cliente = clients.find(x => x.id === c.id);
            const clave = claves.current[c.ruc] || claves.current[c.ruc.slice(0, 10)];
            if (cliente && clave) {
                updateClient(c.id, { sriPassword: clave, sriPasswordUpdatedAt: cuando });
            }
        });
        toast.success(`✅ ${propuesta.cambian.length} clave(s) actualizada(s).`);
        setPropuesta(null);
        claves.current = {};
    };

    const filteredClients = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return activeClients.filter(c => {
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || c.ruc.includes(q) || (c.sriPassword || '').toLowerCase().includes(q);
        });
    }, [activeClients, searchTerm]);

    const handleCopy = (text: string, type: 'ruc' | 'pass', clientId: string) => {
        navigator.clipboard.writeText(text);
        if (type === 'ruc') setCopiedRuc(clientId);
        else setCopiedPass(clientId);
        toast.success(`Copiado: ${text}`);
        setTimeout(() => {
            setCopiedRuc(null);
            setCopiedPass(null);
        }, 2000);
    };

    const handleApplyPasswordChange = (client: Client) => {
        const oldPass = client.sriPassword || '';
        const newPass = transformPasswordForSri(oldPass);

        if (!newPass || oldPass === newPass) {
            toast.info(`La contraseña para ${client.name} ya termina en @ o está formateada.`);
            return;
        }

        updateClient(client.id, { sriPassword: newPass, sriPasswordUpdatedAt: new Date().toISOString() });
        setProcessedMap(prev => ({ ...prev, [client.id]: true }));
        toast.success(`🔑 Clave SRI de ${client.name} actualizada en el sistema a: ${newPass}`);

        // Notificar a la extensión de Chrome
        sendSRIPasswordChangeToExtension(client.ruc, oldPass, newPass);
    };

    const handleLaunchSriChange = (client: Client) => {
        const oldPass = client.sriPassword || '';
        const newPass = transformPasswordForSri(oldPass);

        // Copiar la nueva contraseña al portapapeles
        navigator.clipboard.writeText(newPass);

        // Notificar a la extensión de Chrome
        sendSRIPasswordChangeToExtension(client.ruc, oldPass, newPass);

        // Abrir el portal SRI
        openSRIPortal('https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT');

        toast.success(`🚀 Abriendo SRI para ${client.name}. Nueva clave (${newPass}) copiada al portapapeles.`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-5xl h-[88vh] bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white">
                
                {/* Header */}
                <div className="p-6 bg-slate-900/90 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white font-bold shadow-lg shadow-amber-500/20 shrink-0">
                            <Key size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-amber-400 tracking-[0.2em]">Asistente de Rotación de Credenciales SRI</span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold">
                                    Regla: * ➔ @
                                </span>
                            </div>
                            <h2 className="text-xl font-black text-white tracking-tight">
                                Cambio & Actualización de Contraseñas SRI
                            </h2>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0 self-end sm:self-auto">
                        <X size={18} />
                    </button>
                </div>

                {/* Subheader Informático */}
                <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs flex items-center justify-between font-medium">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-400 shrink-0" />
                        <span>Reemplaza automáticamente el asterisco final <strong>*</strong> por <strong>@</strong> (o agrega @) para cumplir con la renovación periódica solicitada por el SRI.</span>
                    </div>
                    <span className="font-mono font-bold text-slate-400 text-[10px] hidden lg:block">
                        Total Clientes con Clave: {activeClients.length}
                    </span>
                </div>

                {/* Controls */}
                <div className="p-4 bg-slate-950/60 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, RUC o contraseña..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <input 
                            type="file" 
                            ref={csvInputRef} 
                            onChange={handleCsvImport} 
                            accept=".csv" 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => csvInputRef.current?.click()} 
                            className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/10"
                            title="Importar archivo CSV exportado desde Google Chrome"
                        >
                            <Upload size={14} className="text-amber-400" />
                            <span>📥 Importar CSV Contraseñas Chrome</span>
                        </button>
                    </div>
                </div>

                {/* Lo que el CSV cambiaría, antes de tocar nada */}
                {propuesta && (
                    <div className="mx-6 mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] overflow-hidden">
                        <div className="px-5 py-4 border-b border-amber-500/20">
                            <div className="text-sm font-black text-amber-200">
                                Leí {propuesta.leidas} clave{propuesta.leidas === 1 ? '' : 's'} del archivo. Todavía no cambié nada.
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-bold">
                                <span className="text-amber-300">
                                    {propuesta.cambian.length} cliente{propuesta.cambian.length === 1 ? '' : 's'} cambiaría{propuesta.cambian.length === 1 ? '' : 'n'} de clave
                                </span>
                                {propuesta.sinCambio > 0 && (
                                    <span className="text-slate-400">{propuesta.sinCambio} ya la tenía{propuesta.sinCambio === 1 ? '' : 'n'} igual</span>
                                )}
                                {propuesta.noEstan.length > 0 && (
                                    <span className="text-slate-400">
                                        {propuesta.noEstan.length} RUC{propuesta.noEstan.length === 1 ? '' : 's'} del archivo no {propuesta.noEstan.length === 1 ? 'está' : 'están'} en el sistema
                                    </span>
                                )}
                            </div>
                        </div>

                        {propuesta.cambian.length > 0 && (
                            <div className="max-h-52 overflow-y-auto px-5 py-3 space-y-1.5">
                                {propuesta.cambian.map(c => (
                                    <div key={c.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                                        <span className="flex-1 font-bold text-slate-200 truncate">{c.name}</span>
                                        <span className="font-mono text-[11px] text-slate-400">{c.ruc}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                            c.teniaClave
                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        }`}>
                                            {c.teniaClave ? 'reemplaza la actual' : 'clave nueva'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-t border-amber-500/20">
                            <button
                                onClick={aplicarPropuesta}
                                disabled={propuesta.cambian.length === 0}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
                            >
                                {propuesta.cambian.length === 0
                                    ? 'No hay nada que actualizar'
                                    : `Actualizar ${propuesta.cambian.length} clave${propuesta.cambian.length === 1 ? '' : 's'}`}
                            </button>
                            <button
                                onClick={() => { setPropuesta(null); claves.current = {}; }}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold transition-all"
                            >
                                No cambiar nada
                            </button>
                            {propuesta.cambian.some(c => c.teniaClave) && (
                                <span className="text-[11px] text-amber-300/80">
                                    Las marcadas «reemplaza la actual» pisan una clave que ya tenías guardada.
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Table list */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
                    {filteredClients.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            No se encontraron clientes con contraseña registrada.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="py-4 px-5">Cliente / RUC</th>
                                        <th className="py-4 px-5">Clave Actual SRI</th>
                                        <th className="py-4 px-5">Nueva Clave (* ➔ @)</th>
                                        <th className="py-4 px-5 text-right">Acciones de Actualización</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredClients.map(c => {
                                        const oldPass = c.sriPassword || '';
                                        const suggestedPass = transformPasswordForSri(oldPass);
                                        const isUpdated = processedMap[c.id] || oldPass.endsWith('@');

                                        return (
                                            <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 px-5">
                                                    <div className="font-bold text-white uppercase">{c.name}</div>
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 mt-0.5">
                                                        <span>RUC: {c.ruc}</span>
                                                        <button 
                                                            onClick={() => handleCopy(c.ruc, 'ruc', c.id)}
                                                            className="text-slate-500 hover:text-amber-400 p-0.5"
                                                            title="Copiar RUC"
                                                        >
                                                            {copiedRuc === c.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                        </button>
                                                    </div>
                                                </td>

                                                <td className="py-4 px-5 font-mono">
                                                    <span className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold ${oldPass ? 'bg-slate-900 border-white/10 text-slate-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 italic'}`}>
                                                        {oldPass || 'Sin clave registrada'}
                                                    </span>
                                                </td>

                                                <td className="py-4 px-5 font-mono">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                                                            {suggestedPass}
                                                        </span>
                                                        <button
                                                            onClick={() => handleCopy(suggestedPass, 'pass', c.id)}
                                                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                                            title="Copiar Nueva Clave al Portapapeles (para Ecuafact/SRI)"
                                                        >
                                                            {copiedPass === c.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </td>

                                                <td className="py-4 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApplyPasswordChange(c)}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                                                isUpdated
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                    : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/30'
                                                            }`}
                                                        >
                                                            {isUpdated ? '✓ En Sistema' : '⚡ Cambiar en Sistema'}
                                                        </button>

                                                        <button
                                                            onClick={() => handleLaunchSriChange(c)}
                                                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 active:scale-95"
                                                            title="Copiar nueva clave y abrir SRI"
                                                        >
                                                            <ExternalLink size={12} />
                                                            <span>Abrir SRI</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
