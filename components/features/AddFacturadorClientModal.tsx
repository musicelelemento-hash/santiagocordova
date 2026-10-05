import React, { useState, useMemo } from 'react';
import {
    X, User, Search, ShoppingBag, Plus, Check, Laptop,
    Sparkles, Key, DollarSign, Calendar, Layers, Shield,
    UserCheck, FileText, ArrowRight, ExternalLink
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Client, BillingPlan, TaxRegime } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';
import { v4 as uuidv4 } from 'uuid';

interface AddFacturadorClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (client: Client) => void;
}

export const AddFacturadorClientModal: React.FC<AddFacturadorClientModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const { clients, updateClient, addClient, systemSettings } = useAppStore();
    const { toast } = useToast();

    // Mode: Select existing vs Create brand new client
    const [creationMode, setCreationMode] = useState<'existing' | 'new'>('existing');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Filter for existing clients search:
    // User explicitly requested to easily find clients WITHOUT a signature!
    const [existingFilter, setExistingFilter] = useState<'all' | 'sin_firma' | 'con_firma'>('all');

    // New client basic fields
    const [newName, setNewName] = useState('');
    const [newRuc, setNewRuc] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newSriPassword, setNewSriPassword] = useState('');
    const [newRegime, setNewRegime] = useState<TaxRegime>(TaxRegime.General);

    // Facturador & Plan configuration
    const [selectedComboId, setSelectedComboId] = useState<string>('combo-talonario-amigo-100');
    const [programName, setProgramName] = useState('Talonario Amigo (100 docs)');
    const [accessUrl, setAccessUrl] = useState('https://talonarioamigo.santiagocordova.com');
    const [clientAccountantType, setClientAccountantType] = useState<'planta' | 'externo'>('planta');
    const [billingMode, setBillingMode] = useState<'unit' | 'pack_5' | 'monthly_combo_10' | 'semestral_batch' | 'paquete_docs' | 'sri_gratuito'>('paquete_docs');
    const [documentCount, setDocumentCount] = useState<number>(100);
    const [price, setPrice] = useState<number>(40);
    const [costPrice, setCostPrice] = useState<number>(12);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [expirationDate, setExpirationDate] = useState<string>(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().split('T')[0];
    });

    // Filter clients for search
    const filteredClients = useMemo(() => {
        let list = clients.filter(c => !c.isDeleted && c.isActive);

        if (existingFilter === 'sin_firma') {
            list = list.filter(c => !c.signatureFile);
        } else if (existingFilter === 'con_firma') {
            list = list.filter(c => !!c.signatureFile);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            list = list.filter(c => 
                c.name.toLowerCase().includes(q) || 
                (c.tradeName && c.tradeName.toLowerCase().includes(q)) || 
                c.ruc.includes(q)
            );
        }

        return list.slice(0, 20); // Top 20 for fast responsiveness
    }, [clients, searchTerm, existingFilter]);

    if (!isOpen) return null;

    const handleSelectExistingClient = (c: Client) => {
        setSelectedClient(c);
        setUsername(c.ruc);
        setPassword(c.sriPassword || '');
    };

    const handleSelectCombo = (comboId: string) => {
        setSelectedComboId(comboId);
        const combo = (systemSettings.combos || []).find(c => c.id === comboId);
        if (combo) {
            setProgramName(combo.name);
            setAccessUrl(combo.accessUrl || '');
            setPrice(combo.price);
            setCostPrice(combo.costPrice ?? 0);
            setDocumentCount(combo.documentCount ?? 100);
            if (combo.category === 'sri_gratuito') {
                setBillingMode('sri_gratuito');
                setDocumentCount(999999);
            } else if (combo.category === 'talonario' || combo.category === 'ecuafact' || combo.category === 'zifact') {
                setBillingMode('paquete_docs');
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let targetClient: Client;

        if (creationMode === 'existing') {
            if (!selectedClient) {
                toast.error("Por favor selecciona un cliente de la lista.");
                return;
            }
            targetClient = selectedClient;
        } else {
            if (!newName.trim() || !newRuc.trim()) {
                toast.error("Nombre y RUC son requeridos.");
                return;
            }
            const cleanRuc = newRuc.trim();
            const exists = clients.some(c => c.ruc === cleanRuc && !c.isDeleted);
            if (exists) {
                toast.error("Ya existe un cliente con este RUC.");
                return;
            }

            const newClientObj: Client = {
                id: uuidv4(),
                name: newName.trim(),
                ruc: cleanRuc,
                regime: newRegime,
                sriPassword: newSriPassword.trim() || 'S@ntiago2026',
                phones: newPhone.trim() ? [newPhone.trim()] : [],
                email: newEmail.trim() || undefined,
                isActive: true,
                isDeleted: false,
                hasExternalAccountant: clientAccountantType === 'externo',
                createdAt: new Date().toISOString()
            };

            addClient(newClientObj);
            targetClient = newClientObj;
        }

        // Build BillingPlan object
        const updatedPlan: BillingPlan = {
            id: `plan-${Date.now()}`,
            client_id: targetClient.id,
            programName: programName.trim(),
            url: accessUrl.trim(),
            username: username.trim() || targetClient.ruc,
            password: password.trim() || targetClient.sriPassword,
            planType: billingMode === 'sri_gratuito' ? 'sri_gratuito' : billingMode === 'monthly_combo_10' ? 'plan_mensual' : 'paquete_docs',
            defaultBillingMode: billingMode === 'sri_gratuito' ? 'unit' : billingMode,
            documentCount: billingMode === 'sri_gratuito' ? 999999 : Number(documentCount) || 100,
            documentsUsed: 0,
            price: Number(price) || 0,
            costPrice: Number(costPrice) || 0,
            isExternalAccountant: clientAccountantType === 'externo',
            expirationDate: billingMode === 'sri_gratuito' ? undefined : expirationDate,
            soldByMe: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const clientUpdates: Partial<Client> = {
            billingPlan: updatedPlan,
            facturadorConfig: updatedPlan,
            hasExternalAccountant: clientAccountantType === 'externo',
            clientType: clientAccountantType === 'externo' ? 'solo_plan' : 'completo',
            requiresDeclarations: clientAccountantType !== 'externo'
        };

        await updateClient(targetClient.id, clientUpdates);
        toast.success(`✅ ${targetClient.name} vinculado con éxito a ${programName}.`);

        if (onSuccess) onSuccess({ ...targetClient, ...clientUpdates });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="space-y-6 font-mono text-xs max-h-[85vh] overflow-y-auto custom-scrollbar p-1">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-foreground/10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-tertiary/20 to-primary/20 rounded-2xl text-tertiary border border-tertiary/30 shadow-lg shadow-tertiary/10">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest bg-tertiary/10 px-2 py-0.5 rounded-full border border-tertiary/20">
                                Asignación & Activación Rápida
                            </span>
                            <h2 className="text-base sm:text-lg font-black font-display text-on-surface uppercase tracking-tight mt-1">
                                Vincular Cliente a Facturador
                            </h2>
                            <p className="text-[11px] text-on-surface-variant font-sans">
                                Agrega clientes de planta o externos con o <strong>sin firma en sistema</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Selector Modo: Existente vs Nuevo */}
                    <div className="flex items-center gap-2 p-1.5 bg-surface-low border border-foreground/10 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => { setCreationMode('existing'); setSelectedClient(null); }}
                            className={`flex-1 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                creationMode === 'existing'
                                    ? 'bg-tertiary text-white shadow-lg shadow-tertiary/20'
                                    : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <UserCheck size={14} />
                            <span>Seleccionar Cliente Existente</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreationMode('new')}
                            className={`flex-1 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                creationMode === 'new'
                                    ? 'bg-tertiary text-white shadow-lg shadow-tertiary/20'
                                    : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <Plus size={14} />
                            <span>Registrar Nuevo Cliente</span>
                        </button>
                    </div>

                    {/* Paso 1A: Buscar Cliente Existente */}
                    {creationMode === 'existing' && (
                        <div className="space-y-3 bg-surface-low p-4 rounded-2xl border border-foreground/10">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                    Buscar Cliente en el Directorio:
                                </label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setExistingFilter('all')}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${existingFilter === 'all' ? 'bg-foreground/20 text-on-surface' : 'text-on-surface-variant'}`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExistingFilter('sin_firma')}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${existingFilter === 'sin_firma' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-on-surface-variant'}`}
                                    >
                                        ⚠️ Sin Firma Guardada
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExistingFilter('con_firma')}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${existingFilter === 'con_firma' ? 'bg-tertiary/20 text-tertiary border border-tertiary/30' : 'text-on-surface-variant'}`}
                                    >
                                        🔑 Con Firma .p12
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={15} />
                                <input
                                    type="text"
                                    placeholder="BUSCAR POR NOMBRE O RUC..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface uppercase outline-none focus:border-tertiary text-xs"
                                />
                            </div>

                            {/* Resultados de Clientes */}
                            <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                {filteredClients.length === 0 ? (
                                    <p className="text-[11px] text-on-surface-variant text-center py-4">No se encontraron clientes.</p>
                                ) : (
                                    filteredClients.map(c => {
                                        const isSelected = selectedClient?.id === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectExistingClient(c)}
                                                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-tertiary/20 border-tertiary/50 text-on-surface shadow-md' 
                                                        : 'bg-surface-lowest border-foreground/5 hover:border-foreground/20 text-on-surface-variant'
                                                }`}
                                            >
                                                <div>
                                                    <div className="font-bold text-on-surface text-xs uppercase">{c.tradeName || c.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                                        <span className="font-mono text-on-surface-variant">{c.ruc}</span>
                                                        {c.signatureFile ? (
                                                            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded text-[8px] font-bold">🔑 Firma Subida</span>
                                                        ) : (
                                                            <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded text-[8px] font-bold">⚠️ Sin Firma</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isSelected && <Check size={16} className="text-tertiary font-bold" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {selectedClient && (
                                <div className="p-3 bg-tertiary/10 border border-tertiary/30 rounded-xl text-[11px] text-tertiary flex items-center justify-between">
                                    <span>Cliente seleccionado: <strong>{selectedClient.tradeName || selectedClient.name}</strong></span>
                                    <span className="font-mono font-bold">{selectedClient.ruc}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Paso 1B: Formulario para Nuevo Cliente */}
                    {creationMode === 'new' && (
                        <div className="space-y-3 bg-surface-low p-4 rounded-2xl border border-foreground/10">
                            <h4 className="text-[10px] font-bold text-on-surface-variant uppercase">Datos del Nuevo Cliente:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre / Razón Social *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Armijos K..."
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs uppercase outline-none focus:border-tertiary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">RUC / Cédula *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="070..."
                                        value={newRuc}
                                        onChange={(e) => {
                                            setNewRuc(e.target.value);
                                            setUsername(e.target.value);
                                        }}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Teléfono / WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="099..."
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="cliente@ejemplo.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Clave SRI Activa</label>
                                    <input
                                        type="text"
                                        placeholder="Clave del portal SRI"
                                        value={newSriPassword}
                                        onChange={(e) => setNewSriPassword(e.target.value)}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase">Régimen SRI</label>
                                    <select
                                        value={newRegime}
                                        onChange={(e) => setNewRegime(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                                    >
                                        <option value={TaxRegime.General}>Régimen General</option>
                                        <option value={TaxRegime.RimpeNegocioPopular}>RIMPE Negocio Popular</option>
                                        <option value={TaxRegime.RimpeEmprendedor}>RIMPE Emprendedor</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Paso 2: Tipo de Cliente (Planta vs Externo con otro contador) */}
                    <div className="p-4 bg-surface-low rounded-2xl border border-foreground/10 space-y-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                            Tipo de Relación Contable:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                clientAccountantType === 'planta' ? 'bg-tertiary/15 border-tertiary/40 text-on-surface' : 'bg-surface-lowest border-foreground/10 text-on-surface-variant'
                            }`}>
                                <input
                                    type="radio"
                                    name="accountantType"
                                    checked={clientAccountantType === 'planta'}
                                    onChange={() => setClientAccountantType('planta')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-bold text-xs">🏛️ Cliente de Planta (Despacho)</div>
                                    <div className="text-[10px] text-on-surface-variant mt-0.5">
                                        Lleva declaraciones mensuales/semestrales regulares con Santiago Córdova.
                                    </div>
                                </div>
                            </label>

                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                clientAccountantType === 'externo' ? 'bg-sky-500/15 border-sky-500/40 text-on-surface' : 'bg-surface-lowest border-foreground/10 text-on-surface-variant'
                            }`}>
                                <input
                                    type="radio"
                                    name="accountantType"
                                    checked={clientAccountantType === 'externo'}
                                    onChange={() => setClientAccountantType('externo')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-bold text-xs text-sky-400">👤 Externo / Otro Contador</div>
                                    <div className="text-[10px] text-on-surface-variant mt-0.5">
                                        Tiene otro contador (ej: Armijos K, Naula). Solo compra plan, firma o llenado.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Paso 3: Selección de Software / Plan */}
                    <div className="p-4 bg-surface-low rounded-2xl border border-foreground/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                Software de Emisión / Facturador:
                            </label>
                            <span className="text-[10px] text-tertiary font-bold">Desde Catálogo</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(systemSettings.combos || []).filter(c => c.isActive).map(combo => (
                                <button
                                    type="button"
                                    key={combo.id}
                                    onClick={() => handleSelectCombo(combo.id)}
                                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                        selectedComboId === combo.id
                                            ? 'bg-tertiary/20 border-tertiary/50 text-tertiary font-bold shadow-md'
                                            : 'bg-surface-lowest border-foreground/10 text-on-surface-variant hover:text-on-surface'
                                    }`}
                                >
                                    <div className="text-xs truncate">{combo.name}</div>
                                    <div className="text-[10px] font-mono mt-0.5 text-tertiary">${combo.price.toFixed(2)} USD</div>
                                </button>
                            ))}
                        </div>

                        {/* Modalidad de Cobro de Llenado */}
                        <div className="space-y-1.5 pt-2 border-t border-foreground/5">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                                Modalidad de Servicio / Cobro:
                            </label>
                            <select
                                value={billingMode}
                                onChange={(e) => setBillingMode(e.target.value as any)}
                                className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface text-xs outline-none focus:border-tertiary"
                            >
                                <option value="paquete_docs">Paquete de Documentos Anual (Ecuafact / Zifact / Talonario)</option>
                                <option value="sri_gratuito">Facturador SRI Gratuito (Ilimitado por Ley)</option>
                                <option value="unit">Tarifa Unitaria ($2.00 por factura llenada - Ocasional)</option>
                                <option value="pack_5">Paquete Pequeño ($5.00 hasta 5 facturas en el mes)</option>
                                <option value="monthly_combo_10">Combo Mensual $10 (Declaración $5 + Facturas $5 - ej. Camba Paola)</option>
                                <option value="semestral_batch">Lote Semestral Acumulado (Por secuencial y fecha - ej. Wilmer)</option>
                            </select>
                        </div>
                    </div>

                    {/* Paso 4: Credenciales del Facturador */}
                    <div className="p-4 bg-surface-low rounded-2xl border border-foreground/10 space-y-3">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">
                            Credenciales para Facturar ("Nivel Contador"):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Usuario Facturador</label>
                                <input
                                    type="text"
                                    placeholder="RUC o Usuario"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Contraseña Facturador</label>
                                <input
                                    type="text"
                                    placeholder="Contraseña del facturador"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface-lowest border border-foreground/10 rounded-xl text-on-surface font-mono text-xs outline-none focus:border-tertiary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-foreground/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 border border-foreground/10 rounded-xl text-on-surface-variant hover:text-on-surface font-bold text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-7 py-2.5 bg-gradient-to-r from-tertiary to-tertiary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-tertiary/25 flex items-center gap-2 cursor-pointer"
                        >
                            <Check size={15} />
                            <span>Vincular y Activar</span>
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
