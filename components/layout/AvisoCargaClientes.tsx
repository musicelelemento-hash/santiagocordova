import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Aviso cuando no hay clientes en pantalla porque no había copia en este
 * navegador y la nube no los entregó. Antes, en ese caso, el panel mostraba
 * clientes de EJEMPLO como si fueran reales (22-nov-2026: «Hoy» dijo
 * «2 vencidos, $0» cuando eran 6 vencidos y $1.270 por cobrar).
 */
export const AvisoCargaClientes: React.FC = () => {
  const error = useAppStore(s => s.clientesCargaError);
  const cargando = useAppStore(s => s.cargandoClientes);
  const hayClientes = useAppStore(s => s.clients.length > 0);
  const loadFromDB = useAppStore(s => s.loadFromDB);

  if (!error || hayClientes) return null;

  return (
    <div
      role="status"
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#2B6AFF]/30 bg-[#2B6AFF]/10 px-4 py-3 text-slate-700 dark:text-slate-200"
    >
      <CloudOff className="w-5 h-5 shrink-0 text-[#2B6AFF]" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-bold">No pude traer tus clientes de la nube.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {error} Tus datos no se borraron; mientras tanto no muestro números para no confundirte.
        </p>
      </div>
      <button
        type="button"
        onClick={() => { void loadFromDB(); }}
        disabled={cargando}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2B6AFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
      >
        <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden />
        {cargando ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
};
