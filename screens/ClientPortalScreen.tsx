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
// UI SUB-COMPONENTS (Elite Zen v3.2)
// ─────────────────────────────────────────────────────────

const HealthGauge = ({ score, color }: { score: number, color: string }) => {
    const config = COMPLIANCE_COLORS[color as any] || COMPLIANCE_COLORS.gray;
    return (
        <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800"
                />
                <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={364.4}
                    strokeDashoffset={364.4 - (364.4 * score) / 100}
                    strokeLinecap="round"
                    className={`${config.text} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-slate-900">{score}%</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Salud</span>
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
            <div className="bg-gradient-to-br from-[#0B2149] via-[#051135] to-[#010614] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-blue-900/30 border border-white/5 transition-all duration-500 hover:rotate-y-2 hover:scale-[1.02]">
                {/* Visual Artifacts */}
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform"><LucideIcons.ShieldCheck size={100} /></div>
                <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-[80px]"></div>
                <div className="absolute top-10 left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[60px]"></div>

                <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl/5 rounded-full border border-white/10 backdrop-blur-md">
                                <LucideIcons.CreditCard size={12} className="text-teal-400" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Canal de Pago Directo</span>
                            </div>
                            <h4 className="text-2xl font-display font-medium tracking-tight">Banco Pichincha</h4>
                        </div>
                        <Logo className="w-10 h-10 text-white opacity-40" />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Número de Cuenta</p>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-2xl tracking-[0.2em] text-white/90 drop-shadow-lg">2200XXXXXX</span>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl/10 transition-all text-white border border-white/10"
                                >
                                    {copied ? <LucideIcons.Check size={14} className="text-teal-400" /> : <LucideIcons.Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Titular</p>
                                <p className="text-sm font-medium text-slate-200 tracking-wider">Santiago A. Cordova</p>
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
        <div className="relative flex gap-6 pb-10 last:pb-0 group">
            <div className="absolute top-10 left-[1.125rem] bottom-0 w-[2px] bg-slate-100 group-last:hidden"></div>
            <div className={`relative z-10 w-9 h-9 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-all group-hover:scale-110 ${isDeclared ? 'bg-emerald-500 text-white' : config.dot}`}>
                {isDeclared ? <LucideIcons.Check size={14} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl/50"></div>}
            </div>
            <div className="flex-1 pt-1">
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-all hover:shadow-xl hover:shadow-slate-100 group-hover:border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1 block">{formatPeriodForDisplay(ob.period)}</span>
                            <h4 className="text-base font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">{ob.label}</h4>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${config.bg} ${config.text} border ${config.border}`}>
                            {config.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <LucideIcons.Calendar size={13} className="text-slate-300" />
                            Vence el {ob.dueDate ? safeFormat(ob.dueDate, 'dd/MM/yyyy') : '---'}
                        </div>
                        {ob.daysRemaining !== null && !isDeclared && (
                            <div className={`flex items-center gap-1.5 ${ob.daysRemaining < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
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
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex items-center gap-5 group hover:border-teal-200 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-slate-50 group-hover:bg-teal-50 text-slate-400 group-hover:text-teal-600 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0">
                <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                {value ? (
                    <p className="font-mono text-sm font-bold text-slate-800 truncate">
                        {visible ? value : '••••••••••••'}
                    </p>
                ) : (
                    <p className="text-sm text-slate-300 italic">{hint || 'No registrado'}</p>
                )}
            </div>
            {value && (
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => setVisible(v => !v)}
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-all"
                    >
                        {visible ? <LucideIcons.EyeOff size={14} /> : <LucideIcons.Eye size={14} />}
                    </button>
                    <button
                        onClick={handleCopy}
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-400 hover:text-teal-600 flex items-center justify-center transition-all"
                    >
                        {copied ? <LucideIcons.Check size={14} className="text-teal-500" /> : <LucideIcons.Copy size={14} />}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in-up">
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-[3rem] p-10 w-full max-w-md shadow-2xl shadow-slate-900/20 border border-slate-100 dark:border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/5 rounded-full blur-[60px] -mr-16 -mt-16 pointer-events-none" />
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <LucideIcons.KeyRound size={28} className="text-teal-600" />
                    </div>
                    <h3 className="text-2xl font-display font-semibold text-slate-900 mb-1">Cambiar Clave SRI</h3>
                    <p className="text-slate-400 text-sm">Solo tú puedes actualizar esta credencial.</p>
                </div>

                {success ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LucideIcons.CheckCircle size={36} className="text-emerald-500" />
                        </div>
                        <p className="text-emerald-600 font-bold text-lg">¡Clave actualizada!</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Current password */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Clave Actual</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={current}
                                    onChange={e => setCurrent(e.target.value)}
                                    className="w-full px-5 py-4 pr-12 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                                    placeholder="Clave SRI vigente"
                                />
                                <button onClick={() => setShowCurrent(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showCurrent ? <LucideIcons.EyeOff size={16} /> : <LucideIcons.Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* New password */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Nueva Clave</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                    className="w-full px-5 py-4 pr-12 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showNew ? <LucideIcons.EyeOff size={16} /> : <LucideIcons.Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Confirmar Nueva Clave</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className="w-full px-5 py-4 pr-12 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                                    placeholder="Repite la nueva clave"
                                />
                                <button onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showConfirm ? <LucideIcons.EyeOff size={16} /> : <LucideIcons.Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm">
                                <LucideIcons.AlertCircle size={16} className="flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={handleClose} className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleSubmit} className="flex-1 py-4 rounded-2xl bg-slate-900 text-white text-sm font-bold uppercase tracking-widest hover:bg-teal-600 transition-all active:scale-95 shadow-xl shadow-slate-200">
                                Guardar
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
        <div className="min-h-screen bg-[#FDFDFD] font-body text-slate-900 selection:bg-teal-500/10 selection:text-teal-600">
            {/* 💎 Elite Top Navigation */}
            <nav className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-100 dark:border-white/5 dark:border-slate-800">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3 sm:gap-5">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 dark:bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl text-white dark:text-slate-900 rounded-2xl flex items-center justify-center shadow-xl transform transition-transform hover:rotate-6">
                            <Logo className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div className="border-l border-slate-200 dark:border-slate-800 pl-3 sm:pl-5">
                            <h1 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.25em] leading-none mb-1">Bóveda Privada</h1>
                            <p className="text-[11px] text-brand-teal font-bold uppercase tracking-widest flex items-center gap-1">
                                <LucideIcons.Shield size={10} strokeWidth={3} />
                                Santiago Cordova Protocol
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-8">
                        <div className="text-right hidden sm:block">
                            <div className="flex items-center justify-end gap-1.5">
                                <p className="text-sm font-bold text-slate-800 dark:text-white tracking-tight leading-tight">{localClient.name}</p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(localClient.name);
                                        alert('Nombre copiado al portapapeles');
                                    }}
                                    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-brand-teal transition-all"
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
                                        alert('RUC copiado al portapapeles');
                                    }}
                                    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-brand-teal transition-all"
                                    title="Copiar RUC"
                                >
                                    <LucideIcons.Copy size={11} />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                            title="Cerrar Sesión"
                        >
                            <LucideIcons.LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
                {/* 🎚️ Zen Navigation Tabs (Mobile & PC Responsive) */}
                <div className="flex justify-center mb-8 sm:mb-16">
                    <div className="inline-flex p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl sm:rounded-[2rem] border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-inner w-full sm:w-auto overflow-x-auto">
                        {[
                            { id: 'overview', label: 'Centro de Mando', icon: LucideIcons.LayoutDashboard },
                            { id: 'metrics', label: 'Mis Métricas', icon: LucideIcons.BarChart3 },
                            { id: 'vault', label: 'Bóveda', icon: LucideIcons.ShieldCheck },
                            { id: 'timeline', label: 'Cronograma', icon: LucideIcons.Activity },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-3xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl dark:bg-slate-800 text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 ring-1 ring-brand-teal/20 scale-105'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                <tab.icon size={15} strokeWidth={activeTab === tab.id ? 2.5 : 2} className={activeTab === tab.id ? 'text-brand-teal' : ''} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────
                    CENTRO DE MANDO (OVERVIEW)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-16 animate-fade-in-up">
                        <section className="relative overflow-hidden p-12 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-[4rem] border border-slate-100 dark:border-white/5 shadow-premium group">
                             <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
                             <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -ml-20 -mb-20"></div>

                             <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
                                <div className="space-y-8">
                                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] border border-slate-100 dark:border-white/5/60 transition-colors hover:border-teal-200">
                                        <div className={`w-2 h-2 rounded-full ${healthConfig.dot}`}></div>
                                        {localClient.regime}
                                    </div>
                                    <h2 className="text-5xl tracking-tighter sm:text-7xl font-display font-medium text-slate-900 tracking-tighter leading-[1.05] mb-2">
                                        Estatus<br /><span className="text-slate-400">Garantizado.</span>
                                    </h2>
                                    <p className="text-slate-500 font-medium max-w-md text-lg leading-relaxed antialiased">
                                        Gestionamos su cumplimiento fiscal con precisión quirúrgica para garantizar su tranquilidad patrimonial.
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-8 bg-slate-50/50 p-10 rounded-[3.5rem] border border-slate-100 dark:border-white/5 backdrop-blur-sm">
                                    <HealthGauge score={compliance.score} color={compliance.overallColor} />
                                    <div className="text-center">
                                        <p className={`text-xs font-bold uppercase tracking-[0.3em] mb-1 ${healthConfig.text}`}>{healthConfig.label}</p>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cumplimiento Global</p>
                                    </div>
                                </div>
                             </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                             <BankCardPremium clientName={localClient.name} />

                             <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-12 rounded-[4rem] border border-slate-100 dark:border-white/5 shadow-premium flex flex-col items-center justify-center text-center group">
                                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 shadow-lg shadow-teal-100/20">
                                    <LucideIcons.MessageSquareQuote size={32} />
                                </div>
                                <h4 className="text-3xl tracking-tighter font-display font-medium text-slate-900 mb-3 tracking-tight">Comunicación Directa</h4>
                                <p className="text-slate-500 text-base mb-10 leading-relaxed max-w-xs">
                                    Su asesor personal está a un clic de distancia para cualquier consulta técnica.
                                </p>
                                <a
                                    href="https://wa.me/593978980722"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-[2rem] hover:bg-teal-600 transition-all active:scale-95 shadow-2xl shadow-slate-200"
                                >
                                    Abrir WhatsApp Ejecutivo
                                </a>
                             </div>
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    MIS MÉTRICAS & ANÁLISIS FINANCIERO (CHARTS)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'metrics' && (
                    <div className="animate-fade-in-up">
                        <FinancialMetricsOverview client={localClient} theme="dark" />
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    BÓVEDA (VAULT) – Facturación, Credenciales & Documentos KYC
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'vault' && (
                    <div className="space-y-14 animate-fade-in-up">

                        {/* ── SECCIÓN: Facturación Electrónica & Licencia ───────── */}
                        <section className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 sm:p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-premium relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-white/5 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-teal-50 text-brand-teal rounded-2xl flex items-center justify-center shadow-lg shadow-teal-100/40 flex-shrink-0">
                                        <LucideIcons.Receipt size={28} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Sistema de Emisión</p>
                                        <h3 className="text-2xl sm:text-3xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Facturación Electrónica</h3>
                                    </div>
                                </div>

                                {localClient.facturadorConfig?.url && (
                                    <a
                                        href={localClient.facturadorConfig.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-brand-teal text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-200"
                                    >
                                        <span>Abrir Portal de Facturación</span>
                                        <LucideIcons.ExternalLink size={14} />
                                    </a>
                                )}
                            </div>

                            {/* Badge especial de Proveedor Santiago Córdova */}
                            {(localClient.facturadorConfig?.soldByMe || (localClient.facturadorConfig?.providerName && localClient.facturadorConfig.providerName.toLowerCase().includes('santiago'))) && (
                                <div className="mb-8 p-5 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 border border-teal-500/25 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand-teal text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                                            <LucideIcons.ShieldCheck size={22} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                                                Proveedor Oficial: {localClient.facturadorConfig?.providerName || 'Santiago Córdova'}
                                            </p>
                                            <p className="text-xs text-teal-700 font-medium">
                                                Garantía de Servicio: Incluye <strong>Soporte Técnico Especializado</strong> y <strong>Anulación de Facturas Gratis</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-3.5 py-1.5 bg-brand-teal text-white text-[10px] font-bold uppercase tracking-widest rounded-full flex-shrink-0 shadow-md">
                                        Soporte Gratuito Incluido
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Programa */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Programa / Sistema</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {localClient.facturadorConfig?.programName || 'No configurado'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Proveedor: {localClient.facturadorConfig?.providerName || (localClient.facturadorConfig?.soldByMe ? 'Santiago Córdova' : 'Externo')}
                                    </p>
                                </div>

                                {/* Plan / Documentos */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Plan de Comprobantes</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {localClient.facturadorConfig?.documentStatus || 'Modalidad no definida'}
                                    </p>
                                    <p className="text-[11px] text-teal-600 font-semibold mt-1">
                                        {localClient.facturadorConfig?.documentCount !== undefined
                                            ? `Cupo: ${localClient.facturadorConfig.documentCount} docs`
                                            : 'Cupo Ilimitado'}
                                    </p>
                                </div>

                                {/* Vencimiento */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vencimiento Licencia</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {localClient.facturadorConfig?.expirationDate
                                            ? safeFormat(localClient.facturadorConfig.expirationDate, 'dd/MM/yyyy')
                                            : 'Sin fecha registrada'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Precio Vendido: ${localClient.facturadorConfig?.price?.toFixed(2) || '0.00'}
                                    </p>
                                </div>

                                {/* Credencial Facturador */}
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Acceso Facturador</p>
                                        <p className="text-xs font-mono font-bold text-slate-700 truncate">
                                            Usuario: {localClient.facturadorConfig?.username || 'No registrado'}
                                        </p>
                                    </div>
                                    <div className="mt-2 text-xs font-mono text-slate-500 flex items-center justify-between">
                                        <span>Clave: ••••••••</span>
                                        {localClient.facturadorConfig?.password && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(localClient.facturadorConfig?.password || '');
                                                    alert('Clave del facturador copiada al portapapeles');
                                                }}
                                                className="text-[10px] font-bold text-brand-teal hover:underline uppercase"
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
                            <div className="flex items-center justify-between mb-8 px-2">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Accesos Digitales</p>
                                    <h3 className="text-3xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Credenciales Guardadas</h3>
                                </div>
                                <button
                                    onClick={() => setShowChangePassword(true)}
                                    className="flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-teal-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    <LucideIcons.KeyRound size={14} />
                                    Cambiar Clave SRI
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex items-center gap-5">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <LucideIcons.Fingerprint size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Firma Electrónica (.P12)</p>
                                        {signatureExpiry ? (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${signatureExpired ? 'text-rose-500' : signatureWarning ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                    {signatureExpired
                                                        ? '⚠ Firma vencida'
                                                        : signatureWarning
                                                            ? `Vence en ${signatureDaysLeft} días`
                                                            : `Vigente · ${signatureDaysLeft}d restantes`}
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-300 italic">Sin fecha registrada</p>
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
                            <div className="mb-8 px-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Identidad Digital Certificada</p>
                                <h3 className="text-3xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Verificación de Cédula & Biometría</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Cédula Frente */}
                                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col justify-between group hover:border-teal-300 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                                                <LucideIcons.Contact size={24} />
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${localClient.idCardFront ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                                                {localClient.idCardFront ? 'Verificado' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-slate-900 mb-1">Cédula (Frente)</h4>
                                        <p className="text-xs text-slate-400 mb-4">Fotografía clara del anverso del documento de identidad.</p>
                                    </div>

                                    {localClient.idCardFront ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardFront })}
                                            className="w-full py-3 bg-slate-900 hover:bg-brand-teal text-white text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <LucideIcons.Eye size={14} /> Ver Cédula Frente
                                        </button>
                                    ) : (
                                        <div className="py-3 bg-slate-50 text-slate-300 text-xs font-semibold rounded-2xl text-center border border-dashed border-slate-200">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>

                                {/* Cédula Reverso */}
                                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col justify-between group hover:border-teal-300 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                                <LucideIcons.CreditCard size={24} />
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${localClient.idCardBack ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                                                {localClient.idCardBack ? 'Verificado' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-slate-900 mb-1">Cédula (Reverso)</h4>
                                        <p className="text-xs text-slate-400 mb-4">Fotografía clara del reverso con código de dactilar.</p>
                                    </div>

                                    {localClient.idCardBack ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardBack })}
                                            className="w-full py-3 bg-slate-900 hover:bg-brand-teal text-white text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <LucideIcons.Eye size={14} /> Ver Cédula Reverso
                                        </button>
                                    ) : (
                                        <div className="py-3 bg-slate-50 text-slate-300 text-xs font-semibold rounded-2xl text-center border border-dashed border-slate-200">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>

                                {/* Selfie Sosteniendo Cédula */}
                                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col justify-between group hover:border-teal-300 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                                                <LucideIcons.UserCheck size={24} />
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${localClient.idCardSelfie ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                                                {localClient.idCardSelfie ? 'Biometría OK' : 'No Disponible'}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-display font-bold text-slate-900 mb-1">Selfie sosteniendo Cédula</h4>
                                        <p className="text-xs text-slate-400 mb-4">Fotografía del rostro sosteniendo el documento de identidad.</p>
                                    </div>

                                    {localClient.idCardSelfie ? (
                                        <button
                                            onClick={() => handleOpenInNewTab({ proof_file: localClient.idCardSelfie })}
                                            className="w-full py-3 bg-slate-900 hover:bg-brand-teal text-white text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <LucideIcons.Eye size={14} /> Ver Foto Selfie
                                        </button>
                                    ) : (
                                        <div className="py-3 bg-slate-50 text-slate-300 text-xs font-semibold rounded-2xl text-center border border-dashed border-slate-200">
                                            Pendiente de Carga
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── SECCIÓN: Archivos Principales ─────────────────────── */}
                        <section>
                            <div className="mb-8 px-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Documentos Certificados</p>
                                <h3 className="text-3xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Expediente Digital</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Firma electrónica .p12 */}
                                <div
                                    onClick={() => hasSignatureFile && handleDownloadFile(localClient.signatureFile!)}
                                    className={`bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border transition-all group ${hasSignatureFile
                                        ? 'border-slate-100 dark:border-white/5 cursor-pointer hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/30 hover:-translate-y-1 active:scale-[0.98]'
                                        : 'border-dashed border-slate-200 opacity-50'}`}
                                >
                                    <div className="w-14 h-14 bg-violet-50 text-violet-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <LucideIcons.FileKey size={26} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Firma Electrónica (.p12)</p>
                                    <h4 className="text-lg font-display font-semibold text-slate-900 mb-2">
                                        {hasSignatureFile ? localClient.signatureFile!.name : 'Token .P12'}
                                    </h4>
                                    <p className="text-xs text-slate-400">
                                        {hasSignatureFile ? 'Clic para descargar' : 'No cargado aún'}
                                    </p>
                                    {hasSignatureFile && (
                                        <div className="mt-4 flex items-center gap-2 text-teal-600 text-xs font-bold">
                                            <LucideIcons.Download size={13} /> Descargar .p12
                                        </div>
                                    )}
                                </div>

                                {/* Certificado RUC */}
                                <div
                                    onClick={() => hasRucFile && handleRucPreview()}
                                    className={`bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border transition-all group ${hasRucFile
                                        ? 'border-slate-100 dark:border-white/5 cursor-pointer hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/30 hover:-translate-y-1 active:scale-[0.98]'
                                        : 'border-dashed border-slate-200 opacity-50'}`}
                                >
                                    <div className="w-14 h-14 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <LucideIcons.FileText size={26} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Certificado RUC</p>
                                    <h4 className="text-lg font-display font-semibold text-slate-900 mb-2">
                                        {(localClient.rucCertificate || localClient.rucPdf)?.name || 'Documento RUC'}
                                    </h4>
                                    <p className="text-xs text-slate-400">
                                        {hasRucFile ? 'Clic para visualizar' : 'No cargado aún'}
                                    </p>
                                    {hasRucFile && (
                                        <div className="mt-4 flex items-center gap-2 text-teal-600 text-xs font-bold">
                                            <LucideIcons.ExternalLink size={13} /> Ver PDF
                                        </div>
                                    )}
                                </div>

                                {/* Resolución Devolución IVA / Renta */}
                                {hasRentaRefundProof && (
                                    <div
                                        onClick={() => handleOpenInNewTab({ proof_file: localClient.rentaRefundProof })}
                                        className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 cursor-pointer hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/30 hover:-translate-y-1 active:scale-[0.98] transition-all group"
                                    >
                                        <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <LucideIcons.BadgeDollarSign size={26} />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Devolución Renta/IVA</p>
                                        <h4 className="text-lg font-display font-semibold text-slate-900 mb-2">{localClient.rentaRefundProof!.name}</h4>
                                        <div className="mt-4 flex items-center gap-2 text-teal-600 text-xs font-bold">
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
                                        className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 cursor-pointer hover:border-teal-300 hover:shadow-xl hover:shadow-teal-100/30 hover:-translate-y-1 active:scale-[0.98] transition-all group"
                                    >
                                        <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <LucideIcons.File size={26} />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Documento</p>
                                        <h4 className="text-lg font-display font-semibold text-slate-900 mb-2 truncate">{file.name}</h4>
                                        <div className="mt-4 flex items-center gap-2 text-teal-600 text-xs font-bold">
                                            {file.name.endsWith('.pdf') ? <><LucideIcons.ExternalLink size={13} /> Ver PDF</> : <><LucideIcons.Download size={13} /> Descargar</>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!hasSignatureFile && !hasRucFile && vaultFiles.length === 0 && !hasRentaRefundProof && (
                                <div className="py-24 text-center bg-slate-50/60 rounded-[4rem] border-2 border-dashed border-slate-200 mt-4">
                                    <div className="w-20 h-20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
                                        <LucideIcons.FolderOpen size={32} className="text-slate-200" />
                                    </div>
                                    <h4 className="text-2xl font-display font-medium text-slate-700 mb-2">Sin documentos aún</h4>
                                    <p className="text-slate-400 font-medium max-w-xs mx-auto">Su asesor cargará sus documentos certificados a medida que los procese.</p>
                                </div>
                            )}
                        </section>

                        {/* ── SECCIÓN: Declaraciones PDF ────────────────────────── */}
                        <section>
                            <div className="mb-8 px-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Historial Tributario</p>
                                <h3 className="text-3xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Declaraciones</h3>
                            </div>

                            {localClient.declarations && localClient.declarations.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...localClient.declarations].reverse().map((decl, idx) => {
                                        const isPaid = decl.status === 'Pagada' || !!decl.is_paid;
                                        const hasPdf = !!decl.proof_file?.content || !!decl.proof_file?.url;
                                        return (
                                            <div key={idx} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-premium transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-200/50 group">
                                                <div className="flex justify-between items-start mb-8">
                                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                                                        <LucideIcons.FileCheck size={28} />
                                                    </div>
                                                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 dark:border-white/5'}`}>
                                                        {decl.status}
                                                    </div>
                                                </div>

                                                <div className="space-y-1 mb-8">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{decl.type || 'IVA'}</p>
                                                    <h4 className="text-2xl font-display font-medium text-slate-900">{formatPeriodForDisplay(decl.period)}</h4>
                                                    <p className="text-xs text-slate-400 font-medium">{safeFormat(decl.updatedAt, 'MMMM dd, yyyy')}</p>
                                                </div>

                                                <div className="flex gap-3 pt-6 border-t border-slate-50">
                                                    <button
                                                        onClick={() => handleOpenInNewTab(decl)}
                                                        disabled={!hasPdf}
                                                        className={`flex-1 h-12 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 ${hasPdf ? 'bg-slate-900 text-white hover:bg-teal-600 shadow-md' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                                                    >
                                                        <LucideIcons.ExternalLink size={14} /> Abrir
                                                    </button>
                                                    <button
                                                        onClick={() => decl.proof_file && handleDownloadFile(decl.proof_file)}
                                                        disabled={!hasPdf}
                                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${hasPdf ? 'bg-slate-50 text-slate-400 hover:bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl hover:text-slate-900 hover:border-slate-200 border-transparent' : 'bg-slate-50 text-slate-200 border-transparent cursor-not-allowed'}`}
                                                    >
                                                        <LucideIcons.Download size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-20 text-center bg-slate-50/60 rounded-[4rem] border-2 border-dashed border-slate-200">
                                    <div className="w-20 h-20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
                                        <LucideIcons.CloudOff size={32} className="text-slate-200" />
                                    </div>
                                    <h4 className="text-2xl font-display font-medium text-slate-900 mb-2">Sin declaraciones</h4>
                                    <p className="text-slate-400 font-medium">No se han sincronizado expedientes para este ejercicio fiscal.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────
                    CRONOGRAMA (TIMELINE)
                ────────────────────────────────────────────────────────── */}
                {activeTab === 'timeline' && (
                    <div className="max-w-3xl mx-auto animate-fade-in-up">
                        <section className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-[4rem] p-16 border border-slate-100 dark:border-white/5 shadow-premium">
                            <header className="text-center mb-16">
                                <span className="inline-block px-4 py-1.5 bg-teal-50 text-teal-600 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-4 border border-teal-100">Planificación 2024</span>
                                <h3 className="text-5xl tracking-tighter font-display font-medium text-slate-900 tracking-tight">Timeline Fiscal</h3>
                                <p className="text-slate-400 text-sm mt-5 font-medium leading-relaxed max-w-sm mx-auto">
                                    Próximos hitos obligatorios según el calendario regulatorio para su terminación de RUC (<span className="text-slate-900 font-bold">{localClient.ruc[8]}</span>).
                                </p>
                            </header>

                            <div className="relative pl-4 overflow-hidden">
                                {compliance.obligations.filter(ob => ob.color !== 'gray').map((ob, idx) => (
                                    <TimelineItem key={idx} ob={ob} />
                                ))}

                                {compliance.obligations.filter(ob => ob.color === 'gray').length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center mb-8">Periodos Completados o Futuros</p>
                                        <div className="opacity-40 grayscale pointer-events-none">
                                            {compliance.obligations.filter(ob => ob.color === 'gray').slice(0, 2).map((ob, idx) => (
                                                <TimelineItem key={`gray-${idx}`} ob={ob} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <footer className="mt-16 p-8 bg-slate-50/80 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-start gap-5">
                                <div className="w-10 h-10 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl rounded-xl flex items-center justify-center text-teal-600 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                                    <LucideIcons.ShieldAlert size={20} />
                                </div>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed antialiased">
                                    <strong className="text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">Nota de Seguridad:</strong>
                                    Baku monitorea su calendario diariamente. Las fechas mostradas consideran feriados locales y ajustes proactivos para evitar multas.
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