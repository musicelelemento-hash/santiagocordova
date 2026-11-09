import React, { useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Check, FileUp, KeyRound, RefreshCw, UserPlus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { parseCredentialsCSV } from '../../services/csv';
import { guardarContactos } from '../../services/sriContacts';
import { Client } from '../../types';

/**
 * Importador del CSV de contraseñas de Chrome (chrome://password-manager).
 *
 * Antes se aplicaba a ciegas y avisaba con `alert`. Ahora muestra el plan:
 * cuántas claves del SRI hay, cuáles actualizan a un cliente existente,
 * cuáles ya coinciden y cuáles son RUC nuevos (se pueden crear como cliente).
 *
 * El filtro es el mismo que usa la extensión: sólo filas cuyo RUC (columna
 * `username`) tenga 13 dígitos salen de `sri.gob.ec`.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onApply: (plan: { credenciales: Record<string, string>; actualizar: Client[]; crear: Client[] }) => Promise<void> | void;
}

interface Fila {
    ruc: string;
    clave: string;
    estado: 'actualiza' | 'igual' | 'nueva';
    cliente?: Client;
}

const ChromePasswordsImportModal: React.FC<Props> = ({ isOpen, onClose, clients, onApply }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [nombreArchivo, setNombreArchivo] = useState('');
    const [credenciales, setCredenciales] = useState<Record<string, string> | null>(null);
    const [crearFaltantes, setCrearFaltantes] = useState(true);
    const [aplicando, setAplicando] = useState(false);
    const [error, setError] = useState('');

    const porRuc = useMemo(() => {
        const mapa = new Map<string, Client>();
        clients.forEach((c) => mapa.set(String(c.ruc || '').trim(), c));
        return mapa;
    }, [clients]);

    const filas: Fila[] = useMemo(() => {
        if (!credenciales) return [];
        return Object.entries(credenciales)
            .filter(([, clave]) => Boolean(clave))
            .map(([ruc, clave]) => {
                const cliente = porRuc.get(ruc);
                if (!cliente) return { ruc, clave, estado: 'nueva' as const };
                if (cliente.sriPassword !== clave) return { ruc, clave, estado: 'actualiza' as const, cliente };
                return { ruc, clave, estado: 'igual' as const, cliente };
            })
            .sort((a, b) => {
                const orden = { actualiza: 0, nueva: 1, igual: 2 };
                return orden[a.estado] - orden[b.estado];
            });
    }, [credenciales, porRuc]);

    const resumen = useMemo(() => ({
        total: filas.length,
        actualizan: filas.filter((f) => f.estado === 'actualiza').length,
        nuevas: filas.filter((f) => f.estado === 'nueva').length,
        iguales: filas.filter((f) => f.estado === 'igual').length,
    }), [filas]);

    const leerArchivo = (file: File) => {
        setError('');
        const reader = new FileReader();
        reader.onload = (e) => {
            const texto = String(e.target?.result || '');
            if (!texto.trim()) {
                setError('El archivo está vacío.');
                return;
            }
            const parsed = parseCredentialsCSV(texto);
            const validas = Object.fromEntries(
                Object.entries(parsed).filter(([ruc, clave]) => /^\d{13}$/.test(ruc) && Boolean(clave)),
            );
            if (Object.keys(validas).length === 0) {
                setError('No encontré claves del SRI (RUC de 13 dígitos) en ese archivo. Exportá el CSV desde chrome://password-manager.');
                setCredenciales(null);
                return;
            }
            setNombreArchivo(file.name);
            setCredenciales(validas);
        };
        reader.readAsText(file);
    };

    const aplicar = async () => {
        if (!credenciales) return;
        setAplicando(true);
        try {
            const ahora = new Date().toISOString();
            const actualizar: Client[] = filas
                .filter((f) => f.estado === 'actualiza' && f.cliente)
                .map((f) => ({
                    ...(f.cliente as Client),
                    sriPassword: f.clave,
                    sriPasswordUpdatedAt: ahora,
                    updatedAt: ahora,
                }));

            // Las claves que NO son de un cliente jamás se convierten en clientes:
            // van a la bóveda de contactos, que sólo se usa para autocompletar al
            // crear un cliente nuevo o para que el bot responda un RUC.
            if (crearFaltantes) {
                const nuevas = filas.filter((f) => f.estado === 'nueva');
                if (nuevas.length) {
                    await guardarContactos(nuevas.map((f) => ({ ruc: f.ruc, sri_password: f.clave })));
                }
            }
            const crear: Client[] = [];

            await onApply({ credenciales, actualizar, crear });
            onClose();
        } finally {
            setAplicando(false);
        }
    };

    const chip = (texto: string, valor: number, color: string) => (
        <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${color}`}>
            {valor} {texto}
        </span>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar claves del SRI" size="lg">
            <div className="p-5 text-slate-200 space-y-4">
                <p className="text-xs text-slate-400">
                    Exportá las contraseñas desde <span className="font-mono text-[#00A896]">chrome://password-manager/settings</span> y subí el CSV.
                    Sólo se toman los accesos del SRI (RUC de 13 dígitos).
                </p>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) leerArchivo(file);
                        e.target.value = '';
                    }}
                />

                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C9A96E]/40 bg-[#C9A96E]/5 px-4 py-6 text-xs font-bold uppercase tracking-wider text-[#e6d3ab] hover:bg-[#C9A96E]/10 transition-colors"
                >
                    <FileUp size={16} />
                    {nombreArchivo || 'Elegir archivo CSV'}
                </button>

                {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {credenciales && (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {chip('detectadas', resumen.total, 'border-white/15 bg-white/5 text-slate-200')}
                            {chip('actualizan', resumen.actualizan, 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')}
                            {chip('nuevas', resumen.nuevas, 'border-[#C9A96E]/30 bg-[#C9A96E]/10 text-[#e6d3ab]')}
                            {chip('ya iguales', resumen.iguales, 'border-white/10 bg-white/5 text-slate-400')}
                        </div>

                        {resumen.nuevas > 0 && (
                            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-300">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-[#C9A96E]"
                                    checked={crearFaltantes}
                                    onChange={(e) => setCrearFaltantes(e.target.checked)}
                                />
                                Crear los {resumen.nuevas} RUC nuevos como cliente (nombre provisorio, para completar)
                            </label>
                        )}

                        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5">
                            {filas.map((f) => (
                                <div key={f.ruc} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                                    {f.estado === 'actualiza' && <RefreshCw size={12} className="text-emerald-300 shrink-0" />}
                                    {f.estado === 'nueva' && <UserPlus size={12} className="text-[#C9A96E] shrink-0" />}
                                    {f.estado === 'igual' && <Check size={12} className="text-slate-500 shrink-0" />}
                                    <span className="font-mono text-slate-200">{f.ruc}</span>
                                    <span className="truncate text-slate-500">{f.cliente?.name || '—'}</span>
                                    <span className={`ml-auto font-mono text-[10px] uppercase ${f.estado === 'actualiza' ? 'text-emerald-300' : f.estado === 'nueva' ? 'text-[#e6d3ab]' : 'text-slate-500'}`}>
                                        {f.estado === 'actualiza' ? 'actualiza' : f.estado === 'nueva' ? 'nueva' : 'igual'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
                    >
                        <X size={13} /> Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!credenciales || aplicando}
                        onClick={aplicar}
                        className="flex items-center gap-1.5 rounded-xl bg-[#00A896] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-950 disabled:opacity-40"
                    >
                        <KeyRound size={13} />
                        {aplicando ? 'Aplicando…' : 'Aplicar cambios'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ChromePasswordsImportModal;
