import React from 'react';
import { Client, TaxRegime, Declaration } from '../../../../types';
import { getPeriod, formatPeriodForDisplay } from '../../../../services/sri';
import * as LucideIcons from 'lucide-react';
import { VaultCard } from '../VaultCard';
import { ClientNotes } from '../ClientNotes';
import { ClientNote } from '../../../../types';

interface VaultTabProps {
    client: Client;
    editedClient: Client;
    setEditedClient: React.Dispatch<React.SetStateAction<Client>>;
    isEditing: boolean;
    vaultViewMode: 'gallery' | 'list' | 'table';
    setVaultViewMode: (mode: 'gallery' | 'list' | 'table') => void;
    setUploadingTarget: (target: { type: string; period?: string } | null) => void;
    proofInputRef: React.RefObject<HTMLInputElement>;
    setPreviewItem: (item: Declaration | null) => void;
    notes: ClientNote[];
}

export const VaultTab: React.FC<VaultTabProps> = ({
    client,
    editedClient,
    setEditedClient,
    isEditing,
    vaultViewMode,
    setVaultViewMode,
    setUploadingTarget,
    proofInputRef,
    setPreviewItem,
    notes
}) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Top Security Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <VaultCard icon={LucideIcons.ScanLine} label="Certificado RUC" file={editedClient.rucCertificate} onUpload={(f) => setEditedClient({ ...editedClient, rucCertificate: f })} />
                <VaultCard icon={LucideIcons.FileText} label="Otros RUC PDF" file={editedClient.rucPdf} onUpload={(f) => setEditedClient({ ...editedClient, rucPdf: f })} />
                <VaultCard icon={LucideIcons.FileKey} label="Firma Electrónica" file={editedClient.signatureFile} onUpload={(f) => setEditedClient({ ...editedClient, signatureFile: f })} />
                {(editedClient.rentaRefundResolutionFile || editedClient.elderlyDevolucionIvaResolutionFile) ? (
                    <VaultCard 
                        icon={LucideIcons.ShieldCheck} 
                        label={editedClient.rentaRefundResolutionFile ? "Resolución Renta" : "Resolución T.EDAD"} 
                        file={editedClient.rentaRefundResolutionFile || editedClient.elderlyDevolucionIvaResolutionFile} 
                        onUpload={(f) => {
                            if (editedClient.rentaRefundResolutionFile) setEditedClient({ ...editedClient, rentaRefundResolutionFile: f });
                            else setEditedClient({ ...editedClient, elderlyDevolucionIvaResolutionFile: f });
                        }} 
                    />
                ) : (
                    <VaultCard icon={LucideIcons.Smartphone} label="Clave SRI" file={undefined} isPassword value={client.sriPassword} />
                )}
            </div>

            {/* Simplificación Zen: Notas Directas en lugar de Facturador complejo */}
            <div className="grid grid-cols-1 gap-8">
                <div className="min-h-[300px]">
                    <ClientNotes clientId={client.id} notes={notes} />
                </div>
            </div>

            {/* Document Repository - Modularized Section */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-slate-200/50 dark:border-white/10 relative overflow-hidden group shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all duration-500 hover:shadow-primary/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <LucideIcons.Store className="text-primary" size={24} />
                            </div>
                            Repositorio de Documentos
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mt-3 font-premium">Gestión centralizada de archivos y comprobantes</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-1.5 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-white/5 flex gap-1 shadow-sm backdrop-blur-md">
                            {(['gallery', 'list', 'table'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setVaultViewMode(mode)}
                                    className={`px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] transition-all font-premium ${
                                        vaultViewMode === mode 
                                            ? 'bg-white dark:bg-primary/20 text-primary shadow-lg shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-primary/30' 
                                            : 'text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-white/50 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {mode === 'gallery' ? 'Galería' : mode === 'list' ? 'Lista' : 'Tabla'}
                                </button>
                            ))}
                        </div>
                        <div className="hidden sm:flex px-6 py-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-[9px] font-bold text-emerald-600 dark:text-emerald-400 items-center gap-3 border border-emerald-100 dark:border-emerald-500/20 shadow-sm uppercase tracking-[0.2em] font-premium">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            {(client.declarations || []).filter(d => d.proof_file).length} Archivos Protegidos
                        </div>
                    </div>
                </div>

                {vaultViewMode === 'gallery' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <button
                            onClick={() => { setUploadingTarget({ type: 'iva', period: '2024-03' }); proofInputRef.current?.click(); }}
                            className="aspect-square rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden shadow-sm bg-white/30 dark:bg-white/5 backdrop-blur-sm"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-100 dark:border-white/5 relative z-10 shadow-sm">
                                <LucideIcons.Plus className="text-slate-300 group-hover:text-primary" size={32} />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-primary tracking-widest relative z-10 font-premium">Subir Nuevo</span>
                        </button>

                        {[...(client.declarations || [])]
                            .filter(d => d.proof_file)
                            .sort((a, b) => b.period.localeCompare(a.period))
                            .map((decl, idx) => (
                                <div 
                                    key={idx} 
                                    className="bg-white/60 dark:bg-white/5 rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 hover:scale-[1.03] shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all cursor-pointer group relative overflow-hidden" 
                                    onClick={() => setPreviewItem(decl)}
                                >
                                    <div className="aspect-[4/3] rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 mb-6 flex items-center justify-center relative overflow-hidden group-hover:bg-primary/5 transition-all duration-500">
                                        <LucideIcons.FileText className="text-slate-200 dark:text-slate-700 group-hover:text-primary group-hover:scale-110 transition-all duration-700" size={48} />
                                        {decl.proof_file?.metadata?.formType && (
                                            <div className="absolute top-4 left-4 px-3 py-1 bg-primary text-white text-[9px] font-bold rounded-lg uppercase tracking-widest shadow-lg shadow-primary/20 font-premium">
                                                {decl.proof_file.metadata.formType}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-xl translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                <LucideIcons.Eye className="text-primary" size={24} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight font-premium">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1 font-premium">{formatPeriodForDisplay(decl.period)}</span>
                                            </div>
                                            <button className="p-3 bg-slate-50 dark:bg-white/5 hover:bg-primary hover:text-white rounded-xl text-slate-300 transition-all shadow-sm">
                                                <LucideIcons.Download size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {vaultViewMode === 'list' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-5 duration-500">
                        <button
                            onClick={() => { setUploadingTarget({ type: 'iva', period: '2024-03' }); proofInputRef.current?.click(); }}
                            className="w-full p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm font-premium"
                        >
                            <LucideIcons.Plus className="text-slate-400 group-hover:text-primary" size={20} />
                            <span className="text-[11px] font-black uppercase text-slate-400 group-hover:text-primary tracking-widest">Subir Nuevo Documento al Repositorio</span>
                        </button>

                        {[...(client.declarations || [])]
                            .filter(d => d.proof_file)
                            .sort((a, b) => b.period.localeCompare(a.period))
                            .map((decl, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-[2rem] p-6 border border-slate-100 dark:border-white/5 flex items-center justify-between shadow-sm hover:shadow-lg transition-all group cursor-pointer" onClick={() => setPreviewItem(decl)}>
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-surface-low border border-slate-100 dark:border-white/5 flex items-center justify-center shadow-sm group-hover:bg-primary/10 transition-colors">
                                            <LucideIcons.FileText className="text-slate-400 group-hover:text-primary" size={28} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white font-premium tracking-tight uppercase">Comprobante de {formatPeriodForDisplay(decl.period)}</h4>
                                            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest font-premium truncate max-w-[200px]">{decl.proof_file?.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="text-right">
                                            <span className="block text-[13px] font-black text-emerald-600 font-premium">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-premium">Monto Validado</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="p-3 bg-white dark:bg-white/5 hover:bg-slate-900 dark:hover:bg-primary hover:text-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-100 dark:border-white/5">
                                                <LucideIcons.Download size={16} />
                                            </button>
                                            <button className="p-3 bg-white dark:bg-white/5 hover:bg-primary hover:text-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-100 dark:border-white/5">
                                                <LucideIcons.Eye size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {vaultViewMode === 'table' && (
                    <div className="bg-white dark:bg-surface-low rounded-[2.5rem] border border-slate-100 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-right-5 duration-500">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">Documento</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">Periodo</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium">Monto</th>
                                    <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-premium pr-12">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-low">
                                {[...(client.declarations || [])]
                                    .filter(d => d.proof_file)
                                    .sort((a, b) => b.period.localeCompare(a.period))
                                    .map((decl, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setPreviewItem(decl)}>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                        <LucideIcons.FileText size={18} />
                                                    </div>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-50 uppercase tracking-tight font-premium truncate max-w-[150px]">{decl.proof_file?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-premium">{formatPeriodForDisplay(decl.period)}</span>
                                            </td>
                                            <td className="px-10 py-6">
                                                <span className="text-[12px] font-extrabold text-slate-900 dark:text-white font-premium">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="px-10 py-6 text-right pr-12">
                                                <div className="flex justify-end gap-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm">
                                                        <LucideIcons.Download size={16} />
                                                    </button>
                                                    <button className="p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm">
                                                        <LucideIcons.Eye size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
