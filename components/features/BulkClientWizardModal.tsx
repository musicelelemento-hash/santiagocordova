import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SriExtractionResult, Client, TaxRegime, Declaration, StoredFile } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { 
    X, UserPlus, 
    Search, CheckSquare, Square, FileText, KeyRound, FileCheck2, 
    Sparkles, Edit3, Trash2, UserCheck
} from 'lucide-react';

export interface CandidateClientItem {
    id: string;
    name: string;
    tradeName?: string;
    ruc: string;
    regime: TaxRegime;
    email?: string;
    phones?: string[];
    address?: string;
    origin?: 'ruc_pdf' | 'p12_signature' | 'declaracion_pdf' | 'manual';
    sourceFileName?: string;
    subscriptionType: 'declaraciones_completo' | 'solo_plan' | 'solo_firma';
    ivaFrequency: 'Mensual' | 'Semestral' | 'Ninguno';
    requiresAnnualRenta: boolean;
    initialDeclaration?: Declaration;
    signatureFile?: StoredFile;
    electronicSignaturePassword?: string;
    signatureExpirationDate?: string;
    signatureProvider?: string;
    notes?: string;
    isSelected: boolean;
}

interface BulkClientWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    extractedData?: SriExtractionResult[];
    candidates?: CandidateClientItem[];
    onApprove?: (client: Client) => void;
    onApproveBatch?: (clients: Client[]) => void;
}

export const BulkClientWizardModal: React.FC<BulkClientWizardModalProps> = ({ 
    isOpen, 
    onClose, 
    extractedData = [], 
    candidates = [],
    onApprove,
    onApproveBatch 
}) => {
    const [items, setItems] = useState<CandidateClientItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<CandidateClientItem | null>(null);

    // Inicializar candidatos desde extractedData (RUCs) o candidates directos
    useEffect(() => {
        if (!isOpen) return;

        let initialList: CandidateClientItem[] = [];

        if (candidates && candidates.length > 0) {
            initialList = candidates.map(c => ({
                ...c,
                id: c.id || uuidv4(),
                isSelected: c.isSelected !== undefined ? c.isSelected : true
            }));
        } else if (extractedData && extractedData.length > 0) {
            initialList = extractedData.map(data => {
                const isSemestral = data.obligaciones_tributarias === 'semestral' || data.regimen === TaxRegime.RimpeEmprendedor;
                const isPopular = data.regimen === TaxRegime.RimpeNegocioPopular;
                
                let defaultIva: 'Mensual' | 'Semestral' | 'Ninguno' = 'Mensual';
                if (isPopular) defaultIva = 'Ninguno';
                else if (isSemestral) defaultIva = 'Semestral';

                return {
                    id: uuidv4(),
                    name: data.apellidos_nombres || 'Contribuyente Nuevo',
                    tradeName: (data as any).nombre_comercial || '',
                    ruc: data.ruc,
                    regime: data.regimen || TaxRegime.General,
                    phones: [data.contacto?.celular].filter(Boolean) as string[],
                    email: data.contacto?.email || '',
                    address: data.direccion || '',
                    origin: 'ruc_pdf',
                    sourceFileName: data.ruc ? `RUC_${data.ruc}.pdf` : undefined,
                    subscriptionType: 'declaraciones_completo',
                    ivaFrequency: defaultIva,
                    requiresAnnualRenta: data.lista_obligaciones?.includes('Impuesto a la Renta') ?? true,
                    isSelected: true,
                    notes: `Importado desde Certificado de RUC SRI. Actividad: ${data.actividad_economica || 'No especificada'}`
                };
            });
        }

        setItems(initialList);
        setSearchTerm('');
    }, [isOpen, extractedData, candidates]);

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return items;
        const q = searchTerm.toLowerCase().trim();
        return items.filter(i => 
            i.name.toLowerCase().includes(q) || 
            i.ruc.toLowerCase().includes(q) || 
            (i.email && i.email.toLowerCase().includes(q)) ||
            (i.phones && i.phones.some(p => p.includes(q)))
        );
    }, [items, searchTerm]);

    const selectedCount = useMemo(() => items.filter(i => i.isSelected).length, [items]);

    if (!isOpen || items.length === 0) return null;

    // Handlers de selección masiva
    const handleToggleSelectAll = () => {
        const allSelected = filteredItems.every(i => i.isSelected);
        setItems(prev => prev.map(i => {
            if (filteredItems.some(f => f.id === i.id)) {
                return { ...i, isSelected: !allSelected };
            }
            return i;
        }));
    };

    const handleToggleItem = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, isSelected: !i.isSelected } : i));
    };

    // Cambiar tipo de suscripción a un ítem
    const handleChangeSubscription = (id: string, type: 'declaraciones_completo' | 'solo_plan' | 'solo_firma') => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            
            let ivaFreq = i.ivaFrequency;
            let reqRenta = i.requiresAnnualRenta;

            if (type === 'declaraciones_completo') {
                if (i.regime === TaxRegime.RimpeNegocioPopular) {
                    ivaFreq = 'Ninguno';
                    reqRenta = true;
                } else if (i.regime === TaxRegime.RimpeEmprendedor) {
                    ivaFreq = 'Semestral';
                    reqRenta = true;
                } else {
                    ivaFreq = 'Mensual';
                    reqRenta = true;
                }
            } else {
                ivaFreq = 'Ninguno';
                reqRenta = false;
            }

            return {
                ...i,
                subscriptionType: type,
                ivaFrequency: ivaFreq,
                requiresAnnualRenta: reqRenta
            };
        }));
    };

    // Preset Masivo: Asignar a todos
    const handleApplyPresetAll = (type: 'declaraciones_completo' | 'solo_plan' | 'solo_firma') => {
        setItems(prev => prev.map(i => {
            let ivaFreq = i.ivaFrequency;
            let reqRenta = i.requiresAnnualRenta;

            if (type === 'declaraciones_completo') {
                if (i.regime === TaxRegime.RimpeNegocioPopular) {
                    ivaFreq = 'Ninguno';
                    reqRenta = true;
                } else if (i.regime === TaxRegime.RimpeEmprendedor) {
                    ivaFreq = 'Semestral';
                    reqRenta = true;
                } else {
                    ivaFreq = 'Mensual';
                    reqRenta = true;
                }
            } else {
                ivaFreq = 'Ninguno';
                reqRenta = false;
            }

            return {
                ...i,
                subscriptionType: type,
                ivaFrequency: ivaFreq,
                requiresAnnualRenta: reqRenta
            };
        }));
    };

    // Convertir CandidateClientItem a objeto Client oficial
    const candidateToClient = (c: CandidateClientItem): Client => {
        const isSoloPlan = c.subscriptionType === 'solo_plan';
        const clientType: 'completo' | 'solo_plan' = isSoloPlan ? 'solo_plan' : 'completo';
        const requiresDeclarations = c.subscriptionType === 'declaraciones_completo';

        const declarationsList: Declaration[] = [];
        if (c.initialDeclaration) {
            declarationsList.push(c.initialDeclaration);
        }

        const vaultList: StoredFile[] = [];
        if (c.signatureFile) {
            vaultList.push(c.signatureFile);
        }

        return {
            id: c.id,
            name: c.name.trim(),
            tradeName: c.tradeName?.trim() || '',
            ruc: c.ruc.trim(),
            sriPassword: '',
            regime: c.regime,
            isActive: true,
            isDeleted: false,
            phones: (c.phones && c.phones.length > 0) ? c.phones : [''],
            email: c.email || '',
            address: c.address || '',
            clientType,
            requiresDeclarations,
            notes: c.notes || `Registrado mediante Aprobación Masiva (${c.origin || 'Lote'}).`,
            needsVerification: false,
            signatureFile: c.signatureFile,
            electronicSignaturePassword: c.electronicSignaturePassword || '',
            signatureExpirationDate: c.signatureExpirationDate || '',
            signatureProvider: c.signatureProvider || '',
            taxProfile: {
                ivaFrequency: requiresDeclarations ? c.ivaFrequency : 'Ninguno',
                requiresAnnualRenta: requiresDeclarations ? c.requiresAnnualRenta : false,
                requiresAnexosGastos: false,
                hasActiveDevolucionIva: false,
                hasActiveElderlyDevolucionIva: false,
                requiresIce: false,
                requiresAnexoPvp: false
            },
            declarations: declarationsList,
            vault: vaultList
        };
    };

    // Aprobación Masiva
    const handleConfirmApproveSelected = () => {
        const selectedCandidates = items.filter(i => i.isSelected);
        if (selectedCandidates.length === 0) return;

        const convertedClients = selectedCandidates.map(candidateToClient);

        if (onApproveBatch) {
            onApproveBatch(convertedClients);
        } else if (onApprove) {
            convertedClients.forEach(c => onApprove(c));
        }

        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Centro de Aprobación de Nuevos Clientes" 
            size="full"
        >
            <div className="flex flex-col h-[85vh] max-h-[900px] bg-slate-950 text-slate-100 rounded-2xl overflow-hidden font-sans border border-white/10 shadow-2xl">
                
                {/* ── HEADER CON METADATOS Y ACCIONES GLOBALES ── */}
                <div className="p-5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <UserPlus size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-white tracking-tight">
                                    Aprobación Masiva de Clientes
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {selectedCount} de {items.length} seleccionados
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Revisa los RUCs y firmas .p12 detectados en masa. Elige si ingresan con <span className="text-emerald-400 font-semibold">Suscripción a Declaraciones</span> o <span className="text-sky-400 font-semibold">Solo Plan / Facturador</span>.
                            </p>
                        </div>
                    </div>

                    {/* Controles de Vista & Buscador */}
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Filtrar por RUC o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition-all font-mono"
                            />
                        </div>

                        {/* Presets Rápidos */}
                        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-[11px] font-bold">
                            <button
                                onClick={() => handleApplyPresetAll('declaraciones_completo')}
                                className="px-3 py-1 rounded-lg hover:bg-emerald-500/20 text-emerald-300 transition-all flex items-center gap-1.5"
                                title="Asigna suscripción de IVA y Renta a todos los clientes"
                            >
                                <FileCheck2 size={13} />
                                <span>Todos con Declaraciones</span>
                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1" />
                            <button
                                onClick={() => handleApplyPresetAll('solo_plan')}
                                className="px-3 py-1 rounded-lg hover:bg-sky-500/20 text-sky-300 transition-all flex items-center gap-1.5"
                                title="Configura a todos solo para facturación electrónica sin declaraciones periódicas"
                            >
                                <Sparkles size={13} />
                                <span>Todos Solo Plan</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TABLA PRINCIPAL DE CLIENTES CANDIDATOS ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-slate-950/60">
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="py-3 px-4 w-10 text-center">
                                        <button 
                                            onClick={handleToggleSelectAll}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            {filteredItems.every(i => i.isSelected) ? (
                                                <CheckSquare size={16} className="text-emerald-400" />
                                            ) : (
                                                <Square size={16} />
                                            )}
                                        </button>
                                    </th>
                                    <th className="py-3 px-4">Contribuyente / Razón Social</th>
                                    <th className="py-3 px-4">RUC / Identificación</th>
                                    <th className="py-3 px-4">Régimen SRI</th>
                                    <th className="py-3 px-4">Tipo de Suscripción</th>
                                    <th className="py-3 px-4">Frecuencia IVA</th>
                                    <th className="py-3 px-4">Contacto Detectado</th>
                                    <th className="py-3 px-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                                {filteredItems.map((item) => {
                                    const isSelected = item.isSelected;
                                    const isDeclaraciones = item.subscriptionType === 'declaraciones_completo';
                                    const isSoloPlan = item.subscriptionType === 'solo_plan';

                                    return (
                                        <tr 
                                            key={item.id}
                                            className={`transition-colors group ${
                                                isSelected 
                                                    ? 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]' 
                                                    : 'opacity-50 bg-transparent hover:bg-white/[0.02]'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleToggleItem(item.id)}
                                                    className="text-slate-400 hover:text-white transition-colors"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare size={16} className="text-emerald-400" />
                                                    ) : (
                                                        <Square size={16} />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Razón Social */}
                                            <td className="py-3 px-4 font-bold text-white">
                                                <div className="flex flex-col">
                                                    <span className="uppercase tracking-wide group-hover:text-emerald-400 transition-colors">
                                                        {item.name}
                                                    </span>
                                                    {item.tradeName && item.tradeName !== item.name && (
                                                        <span className="text-[10px] text-slate-400 font-normal italic">
                                                            Fant: {item.tradeName}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        {item.origin === 'ruc_pdf' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                                <FileText size={10} /> RUC PDF
                                                            </span>
                                                        )}
                                                        {item.origin === 'p12_signature' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                                                <KeyRound size={10} /> Firma .p12
                                                            </span>
                                                        )}
                                                        {item.origin === 'declaracion_pdf' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                                                <FileCheck2 size={10} /> Declaración
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* RUC */}
                                            <td className="py-3 px-4 font-mono font-bold text-slate-300">
                                                {item.ruc}
                                            </td>

                                            {/* Régimen */}
                                            <td className="py-3 px-4">
                                                <select
                                                    value={item.regime}
                                                    onChange={(e) => {
                                                        const newRegime = e.target.value as TaxRegime;
                                                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, regime: newRegime } : i));
                                                    }}
                                                    className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-emerald-500/50"
                                                >
                                                    <option value={TaxRegime.General}>General</option>
                                                    <option value={TaxRegime.RimpeEmprendedor}>Rimpe Emprendedor</option>
                                                    <option value={TaxRegime.RimpeNegocioPopular}>Rimpe Negocio Popular</option>
                                                </select>
                                            </td>

                                            {/* Tipo de Suscripción */}
                                            <td className="py-3 px-4">
                                                <div className="inline-flex rounded-xl p-1 bg-black/40 border border-white/10">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChangeSubscription(item.id, 'declaraciones_completo')}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                                            isDeclaraciones 
                                                                ? 'bg-emerald-500 text-slate-950 shadow-md' 
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <FileCheck2 size={12} />
                                                        <span>Declaraciones</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChangeSubscription(item.id, 'solo_plan')}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                                            isSoloPlan 
                                                                ? 'bg-sky-500 text-slate-950 shadow-md' 
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Sparkles size={12} />
                                                        <span>Solo Plan</span>
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Frecuencia IVA */}
                                            <td className="py-3 px-4">
                                                {isDeclaraciones ? (
                                                    <select
                                                        value={item.ivaFrequency}
                                                        onChange={(e) => {
                                                            const newFreq = e.target.value as 'Mensual' | 'Semestral' | 'Ninguno';
                                                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, ivaFrequency: newFreq } : i));
                                                        }}
                                                        className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-emerald-300 font-bold outline-none focus:border-emerald-500/50"
                                                    >
                                                        <option value="Mensual">IVA Mensual</option>
                                                        <option value="Semestral">IVA Semestral</option>
                                                        <option value="Ninguno">Sin IVA (Popular)</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 italic font-mono">
                                                        No aplica
                                                    </span>
                                                )}
                                            </td>

                                            {/* Contacto */}
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col text-[11px] text-slate-400">
                                                    <span>{item.phones?.[0] || 'Sin teléfono'}</span>
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.email || 'Sin correo'}</span>
                                                </div>
                                            </td>

                                            {/* Acciones */}
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all mr-1"
                                                    title="Editar detalles completos"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                                                    className="p-1.5 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-all"
                                                    title="Descartar de este lote"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── FOOTER CON ACCIONES DE APROBACIÓN ── */}
                <div className="p-4 border-t border-white/10 bg-slate-900/90 backdrop-blur-md flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 font-bold text-xs transition-all flex items-center gap-2"
                    >
                        <X size={15} />
                        Cancelar y Cerrar
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-mono">
                            <strong className="text-emerald-400">{selectedCount}</strong> de {items.length} clientes listos para integrarse
                        </span>

                        <button
                            onClick={handleConfirmApproveSelected}
                            disabled={selectedCount === 0}
                            className={`px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl ${
                                selectedCount > 0
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                            }`}
                        >
                            <UserCheck size={16} />
                            Aprobar y Registrar Seleccionados ({selectedCount})
                        </button>
                    </div>
                </div>

                {/* ── MODAL DE EDICIÓN RÁPIDA ── */}
                {editingItem && (
                    <Modal
                        isOpen={!!editingItem}
                        onClose={() => setEditingItem(null)}
                        title={`Editar: ${editingItem.name}`}
                    >
                        <div className="p-4 space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-400 uppercase mb-1">Razón Social</label>
                                <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    className="w-full p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-400 uppercase mb-1">RUC</label>
                                    <input
                                        type="text"
                                        value={editingItem.ruc}
                                        onChange={(e) => setEditingItem({ ...editingItem, ruc: e.target.value })}
                                        className="w-full p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-400 uppercase mb-1">Celular</label>
                                    <input
                                        type="text"
                                        value={editingItem.phones?.[0] || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, phones: [e.target.value] })}
                                        className="w-full p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={editingItem.email || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, email: e.target.value })}
                                    className="w-full p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-400 uppercase mb-1">Dirección</label>
                                <input
                                    type="text"
                                    value={editingItem.address || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, address: e.target.value })}
                                    className="w-full p-2.5 bg-slate-800 border border-white/10 rounded-xl text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setItems(prev => prev.map(i => i.id === editingItem.id ? editingItem : i));
                                        setEditingItem(null);
                                    }}
                                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-slate-950 font-bold"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

            </div>
        </Modal>
    );
};
