import React, { useState, useEffect } from 'react';
import { 
    Folder, Plus, Search, Archive, MapPin, Calendar, 
    User, CheckCircle, X, Trash2, Edit3, ShieldCheck
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Client } from '../../types';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/db';

export interface PhysicalFolder {
    id: string;
    clienteId?: string;
    nombreCliente: string;
    rucCliente: string;
    ubicacion: string; // ej: "Estante A - Nivel 2 - Carpeta #45"
    contenido: string; // ej: "Facturas 2025, Declaraciones Renta, Nombramiento"
    prestadoA?: string;
    fechaPrestamo?: string;
    estado: 'En Archivo' | 'Prestado';
}

interface PhysicalArchiveModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PhysicalArchiveModal: React.FC<PhysicalArchiveModalProps> = ({ isOpen, onClose }) => {
    const { clients } = useAppStore();
    const { toast } = useToast();

    const [archiveFolders, setArchiveFolders] = useState<PhysicalFolder[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

    // Form
    const [selectedClientId, setSelectedClientId] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [rucCliente, setRucCliente] = useState('');
    const [ubicacion, setUbicacion] = useState('Estante A - Carpeta 01');
    const [contenido, setContenido] = useState('RUC, Claves SRI, Declaraciones 2026, Facturas Físicas');

    useEffect(() => {
        const loadArchive = async () => {
            try {
                const stored = await db.getLocal('sc_physical_archive_history');
                if (stored && Array.isArray(stored)) {
                    setArchiveFolders(stored);
                } else {
                    const demo: PhysicalFolder[] = [
                        {
                            id: 'ARCH-001',
                            nombreCliente: 'CORDOVA RAMIREZ ROBERTO SANTIAGO',
                            rucCliente: '0705787745001',
                            ubicacion: 'Archivador Principal - Cajón 1 - Carpeta #01',
                            contenido: 'Nombramiento, RUC, Firma Electrónica, Declaraciones 2025-2026',
                            estado: 'En Archivo'
                        }
                    ];
                    setArchiveFolders(demo);
                    await db.setLocal('sc_physical_archive_history', demo);
                }
            } catch (err) {
                console.error("Error al cargar archivo físico:", err);
            }
        };
        loadArchive();
    }, []);

    const saveArchiveToDb = async (newList: PhysicalFolder[]) => {
        setArchiveFolders(newList);
        await db.setLocal('sc_physical_archive_history', newList);
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        const c = clients.find(item => item.id === clientId);
        if (c) {
            setNombreCliente(c.tradeName || c.name);
            setRucCliente(c.ruc);
        }
    };

    const handleCreateFolder = async () => {
        if (!nombreCliente || !rucCliente) {
            toast.error("Selecciona o ingresa el nombre y RUC del cliente.");
            return;
        }

        const newFolder: PhysicalFolder = {
            id: `ARCH-${Date.now()}`,
            clienteId: selectedClientId || undefined,
            nombreCliente,
            rucCliente,
            ubicacion,
            contenido,
            estado: 'En Archivo'
        };

        const updated = [newFolder, ...archiveFolders];
        await saveArchiveToDb(updated);
        setIsCreateFormOpen(false);
        toast.success(`📁 Expediente físico para ${newFolder.nombreCliente} registrado.`);
    };

    const filteredFolders = archiveFolders.filter(f => {
        const q = searchTerm.toLowerCase();
        return !q || f.nombreCliente.toLowerCase().includes(q) || f.rucCliente.includes(q) || f.ubicacion.toLowerCase().includes(q);
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-4xl h-[85vh] bg-[hsl(222,47%,5%)] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white">
                
                {/* Header */}
                <div className="p-6 bg-slate-900/80 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/20">
                            <Archive size={22} />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em] block">
                                Control de Archivos de Oficina
                            </span>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                Bóveda de Expedientes Físicos de Clientes
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md"
                        >
                            + Nuevo Expediente
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
                    
                    {/* Formulario nuevo expediente */}
                    {isCreateFormOpen && (
                        <div className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/30 space-y-4">
                            <h3 className="text-xs font-bold text-indigo-300 uppercase">Registrar Ubicación de Carpeta Física</h3>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cliente</label>
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
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ubicación Física *</label>
                                    <input
                                        type="text"
                                        value={ubicacion}
                                        onChange={(e) => setUbicacion(e.target.value)}
                                        placeholder="Ej: Estante B - Nivel 3 - Carpeta #12"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setIsCreateFormOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold">Cancelar</button>
                                <button onClick={handleCreateFolder} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs">Guardar Expediente</button>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Archivos Físicos */}
                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-950/40">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-4 px-5">Cliente</th>
                                    <th className="py-4 px-5">Ubicación Física en Oficina</th>
                                    <th className="py-4 px-5">Contenido</th>
                                    <th className="py-4 px-5">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredFolders.map(f => (
                                    <tr key={f.id} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-5">
                                            <p className="font-bold text-white uppercase">{f.nombreCliente}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">RUC: {f.rucCliente}</p>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-indigo-300 font-bold">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={13} className="text-indigo-400" />
                                                <span>{f.ubicacion}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-slate-300">
                                            {f.contenido}
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                {f.estado}
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
