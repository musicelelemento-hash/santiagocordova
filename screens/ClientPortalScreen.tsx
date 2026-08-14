import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Client, DeclarationStatus, ServiceFeesConfig, TaxObligationType, Declaration, StoredFile } from '../types';
import { formatPeriodForDisplay, safeFormat } from '../services/sri';
import { getClientServiceFee } from '../services/clientService';
import { getClientCompliance, COMPLIANCE_COLORS } from '../services/complianceEngine';
import { Logo } from '../components/ui/Logo';
import { downloadStoredFile, openStoredFileInNewTab } from '../services/fileService';
import { FinancialMetricsOverview } from '../components/features/ClientDetail/FinancialMetricsOverview';

// ─────────────────────────────────────────────────────────
// UI SUB-COMPONENTS (Stitch Obsidian Luxury)
// ─────────────────────────────────────────────────────────

const HealthGauge = ({ score, color }: { score: number, color: string }) => {
    const config = COMPLIANCE_COLORS[color as any] || COMPLIANCE_COLORS.gray;
    return (
        <div className="relative w-32 h-32 flex items-center justify-center font-mono">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="64" cy="64" r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-white/10"
                />
                <circle
                    cx="64" cy="64" r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={351.8}
                    strokeDashoffset={351.8 - (351.8 * score) / 100}
                    strokeLinecap="round"
                    className={`${config.text} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white font-mono">{score}%</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Salud SRI</span>
            </div>
        </div>
    );
};

const BankCardPremium = ({ clientName }: { clientName: string }) => {
    const [copied, setCopied] = useState(false);
    const account = "220XXXXXXX";

    const handleCopy = () => {
        navigator.clipboard.writeText(account);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group perspective-1000">
            <div className="bg-gradient-to-br from-[#051424] via-[#0b1326] to-[#020b14] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl border border-white/10 border-t-white/20 transition-all duration-500 hover:scale-[1.01]">
                {/* Visual Artifacts */}
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><LucideIcons.ShieldCheck size={120} /></div>
                <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-[#00A896]/15 rounded-full blur-[80px]"></div>
                <div className="absolute top-10 left-10 w-40 h-40 bg-[#2B6AFF]/15 rounded-full blur-[60px]"></div>

                <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                                <LucideIcons.CreditCard size={12} className="text-[#00A896]" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00A896]">Canal de Pago Directo</span>
                            </div>
                            <h4 className="text-2xl font-display font-black tracking-tight text-white">Banco Pichincha</h4>
                        </div>
                        <Logo className="w-10 h-10 text-white opacity-60" />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-[0.2em] font-mono">Número de Cuenta Corriente</p>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-2xl font-bold tracking-[0.2em] text-white drop-shadow-lg">2200XXXXXX</span>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/15 transition-all text-white border border-white/10 cursor-pointer"
                                    title="Copiar número de cuenta"
                                >
                                    {copied ? <LucideIcons.Check size={14} className="text-[#00A896]" /> : <LucideIcons.Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-[0.2em] font-mono">Titular de la Cuenta</p>
                                <p className="text-sm font-bold text-slate-200 tracking-wider font-display">Santiago A. Cordova</p>
                            </div>
                            <div className="w-12 h-8 bg-gradient-to-r from-amber-400/20 to-amber-600/20 rounded-md border border-amber-500/30 flex items-center justify-center">
                                <div className="w-6 h-4 bg-amber-500/40 rounded-sm"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimelineItem = ({ ob }: { ob: any }) => {
    const config = COMPLIANCE_COLORS[ob.color] || COMPLIANCE_COLORS.gray;
    const isDeclared = ob.isDeclared;

    return (
        <div className="relative flex gap-6 pb-8 last:pb-0 group font-mono">
            <div className="absolute top-10 left-[1.125rem] bottom-0 w-[2px] bg-white/10 group-last:hidden"></div>
            <div className={`relative z-10 w-9 h-9 rounded-full border-2 border-white/20 shadow-md flex items-center justify-center transition-all group-hover:scale-110 ${isDeclared ? 'bg-[#00A896] text-white shadow-[0_0_10px_rgba(0,168,150,0.5)]' : config.dot}`}>
                {isDeclared ? <LucideIcons.Check size={14} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-white/50"></div>}
            </div>
            <div className="flex-1 pt-1">
                <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 border-t-white/20 shadow-xl transition-all group-hover:border-white/20">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00A896] mb-1 block">{formatPeriodForDisplay(ob.period)}</span>
                            <h4 className="text-base font-bold text-white group-hover:text-[#00A896] transition-colors font-display">{ob.label}</h4>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${config.bg} ${config.text} border ${config.border}`}>
                            {config.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <LucideIcons.Calendar size={13} className="text-slate-500" />
                            Vence el {ob.dueDate ? safeFormat(ob.dueDate, 'dd/MM/yyyy') : '---'}
                        </div>
                        {ob.daysRemaining !== null && !isDeclared && (
                            <div className={`flex items-center gap-1.5 ${ob.daysRemaining < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                                <LucideIcons.Clock size={13} />
                                {ob.daysRemaining < 0 ? 'Vencido' : `${ob.daysRemaining} días restantes`}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// VAULT CREDENTIAL CARD
// ─────────────────────────────────────────────────────────
const CredentialCard = ({ label, icon: Icon, value, hint }: { label: string; icon: any; value?: string; hint?: string }) => {
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (value) {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 border-t-white/20 shadow-xl flex items-center gap-5 group hover:border-[#00A896]/30 transition-all font-mono">
            <div className="w-12 h-12 bg-white/5 text-[#00A896] group-hover:bg-[#00A896]/15 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0 border border-white/5">
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                {value ? (
                    <p className="font-mono text-sm font-bold text-white truncate">
                        {visible ? value : '••••••••••••'}
                    </p>
                ) : (
                    <p className="text-xs text-slate-500 italic">{hint || 'No registrado'}</p>
                )}
            </div>
            {value && (
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => setVisible(v => !v)}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center transition-all cursor-pointer border border-white/5"
                        title="Mostrar / Ocultar"
                    >
                        {visible ? <LucideIcons.EyeOff size={14} /> : <LucideIcons.Eye size={14} />}
                    </button>
                    <button
                        onClick={handleCopy}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-[#00A896]/20 text-slate-300 hover:text-[#00A896] flex items-center justify-center transition-all cursor-pointer border border-white/5"
                        title="Copiar al portapapeles"
                    >
                        {copied ? <LucideIcons.Check size={14} className="text-[#00A896]" /> : <LucideIcons.Copy size={14} />}
                    </button>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// CHANGE PASSWORD MODAL
// ─────────────────────────────────────────────────────────
interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newPassword: string) => void;
    currentPassword: string;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSave, currentPassword }) => {
    const [current, setCurrent] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const reset = () => {
        setCurrent(''); setNewPass(''); setConfirm('');
        setError(''); setSuccess(false);
        setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    };

    const handleClose = () => { reset(); onClose(); };

    const handleSubmit = () => {
        setError('');
        if (current !== currentPassword) {
            setError('La clave SRI actual no es correcta.');
            return;
        }
        if (newPass.length < 6) {
            setError('La nueva clave debe tener al menos 6 caracteres.');
            return;
        }
        if (newPass !== confirm) {
            setError('Las claves nuevas no coinciden.');
            return;
        }
        onSave(newPass);
        setSuccess(true);
        setTimeout(() => handleClose(), 1800);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-mono">
            <div className="bg-[#051424] rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md shadow-2xl border border-white/10 border-t-white/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(0,168,150,0.3)]">
                        <LucideIcons.KeyRound size={26} />
                    </div>
                    <h3 className="text-2xl font-display font-black text-white mb-1">Cambiar Clave SRI</h3>
                    <p className="text-slate-400 text-xs font-sans">Solo tú puedes actualizar esta credencial de acceso.</p>
                </div>

                {success ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                            <LucideIcons.CheckCircle size={36} />
                        </div>
                        <p className="text-emerald-400 font-bold text-base">¡Clave SRI actualizada con éxito!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Current password */}
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Clave SRI Actual</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={current}
                                    onChange={e => setCurrent(e.target.value)}
                                    className="w-full px-4 py-3 pr-11 rounded-2xl border border-white/10 bg-[#020b14] text-white font-mono text-xs focus:outline-none focus:border-[#00A896]/50 transition-all"
                                    placeholder="Clave vigente"
                                />
                                <button onClick={() => setShowCurrent(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                                    {showCurrent ? <LucideIcons.EyeOff size={15} /> : <LucideIcons.Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* New password */}
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Nueva Clave SRI</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                    className="w-full px-4 py-3 pr-11 rounded-2xl border border-white/10 bg-[#020b14] text-white font-mono text-xs focus:outline-none focus:border-[#00A896]/50 transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button onClick={() => setShowNew(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                                    {showNew ? <LucideIcons.EyeOff size={15} /> : <LucideIcons.Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm */}
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Confirmar Nueva Clave</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className="w-full px-4 py-3 pr-11 rounded-2xl border border-white/10 bg-[#020b14] text-white font-mono text-xs focus:outline-none focus:border-[#00A896]/50 transition-all"
                                    placeholder="Repite la nueva clave"
                                />
                                <button onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                                    {showConfirm ? <LucideIcons.EyeOff size={15} /> : <LucideIcons.Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                                <LucideIcons.AlertCircle size={14} className="flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={handleClose} className="flex-1 py-3 rounded-2xl border border-white/10 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={handleSubmit} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-[#00A896]/20 cursor-pointer border border-white/10">
                                Guardar Clave
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT PROPS
// ─────────────────────────────────────────────────────────
interface ClientPortalScreenProps {
    client: Client;
    onLogout: () => void;
    serviceFees: ServiceFeesConfig;
    onUpdateClient?: (updatedClient: Client) => void;
}

export const ClientPortalScreen: React.FC<ClientPortalScreenProps> = ({ client, onLogout, serviceFees, onUpdateClient }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'vault' | 'timeline'>('overview');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [localClient, setLocalClient] = useState<Client>(client);

    const compliance = useMemo(() => getClientCompliance(localClient, new Date()), [localClient]);
    const healthConfig = COMPLIANCE_COLORS[compliance.overallColor] || COMPLIANCE_COLORS.gray;

    const fee = getClientServiceFee(localClient, serviceFees);
    const totalDebt = useMemo(() => {
        const pending = localClient.declarations?.filter(d => !d.is_paid && d.status !== 'Pendiente') || [];
        return pending.length * fee;
    }, [localClient.declarations, fee]);

    const handleOpenInNewTab = async (decl: Declaration | { proof_file?: StoredFile }) => {
        if (!decl.proof_file) return;
        await openStoredFileInNewTab(decl.proof_file);
    };

    const handleDownloadFile = async (file: StoredFile) => {
        await downloadStoredFile(file);
    };

    const handleRucPreview = () => {
        const file = localClient.rucCertificate || localClient.rucPdf;
        if (file) handleOpenInNewTab({ proof_file: file });
    };

    const handleSavePassword = (newPassword: string) => {
        const updated = { ...localClient, sriPassword: newPassword };
        setLocalClient(updated);
        if (onUpdateClient) onUpdateClient(updated);
    };

    // ── Vault data helpers ──────────────────────────────────
    const hasSignatureFile = !!(localClient.signatureFile);
    const hasRucFile = !!(localClient.rucCertificate || localClient.rucPdf);
    const hasRentaRefundProof = !!(localClient.rentaRefundProof);
    const vaultFiles: StoredFile[] = localClient.vault || [];

    // Signature expiry helpers
    const signatureExpiry = localClient.signatureExpirationDate
        ? new Date(localClient.signatureExpirationDate)
        : null;
    const today = new Date();
    const signatureDaysLeft = signatureExpiry
        ? Math.ceil((signatureExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const signatureExpired = signatureDaysLeft !== null && signatureDaysLeft <= 0;
    const signatureWarning = signatureDaysLeft !== null && signatureDaysLeft > 0 && signatureDaysLeft <= 60;

    return (
        <div className="min-h-screen bg-[#020b14] font-sans text-white selection:bg-[#00A896]/20 selection:text-[#00A896] pb-24">
            {/* 💎 Elite Top Navigation (Stitch Obsidian Luxury) */}
            <nav className="bg-[#051424]/90 backdrop-blur-2xl sticky top-0 z-50 px-4 sm:px-8 py-4 border-b border-white/10">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(0,168,150,0.3)]">
                            <Logo className="w-6 h-6" />
                        </div>
                        <div className="border-l border-white/10 pl-3 sm:pl-4 font-mono">
                            <h1 className="text-[9px] font-bold text-white uppercase tracking-[0.25em] leading-none mb-1">Bóveda Privada</h1>
                            <p className="text-[10px] text-[#00A896] font-bold uppercase tracking-wider flex items-center gap-1">
                                <LucideIcons.Shield size={10} strokeWidth={3} />
                                Santiago Cordova Protocol
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 font-mono">
                        <div className="text-right hidden sm:block">
                            <div className="flex items-center justify-end gap-1.5">
                                <p className="text-sm font-bold text-white tracking-tight leading-tight font-display">{localClient.name}</p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(localClient.name);
                                    }}
                                    className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-slate-400 hover:text-[#00A896] transition-all cursor-pointer"
                                    title="Copiar Nombre"
                                >
                                    <LucideIcons.Copy size={11} />
                                </button>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{localClient.ruc}</p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(localClient.ruc);
                                    }}
                                    className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-slate-400 hover:text-[#00A896] transition-all cursor-pointer"
                                    title="Copiar RUC"
                                >
                                    <LucideIcons.Copy size={11} />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-2xl bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all active:scale-95 border border-white/10 cursor-pointer"
                            title="Cerrar Sesión"
                        >
                            <LucideIcons.LogOut size={16} />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                {/* 🎚️ Navigation Tabs (Stitch Obsidian Luxury) */}
                <div className="flex justify-center mb-8 sm:mb-12 font-mono">
                    <div className="inline-flex p-1.5 bg-[#0b1326] rounded-2xl border border-white/10 w-full sm:w-auto overflow-x-auto gap-1">
                        {[
                            { id: 'overview', label: 'Centro de Mando', icon: LucideIcons.LayoutDashboard },
                            { id: 'metrics', label: 'Mis Métricas', icon: LucideIcons.BarChart3 },
                            { id: 'vault', label: 'Bóveda', icon: LucideIcons.ShieldCheck },
                            { id: 'timeline', label: 'Cronograma', icon: LucideIcons.Activity },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer ${activeTab === tab.id
                                    ? 'bg-white/15 text-white shadow-lg border border-white/20'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <tab.icon size={14} strokeWidth={activeTab === tab.id ? 2.5 : 2} className={activeTab === tab.id ? 'text-[#00A896]' : ''} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────
                    CENTRO DE MANDO (OVERVIEW)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-10 animate-in fade-in duration-300">
                        <section className="relative overflow-hidden p-8 sm:p-12 bg-[#051424]/90 backdrop-blur-2xl rounded-[3rem] border border-white/10 border-t-white/20 shadow-2xl group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#2B6AFF]/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 sm:gap-12">
                                <div className="space-y-6">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0b1326] text-slate-300 rounded-full text-[9.5px] font-bold uppercase tracking-widest border border-white/10 font-mono">
                                        <div className={`w-2 h-2 rounded-full ${healthConfig.dot}`}></div>
                                        {localClient.regime}
                                    </div>
                                    <h2 className="text-4xl sm:text-6xl font-black font-display text-white tracking-tight leading-[1.05]">
                                        Estatus<br /><span className="text-slate-400">Garantizado.</span>
                                    </h2>
                                    <p className="text-slate-300 font-medium max-w-md text-sm sm:text-base leading-relaxed">
                                        Gestionamos su cumplimiento fiscal con precisión quirúrgica para garantizar su tranquilidad patrimonial.
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-6 bg-[#0b1326]/80 p-8 rounded-[2.5rem] border border-white/10 shadow-xl backdrop-blur-sm">
                                    <HealthGauge score={compliance.score} color={compliance.overallColor} />
                                    <div className="text-center font-mono">
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${healthConfig.text}`}>{healthConfig.label}</p>
                                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Cumplimiento Global SRI</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <BankCardPremium clientName={localClient.name} />

                            <div className="bg-[#051424]/90 backdrop-blur-2xl p-8 sm:p-10 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl flex flex-col items-center justify-center text-center group">
                                <div className="w-16 h-16 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,168,150,0.3)]">
                                    <LucideIcons.MessageSquareQuote size={28} />
                                </div>
                                <h4 className="text-2xl font-display font-black text-white mb-2">Comunicación Directa</h4>
                                <p className="text-slate-300 text-xs sm:text-sm mb-8 leading-relaxed max-w-xs font-sans">
                                    Su asesor personal está a un clic de distancia para cualquier consulta técnica o trámite urgente.
                                </p>
                                <a
                                    href="https://wa.me/593978980722"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                                >
                                    <LucideIcons.PhoneCall size={14} /> Abrir WhatsApp Ejecutivo
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    MIS MÉTRICAS & ANÁLISIS FINANCIERO (CHARTS)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'metrics' && (
                    <div className="animate-in fade-in duration-300">
                        <FinancialMetricsOverview client={localClient} theme="dark" />
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    BÓVEDA (VAULT) – Facturación, Credenciales & Documentos KYC
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'vault' && (
                    <div className="space-y-10 animate-in fade-in duration-300">

                        {/* ── SECCIÓN: Facturación Electrónica & Licencia ───────── */}
                        <section className="bg-[#051424]/90 backdrop-blur-2xl p-6 sm:p-8 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-2xl relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-6 border-b border-white/10 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                                        <LucideIcons.Receipt size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-mono">Sistema de Emisión</p>
                                        <h3 className="text-xl sm:text-2xl font-display font-black text-white">Facturación Electrónica</h3>
                                    </div>
                                </div>

                                {localClient.facturadorConfig?.url && (
                                    <a
                                        href={localClient.facturadorConfig.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/20 border border-white/10 cursor-pointer font-mono"
                                    >
                                        <span>Abrir Portal de Facturación</span>
                                        <LucideIcons.ExternalLink size={13} />
                                    </a>
                                )}
                            </div>

                            {/* Badge especial de Proveedor Santiago Córdova */}
                            {(localClient.facturadorConfig?.soldByMe || (localClient.facturadorConfig?.providerName && localClient.facturadorConfig.providerName.toLowerCase().includes('santiago'))) && (
                                <div className="mb-6 p-4 bg-[#00A896]/10 border border-[#00A896]/25 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-[#00A896] text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                                            <LucideIcons.ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white uppercase tracking-wider font-display">
                                                Proveedor Oficial: {localClient.facturadorConfig?.providerName || 'Santiago Córdova'}
                                            </p>
                                            <p className="text-xs text-[#00A896] font-medium font-sans">
                                                Garantía de Servicio: Incluye <strong>Soporte Técnico Especializado</strong> y <strong>Anulación de Facturas Gratis</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-[#00A896]/20 text-[#00A896] border border-[#00A896]/30 text-[9px] font-bold uppercase tracking-wider rounded-full flex-shrink-0 font-mono">
                                        Soporte Gratuito Incluido
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                                {/* Programa */}
                                <div className="bg-[#0b1326]/80 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Programa / Sistema</p>
                                    <p className="text-xs font-bold text-white font-display truncate">
                                        {localClient.facturadorConfig?.programName || 'No configurado'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Proveedor: {localClient.facturadorConfig?.providerName || (localClient.facturadorConfig?.soldByMe ? 'Santiago Córdova' : 'Externo')}
                                    </p>
                                </div>

                                {/* Plan / Documentos */}
                                <div className="bg-[#0b1326]/80 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Plan de Comprobantes</p>
                                    <p className="text-xs font-bold text-white">
                                        {localClient.facturadorConfig?.documentStatus || 'Modalidad no definida'}
                                    </p>
                                    <p className="text-[10px] text-[#00A896] font-semibold mt-1">
                                        {localClient.facturadorConfig?.documentCount !== undefined
                                            ? `Cupo: ${localClient.facturadorConfig.documentCount} docs`
                                            : 'Cupo Ilimitado'}
                                    </p>
                                </div>

                                {/* Vencimiento */}
                                <div className="bg-[#0b1326]/80 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vencimiento Licencia</p>
                                    <p className="text-xs font-bold text-white">
                                        {localClient.facturadorConfig?.expirationDate
                                            ? safeFormat(localClient.facturadorConfig.expirationDate, 'dd/MM/yyyy')
                                            : 'Sin fecha registrada'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Precio Vendido: ${localClient.facturadorConfig?.price?.toFixed(2) || '0.00'}
                                    </p>
                                </div>

                                {/* Credencial Facturador */}
                                <div className="bg-[#0b1326]/80 p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Acceso Facturador</p>
                                        <p className="text-xs font-mono font-bold text-slate-300 truncate">
                                            Usuario: {localClient.facturadorConfig?.username || 'No registrado'}
                                        </p>
                                    </div>
                                    <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-between">
                                        <span>Clave: ••••••••</span>
                                        {localClient.facturadorConfig?.password && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(localClient.facturadorConfig?.password || '');
                                                    alert('Clave del facturador copiada al portapapeles');
                                                }}
                                                className="text-[9px] font-bold text-[#00A896] hover:underline uppercase cursor-pointer"
                                            >
                                                Copiar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── SECCIÓN: Credenciales de Acceso ───────────────────── */}
                        <section>
                            <div className="flex items-center justify-between mb-6 px-1">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-mono">Accesos Digitales</p>
                                    <h3 className="text-2xl font-display font-black text-white">Credenciales Guardadas</h3>
                                </div>
                                <button
                                    onClick={() => setShowChangePassword(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#00A896]/15 hover:bg-[#00A896]/25 border border-[#00A896]/30 text-[#00A896] rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono shadow-sm"
                                >
                                    <LucideIcons.KeyRound size={13} />
                                    Cambiar Clave SRI
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CredentialCard
                                    label="Clave SRI"
                                    icon={LucideIcons.Lock}
                                    value={localClient.sriPassword}
                                    hint="No registrada"
                                />
                                <CredentialCard
                                    label="Clave Firma Electrónica (.p12)"
                                    icon={LucideIcons.KeySquare}
                                    value={localClient.electronicSignaturePassword}
                                    hint="No registrada"
                                />
                                <CredentialCard
                                    label="Clave IESS"
                                    icon={LucideIcons.ShieldEllipsis}
                                    value={localClient.iessPassword}
                                    hint="No registrada"
                                />
                                <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 border-t-white/20 shadow-xl flex items-center gap-5 font-mono">
                                    <div className="w-12 h-12 bg-white/5 text-[#00A896] rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/5">
                                        <LucideIcons.Fingerprint size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Firma Electrónica (.P12)</p>
                                        {signatureExpiry ? (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${signatureExpired ? 'text-rose-400' : signatureWarning ? 'text-amber-400' : 'text-[#00A896]'}`}>
                                                    {signatureExpired
                                                        ? '⚠ Firma vencida'
                                                        : signatureWarning
                                                            ? `Vence en ${signatureDaysLeft} días`
                                                            : `Vigente · ${signatureDaysLeft}d restantes`}
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500 italic">Sin fecha registrada</p>
                                        )}
                                        <div className="text-[10px] text-slate-400 mt-0.5 space-y-0.5">
                                            {localClient.signatureProvider && (
                                                <p>Proveedor: <strong>{localClient.signatureProvider}</strong></p>
                                            )}
                                            {signatureExpiry && (
                                                <p>Vencimiento: {safeFormat(signatureExpiry.toISOString(), 'dd/MM/yyyy')}</p>
                                            )}
                                        </div>
                                    </div>
                                    {signatureExpiry && (
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${signatureExpired ? 'bg-rose-400' : signatureWarning ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── SECCIÓN: Verificación de Identidad KYC (Fotos Cédula) ── */}
                        <section>
                            <div className="mb-6 px-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-mono">Identidad Digital Certificada</p>
                                <h3 className="text-2xl font-display font-black text-white">Verificación de Cédula & Biometría</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono">
                                {/* Cédula Frente */}
                                <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-xl flex flex-col justify-between group hover:border-[#00A896]/40 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-sky-500/15 text-sky-400 rounded-2xl flex items-center justify-center border border-sky-500/30">
                                                <LucideIcons.Contact size={22} />
                                            </div>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${localClient.idCardFront ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'}`}>
                                                {localClient.idCardFront ? 'Verificado' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-white mb-1">Cédula (Frente)</h4>
                                        <p className="text-xs text-slate-400 mb-4 font-sans">Fotografía clara del anverso del documento de identidad.</p>
                                    </div>

                                    {localClient.idCardFront ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardFront })}
                                            className="w-full py-2.5 bg-white/5 hover:bg-[#00A896]/20 text-white hover:text-[#00A896] text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                                        >
                                            <LucideIcons.Eye size={13} /> Ver Cédula Frente
                                        </button>
                                    ) : (
                                        <div className="py-2.5 bg-white/5 text-slate-500 text-xs font-semibold rounded-2xl text-center border border-dashed border-white/10 font-sans">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>

                                {/* Cédula Reverso */}
                                <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-xl flex flex-col justify-between group hover:border-[#00A896]/40 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-indigo-500/15 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                                <LucideIcons.CreditCard size={22} />
                                            </div>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${localClient.idCardBack ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'}`}>
                                                {localClient.idCardBack ? 'Verificado' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-white mb-1">Cédula (Reverso)</h4>
                                        <p className="text-xs text-slate-400 mb-4 font-sans">Fotografía clara del reverso con código de dactilar.</p>
                                    </div>

                                    {localClient.idCardBack ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardBack })}
                                            className="w-full py-2.5 bg-white/5 hover:bg-[#00A896]/20 text-white hover:text-[#00A896] text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                                        >
                                            <LucideIcons.Eye size={13} /> Ver Cédula Reverso
                                        </button>
                                    ) : (
                                        <div className="py-2.5 bg-white/5 text-slate-500 text-xs font-semibold rounded-2xl text-center border border-dashed border-white/10 font-sans">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>

                                {/* Selfie Sosteniendo Cédula */}
                                <div className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-xl flex flex-col justify-between group hover:border-[#00A896]/40 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
                                                <LucideIcons.UserCheck size={22} />
                                            </div>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${localClient.idCardSelfie ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'}`}>
                                                {localClient.idCardSelfie ? 'Biometría OK' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-white mb-1">Selfie con Cédula</h4>
                                        <p className="text-xs text-slate-400 mb-4 font-sans">Fotografía del rostro sosteniendo el documento de identidad.</p>
                                    </div>

                                    {localClient.idCardSelfie ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardSelfie })}
                                            className="w-full py-2.5 bg-white/5 hover:bg-[#00A896]/20 text-white hover:text-[#00A896] text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                                        >
                                            <LucideIcons.Eye size={13} /> Ver Foto Selfie
                                        </button>
                                    ) : (
                                        <div className="py-2.5 bg-white/5 text-slate-500 text-xs font-semibold rounded-2xl text-center border border-dashed border-white/10 font-sans">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── SECCIÓN: Archivos Principales ─────────────────────── */}
                        <section>
                            <div className="mb-6 px-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-mono">Documentos Certificados</p>
                                <h3 className="text-2xl font-display font-black text-white">Expediente Digital</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-mono">
                                {/* Firma electrónica .p12 */}
                                <div
                                    onClick={() => hasSignatureFile && handleDownloadFile(localClient.signatureFile!)}
                                    className={`bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border transition-all group ${hasSignatureFile
                                        ? 'border-white/10 border-t-white/20 cursor-pointer hover:border-[#00A896]/40 shadow-xl active:scale-[0.98]'
                                        : 'border-dashed border-white/10 opacity-50'}`}
                                >
                                    <div className="w-12 h-12 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                        <LucideIcons.FileKey size={22} />
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Firma Electrónica (.p12)</p>
                                    <h4 className="text-base font-display font-bold text-white mb-1 truncate">
                                        {hasSignatureFile ? localClient.signatureFile!.name : 'Token .P12'}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-sans">
                                        {hasSignatureFile ? 'Clic para descargar' : 'No cargado aún'}
                                    </p>
                                    {hasSignatureFile && (
                                        <div className="mt-4 flex items-center gap-1.5 text-[#00A896] text-xs font-bold">
                                            <LucideIcons.Download size={13} /> Descargar .p12
                                        </div>
                                    )}
                                </div>

                                {/* Certificado RUC */}
                                <div
                                    onClick={() => hasRucFile && handleRucPreview()}
                                    className={`bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border transition-all group ${hasRucFile
                                        ? 'border-white/10 border-t-white/20 cursor-pointer hover:border-[#00A896]/40 shadow-xl active:scale-[0.98]'
                                        : 'border-dashed border-white/10 opacity-50'}`}
                                >
                                    <div className="w-12 h-12 bg-sky-500/15 border border-sky-500/30 text-sky-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                        <LucideIcons.FileText size={22} />
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Certificado RUC</p>
                                    <h4 className="text-base font-display font-bold text-white mb-1 truncate">
                                        {(localClient.rucCertificate || localClient.rucPdf)?.name || 'Documento RUC'}
                                    </h4>
                                    <p className="text-xs text-slate-400 font-sans">
                                        {hasRucFile ? 'Clic para visualizar' : 'No cargado aún'}
                                    </p>
                                    {hasRucFile && (
                                        <div className="mt-4 flex items-center gap-1.5 text-[#00A896] text-xs font-bold">
                                            <LucideIcons.ExternalLink size={13} /> Ver PDF
                                        </div>
                                    )}
                                </div>

                                {/* Resolución Devolución IVA / Renta */}
                                {hasRentaRefundProof && (
                                    <div
                                        onClick={() => handleOpenInNewTab({ proof_file: localClient.rentaRefundProof })}
                                        className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 cursor-pointer hover:border-[#00A896]/40 shadow-xl active:scale-[0.98] transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                            <LucideIcons.BadgeDollarSign size={22} />
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Devolución Renta/IVA</p>
                                        <h4 className="text-base font-display font-bold text-white mb-1 truncate">{localClient.rentaRefundProof!.name}</h4>
                                        <div className="mt-4 flex items-center gap-1.5 text-[#00A896] text-xs font-bold">
                                            <LucideIcons.ExternalLink size={13} /> Ver Resolución
                                        </div>
                                    </div>
                                )}

                                {/* Archivos del vault general */}
                                {vaultFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            if (file.type === 'pdf' || file.name.endsWith('.pdf')) {
                                                handleOpenInNewTab({ proof_file: file });
                                            } else {
                                                handleDownloadFile(file);
                                            }
                                        }}
                                        className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 cursor-pointer hover:border-[#00A896]/40 shadow-xl active:scale-[0.98] transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                            <LucideIcons.File size={22} />
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Documento</p>
                                        <h4 className="text-base font-display font-bold text-white mb-1 truncate">{file.name}</h4>
                                        <div className="mt-4 flex items-center gap-1.5 text-[#00A896] text-xs font-bold">
                                            {file.name.endsWith('.pdf') ? <><LucideIcons.ExternalLink size={13} /> Ver PDF</> : <><LucideIcons.Download size={13} /> Descargar</>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!hasSignatureFile && !hasRucFile && vaultFiles.length === 0 && !hasRentaRefundProof && (
                                <div className="py-16 text-center bg-[#051424]/90 rounded-[2.5rem] border border-white/10 mt-4">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <LucideIcons.FolderOpen size={28} className="text-slate-500" />
                                    </div>
                                    <h4 className="text-xl font-display font-bold text-white mb-1">Sin documentos aún</h4>
                                    <p className="text-slate-400 text-xs font-sans max-w-xs mx-auto">Su asesor cargará sus documentos certificados a medida que los procese.</p>
                                </div>
                            )}
                        </section>

                        {/* ── SECCIÓN: Declaraciones PDF ────────────────────────── */}
                        <section>
                            <div className="mb-6 px-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-mono">Historial Tributario</p>
                                <h3 className="text-2xl font-display font-black text-white">Declaraciones SRI</h3>
                            </div>

                            {localClient.declarations && localClient.declarations.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-mono">
                                    {[...localClient.declarations].reverse().map((decl, idx) => {
                                        const isPaid = decl.status === 'Pagada' || !!decl.is_paid;
                                        const hasPdf = !!decl.proof_file?.content || !!decl.proof_file?.url;
                                        return (
                                            <div key={idx} className="bg-[#051424]/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-xl transition-all group">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-[#00A896]/15 group-hover:text-[#00A896] transition-colors border border-white/5">
                                                        <LucideIcons.FileCheck size={24} />
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                                                        {decl.status}
                                                    </div>
                                                </div>

                                                <div className="space-y-1 mb-6">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{decl.type || 'IVA'}</p>
                                                    <h4 className="text-xl font-display font-bold text-white">{formatPeriodForDisplay(decl.period)}</h4>
                                                    <p className="text-xs text-slate-400 font-medium font-sans">{safeFormat(decl.updatedAt, 'MMMM dd, yyyy')}</p>
                                                </div>

                                                <div className="flex gap-2 pt-4 border-t border-white/5">
                                                    <button
                                                        onClick={() => handleOpenInNewTab(decl)}
                                                        disabled={!hasPdf}
                                                        className={`flex-1 h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${hasPdf ? 'bg-[#00A896]/15 hover:bg-[#00A896]/25 text-[#00A896] border border-[#00A896]/30' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                                                    >
                                                        <LucideIcons.ExternalLink size={13} /> Abrir
                                                    </button>
                                                    <button
                                                        onClick={() => decl.proof_file && handleDownloadFile(decl.proof_file)}
                                                        disabled={!hasPdf}
                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${hasPdf ? 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10' : 'bg-white/5 text-slate-600 border-transparent cursor-not-allowed'}`}
                                                    >
                                                        <LucideIcons.Download size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-16 text-center bg-[#051424]/90 rounded-[2.5rem] border border-white/10">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <LucideIcons.CloudOff size={28} className="text-slate-500" />
                                    </div>
                                    <h4 className="text-xl font-display font-bold text-white mb-1">Sin declaraciones</h4>
                                    <p className="text-slate-400 text-xs font-sans">No se han sincronizado expedientes para este ejercicio fiscal.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    CRONOGRAMA (TIMELINE)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'timeline' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in duration-300 font-mono">
                        <section className="bg-[#051424]/90 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-12 border border-white/10 border-t-white/20 shadow-2xl">
                            <header className="text-center mb-12">
                                <span className="inline-block px-3 py-1 bg-[#00A896]/15 text-[#00A896] rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 border border-[#00A896]/30">Planificación Tributaria</span>
                                <h3 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight">Timeline Fiscal SRI</h3>
                                <p className="text-slate-400 text-xs mt-3 font-medium leading-relaxed max-w-sm mx-auto font-sans">
                                    Próximos hitos obligatorios según el noveno dígito de su RUC (<span className="text-[#00A896] font-bold font-mono text-sm">{localClient.ruc[8]}</span>).
                                </p>
                            </header>

                            <div className="relative pl-2 overflow-hidden">
                                {compliance.obligations.filter(ob => ob.color !== 'gray').map((ob, idx) => (
                                    <TimelineItem key={idx} ob={ob} />
                                ))}

                                {compliance.obligations.filter(ob => ob.color === 'gray').length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-white/10">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">Periodos Completados o Futuros</p>
                                        <div className="opacity-40 grayscale pointer-events-none">
                                            {compliance.obligations.filter(ob => ob.color === 'gray').slice(0, 2).map((ob, idx) => (
                                                <TimelineItem key={`gray-${idx}`} ob={ob} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <footer className="mt-12 p-6 bg-[#0b1326]/80 rounded-2xl border border-white/10 flex items-start gap-4">
                                <div className="w-9 h-9 bg-[#00A896]/15 border border-[#00A896]/30 rounded-xl flex items-center justify-center text-[#00A896] flex-shrink-0 shadow-sm">
                                    <LucideIcons.ShieldAlert size={18} />
                                </div>
                                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                                    <strong className="text-white block mb-0.5 uppercase tracking-wider text-[9px] font-mono">Nota de Seguridad SantiagoCórdova:</strong>
                                    Monitoreamos su calendario fiscal activamente. Las fechas mostradas consideran feriados locales y ajustes proactivos para evitar multas.
                                </p>
                            </footer>
                        </section>
                    </div>
                )}
            </main>

            {/* Modal cambio de clave SRI */}
            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
                onSave={handleSavePassword}
                currentPassword={localClient.sriPassword}
            />
        </div>
    );
};