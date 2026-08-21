import React, { useCallback, useState } from 'react';
import { Client, TaxRegime, Declaration, StoredFile, ClientNote } from '../../../../types';
import { getPeriod, formatPeriodForDisplay } from '../../../../services/sri';
import * as LucideIcons from 'lucide-react';
import { VaultCard } from '../VaultCard';
import { ClientNotes } from '../ClientNotes';
import { FacturadorCard } from '../FacturadorCard';
import { SalesComboModal } from '../../SalesComboModal';
import { extractP12Metadata } from '../../../../utils/p12Reader';
import { useDropzone } from 'react-dropzone';
import { SupabaseService } from '../../../../services/supabaseClientService';
import { useToast } from '../../../../context/ToastContext';

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
    onDownloadFile?: (file: any) => void;
    onUpdateClientDirect?: (updates: Partial<Client>, showNotification?: boolean) => Promise<void>;
    onOpenAnulacionSRI?: () => void;
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
    notes,
    onDownloadFile,
    onUpdateClientDirect,
    onOpenAnulacionSRI
}) => {
    const [isVaultEditing, setIsVaultEditing] = React.useState(false);
    const [isSavingVault, setIsSavingVault] = React.useState(false);
    const [vaultSaved, setVaultSaved] = React.useState(false);
    const [isSalesModalOpen, setIsSalesModalOpen] = React.useState(false);
    const { toast } = useToast();

    // Estado para calculadora de facturación gestionada por despacho
    const [managedInvoicesCount, setManagedInvoicesCount] = React.useState<number>(0);
    const [managedAnulationsCount, setManagedAnulationsCount] = React.useState<number>(0);

    const calculatedEmissionFee = React.useMemo(() => {
        if (managedInvoicesCount === 0 && managedAnulationsCount === 0) return 0;
        let fee = 0;
        if (managedInvoicesCount === 1) fee += 2;
        else if (managedInvoicesCount >= 2 && managedInvoicesCount <= 5) fee += 5;
        else if (managedInvoicesCount >= 6 && managedInvoicesCount <= 15) fee += 10;
        else if (managedInvoicesCount > 15) fee += 20;
        fee += managedAnulationsCount * 1.5;
        return fee;
    }, [managedInvoicesCount, managedAnulationsCount]);

    const handleSendInvoicingWhatsApp = () => {
        const phone = client.phones?.[0] || '';
        const cleanPhone = phone.replace(/\D/g, '');
        const text = encodeURIComponent(`Hola ${client.name}, le saludamos de Soluciones Contables Pro. Le informamos el detalle de emisión de facturación de este período: ${managedInvoicesCount} facturas y ${managedAnulationsCount} anulaciones emitidas por un valor de $${calculatedEmissionFee.toFixed(2)}. Saludos cordiales.`);
        window.open(`https://wa.me/${cleanPhone.startsWith('593') ? cleanPhone : '593' + cleanPhone.replace(/^0/, '')}?text=${text}`, '_blank');
    };

    const handleSaveManagedInvoicing = async () => {
        if (onUpdateClientDirect) {
            await onUpdateClientDirect({
                notes: `${client.notes || ''}\n[${new Date().toISOString().substring(0, 10)}] Gestión Facturación: ${managedInvoicesCount} facturas, ${managedAnulationsCount} anulaciones ($${calculatedEmissionFee.toFixed(2)})`
            }, true);
            toast.success('Registro de facturación guardado exitosamente');
        }
    };

    // Estado para metadatos de firma .p12 decodificada en tiempo real
    const [p12Meta, setP12Meta] = React.useState<any>(null);
    const [p12Error, setP12Error] = React.useState<string>('');

    const onUpdateClientDirectRef = React.useRef(onUpdateClientDirect);
    React.useEffect(() => {
        onUpdateClientDirectRef.current = onUpdateClientDirect;
    }, [onUpdateClientDirect]);

    React.useEffect(() => {
        const fileContent = editedClient.signatureFile?.content;
        const password = editedClient.electronicSignaturePassword;
        if (!fileContent) {
            setP12Meta(null);
            setP12Error('');
            return;
        }

        try {
            const meta = extractP12Metadata(fileContent, password);
            setP12Meta(meta);
            setP12Error('');

            const formattedExp = meta.notAfter.toISOString().split('T')[0];
            const formattedIssue = meta.notBefore.toISOString().split('T')[0];

            if (editedClient.signatureExpirationDate !== formattedExp || 
                editedClient.signatureProvider !== meta.issuerName ||
                editedClient.signatureIssueDate !== formattedIssue) {
                
                setEditedClient(prev => ({
                    ...prev,
                    signatureExpirationDate: formattedExp,
                    signatureIssueDate: formattedIssue,
                    signatureProvider: meta.issuerName
                }));

                // Auto-guardar inmediatamente los metadatos en segundo plano sin toasts ruidosos
                if (onUpdateClientDirectRef.current) {
                    onUpdateClientDirectRef.current({
                        signatureExpirationDate: formattedExp,
                        signatureIssueDate: formattedIssue,
                        signatureProvider: meta.issuerName,
                        electronicSignaturePassword: password
                    }, false);
                }
            }
        } catch (err: any) {
            setP12Meta(null);
            if (password) {
                setP12Error('Contraseña incorrecta o firma corrupta.');
            } else {
                setP12Error('Se requiere la contraseña de la firma para descifrar.');
            }
        }
    }, [editedClient.signatureFile?.content, editedClient.electronicSignaturePassword, editedClient.signatureExpirationDate, editedClient.signatureProvider, editedClient.signatureIssueDate, setEditedClient]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file || !onUpdateClientDirect) return;

        toast.info(`Subiendo ${file.name} a la bóveda...`);

        try {
            const fileDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const fileExt = file.name.split('.').pop() || '';
            const path = `${client.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const uploadResult = await SupabaseService.uploadFileToStorage('clients-vault', path, fileDataUrl);

            const isP12 = file.name.toLowerCase().endsWith('.p12') || file.name.toLowerCase().endsWith('.pfx');
            
            const newStoredFile: StoredFile = {
                name: file.name,
                type: isP12 ? 'p12' : (file.type.startsWith('image/') ? 'image' : 'pdf'),
                size: file.size,
                lastModified: file.lastModified,
                url: uploadResult.url,
                bucketPath: uploadResult.path
            };

            const updatedDeclarations = [...(editedClient.declarations || [])];
            
            // Add as a new empty declaration with proof file for the vault repository
            updatedDeclarations.push({
                period: formatPeriodForDisplay(new Date().toISOString().substring(0, 7)),
                type: 'ANEXO',
                status: 'Pendiente' as any, // DeclarationStatus
                updatedAt: new Date().toISOString(),
                proof_file: newStoredFile
            });
            
            setEditedClient({ ...editedClient, declarations: updatedDeclarations });
            await onUpdateClientDirect({ declarations: updatedDeclarations }, false);
            toast.success('Archivo subido al repositorio exitosamente');
            
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Error al subir archivo");
        }
    }, [client.id, editedClient, onUpdateClientDirect, setEditedClient]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true,
        noKeyboard: true
    });

    const handleSaveVault = async () => {
        if (!onUpdateClientDirect) return;
        setIsSavingVault(true);
        try {
            await onUpdateClientDirect({
                sriPassword: editedClient.sriPassword,
                electronicSignaturePassword: editedClient.electronicSignaturePassword,
                facturadorConfig: editedClient.facturadorConfig,
                signatureExpirationDate: editedClient.signatureExpirationDate,
                signatureIssueDate: editedClient.signatureIssueDate,
                signatureProvider: editedClient.signatureProvider,
            }, true);
            setVaultSaved(true);
            setIsVaultEditing(false);
            setTimeout(() => setVaultSaved(false), 3000);
        } catch (e) {
            console.error('Error guardando bóveda:', e);
        } finally {
            setIsSavingVault(false);
        }
    };

    const handleUploadField = async (field: keyof Client, file: StoredFile) => {
        if (isEditing) {
            setEditedClient({ ...editedClient, [field]: file });
        } else {
            setEditedClient({ ...editedClient, [field]: file });
            if (onUpdateClientDirect) {
                await onUpdateClientDirect({ [field]: file }, true);
            }
        }
    };

    const handleDeleteField = async (field: keyof Client) => {
        if (isEditing) {
            const updated = { ...editedClient };
            delete updated[field];
            setEditedClient(updated);
        } else {
            const updated = { ...editedClient };
            delete updated[field];
            setEditedClient(updated);
            if (onUpdateClientDirect) {
                await onUpdateClientDirect({ [field]: null as any }, true);
            }
        }
    };
    return (
        <div {...getRootProps()} className="relative space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 h-full">
            <input {...getInputProps()} />
            {isDragActive && (
                <div className="absolute inset-0 z-50 bg-[#051424]/95 backdrop-blur-md rounded-3xl border-2 border-dashed border-[#00A896] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-28 h-28 bg-[#00A896]/20 rounded-full flex items-center justify-center mb-5 animate-pulse shadow-[0_0_30px_rgba(0,168,150,0.3)]">
                        <LucideIcons.UploadCloud size={56} className="text-[#00A896]" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-widest uppercase font-display">Suelta para Subir a Bóveda</h2>
                    <p className="text-[#00A896] font-mono font-medium text-sm mt-2">El archivo se encriptará y almacenará en el repositorio seguro</p>
                </div>
            )}

            {/* Encabezado Premium Bóveda (Stitch Obsidian Glass) */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl border border-white/10 border-t-white/20">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#00A896]/10 blur-[90px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#2B6AFF]/10 blur-[70px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#00A896]/15 backdrop-blur-md border border-[#00A896]/30 flex items-center justify-center text-[#00A896] shadow-lg shadow-[#00A896]/20">
                            <LucideIcons.Shield size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3 font-display">
                                Bóveda & Credenciales <span className="px-2.5 py-1 bg-[#00A896]/15 text-[#00A896] text-[9px] font-mono font-bold uppercase tracking-widest rounded-full border border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]">Encriptación Activa</span>
                            </h2>
                            <p className="text-slate-300 font-medium text-xs mt-1 max-w-lg">
                                Bóveda de seguridad militar. Administra certificados `.p12`, llaves privadas, expedientes de tramitación y facturadores electrónicos.
                            </p>
                        </div>
                    </div>
                    {/* Botones de Edición de Bóveda */}
                    <div className="flex items-center gap-3 flex-shrink-0 font-mono">
                        {vaultSaved && (
                            <span className="flex items-center gap-1.5 text-[#00A896] text-xs font-bold animate-in fade-in">
                                <LucideIcons.CheckCircle size={14} /> Guardado
                            </span>
                        )}
                        {isVaultEditing ? (
                            <>
                                <button
                                    onClick={() => setIsVaultEditing(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white rounded-xl border border-white/10 hover:border-white/30 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveVault}
                                    disabled={isSavingVault}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00A896]/25 active:scale-95 disabled:opacity-50 border border-white/10"
                                >
                                    {isSavingVault ? <LucideIcons.Loader size={13} className="animate-spin" /> : <LucideIcons.Save size={13} />}
                                    {isSavingVault ? 'Guardando...' : '💾 Guardar Bóveda'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsVaultEditing(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 hover:border-white/20 active:scale-95 shadow-md"
                            >
                                <LucideIcons.Edit3 size={13} /> Editar Claves
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Security Cards Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                {onOpenAnulacionSRI && (
                    <div className="p-6 bg-[#051424]/90 backdrop-blur-2xl rounded-3xl border border-rose-500/30 border-t-white/20 shadow-xl flex flex-col justify-between space-y-4 hover:border-rose-500/50 transition-all group">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between font-mono">
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-md">
                                    <LucideIcons.FileX size={22} />
                                </div>
                                <span className="px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                    Herramienta Directa
                                </span>
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wide group-hover:text-rose-400 transition-colors font-display">
                                    Anulación de Comprobantes SRI
                                </h4>
                                <p className="text-xs text-slate-300 leading-relaxed mt-1">
                                    Carga las credenciales de <strong>{client.name}</strong> (<span className="font-mono text-[#00A896]">{client.ruc}</span>) e inicia el portal oficial de anulación de comprobantes.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onOpenAnulacionSRI}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-2xl text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20 active:scale-95 border border-white/10"
                        >
                            <LucideIcons.FileX size={15} />
                            <span>🔑 Abrir Portal & Anular Facturas</span>
                        </button>
                    </div>
                )}
                <VaultCard 
                    icon={LucideIcons.ScanLine} 
                    label="Certificado RUC" 
                    file={editedClient.rucCertificate} 
                    onUpload={(f) => handleUploadField('rucCertificate', f)} 
                    onDownload={() => editedClient.rucCertificate && onDownloadFile?.(editedClient.rucCertificate)} 
                    onDelete={() => handleDeleteField('rucCertificate')}
                />
                <VaultCard 
                    icon={LucideIcons.FileKey} 
                    label="Firma Electrónica" 
                    file={editedClient.signatureFile} 
                    onUpload={(f) => handleUploadField('signatureFile', f)} 
                    onDownload={() => editedClient.signatureFile && onDownloadFile?.(editedClient.signatureFile)} 
                    onDelete={() => handleDeleteField('signatureFile')}
                />
                
                <VaultCard 
                    icon={LucideIcons.Smartphone} 
                    label="Clave SRI" 
                    isPassword 
                    value={editedClient.sriPassword} 
                    ruc={editedClient.ruc}
                    isEditing={isVaultEditing || isEditing}
                    onChange={(val) => setEditedClient({ ...editedClient, sriPassword: val })}
                />
                
                <VaultCard 
                    icon={LucideIcons.Lock} 
                    label="Clave Firma" 
                    isPassword 
                    value={editedClient.electronicSignaturePassword} 
                    ruc={editedClient.ruc}
                    isEditing={isVaultEditing || isEditing}
                    onChange={(val) => setEditedClient({ ...editedClient, electronicSignaturePassword: val })}
                />

                {(editedClient.rentaRefundResolutionFile || editedClient.elderlyDevolucionIvaResolutionFile) && (
                    <VaultCard 
                        icon={LucideIcons.ShieldCheck} 
                        label={editedClient.rentaRefundResolutionFile ? "Resolución Renta" : "Resolución T.EDAD"} 
                        file={editedClient.rentaRefundResolutionFile || editedClient.elderlyDevolucionIvaResolutionFile} 
                        onUpload={(f) => {
                            if (editedClient.rentaRefundResolutionFile) handleUploadField('rentaRefundResolutionFile', f);
                            else handleUploadField('elderlyDevolucionIvaResolutionFile', f);
                        }} 
                        onDownload={() => {
                            const file = editedClient.rentaRefundResolutionFile || editedClient.elderlyDevolucionIvaResolutionFile;
                            file && onDownloadFile?.(file);
                        }}
                        onDelete={() => {
                            if (editedClient.rentaRefundResolutionFile) handleDeleteField('rentaRefundResolutionFile');
                            else handleDeleteField('elderlyDevolucionIvaResolutionFile');
                        }}
                    />
                )}
            </div>

            {/* Estado y Metadatos de la Firma Electrónica Decodificada (Stitch Telemetry) */}
            {editedClient.signatureFile && (
                <div className={`p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl transition-all duration-500 font-sans shadow-xl ${
                    p12Meta 
                        ? p12Meta.isValid 
                            ? 'bg-[#051424]/90 border-[#00A896]/30 border-t-white/20 text-[#00A896]' 
                            : 'bg-[#051424]/90 border-amber-500/30 border-t-white/20 text-amber-400' 
                        : 'bg-[#051424]/90 border-white/10 border-t-white/20 text-slate-400'
                }`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg ${
                                p12Meta 
                                    ? p12Meta.isValid 
                                        ? 'bg-[#00A896]/15 border-[#00A896]/30 text-[#00A896] shadow-[#00A896]/20' 
                                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                                    : 'bg-white/5 border-white/10 text-slate-500'
                            }`}>
                                <LucideIcons.KeyRound size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-display">
                                    <span>Verificación de Firma Electrónica (.p12)</span>
                                    {p12Meta && (
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                                            p12Meta.isValid 
                                                ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30 shadow-[0_0_8px_rgba(0,168,150,0.2)]' 
                                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                        }`}>
                                            {p12Meta.isValid ? 'Válida / Activa' : 'Caducada / Inactiva'}
                                        </span>
                                    )}
                                </h4>
                                <p className="text-slate-400 text-xs mt-1 font-medium">
                                    {p12Meta 
                                        ? `Certificado emitido por ${p12Meta.issuerName}.` 
                                        : p12Error || 'Esperando contraseña de la firma para descifrar...'
                                    }
                                </p>
                            </div>
                        </div>

                        {p12Meta && (
                            <div className="flex flex-wrap gap-6 text-xs p-4 bg-[#0b1326]/80 rounded-2xl border border-white/10 min-w-[280px]">
                                <div>
                                    <span className="text-slate-400 block uppercase tracking-widest font-mono text-[9px]">Titular</span>
                                    <strong className="text-white font-bold block truncate max-w-[200px]" title={p12Meta.commonName}>
                                        {p12Meta.commonName}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block uppercase tracking-widest font-mono text-[9px]">Cédula / RUC</span>
                                    <strong className="text-[#00A896] font-mono font-bold block">
                                        {p12Meta.ruc || p12Meta.cedula || 'No disponible'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block uppercase tracking-widest font-mono text-[9px]">Caducidad</span>
                                    <strong className={`${p12Meta.isValid ? 'text-[#00A896]' : 'text-rose-400'} font-mono font-bold block`}>
                                        {new Date(p12Meta.notAfter).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </strong>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Contexto de Facturación & Cobro de Emisión al Vuelo (Stitch Obsidian Luxury) ── */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 border-t-white/20 shadow-2xl space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00A896]/20 to-[#2B6AFF]/20 border border-[#00A896]/30 flex items-center justify-center text-[#00A896] shadow-lg shadow-[#00A896]/15">
                            <LucideIcons.Receipt size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg sm:text-xl font-display font-black text-white uppercase tracking-tight">
                                    Contexto de Facturación & Emisión Directa
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                                    (editedClient.billingPlan || editedClient.facturadorConfig)
                                        ? 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30'
                                        : (editedClient.clientType === 'solo_plan' || (editedClient as any).signatureType === 'temporal_10_30dias')
                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                }`}>
                                    {(editedClient.billingPlan || editedClient.facturadorConfig) 
                                        ? '💼 Facturador Pro (Zifact / Pago)' 
                                        : (editedClient.clientType === 'solo_plan' || (editedClient as any).signatureType === 'temporal_10_30dias')
                                        ? '⏳ Solo Firma (10-30 días / Trámites)'
                                        : '🏛️ SRI Gratuito (SRI & Yo en Línea)'}
                                </span>
                            </div>
                            <p className="text-slate-300 text-xs mt-1 font-medium max-w-xl">
                                Gestión de comprobantes emitidos por el despacho para el cliente. Calcula honorarios automáticamente según la escala oficial.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-auto font-mono">
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    const credentialsPayload = {
                                        ruc: client.ruc,
                                        password: client.sriPassword || '',
                                        name: client.name,
                                        timestamp: Date.now()
                                    };
                                    localStorage.setItem('sri_active_credentials', JSON.stringify(credentialsPayload));
                                    if (client.sriPassword) {
                                        navigator.clipboard.writeText(`${client.ruc}\t${client.sriPassword}`);
                                    } else {
                                        navigator.clipboard.writeText(client.ruc);
                                    }
                                    toast.success("Credenciales cargadas para emitir en SRI & Yo.");
                                    window.open("https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/facturacion/factura.jsf", "_blank");
                                } catch (e) {
                                    window.open("https://srienlinea.sri.gob.ec/", "_blank");
                                }
                            }}
                            className="px-4 py-2.5 bg-gradient-to-r from-[#00A896] to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer border border-white/10"
                        >
                            <LucideIcons.ExternalLink size={14} />
                            <span>Abrir SRI & Yo</span>
                        </button>
                    </div>
                </div>

                {/* Calculadora Táctica de Honorarios por Facturación On-Demand */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-[#020b14]/90 p-6 rounded-3xl border border-white/10 font-mono">
                    {/* Contadores */}
                    <div className="md:col-span-7 space-y-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <LucideIcons.Sliders size={14} className="text-[#00A896]" />
                            <span>Comprobantes Emitidos por Despacho este Mes</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Facturas Emitidas */}
                            <div className="p-4 bg-[#051424] rounded-2xl border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Facturas Emitidas</span>
                                    <span className="text-2xl font-bold text-white font-mono mt-1 block">{managedInvoicesCount}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setManagedInvoicesCount(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-sm border border-white/10 transition-all cursor-pointer active:scale-90"
                                    >
                                        -
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setManagedInvoicesCount(prev => prev + 1)}
                                        className="w-8 h-8 rounded-xl bg-[#00A896]/20 hover:bg-[#00A896]/30 text-[#00A896] flex items-center justify-center font-bold text-sm border border-[#00A896]/30 transition-all cursor-pointer active:scale-90"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Anulaciones */}
                            <div className="p-4 bg-[#051424] rounded-2xl border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Anulaciones</span>
                                    <span className="text-2xl font-bold text-rose-400 font-mono mt-1 block">{managedAnulationsCount}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setManagedAnulationsCount(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-sm border border-white/10 transition-all cursor-pointer active:scale-90"
                                    >
                                        -
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setManagedAnulationsCount(prev => prev + 1)}
                                        className="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-sm border border-rose-500/30 transition-all cursor-pointer active:scale-90"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Escala de Precios Informativa */}
                        <div className="flex flex-wrap gap-2 text-[9px] text-slate-400 pt-1">
                            <span className={`px-2 py-0.5 rounded-lg border ${managedInvoicesCount === 1 ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 font-bold' : 'bg-white/5 border-white/5'}`}>1 Factura: $2.00</span>
                            <span className={`px-2 py-0.5 rounded-lg border ${managedInvoicesCount >= 2 && managedInvoicesCount <= 5 ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 font-bold' : 'bg-white/5 border-white/5'}`}>Hasta 5: $5.00</span>
                            <span className={`px-2 py-0.5 rounded-lg border ${managedInvoicesCount >= 6 && managedInvoicesCount <= 15 ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 font-bold' : 'bg-white/5 border-white/5'}`}>Hasta 15: $10.00</span>
                            <span className={`px-2 py-0.5 rounded-lg border ${managedInvoicesCount > 15 ? 'bg-[#00A896]/20 text-[#00A896] border-[#00A896]/40 font-bold' : 'bg-white/5 border-white/5'}`}>Gestión Mensual: $20.00</span>
                        </div>
                    </div>

                    {/* Resumen de Cobro y Acciones */}
                    <div className="md:col-span-5 p-5 bg-[#051424] rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Honorarios Calculados</span>
                            <div className="text-3xl font-black text-[#00A896] font-mono mt-1">
                                ${calculatedEmissionFee.toFixed(2)}
                            </div>
                            <span className="text-[9px] text-slate-400 font-sans block mt-1">
                                {managedInvoicesCount === 0 && managedAnulationsCount === 0 
                                    ? 'Sin emisiones pendientes de cobro' 
                                    : `${managedInvoicesCount} facturas y ${managedAnulationsCount} anulaciones registradas`}
                            </span>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <button
                                type="button"
                                onClick={handleSendInvoicingWhatsApp}
                                disabled={calculatedEmissionFee === 0}
                                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                            >
                                <LucideIcons.MessageSquare size={13} />
                                <span>Cobrar por WhatsApp</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveManagedInvoicing}
                                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10 active:scale-95"
                            >
                                <LucideIcons.Save size={13} />
                                <span>Guardar Registro</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sistema de Facturación Electrónica del Cliente (Bóveda Full-Width) ── */}
            <div className="w-full">
                <FacturadorCard
                    config={editedClient.facturadorConfig || {}}
                    isEditing={isEditing}
                    onChange={(cfg) => setEditedClient(prev => ({ ...prev, facturadorConfig: cfg }))}
                    activationStatus={editedClient.facturadorActivationStatus || 'recursos_listos'}
                    onStatusChange={(status) => {
                        setEditedClient(prev => ({ ...prev, facturadorActivationStatus: status }));
                        if (onUpdateClientDirect) {
                            onUpdateClientDirect({ facturadorActivationStatus: status }, true);
                        }
                    }}
                    onNavigateToFacturadores={() => {
                        window.dispatchEvent(new CustomEvent('app-navigate', { detail: { screen: 'facturadores', searchTerm: editedClient.ruc } }));
                    }}
                    onOpenSalesModal={() => setIsSalesModalOpen(true)}
                />
            </div>

            {/* Modal de Registro de Ventas de Sistemas y Firmas */}
            <SalesComboModal
                isOpen={isSalesModalOpen}
                onClose={() => setIsSalesModalOpen(false)}
                initialClient={editedClient}
            />

            {/* Respaldo para Tramitar Firma Electrónica */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 border-t-white/20 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#2B6AFF]/15 border border-[#2B6AFF]/30 text-[#2B6AFF] flex items-center justify-center shadow-md shadow-[#2B6AFF]/10">
                            <LucideIcons.Camera size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wide font-display">
                                Recursos para Trámites (Firma / Facturadores)
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Cédulas, Selfie, RUC y solicitudes firmadas recopiladas para activar planes y emitir firmas.
                            </p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-[#2B6AFF]/15 text-[#2B6AFF] text-[10px] font-mono font-bold uppercase tracking-wider rounded-full border border-[#2B6AFF]/30 self-start sm:self-auto">
                        Expediente de Recursos
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    <VaultCard 
                        icon={LucideIcons.CreditCard} 
                        label="Cédula (Frontal)" 
                        file={editedClient.idCardFront} 
                        onUpload={(f) => handleUploadField('idCardFront', f)} 
                        onDownload={() => editedClient.idCardFront && onDownloadFile?.(editedClient.idCardFront)} 
                        onDelete={() => handleDeleteField('idCardFront')}
                    />
                    <VaultCard 
                        icon={LucideIcons.CreditCard} 
                        label="Cédula (Reverso)" 
                        file={editedClient.idCardBack} 
                        onUpload={(f) => handleUploadField('idCardBack', f)} 
                        onDownload={() => editedClient.idCardBack && onDownloadFile?.(editedClient.idCardBack)} 
                        onDelete={() => handleDeleteField('idCardBack')}
                    />
                    <VaultCard 
                        icon={LucideIcons.UserCheck} 
                        label="Selfie con Cédula" 
                        file={editedClient.idCardSelfie} 
                        onUpload={(f) => handleUploadField('idCardSelfie', f)} 
                        onDownload={() => editedClient.idCardSelfie && onDownloadFile?.(editedClient.idCardSelfie)} 
                        onDelete={() => handleDeleteField('idCardSelfie')}
                    />
                    <VaultCard 
                        icon={LucideIcons.FileText} 
                        label="RUC PDF Actual" 
                        file={editedClient.rucPdf} 
                        onUpload={(f) => handleUploadField('rucPdf', f)} 
                        onDownload={() => editedClient.rucPdf && onDownloadFile?.(editedClient.rucPdf)} 
                        onDelete={() => handleDeleteField('rucPdf')}
                    />
                    <VaultCard 
                        icon={LucideIcons.FileCheck} 
                        label="Solicitud Ecuafact" 
                        file={editedClient.ecuafactSignedRequest} 
                        onUpload={(f) => handleUploadField('ecuafactSignedRequest', f)} 
                        onDownload={() => editedClient.ecuafactSignedRequest && onDownloadFile?.(editedClient.ecuafactSignedRequest)} 
                        onDelete={() => handleDeleteField('ecuafactSignedRequest')}
                    />
                </div>
            </div>

            {/* Simplificación Zen: Notas Directas en lugar de Facturador complejo */}
            <div className="grid grid-cols-1 gap-8">
                <div className="min-h-[300px]">
                    <ClientNotes clientId={client.id} notes={notes} />
                </div>
            </div>

            {/* Document Repository - Modularized Section (Stitch Obsidian Container) */}
            <div className="bg-[#051424]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 border border-white/10 border-t-white/20 relative overflow-hidden group shadow-2xl transition-all duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
                    <div>
                        <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight flex items-center gap-3">
                            <div className="p-3 bg-[#00A896]/15 rounded-2xl text-[#00A896] border border-[#00A896]/30">
                                <LucideIcons.Store size={24} />
                            </div>
                            Repositorio de Documentos
                        </h3>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-2">Gestión centralizada de archivos y comprobantes protegidos</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-1.5 bg-[#0b1326]/80 rounded-2xl border border-white/10 flex gap-1 shadow-sm backdrop-blur-md font-mono">
                            {(['gallery', 'list', 'table'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setVaultViewMode(mode)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        vaultViewMode === mode 
                                            ? 'bg-gradient-to-r from-[#00A896] to-teal-600 text-white shadow-md shadow-[#00A896]/20 border border-white/10' 
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {mode === 'gallery' ? 'Galería' : mode === 'list' ? 'Lista' : 'Tabla'}
                                </button>
                            ))}
                        </div>
                        <div className="hidden sm:flex px-4 py-2 bg-[#00A896]/15 rounded-2xl text-[10px] font-mono font-bold text-[#00A896] items-center gap-2.5 border border-[#00A896]/30 shadow-sm uppercase tracking-wider">
                            <div className="w-2 h-2 bg-[#00A896] rounded-full animate-pulse shadow-[0_0_6px_#00A896]"></div>
                            {(client.declarations || []).filter(d => d.proof_file).length} Archivos
                        </div>
                    </div>
                </div>

                {vaultViewMode === 'gallery' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <button
                            onClick={() => { setUploadingTarget({ type: 'iva', period: '2024-03' }); proofInputRef.current?.click(); }}
                            className="aspect-square rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:border-[#00A896]/50 hover:bg-[#00A896]/5 transition-all group relative overflow-hidden shadow-sm bg-white/30 dark:bg-white/5 backdrop-blur-sm"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform border border-slate-100 dark:border-white/5 relative z-10 shadow-sm">
                                <LucideIcons.Plus className="text-slate-400 group-hover:text-[#00A896]" size={28} />
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 group-hover:text-[#00A896] tracking-wider relative z-10">Subir Archivo</span>
                        </button>

                        {[...(client.declarations || [])]
                            .filter(d => d.proof_file)
                            .sort((a, b) => b.period.localeCompare(a.period))
                            .map((decl, idx) => (
                                <div 
                                    key={idx} 
                                    className="bg-white/80 dark:bg-[#0b1326]/80 rounded-3xl p-5 border border-slate-200/80 dark:border-white/10 dark:border-t-white/20 hover:border-[#00A896]/40 hover:scale-[1.02] shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden" 
                                    onClick={() => setPreviewItem(decl)}
                                >
                                    <div className="aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 mb-4 flex items-center justify-center relative overflow-hidden group-hover:bg-[#00A896]/5 transition-all duration-500">
                                        <LucideIcons.FileText className="text-slate-300 dark:text-slate-600 group-hover:text-[#00A896] group-hover:scale-110 transition-all duration-500" size={40} />
                                        {decl.proof_file?.metadata?.formType && (
                                            <div className="absolute top-3 left-3 px-2.5 py-0.5 bg-[#00A896] text-white text-[9px] font-mono font-bold rounded-lg uppercase tracking-wider shadow-md shadow-[#00A896]/20">
                                                {decl.proof_file.metadata.formType}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                            <div className="p-3 bg-white dark:bg-[#051424] rounded-full shadow-xl translate-y-2 group-hover:translate-y-0 transition-transform duration-300 border border-white/10">
                                                <LucideIcons.Eye className="text-[#00A896]" size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 relative z-10 font-mono">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-[#00A896] tracking-tight">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{formatPeriodForDisplay(decl.period)}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); decl.proof_file && onDownloadFile?.(decl.proof_file); }}
                                                className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-[#00A896] hover:text-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-200 dark:border-white/10"
                                            >
                                                <LucideIcons.Download size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {vaultViewMode === 'list' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-5 duration-500 font-mono">
                        <button
                            onClick={() => { setUploadingTarget({ type: 'iva', period: '2024-03' }); proofInputRef.current?.click(); }}
                            className="w-full p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center gap-3 hover:border-[#00A896]/50 hover:bg-[#00A896]/5 transition-all group shadow-sm text-xs font-bold uppercase text-slate-400 hover:text-[#00A896] tracking-wider"
                        >
                            <LucideIcons.Plus className="group-hover:scale-110 transition-transform" size={18} />
                            <span>Subir Nuevo Documento al Repositorio</span>
                        </button>

                        {[...(client.declarations || [])]
                            .filter(d => d.proof_file)
                            .sort((a, b) => b.period.localeCompare(a.period))
                            .map((decl, idx) => (
                                <div key={idx} className="bg-white/60 dark:bg-[#0b1326]/60 hover:bg-white dark:hover:bg-[#0b1326] rounded-2xl p-5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between shadow-sm hover:shadow-lg transition-all group cursor-pointer" onClick={() => setPreviewItem(decl)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-[#00A896]/15 transition-colors border border-slate-200/60 dark:border-white/5">
                                            <LucideIcons.FileText className="text-slate-400 group-hover:text-[#00A896]" size={22} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight uppercase font-display">Comprobante de {formatPeriodForDisplay(decl.period)}</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider truncate max-w-[220px]">{decl.proof_file?.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-[#00A896]">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Validado</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); decl.proof_file && onDownloadFile?.(decl.proof_file); }}
                                                className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-[#00A896] hover:text-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-200 dark:border-white/10"
                                            >
                                                <LucideIcons.Download size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setPreviewItem(decl); }}
                                                className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-[#2B6AFF] hover:text-white rounded-xl text-slate-400 transition-all shadow-sm border border-slate-200 dark:border-white/10"
                                            >
                                                <LucideIcons.Eye size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {vaultViewMode === 'table' && (
                    <div className="bg-white/60 dark:bg-[#0b1326]/60 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-right-5 duration-500 font-mono">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/10">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documento</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periodo</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-8">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                                {[...(client.declarations || [])]
                                    .filter(d => d.proof_file)
                                    .sort((a, b) => b.period.localeCompare(a.period))
                                    .map((decl, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setPreviewItem(decl)}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400 group-hover:text-[#00A896] transition-colors">
                                                        <LucideIcons.FileText size={16} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{decl.proof_file?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatPeriodForDisplay(decl.period)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-[#00A896]">${(decl.amount || decl.proof_file?.metadata?.amount || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right pr-8">
                                                <div className="flex justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); decl.proof_file && onDownloadFile?.(decl.proof_file); }}
                                                        className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#00A896] transition-colors shadow-sm"
                                                    >
                                                        <LucideIcons.Download size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setPreviewItem(decl); }}
                                                        className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#2B6AFF] transition-colors shadow-sm"
                                                    >
                                                        <LucideIcons.Eye size={14} />
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
